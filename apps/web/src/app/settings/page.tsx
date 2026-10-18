"use client";

import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import {
  Settings,
  Shield,
  Key,
  Database,
  Lock,
  CheckCircle,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export default function SettingsPage() {
  const { parent } = useAuth();
  const [retentionDays, setRetentionDays] = useState('30');
  const [streamTimeout, setStreamTimeout] = useState('15');
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Platform Settings & Privacy</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure session security policies, data retention, and review Apple platform compliance.
        </p>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center space-x-3 text-emerald-400 text-sm">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>Settings saved successfully.</span>
        </div>
      )}

      {/* Account Info */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <Key className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Parent Account Credentials</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 block mb-1">Full Name</span>
            <span className="text-white font-medium text-sm">{parent?.fullName || 'Parent'}</span>
          </div>
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-slate-500 block mb-1">Email Address</span>
            <span className="text-white font-medium text-sm">{parent?.email || 'parent@example.com'}</span>
          </div>
        </div>
      </div>

      {/* Security Policies */}
      <form onSubmit={handleSave} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6">
        <div className="flex items-center space-x-2">
          <Lock className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Session Security & WebRTC Policies</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Broadcast Session Token TTL (Minutes)
            </label>
            <select
              value={streamTimeout}
              onChange={(e) => setStreamTimeout(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="15">15 Minutes (Recommended)</option>
              <option value="30">30 Minutes</option>
              <option value="60">60 Minutes Maximum</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Short-lived JWTs ensure broadcast sessions automatically expire if connection drops.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Audit Log Retention Period
            </label>
            <select
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="14">14 Days</option>
              <option value="30">30 Days (Standard)</option>
              <option value="90">90 Days</option>
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Security audit logs are purged automatically following this retention policy.
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="py-2.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-all"
        >
          Save Policy Changes
        </button>
      </form>

      {/* Compliance & Privacy Architecture Disclosure */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center space-x-2">
          <FileText className="w-5 h-5 text-indigo-400" />
          <h2 className="text-base font-semibold text-white">Apple Platform & App Store Compliance</h2>
        </div>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="font-semibold text-indigo-400">1. ReplayKit Broadcast Transparency</h3>
            <p className="text-slate-400">
              ParentVision uses Apple&apos;s standard <code>RPSystemBroadcastPickerView</code> and
              Broadcast Upload Extension. iOS requires explicit user interaction to initiate broadcasting,
              and indicates active broadcasting with a system-level red pill in the status bar and Dynamic Island.
              No clandestine or background screen capture is supported or attempted.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="font-semibold text-indigo-400">2. Screen Time FamilyControls Entitlements</h3>
            <p className="text-slate-400">
              Device restrictions and shields are implemented through Apple&apos;s <code>ManagedSettings</code> and
              <code>FamilyControls</code> frameworks. These require the <code>com.apple.developer.family-controls</code> entitlement
              granted by Apple. User browsing activity is sandboxed by iOS privacy protections.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <h3 className="font-semibold text-indigo-400">3. Media Encryption & Ephemeral Relays</h3>
            <p className="text-slate-400">
              Live screen video is encrypted end-to-end via DTLS-SRTP. WebRTC connections use ephemeral
              coturn STUN/TURN credentials generated on-demand with 15-minute expiration. No video streams
              are recorded or stored on the server.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
