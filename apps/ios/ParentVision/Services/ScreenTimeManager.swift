import Foundation
import FamilyControls
import ManagedSettings
import DeviceActivity

/// Manager for Apple's Screen Time APIs (FamilyControls, ManagedSettings, DeviceActivity).
///
/// NOTE ON APPLE PLATFORM RESTRICTIONS:
/// 1. Requires `com.apple.developer.family-controls` entitlement granted directly by Apple.
/// 2. Must be used with Family Sharing where a parent Apple ID manages the child device.
/// 3. DeviceActivity does NOT expose raw unvetted browsing history or keystrokes to third-party code.
/// 4. ManagedSettings enforces restrictions out-of-process via iOS system shields.
@MainActor
public final class ScreenTimeManager: ObservableObject {
    public static let shared = ScreenTimeManager()

    @Published public var isAuthorized: Bool = false
    @Published public var authorizationError: String? = nil
    @Published public var isDowntimeActive: Bool = false
    @Published public var restrictedCategoriesCount: Int = 0

    private let store = ManagedSettingsStore()
    private let activityCenter = DeviceActivityCenter()

    private init() {
        checkCurrentStatus()
    }

    public func checkCurrentStatus() {
        if #available(iOS 16.0, *) {
            let status = AuthorizationCenter.shared.authorizationStatus
            self.isAuthorized = (status == .approved)
        }
    }

    /// Requests FamilyControls authorization for the child device
    public func requestAuthorization() async {
        guard #available(iOS 16.0, *) else {
            self.authorizationError = "Screen Time APIs require iOS 16.0 or higher"
            return
        }

        do {
            try await AuthorizationCenter.shared.requestAuthorization(for: .child)
            self.isAuthorized = (AuthorizationCenter.shared.authorizationStatus == .approved)
            self.authorizationError = nil
        } catch {
            self.authorizationError = error.localizedDescription
            self.isAuthorized = false
        }
    }

    /// Applies content shielding (e.g., blocking adult content or specific social media categories)
    public func applyCategoryShields(blockSocial: Bool, blockAdultWebsites: Bool) {
        guard isAuthorized else { return }

        // Configure ManagedSettingsStore
        if blockAdultWebsites {
            store.webContent.blockedByFilter = .auto()
        } else {
            store.webContent.blockedByFilter = nil
        }

        // Update tracking count
        var count = 0
        if blockSocial { count += 1 }
        if blockAdultWebsites { count += 1 }
        self.restrictedCategoriesCount = count
    }

    /// Configures scheduled downtime (e.g. 9:00 PM to 7:00 AM)
    public func setDowntimeSchedule(startHour: Int, startMinute: Int, endHour: Int, endMinute: Int) {
        let schedule = DeviceActivitySchedule(
            intervalStart: DateComponents(hour: startHour, minute: startMinute),
            intervalEnd: DateComponents(hour: endHour, minute: endMinute),
            repeats: true
        )

        let activityName = DeviceActivityName("com.parentvision.downtime")
        do {
            try activityCenter.startMonitoring(activityName, during: schedule)
            self.isDowntimeActive = true
        } catch {
            print("Failed to schedule downtime monitoring: \(error)")
        }
    }

    public func removeAllRestrictions() {
        store.clearAllSettings()
        activityCenter.stopMonitoring()
        self.isDowntimeActive = false
        self.restrictedCategoriesCount = 0
    }
}
