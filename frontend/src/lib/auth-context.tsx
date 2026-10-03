'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '@/lib/api';
import { User } from '@/lib/types';

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (loginStr: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('xdtv_token');
    const storedUser = localStorage.getItem('xdtv_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Revalidate token and refresh user data from server
      api.get('/auth/me', { headers: { Authorization: `Bearer ${storedToken}` } })
        .then(({ data }) => {
          setUser(data);
          localStorage.setItem('xdtv_user', JSON.stringify(data));
        })
        .catch(() => {
          // Token invalid/expired — log out
          setToken(null);
          setUser(null);
          localStorage.removeItem('xdtv_token');
          localStorage.removeItem('xdtv_user');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (loginStr: string, password: string) => {
    const { data } = await api.post('/auth/login', { login: loginStr, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('xdtv_token', data.token);
    localStorage.setItem('xdtv_user', JSON.stringify(data.user));
  };

  const register = async (email: string, username: string, password: string) => {
    const { data } = await api.post('/auth/register', { email, username, password });
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem('xdtv_token', data.token);
    localStorage.setItem('xdtv_user', JSON.stringify(data.user));
  };

  /**
   * Adopt a token issued by the OAuth callback.
   *
   * Stable identity via useCallback: the auth callback page runs this from an
   * effect that lists it as a dependency, and a fresh function each render
   * made that effect re-fire on every state change — re-requesting the profile
   * in a loop while the page was trying to settle.
   *
   * The profile is fetched before anything is committed, so a failure leaves
   * no half-signed-in state behind.
   */
  const loginWithToken = useCallback(async (oauthToken: string) => {
    const { data } = await api.get('/auth/me', {
      headers: { Authorization: `Bearer ${oauthToken}` },
    });
    localStorage.setItem('xdtv_token', oauthToken);
    localStorage.setItem('xdtv_user', JSON.stringify(data));
    setToken(oauthToken);
    setUser(data);
  }, []);

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('xdtv_token');
    localStorage.removeItem('xdtv_user');
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    localStorage.setItem('xdtv_user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, loginWithToken, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
