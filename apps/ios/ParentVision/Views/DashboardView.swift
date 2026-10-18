import SwiftUI

public struct DashboardView: View {
    @ObservedObject var appState = AppState.shared
    @ObservedObject var screenTime = ScreenTimeManager.shared
    @State private var isPreparingBroadcast: Bool = false
    @State private var broadcastStatusMessage: String = "Ready for parental supervision"

    public var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Status Header Card
                    VStack(alignment: .leading, spacing: 14) {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(appState.deviceName)
                                    .font(.title2)
                                    .fontWeight(.bold)
                                Text("Enrolled & Supervised")
                                    .font(.caption)
                                    .foregroundColor(.green)
                            }
                            Spacer()
                            HStack(spacing: 4) {
                                Image(systemName: appState.isCharging ? "battery.100.bolt" : "battery.75")
                                    .foregroundColor(appState.isCharging ? .green : .secondary)
                                Text("\(appState.batteryLevel)%")
                                    .font(.subheadline)
                                    .fontWeight(.semibold)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Color(.systemGray6))
                            .cornerRadius(10)
                        }

                        Divider()

                        HStack {
                            Circle()
                                .fill(appState.isBroadcasting ? Color.red : Color.green)
                                .frame(width: 8, height: 8)
                            Text(appState.isBroadcasting ? "Screen Broadcasting Active" : "Online & Connected")
                                .font(.footnote)
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("ID: \(appState.deviceId?.prefix(8) ?? "...")")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(18)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(20)

                    // Live Screen Broadcast Action Card
                    VStack(spacing: 16) {
                        HStack {
                            Image(systemName: "video.fill")
                                .font(.title3)
                                .foregroundColor(.red)
                            Text("Live Screen Broadcast")
                                .font(.headline)
                            Spacer()
                            if appState.isBroadcasting {
                                Text("LIVE")
                                    .font(.caption2)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(Color.red.opacity(0.15))
                                    .foregroundColor(.red)
                                    .cornerRadius(6)
                            }
                        }

                        Text("To allow your parent to view your screen in the authenticated portal, tap the broadcast button below and confirm via the system alert.")
                            .font(.footnote)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.leading)

                        // ReplayKit Broadcast Picker
                        HStack {
                            Spacer()
                            VStack(spacing: 8) {
                                BroadcastPickerView(preferredExtension: "com.parentvision.ParentVision.BroadcastUpload")
                                    .frame(width: 64, height: 64)
                                    .background(Color(.tertiarySystemBackground))
                                    .clipShape(Circle())
                                    .shadow(color: Color.black.opacity(0.08), radius: 6, x: 0, y: 3)

                                Text("Tap to Broadcast")
                                    .font(.caption2)
                                    .fontWeight(.medium)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 4)

                        HStack(alignment: .top, spacing: 8) {
                            Image(systemName: "info.circle")
                                .font(.caption)
                                .foregroundColor(.indigo)
                            Text("Apple ReplayKit displays a system red pill in the Dynamic Island while active. You can stop broadcasting at any time.")
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding(18)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(20)

                    // Screen Time Quick Controls Card
                    NavigationLink {
                        ScreenTimeControlsView()
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 4) {
                                HStack {
                                    Image(systemName: "hourglass")
                                        .foregroundColor(.indigo)
                                    Text("Screen Time Safeguards")
                                        .font(.headline)
                                        .foregroundColor(.primary)
                                }
                                Text(screenTime.isAuthorized ? "Active shields & schedule limits configured" : "Tap to authorize Screen Time")
                                    .font(.footnote)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundColor(.secondary)
                        }
                        .padding(18)
                        .background(Color(.secondarySystemBackground))
                        .cornerRadius(20)
                    }

                    // Unenroll Button
                    Button(role: .destructive) {
                        appState.unenroll()
                    } label: {
                        Text("Unenroll This Device")
                            .font(.footnote)
                            .fontWeight(.medium)
                    }
                    .padding(.top, 10)
                }
                .padding()
            }
            .navigationTitle("ParentVision")
            .refreshable {
                appState.updateBatteryInfo()
                if let devId = appState.deviceId {
                    _ = try? await APIClient.shared.fetchActiveSession(deviceId: devId)
                }
            }
        }
    }
}
