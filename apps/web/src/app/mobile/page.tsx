"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Radio, CheckCircle2, AlertCircle, Wifi, StopCircle, RefreshCw } from 'lucide-react';

export default function MobileBroadcasterPage() {
  const [step, setStep] = useState<'pair' | 'ready' | 'broadcasting'>('pair');
  const [pairingCode, setPairingCode] = useState('');
  const [deviceName, setDeviceName] = useState('My iPhone');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [deviceToken, setDeviceToken] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('Enter the 6-digit code from the parent dashboard.');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Check if already paired locally
  useEffect(() => {
    const savedDevId = localStorage.getItem('pv_mobile_dev_id');
    const savedToken = localStorage.getItem('pv_mobile_token');
    const savedName = localStorage.getItem('pv_mobile_name');
    if (savedDevId && savedToken) {
      setDeviceId(savedDevId);
      setDeviceToken(savedToken);
      if (savedName) setDeviceName(savedName);
      setStep('ready');
      setStatusText('Device paired! Ready to broadcast to parent dashboard.');
    }
  }, []);

  const handlePair = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const apiHost = window.location.hostname;
      const res = await fetch(`http://${apiHost}:4000/api/devices/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: pairingCode.trim(),
          name: deviceName.trim(),
          model: 'iPhone (Web)',
          osVersion: 'iOS Safari',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pairing failed');
      }

      setDeviceId(data.device.id);
      setDeviceToken(data.deviceToken);
      localStorage.setItem('pv_mobile_dev_id', data.device.id);
      localStorage.setItem('pv_mobile_token', data.deviceToken);
      localStorage.setItem('pv_mobile_name', deviceName);

      setStep('ready');
      setStatusText('Paired successfully! You can now start screen broadcasting.');
    } catch (err: any) {
      setError(err.message || 'Could not pair device. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBroadcast = async () => {
    setError('');
    setLoading(true);

    try {
      const apiHost = window.location.hostname;

      // 1. Request capture stream
      if (!navigator.mediaDevices) {
        throw new Error(
          "iOS Safari strictly requires HTTPS for screen sharing and camera permissions. Plain http://192.168.1.9 is treated as insecure by Apple."
        );
      }

      let stream: MediaStream;
      if (navigator.mediaDevices.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        });
      } else if (navigator.mediaDevices.getUserMedia) {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } else {
        throw new Error("No media capture available in this browser context.");
      }

      streamRef.current = stream;
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }

      // Handle user stopping screen share via iOS top bar
      stream.getVideoTracks()[0].onended = () => {
        handleStopBroadcast();
      };

      // 2. Request a session token from backend
      const sessRes = await fetch(`http://${apiHost}:4000/api/sessions/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer default`,
        },
        body: JSON.stringify({ deviceId }),
      });

      const sessData = await sessRes.json();
      if (!sessRes.ok) {
        throw new Error(sessData.error || 'Could not authorize broadcast session');
      }

      const { broadcasterToken, iceServers } = sessData;

      // 3. Setup WebRTC PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [iceServers],
      });
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // 4. Setup WebSocket Signaling
      const ws = new WebSocket(`ws://${apiHost}:4000/ws/signaling?token=${broadcasterToken}`);
      wsRef.current = ws;

      pc.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              type: 'candidate',
              payload: { candidate: event.candidate },
            })
          );
        }
      };

      ws.onopen = async () => {
        // Create and send WebRTC SDP offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        ws.send(
          JSON.stringify({
            type: 'offer',
            payload: { sdp: offer.sdp },
          })
        );
      };

      ws.onmessage = async (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: msg.sdp }));
          setStep('broadcasting');
          setStatusText('Streaming live to the parent dashboard over local network!');
        } else if (msg.type === 'candidate' && msg.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
        } else if (msg.type === 'stream_stopped') {
          handleStopBroadcast();
        }
      };

      ws.onerror = () => {
        setError('Signaling server connection error');
      };

      setStep('broadcasting');
    } catch (err: any) {
      setError(err.message || 'Failed to start screen broadcast. Please grant screen recording permissions.');
      handleStopBroadcast();
    } finally {
      setLoading(false);
    }
  };

  const handleStopBroadcast = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setStep('ready');
    setStatusText('Broadcast ended. Ready to start again.');
  };

  const handleUnpair = () => {
    handleStopBroadcast();
    localStorage.removeItem('pv_mobile_dev_id');
    localStorage.removeItem('pv_mobile_token');
    localStorage.removeItem('pv_mobile_name');
    setDeviceId(null);
    setDeviceToken(null);
    setStep('pair');
    setStatusText('Enter the 6-digit code from the parent dashboard.');
  };

  return (
    <div className="max-w-md mx-auto py-4 px-4 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
          <Smartphone className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">ParentVision iPhone Broadcaster</h1>
        <p className="text-xs text-slate-400">Local Wi-Fi Screen Sharing</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start space-x-2 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Pair Device */}
      {step === 'pair' && (
        <form onSubmit={handlePair} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-white">Pair with Parent Dashboard</h2>
            <p className="text-xs text-slate-400">
              Enter the 6-digit code shown on the dashboard screen.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              6-Digit Pairing Code
            </label>
            <input
              type="text"
              required
              maxLength={6}
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value)}
              placeholder="e.g. 849201"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest text-indigo-400 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Device Name
            </label>
            <input
              type="text"
              required
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. John's iPhone"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || pairingCode.length < 6}
            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Pair & Connect iPhone</span>
          </button>
        </form>
      )}

      {/* Step 2: Ready to Broadcast */}
      {step === 'ready' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 text-center shadow-xl">
          <div className="space-y-1">
            <span className="inline-flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Connected: {deviceName}</span>
            </span>
            <h2 className="text-lg font-bold text-white mt-2">Ready to Broadcast Screen</h2>
            <p className="text-xs text-slate-400">{statusText}</p>
          </div>

          <div className="py-4">
            <button
              onClick={handleStartBroadcast}
              disabled={loading}
              className="w-full py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-base shadow-xl shadow-rose-600/40 flex items-center justify-center space-x-2 transition-transform active:scale-95"
            >
              <Radio className="w-5 h-5 animate-pulse" />
              <span>Start Screen Broadcast</span>
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>ID: {deviceId?.slice(0, 8)}...</span>
            <button onClick={handleUnpair} className="text-slate-400 hover:text-red-400">
              Unpair Device
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Actively Broadcasting */}
      {step === 'broadcasting' && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-rose-500/50 space-y-6 text-center shadow-2xl shadow-rose-950/40">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 text-xs font-bold text-rose-400 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/40 animate-pulse">
              <Radio className="w-4 h-4" />
              <span>LIVE BROADCASTING ACTIVE</span>
            </div>
            <h2 className="text-base font-semibold text-white">Your Screen is Live on Parent Dashboard</h2>
            <p className="text-xs text-slate-400">Streamed via direct local WebRTC connection</p>
          </div>

          {/* Local Preview */}
          <div className="aspect-[9/16] max-h-56 mx-auto rounded-xl overflow-hidden bg-black border border-slate-800">
            <video
              ref={videoPreviewRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain"
            />
          </div>

          <button
            onClick={handleStopBroadcast}
            className="w-full py-3.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold text-sm border border-rose-500/30 flex items-center justify-center space-x-2 transition-colors"
          >
            <StopCircle className="w-5 h-5" />
            <span>Stop Broadcasting</span>
          </button>
        </div>
      )}

      {/* Local Network Info */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center space-x-2">
        <Wifi className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Connected on the same Wi-Fi network &bull; Zero external data used</span>
      </div>
    </div>
  );
}
