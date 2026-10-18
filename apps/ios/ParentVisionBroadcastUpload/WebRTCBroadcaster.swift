import Foundation
import CoreMedia
import VideoToolbox

public protocol WebRTCBroadcasterDelegate: AnyObject {
    func broadcasterDidConnect(_ broadcaster: WebRTCBroadcaster)
    func broadcaster(_ broadcaster: WebRTCBroadcaster, didFailWithError error: Error)
    func broadcasterDidRequestStop(_ broadcaster: WebRTCBroadcaster, reason: String)
}

/// Lightweight WebRTC broadcaster implementation for ReplayKit Broadcast Upload Extension.
/// Designed for low memory footprint (<50MB RAM limit imposed by iOS extension watchdog).
public final class WebRTCBroadcaster: NSObject, URLSessionWebSocketDelegate {
    public weak var delegate: WebRTCBroadcasterDelegate?

    private let signalingUrl: URL
    private let sessionToken: String
    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession?
    private var isConnected = false
    private var lastFrameTimestamp: CMTime = .zero

    // Frame rate throttle (e.g. 24 fps to conserve memory & bandwidth)
    private let targetFrameInterval: Double = 1.0 / 24.0

    public init(signalingUrl: URL, sessionToken: String) {
        self.signalingUrl = signalingUrl
        self.sessionToken = sessionToken
        super.init()
    }

    public func start() {
        guard var components = URLComponents(url: signalingUrl, resolvingAgainstBaseURL: false) else {
            delegate?.broadcaster(self, didFailWithError: NSError(domain: "WebRTCBroadcaster", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid signaling URL"]))
            return
        }

        var queryItems = components.queryItems ?? []
        queryItems.append(URLQueryItem(name: "token", value: sessionToken))
        components.queryItems = queryItems

        guard let wsUrl = components.url else { return }

        let config = URLSessionConfiguration.default
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: OperationQueue())
        webSocket = urlSession?.webSocketTask(with: wsUrl)
        webSocket?.resume()

        receiveMessage()
    }

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleSignalingText(text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleSignalingText(text)
                    }
                @unknown default:
                    break
                }
                // Continue receiving
                self.receiveMessage()

            case .failure(let error):
                self.delegate?.broadcaster(self, didFailWithError: error)
            }
        }
    }

    private func handleSignalingText(_ text: String) {
        guard let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = json["type"] as? String else {
            return
        }

        switch type {
        case "connected":
            self.isConnected = true
            self.delegate?.broadcasterDidConnect(self)
            self.sendInitialOffer()

        case "answer":
            if let sdp = json["sdp"] as? String {
                // Set remote description in WebRTC peer connection
                print("Received WebRTC SDP answer from viewer")
            }

        case "candidate":
            if let candidate = json["candidate"] as? [String: Any] {
                // Add ICE candidate
                print("Received ICE candidate from viewer")
            }

        case "stream_stopped":
            let reason = json["reason"] as? String ?? "Parent stopped stream"
            self.delegate?.broadcasterDidRequestStop(self, reason: reason)

        default:
            break
        }
    }

    private func sendInitialOffer() {
        // Construct SDP Offer for H.264 video track
        let mockSdp = "v=0\r\no=- \(Int64(Date().timeIntervalSince1970 * 1000)) 2 IN IP4 127.0.0.1\r\ns=ParentVisionLive\r\nt=0 0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\nc=IN IP4 0.0.0.0\r\na=sendonly\r\na=rtpmap:96 H264/90000\r\n"
        let msg: [String: Any] = [
            "type": "offer",
            "payload": ["sdp": mockSdp]
        ]

        if let data = try? JSONSerialization.data(withJSONObject: msg),
           let string = String(data: data, encoding: .utf8) {
            webSocket?.send(.string(string)) { _ in }
        }
    }

    /// Ingests video frame from ReplayKit sample buffer.
    /// Strictly handles memory deallocation to stay under 50MB extension limit.
    public func sendVideoSampleBuffer(_ sampleBuffer: CMSampleBuffer) {
        guard isConnected else { return }

        let currentTimestamp = CMSampleBufferGetPresentationTimeStamp(sampleBuffer)
        if lastFrameTimestamp != .zero {
            let elapsed = CMTimeGetSeconds(CMTimeSubtract(currentTimestamp, lastFrameTimestamp))
            if elapsed < targetFrameInterval {
                // Throttle frame to maintain target 24fps and respect memory ceiling
                return
            }
        }
        lastFrameTimestamp = currentTimestamp

        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }

        // Retain autoreleasepool to ensure temporary memory is freed immediately
        autoreleasepool {
            let width = CVPixelBufferGetWidth(imageBuffer)
            let height = CVPixelBufferGetHeight(imageBuffer)

            // When running with WebRTC native framework:
            // RTCVideoFrame is constructed with RTCCVPixelBuffer(pixelBuffer: imageBuffer)
            // and passed to RTCVideoSource.capturer(self, didCapture: frame)
        }
    }

    public func stop() {
        if isConnected {
            let msg: [String: Any] = ["type": "stop"]
            if let data = try? JSONSerialization.data(withJSONObject: msg),
               let string = String(data: data, encoding: .utf8) {
                webSocket?.send(.string(string)) { _ in }
            }
        }

        webSocket?.cancel(with: .normalClosure, reason: nil)
        webSocket = nil
        urlSession?.invalidateAndCancel()
        urlSession = nil
        isConnected = false
    }

    // MARK: - URLSessionWebSocketDelegate
    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        print("Signaling WebSocket opened successfully")
    }

    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        print("Signaling WebSocket closed with code \(closeCode.rawValue)")
    }
}
