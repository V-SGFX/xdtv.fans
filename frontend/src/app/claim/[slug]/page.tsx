'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Crown, Loader2, CheckCircle2, AlertTriangle, ChevronRight } from 'lucide-react';

type ClaimState = 'idle' | 'loading' | 'ready' | 'claiming' | 'claimed' | 'error';

export default function ClaimStreamerPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { token } = useAuth();

  const [state, setState] = useState<ClaimState>('loading');
  const [streamer, setStreamer] = useState<any>(null);
  const [error, setError] = useState('');
  /**
   * Które konta platform ma połączone zalogowany użytkownik.
   *
   * Przejęcie wymaga, żeby identyfikator konta z Twitcha lub Kicka zgadzał
   * się z tym, który przy tym profilu zapisał scraper. Bez pokazania stanu
   * połączeń użytkownik dostawał samą odmowę i nie miał jak się domyślić,
   * czego mu brakuje.
   */
  const [connected, setConnected] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let mounted = true;

    api.get(`/streamers/${slug}`)
      .then(({ data }) => {
        if (!mounted) return;
        setStreamer(data);
        if (data?.isClaimed) {
          setState('claimed');
          return;
        }
        setState('ready');
      })
      .catch(() => {
        if (!mounted) return;
        setError('Nie znaleziono profilu streamera do przejęcia.');
        setState('error');
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!token) return;
    let mounted = true;
    api.get('/oauth/platforms/connected')
      .then(({ data }) => mounted && setConnected(data))
      .catch(() => mounted && setConnected({}));
    return () => { mounted = false; };
  }, [token]);

  const handleClaim = async () => {
    if (!streamer?.id) return;
    if (!token) {
      router.push(`/login?next=${encodeURIComponent(`/claim/${slug}`)}`);
      return;
    }

    setState('claiming');
    setError('');
    try {
      await api.post(`/streamers/${streamer.id}/claim`);
      setState('claimed');
    } catch (err: any) {
      const message = err?.response?.data?.message;
      if (Array.isArray(message)) {
        setError(message[0] || 'Nie udało się przejąć profilu.');
      } else if (typeof message === 'string') {
        setError(message);
      } else {
        setError('Nie udało się przejąć profilu. Spróbuj ponownie.');
      }
      setState('error');
    }
  };

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto py-12 px-4">
        <div className="rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/10 via-dark-900 to-neon-pink/10 p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-300">
            <Crown className="w-5 h-5" />
            <h1 className="text-lg font-extrabold tracking-tight">Przejęcie profilu streamera</h1>
          </div>

          {(state === 'loading' || state === 'idle') && (
            <div className="flex items-center gap-2 text-sm text-white/75">
              <Loader2 className="w-4 h-4 animate-spin" /> Trwa weryfikacja profilu...
            </div>
          )}

          {(state === 'ready' || state === 'claiming' || state === 'error' || state === 'claimed') && streamer && (
            <div className="rounded-xl border border-white/10 bg-dark-800/60 px-4 py-3">
              <p className="text-xs uppercase tracking-wider text-white/45">Profil</p>
              <p className="text-base font-semibold text-white">{streamer.name}</p>
              <p className="text-xs text-white/60">slug: {streamer.slug}</p>
            </div>
          )}

          {token && state !== 'claimed' && (
            <div className="rounded-xl border border-white/10 bg-dark-800/60 px-4 py-3 space-y-2">
              <p className="text-xs uppercase tracking-wider text-white/45">
                Połączone konta
              </p>
              {connected === null ? (
                <p className="text-xs text-white/55">Sprawdzanie…</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {(['twitch', 'kick'] as const).map((platform) => (
                      <span
                        key={platform}
                        className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                          connected[platform]
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-white/5 text-white/50'
                        }`}
                      >
                        {platform === 'twitch' ? 'Twitch' : 'Kick'}
                        {connected[platform] ? ' — połączone' : ' — brak'}
                      </span>
                    ))}
                  </div>
                  {!connected.twitch && !connected.kick && (
                    <p className="text-xs text-white/60">
                      Przejąć kanał może tylko jego właściciel, więc trzeba
                      potwierdzić to logowaniem na platformie.{' '}
                      <Link href="/settings" className="text-neon-cyan hover:text-neon-pink transition-colors">
                        Połącz konto Twitch lub Kick
                      </Link>
                      , a potem wróć tutaj.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {state === 'ready' && (
            <button
              onClick={handleClaim}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-bold text-black hover:bg-amber-400 transition-colors"
            >
              Potwierdź przejęcie
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {state === 'claiming' && (
            <div className="flex items-center gap-2 text-sm text-white/75">
              <Loader2 className="w-4 h-4 animate-spin" /> Trwa przejęcie profilu...
            </div>
          )}

          {state === 'claimed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-300 text-sm">
                <CheckCircle2 className="w-4 h-4" /> Profil został poprawnie przejęty.
              </div>
              <Link
                href={`/streamers/${slug}`}
                className="inline-flex items-center gap-1.5 text-sm text-neon-cyan hover:text-neon-pink transition-colors"
              >
                Przejdź do profilu streamera <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 text-rose-300 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <span>{error || 'Wystąpił błąd podczas przejęcia profilu.'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <button
                  onClick={handleClaim}
                  className="rounded-lg border border-white/20 px-3 py-1.5 text-white/85 hover:text-white hover:border-white/35 transition-colors"
                >
                  Spróbuj ponownie
                </button>
                <Link href={`/streamers/${slug}`} className="text-neon-cyan hover:text-neon-pink transition-colors">
                  Wróć do streamera
                </Link>
              </div>
            </div>
          )}

          {!token && (state === 'ready' || state === 'error') && (
            <p className="text-xs text-white/55">
              Aby przejąć profil, musisz być zalogowany.
            </p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
