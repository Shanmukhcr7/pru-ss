"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, Device } from '../../lib/api';
import {
  Smartphone,
  Plus,
  Trash2,
  Edit2,
  Clock,
  Radio,
  Check,
  X,
  AlertCircle,
  Copy,
  CheckCircle,
} from 'lucide-react';

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pairing Modal state
  const [isPairingOpen, setIsPairingOpen] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [generatedCode, setGeneratedCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [pairingLoading, setPairingLoading] = useState(false);

  // Rename state
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const loadDevices = async () => {
    try {
      setLoading(true);
      const res = await api.getDevices();
      setDevices(res.devices);
    } catch (err: any) {
      setError(err.message || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleGenerateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName.trim()) return;

    try {
      setPairingLoading(true);
      const res = await api.createPairingCode(newDeviceName.trim());
      setGeneratedCode({ code: res.code, expiresAt: res.expiresAt });
    } catch (err: any) {
      setError(err.message || 'Failed to generate pairing code');
    } finally {
      setPairingLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (generatedCode) {
      navigator.clipboard.writeText(generatedCode.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleSaveRename = async (id: string) => {
    if (!renameValue.trim()) return;
    try {
      await api.renameDevice(id, renameValue.trim());
      setEditingDeviceId(null);
      loadDevices();
    } catch (err: any) {
      setError(err.message || 'Failed to rename device');
    }
  };

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently revoke "${name}"? This device will lose all access.`)) {
      return;
    }
    try {
      await api.revokeDevice(id);
      loadDevices();
    } catch (err: any) {
      setError(err.message || 'Failed to revoke device');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Supervised Devices</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage enrolled iOS devices, authorization status, and pairing codes.
          </p>
        </div>
        <button
          onClick={() => {
            setGeneratedCode(null);
            setNewDeviceName('');
            setIsPairingOpen(true);
          }}
          className="flex items-center space-x-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/25 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Pair New iPhone</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Device List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-white text-sm">Enrolled Devices ({devices.length})</h2>
          <span className="text-xs text-slate-500">Apple ReplayKit & Screen Time Enrolled</span>
        </div>

        {devices.length === 0 ? (
          <div className="p-12 text-center">
            <Smartphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="font-semibold text-white">No devices paired yet</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-6">
              Pair an iPhone by tapping &quot;Pair New iPhone&quot; to generate an authorization code.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {devices.map((device) => (
              <div key={device.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-2xl bg-slate-800 border border-slate-700/60 text-indigo-400 flex-shrink-0 mt-0.5">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    {editingDeviceId === device.id ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => handleSaveRename(device.id)}
                          className="p-1 text-emerald-400 hover:text-emerald-300"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingDeviceId(null)}
                          className="p-1 text-slate-400 hover:text-slate-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold text-white text-base">{device.name}</h3>
                        <button
                          onClick={() => {
                            setEditingDeviceId(device.id);
                            setRenameValue(device.name);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                          title="Rename"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {device.model} &bull; {device.os_version} &bull; Enrolled on {new Date(device.created_at).toLocaleDateString()}
                    </p>
                    <div className="mt-2 flex items-center space-x-3 text-xs">
                      <span className="flex items-center space-x-1.5 text-slate-300">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            device.status === 'broadcasting'
                              ? 'bg-rose-500 animate-ping'
                              : device.status === 'online'
                              ? 'bg-emerald-500'
                              : 'bg-slate-600'
                          }`}
                        />
                        <span className="capitalize">{device.status}</span>
                      </span>
                      <span className="text-slate-600">&bull;</span>
                      <span className="text-slate-400">Battery: {device.battery_level}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Link
                    href={`/live/${device.id}`}
                    className="flex items-center space-x-1.5 py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 font-medium text-xs transition-colors"
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>Live Screen</span>
                  </Link>

                  <Link
                    href={`/reports/${device.id}`}
                    className="flex items-center space-x-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Reports</span>
                  </Link>

                  <button
                    onClick={() => handleRevoke(device.id, device.name)}
                    className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Revoke Enrollment"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pairing Modal */}
      {isPairingOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative space-y-5">
            <button
              onClick={() => {
                setIsPairingOpen(false);
                loadDevices();
              }}
              className="absolute right-4 top-4 text-slate-500 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Pair Child iPhone</h2>
              <p className="text-xs text-slate-400 mt-1">
                Generate a temporary authorization code to connect your child&apos;s device.
              </p>
            </div>

            {!generatedCode ? (
              <form onSubmit={handleGenerateCode} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Device Identifier / Child Name
                  </label>
                  <input
                    type="text"
                    required
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    placeholder="e.g. Leo's iPhone"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={pairingLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {pairingLoading ? 'Generating...' : 'Generate 6-Digit Code'}
                </button>
              </form>
            ) : (
              <div className="space-y-5 text-center">
                <div className="p-6 bg-slate-950 rounded-2xl border border-indigo-500/30">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest block mb-2">
                    Pairing Code (Expires in 15m)
                  </span>
                  <div className="text-4xl font-extrabold tracking-widest text-indigo-400 font-mono">
                    {generatedCode.code}
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="mt-4 inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {codeCopied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{codeCopied ? 'Copied to clipboard' : 'Copy code'}</span>
                  </button>
                </div>

                <div className="text-left text-xs text-slate-300 bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-1.5">
                  <p className="font-semibold text-white">Instructions:</p>
                  <p>1. Open the <strong>ParentVision</strong> app on your child&apos;s iPhone.</p>
                  <p>2. Select <strong>Enroll Device</strong>.</p>
                  <p>3. Enter the 6-digit code: <strong className="text-indigo-400">{generatedCode.code}</strong>.</p>
                  <p>4. Grant required permissions (Family Controls / Screen Time).</p>
                </div>

                <button
                  onClick={() => {
                    setIsPairingOpen(false);
                    loadDevices();
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
