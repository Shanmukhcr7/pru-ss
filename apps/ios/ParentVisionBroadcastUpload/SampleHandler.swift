import ReplayKit

/// Primary broadcast sample handler for ParentVision ReplayKit Broadcast Upload Extension.
///
/// NOTE ON APPLE MEMORY & PRIVACY RULES:
/// 1. Broadcast extensions have a hard 50MB memory ceiling.
/// 2. Protected DRM content and secure system inputs are masked out automatically by iOS.
/// 3. Zero silent capture: User must initiate via system broadcast picker.
public class SampleHandler: RPBroadcastSampleHandler, WebRTCBroadcasterDelegate {
    private var broadcaster: WebRTCBroadcaster?
    private let appGroup = AppGroupBridge.shared

    public override func broadcastStarted(withSetupInfo setupInfo: [String : NSObject]?) {
        // Resolve backend URL (with remote fallback if App Group container is sandboxed on free Apple ID)
        var wsBase = appGroup.backendUrl
        if wsBase == "http://localhost:4000" || wsBase.isEmpty {
            wsBase = "https://she-herself-virtually-earrings.trycloudflare.com"
        }

        // Convert backend HTTP URL to WebSocket Signaling URL
        if wsBase.starts(with: "https://") {
            wsBase = "wss://" + wsBase.dropFirst(8)
        } else if wsBase.starts(with: "http://") {
            wsBase = "ws://" + wsBase.dropFirst(7)
        }

        guard let signalingUrl = URL(string: "\(wsBase)/ws/signaling") else {
            let error = NSError(
                domain: "com.parentvision.broadcast",
                code: 400,
                userInfo: [NSLocalizedDescriptionKey: "Invalid server signaling address."]
            )
            finishBroadcastWithError(error)
            return
        }

        let sessionToken = appGroup.broadcasterToken ?? appGroup.deviceToken ?? "broadcaster"
        let broadcaster = WebRTCBroadcaster(signalingUrl: signalingUrl, sessionToken: sessionToken)
        broadcaster.delegate = self
        self.broadcaster = broadcaster
        broadcaster.start()

        appGroup.isBroadcasting = true
    }

    public override func broadcastPaused() {
        // Broadcaster pause event
    }

    public override func broadcastResumed() {
        // Broadcaster resume event
    }

    public override func broadcastFinished() {
        broadcaster?.stop()
        broadcaster = nil
        appGroup.isBroadcasting = false
        appGroup.clearBroadcastSession()
    }

    public override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        switch sampleBufferType {
        case .video:
            broadcaster?.sendVideoSampleBuffer(sampleBuffer)
        case .audioApp:
            // App audio samples
            break
        case .audioMic:
            // Mic audio samples (disabled)
            break
        @unknown default:
            break
        }
    }

    // MARK: - WebRTCBroadcasterDelegate
    public func broadcasterDidConnect(_ broadcaster: WebRTCBroadcaster) {
        print("Broadcast extension connected to signaling server")
    }

    public func broadcaster(_ broadcaster: WebRTCBroadcaster, didFailWithError error: Error) {
        let nsError = NSError(
            domain: "com.parentvision.broadcast",
            code: 500,
            userInfo: [NSLocalizedDescriptionKey: "Streaming connection failed: \(error.localizedDescription)"]
        )
        finishBroadcastWithError(nsError)
    }

    public func broadcasterDidRequestStop(_ broadcaster: WebRTCBroadcaster, reason: String) {
        let nsError = NSError(
            domain: "com.parentvision.broadcast",
            code: 200,
            userInfo: [NSLocalizedDescriptionKey: "Live screen broadcast ended by parent: \(reason)"]
        )
        finishBroadcastWithError(nsError)
    }
}
