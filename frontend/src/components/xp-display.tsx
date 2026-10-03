'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Zap, Flame, Trophy, Award, ChevronDown } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import Link from 'next/link';

const BADGE_ICONS: Record<string, string> = {
  nowicjusz:   '🌱',
  gadacz:      '💬',
  sedzia:      '⚔️',
  regularny:   '🔥',
  uzalezniony: '🔥🔥',
  legenda:     '🔥🔥🔥',
  og:          '🏛️',
};

// Maps badge code to xp translation key
const BADGE_XP_KEY: Record<string, string> = {
  nowicjusz:   'novice',
  gadacz:      'talker',
  sedzia:      'judge',
  regularny:   'regular',
  uzalezniony: 'addict',
  legenda:     'legend',
  og:          'og',
};

interface XpProfile {
  totalXp: number;
  level: number;
  xpForNextLevel: number;
  xpProgress: number;
  weeklyXp: number;
  currentStreak: number;
  longestStreak: number;
  streakMultiplier: number;
  badges: { badge: string; earnedAt: string }[];
}

interface LeaderboardEntry {
  rank: number;
  weeklyXp: number;
  user: { id: number; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

/**
 * XP bar shown in navbar — just shows total XP + streak count.
 * Click to expand dropdown with badges + weekly leaderboard.
 */
export function XpDisplay() {
  const t = useTranslations('xp');
  const { token } = useAuth();
  const [profile, setProfile] = useState<XpProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.get('/engagement/me').then(({ data }) => setProfile(data)).catch(() => {});
  }, [token]);

  const loadLeaderboard = async () => {
    if (loaded) return;
    try {
      const { data } = await api.get('/engagement/leaderboard');
      setLeaderboard(data);
      setLoaded(true);
    } catch {}
  };

  if (!token || !profile) return null;

  return (
    <div className="relative">
      <motion.button
        onClick={() => { setOpen(!open); loadLeaderboard(); }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-dark-800/50 border border-border-default hover:border-neon-purple/30 transition-all"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-2xs font-bold text-neon-purple bg-neon-purple/20 px-1.5 py-0.5 rounded">Lv.{profile.level}</span>
        <Zap className="w-3.5 h-3.5 text-neon-cyan" />
        <span className="text-xs font-bold text-neon-cyan">{profile.totalXp}</span>
        {profile.currentStreak > 0 && (
          <>
            <span className="text-text-dimmed">·</span>
            <Flame className="w-3 h-3 text-orange-400" />
            <span className="text-xs font-medium text-orange-400">{profile.currentStreak}</span>
          </>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -5, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -5, scale: 0.97 }}
              className="absolute right-0 top-full mt-2 w-80 bg-dark-800/95 backdrop-blur-md border border-border-default rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              {/* XP Stats */}
              <div className="p-4 border-b border-border-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-text-primary">{t('level', { level: profile.level })}</span>
                  <span className="text-2xs text-text-dimmed">{profile.totalXp} / {profile.xpForNextLevel} XP</span>
                </div>
                <div className="h-1.5 bg-dark-700 rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full bg-gradient-to-r from-neon-purple to-neon-cyan rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(profile.xpProgress * 100, 100)}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-lg font-display font-bold text-neon-cyan">{profile.totalXp}</p>
                    <p className="text-2xs text-text-dimmed">Total XP</p>
                  </div>
                  <div>
                    <p className="text-lg font-display font-bold text-neon-pink">{profile.weeklyXp}</p>
                    <p className="text-2xs text-text-dimmed">{t('thisWeek')}</p>
                  </div>
                  <div>
                    <p className="text-lg font-display font-bold text-orange-400">{profile.currentStreak}</p>
                    <p className="text-2xs text-text-dimmed">Streak 🔥</p>
                  </div>
                </div>
                {profile.streakMultiplier > 1 && (
                  <div className="mt-2 text-center">
                    <span className="text-xs font-bold text-neon-purple bg-neon-purple/10 px-3 py-1 rounded-full">
                      {t('multiplier', { val: profile.streakMultiplier })}
                    </span>
                  </div>
                )}
              </div>

              {/* Badges */}
              {profile.badges.length > 0 && (
                <div className="p-3 border-b border-border-default">
                  <p className="text-2xs font-bold uppercase tracking-wider text-text-dimmed mb-2 flex items-center gap-1">
                    <Award className="w-3 h-3" /> {t('badgesLabel')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.badges.map((b) => {
                      const icon = BADGE_ICONS[b.badge] || '🏅';
                      const xpKey = BADGE_XP_KEY[b.badge];
                      const label = xpKey ? t(xpKey as any) : b.badge;
                      return (
                        <span
                          key={b.badge}
                          className="text-xs px-2.5 py-1 rounded-full bg-dark-700/60 border border-border-default text-text-primary"
                          title={t('earned', { date: new Date(b.earnedAt).toLocaleDateString() })}
                        >
                          {icon} {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}


              {/* Leaderboard */}
              <div className="p-3 max-h-48 overflow-y-auto">
                <p className="text-2xs font-bold uppercase tracking-wider text-text-dimmed mb-2 flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {t('topWeekly')}
                </p>
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-text-dimmed text-center py-2">{t('noData')}</p>
                ) : (
                  <div className="space-y-1">
                    {leaderboard.slice(0, 10).map((entry) => (
                      <div key={entry.rank} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-dark-700/40">
                        <span className={`w-5 text-center text-xs font-bold ${entry.rank <= 3 ? 'text-yellow-400' : 'text-text-muted'}`}>
                          {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                        </span>
                        <Avatar src={entry.user?.avatarUrl ?? null} name={entry.user?.displayName || entry.user?.username || ''} size="xs" />
                        <span className="text-xs text-text-primary flex-1 truncate">
                          {entry.user?.displayName || entry.user?.username || t('anonymous')}
                        </span>
                        <span className="text-xs font-bold text-neon-cyan">{entry.weeklyXp}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Inline XP toast — shows briefly when user earns XP.
 * Used in chat.
 */
export function XpToast({ amount }: { amount: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex items-center gap-1 text-xs font-bold text-neon-purple"
    >
      <Zap className="w-3 h-3" /> +{amount} XP
    </motion.div>
  );
}
