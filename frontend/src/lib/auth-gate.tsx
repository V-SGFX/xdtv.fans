'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AuthModal } from '@/components/auth-modal';

const INTERACTION_THRESHOLD = 3;
const COUNTER_KEY = 'xdtv_guest_interactions';

interface AuthGateCtx {
  /** Guard an action — returns true if user is authenticated, false if blocked (modal shown) */
  requireAuth: (reason?: string) => boolean;
  /** Track a guest interaction (view, scroll). After threshold, show a soft prompt */
  trackInteraction: () => void;
}

const AuthGateContext = createContext<AuthGateCtx>({
  requireAuth: () => false,
  trackInteraction: () => {},
});

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [modalReason, setModalReason] = useState<string | undefined>();
  const [softPromptShown, setSoftPromptShown] = useState(false);
  const interactionCount = useRef(0);
  // Use ref so trackInteraction always sees current user without stale closures
  const userRef = useRef(user);
  const loadingRef = useRef(loading);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);

  // Initialize counter from sessionStorage; clear if already logged in
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (user) {
        sessionStorage.removeItem(COUNTER_KEY);
        interactionCount.current = 0;
      } else if (!loading) {
        const stored = sessionStorage.getItem(COUNTER_KEY);
        if (stored) interactionCount.current = parseInt(stored, 10) || 0;
      }
    }
  }, [user, loading]);

  const requireAuth = useCallback((reason?: string): boolean => {
    if (userRef.current) return true;
    setModalReason(reason);
    setModalOpen(true);
    return false;
  }, []);

  const trackInteraction = useCallback(() => {
    if (userRef.current || loadingRef.current || softPromptShown) return;
    interactionCount.current += 1;
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(COUNTER_KEY, String(interactionCount.current));
    }
    if (interactionCount.current >= INTERACTION_THRESHOLD) {
      setModalReason(undefined);
      setModalOpen(true);
      setSoftPromptShown(true);
    }
  }, [softPromptShown]);

  const handleClose = useCallback(() => {
    setModalOpen(false);
    setModalReason(undefined);
  }, []);

  return (
    <AuthGateContext.Provider value={{ requireAuth, trackInteraction }}>
      {children}
      <AuthModal open={modalOpen} onClose={handleClose} reason={modalReason} />
    </AuthGateContext.Provider>
  );
}

export const useAuthGate = () => useContext(AuthGateContext);
