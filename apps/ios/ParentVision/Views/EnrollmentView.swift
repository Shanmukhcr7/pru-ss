import SwiftUI

public struct EnrollmentView: View {
    @ObservedObject var appState = AppState.shared
    @State private var pairingCode: String = ""
    @State private var deviceName: String = UIDevice.current.name
    @State private var backendUrl: String = AppGroupBridge.shared.backendUrl
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil
    @State private var showOnboarding: Bool = false

    public var body: some View {
        NavigationStack {
            Form {
                Section {
                    VStack(alignment: .center, spacing: 12) {
                        Image(systemName: "iphone.badge.play")
                            .resizable()
                            .scaledToFit()
                            .frame(width: 50, height: 50)
                            .foregroundColor(.indigo)

                        Text("Enroll This iPhone")
                            .font(.headline)

                        Text("Enter the 6-digit authorization code displayed on your parent's website dashboard.")
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 8)
                }

                Section("Pairing Information") {
                    HStack {
                        Text("Pairing Code")
                            .font(.subheadline)
                        Spacer()
                        TextField("6 digits", text: $pairingCode)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .font(.system(.body, design: .monospaced))
                            .fontWeight(.bold)
                            .onChange(of: pairingCode) { newValue in
                                if newValue.count > 6 {
                                    pairingCode = String(newValue.prefix(6))
                                }
                            }
                    }

                    HStack {
                        Text("Device Name")
                            .font(.subheadline)
                        Spacer()
                        TextField("e.g. Leo's iPhone", text: $deviceName)
                            .multilineTextAlignment(.trailing)
                    }
                }

                Section("Server Endpoint") {
                    TextField("https://api.yourdomain.com", text: $backendUrl)
                        .keyboardType(.URL)
                        .autocapitalization(.none)
                        .disableAutocorrection(true)
                        .font(.footnote)
                        .onChange(of: backendUrl) { newValue in
                            AppGroupBridge.shared.backendUrl = newValue
                        }
                }

                if let error = errorMessage {
                    Section {
                        Text(error)
                            .font(.footnote)
                            .foregroundColor(.red)
                    }
                }

                Section {
                    Button {
                        enroll()
                    } label: {
                        if isLoading {
                            HStack {
                                Spacer()
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                Spacer()
                            }
                        } else {
                            Text("Pair & Authorize Device")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .foregroundColor(.white)
                        }
                    }
                    .listRowBackground(Color.indigo)
                    .disabled(pairingCode.count != 6 || isLoading)
                }
            }
            .navigationTitle("Device Setup")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        showOnboarding = true
                    } label: {
                        Image(systemName: "questionmark.circle")
                    }
                }
            }
            .sheet(isPresented: $showOnboarding) {
                OnboardingView(isPresented: $showOnboarding)
            }
        }
    }

    private func enroll() {
        guard pairingCode.count == 6 else { return }
        isLoading = true
        errorMessage = nil

        AppGroupBridge.shared.backendUrl = backendUrl

        Task {
            do {
                let res = try await APIClient.shared.enrollDevice(
                    pairingCode: pairingCode,
                    deviceName: deviceName
                )

                await MainActor.run {
                    appState.setEnrolled(
                        deviceId: res.device.id,
                        deviceToken: res.deviceToken,
                        name: res.device.name
                    )
                    isLoading = false
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = error.localizedDescription
                    self.isLoading = false
                }
            }
        }
    }
}
