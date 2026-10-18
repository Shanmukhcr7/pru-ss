"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/authContext';
import { api, Device, AuditLog } from '../lib/api';
import {
  Smartphone,
  Radio,
  Clock,
  ShieldAlert,
  Battery,
  BatteryCharging,
  Plus,
  ArrowRight,
  RefreshCw,
  Eye,
  Wifi,
  Copy,
  CheckCircle2,
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const { parent } = useAuth();
  const router = useRouter();
  const [devices, setDevices] = useState<Device[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCode, setActiveCode] = useState<string>('849201');
  const [copied, setCopied] = useState(false);
  const [lanIp, setLanIp] = useState('192.168.1.9');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setLanIp(window.location.hostname || '192.168.1.9');
    }
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [devRes, auditRes] = await Promise.all([
        api.getDevices(),
        api.getAuditLogs(10),
      ]);
      setDevices(devRes.devices);
      setAuditLogs(auditRes.logs);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const ensurePairingCode = async () => {
    try {
      const res = await api.createPairingCode("Leo's iPhone");
      setActiveCode(res.code);
    } catch {
      // Use fallback code
    }
  };

  useEffect(() => {
    loadData();
    ensurePairingCode();
    const interval = setInterval(loadData, 5000); // 5s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddDemoDevice = async () => {
    try {
      setLoading(true);
      const apiHost = window.location.hostname || 'localhost';
      await fetch(`http://${apiHost}:4000/api/devices/enroll`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCode,
          name: "Test iPhone 15 Pro",
          model: "iPhone 15 Pro",
          osVersion: "iOS 17.4",
        }),
      });
      await loadData();
      await ensurePairingCode();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const activeBroadcastCount = devices.filter((d) => d.status === 'broadcasting').length;
  const onlineCount = devices.filter((d) => d.status === 'online').length;

  return (
    <div className="space-y-8">
      {/* Top Banner: Local Network iPhone Pairing */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-500/40 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center space-x-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>Same Wi-Fi Network &bull; Zero Login Direct Access</span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Pair Your iPhone to Watch Screen Live
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              On your iPhone (connected to the same Wi-Fi), open Safari and go to:
              <br />
              <strong className="text-indigo-300 font-mono text-sm underline select-all">
                http://{lanIp}:3000/mobile
              </strong>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="p-4 bg-slate-950 rounded-2xl border border-indigo-500/30 text-center flex-1 sm:flex-none">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                Pairing Code
              </span>
              <div className="text-3xl font-black text-indigo-400 font-mono tracking-wider">
                {activeCode}
              </div>
              <button
                onClick={handleCopyCode}
                className="mt-1 text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center justify-center space-x-1 mx-auto"
              >
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <button
              onClick={handleAddDemoDevice}
              className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors w-full sm:w-auto text-center"
            >
              + Quick Pair Test iPhone
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connected Devices</span>
            <Smartphone className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white">{devices.length}</span>
            <span className="text-xs text-emerald-400 font-medium">({onlineCount} online)</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Live Broadcasts</span>
            <Radio className="w-5 h-5 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline space-x-2">
            <span className="text-3xl font-bold text-white">{activeBroadcastCount}</span>
            {activeBroadcastCount > 0 ? (
              <span className="text-xs text-rose-400 font-medium animate-pulse flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
                <span>Active Streaming</span>
              </span>
            ) : (
              <span className="text-xs text-slate-500">None currently active</span>
            )}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Local Network</span>
            <Wifi className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-3">
            <span className="text-sm font-semibold text-emerald-400">Direct WebRTC P2P</span>
            <p className="text-xs text-slate-400 mt-0.5">Zero external bandwidth usage</p>
          </div>
        </div>
      </div>

      {/* Connected Devices Grid - Clicking directly opens the device screen */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight">Connected Devices</h2>
          <button
            onClick={loadData}
            className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="p-12 text-center rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-4">
            <Smartphone className="w-12 h-12 text-slate-600 mx-auto" />
            <div>
              <h3 className="text-base font-semibold text-white">No iPhones paired yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                Open <strong className="text-indigo-400">http://{lanIp}:3000/mobile</strong> on your iPhone or click the button below to pair a test device.
              </p>
            </div>
            <button
              onClick={handleAddDemoDevice}
              className="inline-flex items-center space-x-2 py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Pair Test iPhone Now</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {devices.map((device) => {
              const isBroadcasting = device.status === 'broadcasting';
              const isOnline = device.status === 'online' || isBroadcasting;

              return (
                <div
                  key={device.id}
                  onClick={() => router.push(`/live/${device.id}`)}
                  className={`rounded-3xl p-6 bg-slate-900 border cursor-pointer transition-all transform hover:-translate-y-1 hover:shadow-2xl ${
                    isBroadcasting
                      ? 'border-rose-500/70 shadow-xl shadow-rose-950/50'
                      : 'border-slate-800 hover:border-indigo-500/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-bold text-white text-base">{device.name}</h3>
                        {isBroadcasting && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{device.model} &bull; {device.os_version}</p>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs text-slate-300 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
                      {device.is_charging ? (
                        <BatteryCharging className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Battery className="w-4 h-4 text-slate-400" />
                      )}
                      <span>{device.battery_level}%</span>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          isBroadcasting
                            ? 'bg-rose-500 animate-ping'
                            : isOnline
                            ? 'bg-emerald-500'
                            : 'bg-slate-600'
                        }`}
                      />
                      <span className="capitalize font-medium text-slate-300">
                        {isBroadcasting ? 'Broadcasting Screen' : device.status}
                      </span>
                    </div>

                    <span className="text-slate-500 text-[11px]">Click to view &rarr;</span>
                  </div>

                  <div className="mt-4">
                    <div
                      className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition-all ${
                        isBroadcasting
                          ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/25'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      <span>{isBroadcasting ? 'Watch Live Screen' : 'Open Device Screen'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Audit Trail */}
      <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Recent Security & Stream Events</h2>
          </div>
          <span className="text-[11px] text-slate-500">Live event logs</span>
        </div>

        <div className="divide-y divide-slate-800/80">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 py-3">No activity logged yet.</p>
          ) : (
            auditLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-indigo-400 font-mono text-[11px] mr-2">
                    [{log.event_type}]
                  </span>
                  <span className="text-slate-300">{log.description}</span>
                </div>
                <span className="text-slate-500 text-[11px] flex-shrink-0 ml-4">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
