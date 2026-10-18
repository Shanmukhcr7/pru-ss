"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, Parent } from './api';

interface AuthContextType {
  parent: Parent | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const defaultParentUser: Parent = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'parent@parentvision.local',
  fullName: 'Parent Supervisor',
};

const AuthContext = createContext<AuthContextType>({
  parent: defaultParentUser,
  loading: false,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [parent, setParent] = useState<Parent | null>(defaultParentUser);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Ensure default access token exists in localStorage for direct access
    if (typeof window !== 'undefined') {
      if (!localStorage.getItem('parentvision_token')) {
        localStorage.setItem('parentvision_token', 'default');
      }
    }
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await api.login(email, pass);
    setParent(res.parent);
    router.push('/');
  };

  const register = async (email: string, pass: string, name: string) => {
    const res = await api.register(email, pass, name);
    setParent(res.parent);
    router.push('/');
  };

  const logout = async () => {
    // In direct access mode, reset to default parent
    setParent(defaultParentUser);
    router.push('/');
  };

  return (
    <AuthContext.Provider value={{ parent, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
