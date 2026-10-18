import SwiftUI

public struct ScreenTimeControlsView: View {
    @ObservedObject var screenTime = ScreenTimeManager.shared
    @State private var blockAdultWebsites = true
    @State private var blockSocialMedia = false
    @State private var enableBedtimeDowntime = true

    public var body: some View {
        Form {
            Section("Apple FamilyControls Authorization") {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: screenTime.isAuthorized ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                            .foregroundColor(screenTime.isAuthorized ? .green : .orange)

                        Text(screenTime.isAuthorized ? "Family Controls Approved" : "Authorization Required")
                            .font(.headline)
                    }

                    Text("Apple requires explicit parent authorization on this device to monitor screen time and enforce app shields.")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    if !screenTime.isAuthorized {
                        Button {
                            Task {
                                await screenTime.requestAuthorization()
                            }
                        } label: {
                            Text("Request Screen Time Permission")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(Color.indigo)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }
                        .padding(.top, 4)
                    }

                    if let err = screenTime.authorizationError {
                        Text(err)
                            .font(.caption2)
                            .foregroundColor(.red)
                    }
                }
                .padding(.vertical, 4)
            }

            if screenTime.isAuthorized {
                Section("Protective Shields (ManagedSettings)") {
                    Toggle("Filter Adult Web Content", isOn: $blockAdultWebsites)
                        .onChange(of: blockAdultWebsites) { _ in
                            applySettings()
                        }

                    Toggle("Block Social Networking Apps", isOn: $blockSocialMedia)
                        .onChange(of: blockSocialMedia) { _ in
                            applySettings()
                        }
                }

                Section("Bedtime Downtime (DeviceActivity)") {
                    Toggle("Enforce Night Downtime (9PM - 7AM)", isOn: $enableBedtimeDowntime)
                        .onChange(of: enableBedtimeDowntime) { enabled in
                            if enabled {
                                screenTime.setDowntimeSchedule(startHour: 21, startMinute: 0, endHour: 7, endMinute: 0)
                            } else {
                                screenTime.removeAllRestrictions()
                            }
                        }
                }
            }

            Section("Apple Privacy Protection Notice") {
                Text("Third-party applications cannot secretly inspect keystrokes, incognito URLs, or unvetted private messages. iOS processes shields and reports out-of-process to protect child privacy.")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .navigationTitle("Screen Time Controls")
    }

    private func applySettings() {
        screenTime.applyCategoryShields(
            blockSocial: blockSocialMedia,
            blockAdultWebsites: blockAdultWebsites
        )
    }
}
