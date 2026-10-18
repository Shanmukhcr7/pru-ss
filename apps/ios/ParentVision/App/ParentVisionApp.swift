import SwiftUI

@main
struct ParentVisionApp: App {
    @StateObject private var appState = AppState.shared
    @StateObject private var screenTime = ScreenTimeManager.shared

    var body: some Scene {
        WindowGroup {
            Group {
                if appState.isEnrolled {
                    DashboardView()
                } else {
                    EnrollmentView()
                }
            }
            .tint(.indigo)
        }
    }
}
