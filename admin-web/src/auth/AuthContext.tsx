import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import type { ReactNode } from 'react';
import { ApiError, clearToken, getToken, request, setToken } from '../lib/api';
import type { AdminUser, LoginResponse } from '../lib/types';

type AuthState = {
  user: AdminUser | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = 'trotro.admin.user';

const readCachedUser = (): AdminUser | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Restore the session on boot: a cached user renders immediately, then
  // /auth/me confirms the token is still valid (and still an admin).
  useEffect(() => {
    let cancelled = false;
    const token = getToken();
    if (!token) {
      setLoading(false);
      return () => { cancelled = true; };
    }
    setUser(readCachedUser());
    request<{ user: { id: string; role: string } }>('/auth/me')
      .then((result) => {
        if (cancelled) return;
        if (result.user.role !== 'admin') {
          logout();
          return;
        }
        setUser((current) => (current ? { ...current, role: 'admin' } : {
          id: result.user.id, role: 'admin', full_name: null, phone: '', email: null,
        }));
      })
      .catch(() => { if (!cancelled) logout(); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [logout]);

  // A 401 from any request means the JWT expired — drop the session.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener('trotro:unauthorized', handler);
    return () => window.removeEventListener('trotro:unauthorized', handler);
  }, [logout]);

  const login = useCallback(async (phone: string, password: string) => {
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST', body: { phone, password }, anonymous: true,
    });
    // The API issues tokens for every role; this console is admin-only, so the
    // check happens here rather than letting a passenger in to hit 403s.
    if (result.user.role !== 'admin') {
      throw new ApiError(403, 'This account is not an administrator.');
    }
    setToken(result.token);
    localStorage.setItem(USER_KEY, JSON.stringify(result.user));
    setUser(result.user);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
