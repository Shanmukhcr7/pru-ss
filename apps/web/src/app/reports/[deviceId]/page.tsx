"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api, Device, ScreenTimeSummary } from '../../../lib/api';
import {
  Clock,
  ArrowLeft,
  Calendar,
  PieChart,
  ShieldCheck,
  AlertCircle,
  Smartphone,
  Info,
} from 'lucide-react';

export default function ReportsPage() {
  const params = useParams();
  const deviceId = params.deviceId as string;

  const [device, setDevice] = useState<Device | null>(null);
  const [summaries, setSummaries] = useState<ScreenTimeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [devRes, repRes] = await Promise.all([
          api.getDevice(deviceId),
          api.getScreenTime(deviceId, 7),
        ]);
        setDevice(devRes.device);
        setSummaries(repRes.summaries);
      } catch (err: any) {
        setError(err.message || 'Failed to load usage reports');
      } finally {
        setLoading(false);
      }
    }

    if (deviceId) {
      loadData();
    }
  }, [deviceId]);

  const totalWeeklyMinutes = summaries.reduce((acc, curr) => acc + curr.total_minutes, 0);
  const dailyAverageHours = summaries.length > 0 ? (totalWeeklyMinutes / summaries.length / 60).toFixed(1) : '0';

  // Aggregate category breakdowns
  const categoryTotals: Record<string, number> = {};
  summaries.forEach((s) => {
    Object.entries(s.category_breakdown).forEach(([cat, mins]) => {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + mins;
    });
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Link
          href="/"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Screen Time Reports: {device?.name || 'iPhone'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Apple Screen Time API Metrics &bull; 7-Day Overview
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">7-Day Total</span>
          <div className="mt-2 text-2xl font-bold text-white">
            {Math.floor(totalWeeklyMinutes / 60)}h {totalWeeklyMinutes % 60}m
          </div>
          <p className="text-xs text-slate-500 mt-1">Across all permitted categories</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Daily Average</span>
          <div className="mt-2 text-2xl font-bold text-indigo-400">{dailyAverageHours} hrs/day</div>
          <p className="text-xs text-slate-500 mt-1">Computed over logged activity</p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Screen Time Limits</span>
          <div className="mt-2 text-sm font-semibold text-emerald-400 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4" />
            <span>Active ManagedSettings Shields</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Enforced locally on iOS device</p>
        </div>
      </div>

      {/* Category Breakdown & Daily Usage List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <PieChart className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Category Distribution</h2>
          </div>

          {Object.keys(categoryTotals).length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No category usage logged yet.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(categoryTotals).map(([category, minutes]) => {
                const percentage = totalWeeklyMinutes > 0 ? Math.round((minutes / totalWeeklyMinutes) * 100) : 0;
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300 font-medium">{category}</span>
                      <span className="text-slate-400 font-mono">
                        {Math.floor(minutes / 60)}h {minutes % 60}m ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Daily Breakdown List */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-white">Daily Logged Usage</h2>
          </div>

          <div className="divide-y divide-slate-800/80">
            {summaries.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No daily logs received yet.</p>
            ) : (
              summaries.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-300">{s.summary_date}</span>
                  <span className="font-mono text-indigo-300 font-semibold">
                    {Math.floor(s.total_minutes / 60)}h {s.total_minutes % 60}m
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Privacy Notice Box */}
      <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start space-x-3 text-xs text-slate-400">
        <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">Apple Screen Time & Privacy Architecture</p>
          <p className="leading-relaxed">
            By design, Apple&apos;s <code>DeviceActivity</code> framework provides privacy isolation.
            Individual keystrokes, incognito URLs, and private message contents are never transmitted
            or exposed to the remote server. Reports represent authorized high-level category totals
            and configured <code>ManagedSettings</code> schedule limits.
          </p>
        </div>
      </div>
    </div>
  );
}
