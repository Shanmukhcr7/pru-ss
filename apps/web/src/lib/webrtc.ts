export interface WebRTCViewerOptions {
  signalingUrl: string;
  viewerToken: string;
  iceServers: RTCIceServer[];
  videoElement: HTMLVideoElement;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
  onStats?: (stats: { fps: number; rttMs: number; bytesReceived: number; resolution: string }) => void;
  onBinaryFrame?: (data: Blob | ArrayBuffer) => void;
  onError?: (error: Error) => void;
  onStreamStopped?: (reason: string) => void;
}

export class WebRTCViewer {
  private pc: RTCPeerConnection | null = null;
  private ws: WebSocket | null = null;
  private statsInterval: any = null;
  private prevBytes = 0;
  private prevTimestamp = 0;

  constructor(private options: WebRTCViewerOptions) {}

  public async start(): Promise<void> {
    try {
      // 1. Initialize Peer Connection
      this.pc = new RTCPeerConnection({
        iceServers: this.options.iceServers,
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
      });

      // We only receive video from child screen
      this.pc.addTransceiver('video', { direction: 'recvonly' });

      this.pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.options.videoElement.srcObject = event.streams[0];
          this.options.videoElement.play().catch((err) => {
            console.warn('Autoplay prevented, requires user click:', err);
          });
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (this.pc && this.options.onConnectionStateChange) {
          this.options.onConnectionStateChange(this.pc.connectionState);
        }
      };

      this.pc.onicecandidate = (event) => {
        if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'candidate',
              payload: { candidate: event.candidate },
            })
          );
        }
      };

      // 2. Connect to WebSocket Signaling
      const wsUrl = `${this.options.signalingUrl}?token=${this.options.viewerToken}`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onmessage = async (event) => {
        try {
          if (event.data instanceof Blob || event.data instanceof ArrayBuffer) {
            this.options.onBinaryFrame?.(event.data);
            return;
          }
          if (typeof event.data === 'string' && !event.data.startsWith('{')) {
            return;
          }
          const msg = JSON.parse(event.data);
          await this.handleSignalingMessage(msg);
        } catch (err: any) {
          this.options.onError?.(err);
        }
      };

      this.ws.onerror = (err) => {
        this.options.onError?.(new Error('WebSocket signaling connection failed'));
      };

      this.ws.onclose = () => {
        this.options.onConnectionStateChange?.('closed');
      };

      this.startStatsMonitoring();
    } catch (err: any) {
      this.options.onError?.(err);
      throw err;
    }
  }

  private async handleSignalingMessage(msg: any) {
    if (!this.pc) return;

    switch (msg.type) {
      case 'offer':
        await this.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: msg.sdp }));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(
            JSON.stringify({
              type: 'answer',
              payload: { sdp: answer.sdp },
            })
          );
        }
        break;

      case 'candidate':
        if (msg.candidate) {
          await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
        break;

      case 'stream_stopped':
        this.options.onStreamStopped?.(msg.reason || 'Stream ended');
        this.stop();
        break;

      case 'peer_disconnected':
        this.options.onStreamStopped?.('Child device disconnected from broadcast');
        break;
    }
  }

  private startStatsMonitoring() {
    this.statsInterval = setInterval(async () => {
      if (!this.pc || this.pc.connectionState !== 'connected') return;

      try {
        const stats = await this.pc.getStats();
        let fps = 0;
        let rttMs = 0;
        let bytesReceived = 0;
        let resolution = '1080x1920';

        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            fps = report.framesPerSecond || 0;
            bytesReceived = report.bytesReceived || 0;
            if (report.frameWidth && report.frameHeight) {
              resolution = `${report.frameWidth}x${report.frameHeight}`;
            }
          }
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            rttMs = Math.round((report.currentRoundTripTime || 0) * 1000);
          }
        });

        this.options.onStats?.({ fps, rttMs, bytesReceived, resolution });
      } catch {}
    }, 2000);
  }

  public stop(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'stop' }));
      this.ws.close();
      this.ws = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.options.videoElement) {
      this.options.videoElement.srcObject = null;
    }
  }
}
