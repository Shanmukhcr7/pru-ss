import Foundation
import UIKit
import Combine

@MainActor
public final class AppState: ObservableObject {
    public static let shared = AppState()

    @Published public var isEnrolled: Bool = false
    @Published public var deviceId: String? = nil
    @Published public var deviceName: String = "My iPhone"
    @Published public var isBroadcasting: Bool = false
    @Published public var batteryLevel: Int = 100
    @Published public var isCharging: Bool = false
    @Published public var backendUrl: String = "http://localhost:4000"

    private var heartbeatTimer: Timer?
    private var cancellables = Set<AnyCancellable>()

    private init() {
        self.backendUrl = AppGroupBridge.shared.backendUrl
        UIDevice.current.isBatteryMonitoringEnabled = true
        checkEnrollmentStatus()
        updateBatteryInfo()
        startHeartbeat()
    }

    public func checkEnrollmentStatus() {
        if let token = KeychainService.shared.loadString(key: "device_token"),
           let devId = KeychainService.shared.loadString(key: "device_id") {
            self.isEnrolled = true
            self.deviceId = devId
            AppGroupBridge.shared.deviceId = devId
            AppGroupBridge.shared.deviceToken = token
        } else {
            self.isEnrolled = false
            self.deviceId = nil
        }
        self.isBroadcasting = AppGroupBridge.shared.isBroadcasting
    }

    public func setEnrolled(deviceId: String, deviceToken: String, name: String) {
        _ = KeychainService.shared.saveString(key: "device_token", value: deviceToken)
        _ = KeychainService.shared.saveString(key: "device_id", value: deviceId)
        AppGroupBridge.shared.deviceId = deviceId
        AppGroupBridge.shared.deviceToken = deviceToken
        self.deviceId = deviceId
        self.deviceName = name
        self.isEnrolled = true
    }

    public func unenroll() {
        KeychainService.shared.clearAll()
        AppGroupBridge.shared.deviceId = nil
        AppGroupBridge.shared.deviceToken = nil
        AppGroupBridge.shared.clearBroadcastSession()
        self.isEnrolled = false
        self.deviceId = nil
    }

    public func updateBatteryInfo() {
        let level = UIDevice.current.batteryLevel
        self.batteryLevel = level >= 0 ? Int(level * 100) : 100
        let state = UIDevice.current.batteryState
        self.isCharging = (state == .charging || state == .full)
    }

    public func startHeartbeat() {
        heartbeatTimer?.invalidate()
        heartbeatTimer = Timer.scheduledTimer(withTimeInterval: 30.0, repeats: true) { [weak self] _ in
            guard let self = self, self.isEnrolled else { return }
            Task { @MainActor in
                self.updateBatteryInfo()
                self.isBroadcasting = AppGroupBridge.shared.isBroadcasting
                let status = self.isBroadcasting ? "broadcasting" : "online"
                do {
                    try await APIClient.shared.sendHeartbeat(
                        batteryLevel: self.batteryLevel,
                        isCharging: self.isCharging,
                        status: status
                    )
                } catch {
                    if case APIError.unauthorized = error {
                        self.unenroll()
                    }
                }
            }
        }
    }
}
