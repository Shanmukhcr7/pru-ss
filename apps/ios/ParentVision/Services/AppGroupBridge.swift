import Foundation

/// Bridge for sharing authentication and session parameters between the main iOS application
/// and the ReplayKit Broadcast Upload Extension using an App Group container.
public final class AppGroupBridge {
    public static let shared = AppGroupBridge()
    public static let appGroupIdentifier = "group.com.parentvision.app"

    private let defaults: UserDefaults?

    private init() {
        self.defaults = UserDefaults(suiteName: AppGroupBridge.appGroupIdentifier)
    }

    // MARK: - Keys
    private enum Keys {
        static let backendUrl = "pv_backend_url"
        static let deviceId = "pv_device_id"
        static let deviceToken = "pv_device_token"
        static let activeSessionId = "pv_active_session_id"
        static let broadcasterToken = "pv_broadcaster_token"
        static let iceServers = "pv_ice_servers_json"
        static let isBroadcasting = "pv_is_broadcasting"
        static let lastBroadcastError = "pv_last_broadcast_error"
    }

    // MARK: - Persistent Properties
    public var backendUrl: String {
        get { defaults?.string(forKey: Keys.backendUrl) ?? "http://localhost:4000" }
        set { defaults?.set(newValue, forKey: Keys.backendUrl) }
    }

    public var deviceId: String? {
        get { defaults?.string(forKey: Keys.deviceId) }
        set { defaults?.set(newValue, forKey: Keys.deviceId) }
    }

    public var deviceToken: String? {
        get { defaults?.string(forKey: Keys.deviceToken) }
        set { defaults?.set(newValue, forKey: Keys.deviceToken) }
    }

    public var activeSessionId: String? {
        get { defaults?.string(forKey: Keys.activeSessionId) }
        set { defaults?.set(newValue, forKey: Keys.activeSessionId) }
    }

    public var broadcasterToken: String? {
        get { defaults?.string(forKey: Keys.broadcasterToken) }
        set { defaults?.set(newValue, forKey: Keys.broadcasterToken) }
    }

    public var iceServersJson: String? {
        get { defaults?.string(forKey: Keys.iceServers) }
        set { defaults?.set(newValue, forKey: Keys.iceServers) }
    }

    public var isBroadcasting: Bool {
        get { defaults?.bool(forKey: Keys.isBroadcasting) ?? false }
        set { defaults?.set(newValue, forKey: Keys.isBroadcasting) }
    }

    public var lastBroadcastError: String? {
        get { defaults?.string(forKey: Keys.lastBroadcastError) }
        set { defaults?.set(newValue, forKey: Keys.lastBroadcastError) }
    }

    public func clearBroadcastSession() {
        defaults?.removeObject(forKey: Keys.activeSessionId)
        defaults?.removeObject(forKey: Keys.broadcasterToken)
        defaults?.set(false, forKey: Keys.isBroadcasting)
    }
}
