'use client';
import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../state/store';
import { nexusAuth } from '../services/api.client';

const AuthContext = createContext<{ logout: () => void } | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { clearAuth } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const handle = () => { clearAuth(); router.push('/login'); };
    window.addEventListener('nexus:unauthenticated', handle);
    return () => window.removeEventListener('nexus:unauthenticated', handle);
  }, [clearAuth, router]);

  const logout = () => { nexusAuth.logout(); clearAuth(); router.push('/login'); };

  return <AuthContext.Provider value={{ logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext)!;
