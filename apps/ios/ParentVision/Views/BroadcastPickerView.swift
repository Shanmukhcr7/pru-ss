import SwiftUI
import ReplayKit

/// SwiftUI UIViewRepresentable wrapper for Apple's RPSystemBroadcastPickerView.
///
/// NOTE ON APPLE REPLAYKIT REQUIREMENTS:
/// 1. Broadcast must be explicitly launched by user interaction with RPSystemBroadcastPickerView.
/// 2. The system displays a confirmation alert with "Start Broadcast".
/// 3. While active, the iOS status bar and Dynamic Island display an unmistakable red recording indicator.
public struct BroadcastPickerView: UIViewRepresentable {
    public let preferredExtension: String

    public init(preferredExtension: String = "com.parentvision.app.broadcast") {
        self.preferredExtension = preferredExtension
    }

    public func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let picker = RPSystemBroadcastPickerView(frame: CGRect(x: 0, y: 0, width: 60, height: 60))
        picker.preferredExtension = preferredExtension
        picker.showsMicrophoneButton = false

        // Customise the system button appearance if desired
        for subview in picker.subviews {
            if let button = subview as? UIButton {
                button.tintColor = UIColor.systemIndigo
            }
        }

        return picker
    }

    public func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {
        uiView.preferredExtension = preferredExtension
    }
}
