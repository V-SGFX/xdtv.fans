import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the stored token — but never over an explicit one.
//
// This used to overwrite unconditionally, which broke the OAuth handshake:
// loginWithToken passes the fresh token as an explicit header, and the
// interceptor replaced it with whatever localStorage happened to hold at that
// instant. A caller that names its own credentials means it.
api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') return config;
  if (config.headers?.Authorization) return config;

  const token = localStorage.getItem('xdtv_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Requests that must never trigger a global sign-out on 401.
 *
 * The handler below clears the session whenever anything 401s. During login
 * that is actively harmful: a stale token from a previous session revalidating
 * in the background would 401 and wipe the credentials the OAuth callback had
 * just stored, logging the user straight back out.
 */
function isAuthProbe(url?: string): boolean {
  return Boolean(url && url.includes('/auth/me'));
}

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    if (status === 401 && typeof window !== 'undefined' && !isAuthProbe(error.config?.url)) {
      localStorage.removeItem('xdtv_token');
      localStorage.removeItem('xdtv_user');
    }
    return Promise.reject(error);
  }
);
