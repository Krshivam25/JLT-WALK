import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, removeTokens, getToken, saveCredentials } from '../services/api';
import { User } from '../types';
import { showSuccess } from '../utils/toast';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null, loading: true,
  login: async () => {}, register: async () => {}, logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore session on app launch
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        if (token) {
          // Try /me — the 401 interceptor will silently re-login if token expired
          const res = await authApi.me();
          setUser(res.data);
        }
      } catch {
        // Token expired AND silent re-login failed (no saved credentials)
        // Don't remove tokens — let user see login screen naturally
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const accessToken = res.data.token || res.data.access_token;
    const refreshToken = res.data.refresh_token;

    // Save token
    await setToken('access', accessToken);
    if (refreshToken) await setToken('refresh', refreshToken);

    // Save credentials for silent re-login when token expires
    await saveCredentials(email, password);

    setUser(res.data.user);
    showSuccess('Welcome Back', 'You are now signed in');
  }, []);

  const register = useCallback(async (email: string, password: string, displayName?: string) => {
    const res = await authApi.register(email, password, displayName);
    const accessToken = res.data.token || res.data.access_token;
    const refreshToken = res.data.refresh_token;

    await setToken('access', accessToken);
    if (refreshToken) await setToken('refresh', refreshToken);
    await saveCredentials(email, password);

    setUser(res.data.user);
    showSuccess('Account Created', 'Welcome to JLT Walk!');
  }, []);

  const logout = useCallback(async () => {
    await removeTokens(); // removes access, refresh, AND credentials
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
