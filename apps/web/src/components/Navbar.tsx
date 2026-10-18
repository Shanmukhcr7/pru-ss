"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../lib/authContext';
import { Shield, Smartphone, Settings, LogOut, Radio, Home } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { parent, logout } = useAuth();
  const pathname = usePathname();

  if (!parent) return null;

  const navItems = [
    { label: 'Overview', href: '/', icon: Home },
    { label: 'Devices', href: '/devices', icon: Smartphone },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2 text-indigo-400 font-bold text-xl tracking-tight">
              <Shield className="w-6 h-6 text-indigo-500" />
              <span className="text-white">Parent<span className="text-indigo-400">Vision</span></span>
            </Link>
            <span className="hidden md:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-950 text-indigo-400 border border-indigo-800/60">
              Parent Portal
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-slate-200">{parent.fullName}</p>
              <p className="text-xs text-slate-400">{parent.email}</p>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800/60 transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};
