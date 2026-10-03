'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

function CallbackHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { loginWithToken } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    const isNew = searchParams.get('isNew') === 'true';

    if (error) {
      setStatus('error');
      const messages: Record<string, string> = {
        no_code: 'Nie otrzymano kodu autoryzacji',
        invalid_platform: 'Nieprawidłowa platforma',
        missing_state: 'Brak tokenu bezpieczeństwa',
        invalid_state: 'Token bezpieczeństwa wygasł. Spróbuj ponownie.',
      };
      setErrorMsg(messages[error] || decodeURIComponent(error));
      return;
    }

    if (token) {
      loginWithToken(token)
        .then(() => {
          setStatus('success');
          setTimeout(() => {
            router.push(isNew ? '/settings' : '/');
          }, 800);
        })
        .catch((err) => {
          setStatus('error');
          // Say what actually failed. A flat "could not fetch profile" gave
          // no way to tell an expired token from a network problem from a
          // server error — the same blind spot the OAuth callback had.
          const status = err?.response?.status;
          const detail = err?.response?.data?.message;
          setErrorMsg(
            status === 401
              ? 'Token wygasł lub jest nieprawidłowy. Zaloguj się ponownie.'
              : status
                ? `Nie udało się pobrać profilu (HTTP ${status}${detail ? `: ${detail}` : ''})`
                : 'Brak połączenia z serwerem. Spróbuj ponownie.',
          );
        });
    } else {
      setStatus('error');
      setErrorMsg('Brak tokenu w odpowiedzi');
    }
  }, [searchParams, router, loginWithToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-950">
      <div className="text-center space-y-4">
        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-neon-cyan animate-spin mx-auto" />
            <p className="text-text-secondary">Logowanie...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-neon-green mx-auto" />
            <p className="text-text-primary font-medium">Zalogowano!</p>
            <p className="text-text-muted text-sm">Przekierowanie...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <XCircle className="w-10 h-10 text-neon-red mx-auto" />
            <p className="text-text-primary font-medium">Błąd logowania</p>
            <p className="text-text-muted text-sm">{errorMsg}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 px-4 py-2 bg-neon-purple text-white rounded-lg hover:bg-neon-purple/90 transition-colors"
            >
              Wróć do logowania
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <Loader2 className="w-10 h-10 text-neon-cyan animate-spin" />
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
