"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, Device, BroadcastSessionInfo } from '../../../lib/api';
import { WebRTCViewer } from '../../../lib/webrtc';
import {
  Radio,
  Square,
  ArrowLeft,
  Shield,
  Activity,
  Wifi,
  AlertTriangle,
  Lock,
  RefreshCw,
  Info,
} from 'lucide-react';

export default function LiveScreenPage() {
  const params = useParams();
  const router = useRouter();
  const deviceId = params.deviceId as string;

  const [device, setDevice] = useState<Device | null>(null);
  const [sessionInfo, setSessionInfo] = useState<BroadcastSessionInfo | null>(null);
  const [connectionState, setConnectionState] = useState<string>('initializing');
  const [stats, setStats] = useState<{ fps: number; rttMs: number; bytesReceived: number; resolution: string }>({
    fps: 0,
    rttMs: 0,
    bytesReceived: 0,
    resolution: 'Unknown',
  });
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [hasReceivedFrames, setHasReceivedFrames] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<WebRTCViewer | null>(null);

  useEffect(() => {
    async function loadDeviceAndInit() {
      try {
        setLoading(true);
        const { device: dev } = await api.getDevice(deviceId);
        setDevice(dev);

        // Request live broadcast authorization
        const sess = await api.requestBroadcastSession(deviceId);
        setSessionInfo(sess);

        let signalingUrl: string;
        if (process.env.NEXT_PUBLIC_WS_URL) {
          signalingUrl = process.env.NEXT_PUBLIC_WS_URL;
        } else if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
          signalingUrl = 'wss://she-herself-virtually-earrings.trycloudflare.com/ws/signaling';
        } else {
          const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
          signalingUrl = `ws://${host}:4000/ws/signaling`;
        }

        if (videoRef.current) {
          const viewer = new WebRTCViewer({
            signalingUrl,
            viewerToken: sess.viewerToken,
            iceServers: [sess.iceServers],
            videoElement: videoRef.current,
            onConnectionStateChange: (state) => setConnectionState(state),
            onStats: (s) => setStats(s),
            onBinaryFrame: (data) => {
              setConnectionState('connected');
              setHasReceivedFrames(true);
              const blob = data instanceof Blob ? data : new Blob([data], { type: 'image/jpeg' });
              createImageBitmap(blob)
                .then((bitmap) => {
                  const canvas = canvasRef.current;
                  if (canvas) {
                    if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                      canvas.width = bitmap.width;
                      canvas.height = bitmap.height;
                      setStats((prev) => ({
                        ...prev,
                        resolution: `${bitmap.width}x${bitmap.height}`,
                      }));
                    }
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(bitmap, 0, 0);
                  }
                  bitmap.close();
                })
                .catch(() => {});
            },
            onError: (err) => setError(err.message),
            onStreamStopped: (reason) => {
              setConnectionState('stopped');
              setHasReceivedFrames(false);
              setError(reason || 'Broadcast was stopped.');
            },
          });

          viewerRef.current = viewer;
          await viewer.start();
        }
      } catch (err: any) {
        setError(err.message || 'Failed to initialize live broadcast session');
      } finally {
        setLoading(false);
      }
    }

    if (deviceId) {
      loadDeviceAndInit();
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.stop();
        viewerRef.current = null;
      }
    };
  }, [deviceId]);

  const handleStopStream = async () => {
    if (sessionInfo) {
      try {
        await api.terminateBroadcastSession(sessionInfo.sessionId);
      } catch {}
    }
    if (viewerRef.current) {
      viewerRef.current.stop();
      viewerRef.current = null;
    }
    setConnectionState('stopped');
  };

  const handleRevokeDevice = async () => {
    if (!confirm('Are you sure you want to permanently revoke this device? Broadcasting will immediately cease.')) {
      return;
    }
    try {
      await api.revokeDevice(deviceId);
      router.push('/devices');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-white tracking-tight">
                Live Screen: {device ? device.name : 'iPhone'}
              </h1>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 ${
                  connectionState === 'connected'
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                    : connectionState === 'connecting'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current"></span>
                <span>{connectionState}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Encrypted WebRTC Stream (DTLS-SRTP) &bull; Session {sessionInfo?.sessionId.slice(0, 8) || '...'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            onClick={handleStopStream}
            disabled={connectionState === 'stopped' || connectionState === 'closed'}
            className="flex items-center space-x-2 py-2 px-4 rounded-xl font-medium text-xs bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30 transition-all disabled:opacity-40"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>Stop Broadcast</span>
          </button>
          <button
            onClick={handleRevokeDevice}
            className="py-2 px-3 rounded-xl font-medium text-xs bg-slate-800 hover:bg-red-950/60 hover:text-red-400 text-slate-300 border border-slate-700 transition-colors"
          >
            Revoke Access
          </button>
        </div>
      </div>

      {/* Main Stream Area & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Stream Video Container (3 cols) */}
        <div className="lg:col-span-3">
          <div className="relative aspect-[9/16] max-h-[75vh] w-auto mx-auto rounded-3xl overflow-hidden bg-black border-4 border-slate-800 shadow-2xl flex items-center justify-center">
            {/* Live Canvas for Direct Frame Stream */}
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-contain ${hasReceivedFrames ? 'block' : 'hidden'}`}
            />

            {/* Live Video Element (WebRTC fallback) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain ${hasReceivedFrames ? 'hidden' : 'block'}`}
            />

            {/* Overlay if connecting or waiting for iPhone broadcast */}
            {connectionState !== 'connected' && !hasReceivedFrames && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-4">
                {connectionState === 'connecting' || connectionState === 'initializing' ? (
                  <>
                    <div className="p-4 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 animate-pulse">
                      <Radio className="w-10 h-10 animate-bounce" />
                    </div>
                    <div className="max-w-md">
                      <h3 className="text-lg font-bold text-white">Awaiting Child Broadcast Initiation</h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        To protect privacy according to Apple guidelines, screen broadcasting must be initiated directly on the iPhone.
                      </p>
                      <div className="mt-4 p-3 rounded-xl bg-slate-900 border border-slate-800 text-left text-xs text-slate-300 space-y-1">
                        <p className="font-semibold text-indigo-400">On the child&apos;s iPhone:</p>
                        <p>1. Open the <strong>ParentVision</strong> app</p>
                        <p>2. Tap <strong>Start Screen Broadcast</strong></p>
                        <p>3. Select <strong>ParentVision Broadcast Extension</strong> and confirm</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-12 h-12 text-slate-500" />
                    <h3 className="text-base font-semibold text-white">Broadcast Inactive</h3>
                    <p className="text-xs text-slate-400 max-w-xs">{error || 'Session ended.'}</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="inline-flex items-center space-x-2 py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Request New Session</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live Telemetry & Compliance Sidebar (1 col) */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <Activity className="w-4 h-4 text-indigo-400" />
              <span>Stream Telemetry</span>
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Resolution</span>
                <span className="font-mono text-slate-200">{stats.resolution}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Frame Rate</span>
                <span className="font-mono text-emerald-400">{stats.fps} FPS</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Round-Trip Latency</span>
                <span className="font-mono text-slate-200">{stats.rttMs} ms</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">Data Received</span>
                <span className="font-mono text-slate-200">
                  {(stats.bytesReceived / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Transport Security</span>
                <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                  <Lock className="w-3 h-3" />
                  <span>DTLS-SRTP</span>
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs text-slate-400">
            <div className="flex items-center space-x-2 text-indigo-400 font-semibold">
              <Info className="w-4 h-4" />
              <span>Apple Platform Safeguards</span>
            </div>
            <ul className="space-y-2 list-disc list-inside text-[11px] leading-relaxed">
              <li>Broadcasting is visibly indicated on the child&apos;s iPhone status bar/Dynamic Island.</li>
              <li>Protected media (DRM streaming, secure password fields, banking apps) is masked by iOS.</li>
              <li>Zero silent background recording or surveillance hooks.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
