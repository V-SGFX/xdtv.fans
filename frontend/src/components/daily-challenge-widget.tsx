'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Flame, CheckCircle2, Circle, Gift, Zap } from 'lucide-react';

const CHALLENGE_LABELS: Record<string, { emoji: string; label: string }> = {
  BATTLE_VOTE:     { emoji: '⚔️', label: 'Zagłosuj w bitwie' },
  HOT_TAKE_VOTE:   { emoji: '🔥', label: 'Odpowiedz na hot take' },
  CHAT_MESSAGE:    { emoji: '💬', label: 'Napisz na czacie' },
  CHAT_REACTION:   { emoji: '😄', label: 'Zareaguj na wiadomość' },
  POST_VOTE:       { emoji: '👍', label: 'Zagłosuj na post' },
  VISIT_STREAMER:  { emoji: '📺', label: 'Odwiedź streamera' },
  CREATE_COMMENT:  { emoji: '🗣️', label: 'Napisz komentarz' },
};

interface Challenge {
  id: number;
  challengeType: string;
  completed: boolean;
}

interface EngagementProfile {
  totalXp: number;
  currentStreak: number;
  streakMultiplier: number;
  badges: { badge: string; earnedAt: string }[];
}

/**
 * Floating daily challenge widget — sits in bottom-left or as a panel.
 * Shows 3 daily tasks + streak + XP.
 */
export function DailyChallengeWidget() {
  const { token, user } = useAuth();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [profile, setProfile] = useState<EngagementProfile | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [challengeRes, profileRes] = await Promise.all([
          api.get('/engagement/challenges'),
          api.get('/engagement/me'),
        ]);
        setChallenges(challengeRes.data);
        setProfile(profileRes.data);
      } catch {}
      setLoading(false);
    })();
  }, [token]);

  if (!token || loading) return null;

  const completed = challenges.filter((c) => c.completed).length;
  const total = challenges.length || 3;
  const allDone = completed >= total;
  const streak = profile?.currentStreak ?? 0;
  const multiplier = profile?.streakMultiplier ?? 1;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-40">
      {/* Collapsed pill */}
      <motion.button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all shadow-lg backdrop-blur-md ${
          allDone
            ? 'bg-neon-green/10 border-neon-green/30 text-neon-green'
            : 'bg-dark-800/90 border-border-default text-text-primary hover:border-neon-purple/40'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {streak > 0 && <Flame className="w-4 h-4 text-orange-400" />}
        <span className="text-xs font-bold">
          {allDone ? '✅ Gotowe!' : `${completed}/${total}`}
        </span>
        {streak > 0 && (
          <span className="text-2xs text-text-muted">{streak}🔥</span>
        )}
        {multiplier > 1 && (
          <span className="text-2xs font-bold text-neon-purple">{multiplier}x</span>
        )}
      </motion.button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-12 left-0 w-72 bg-dark-800/95 backdrop-blur-md border border-border-default rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-border-default">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-neon-purple" />
                <span className="text-sm font-bold text-text-primary">Dzienne wyzwania</span>
              </div>
              {profile && (
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-neon-cyan" />
                  <span className="text-xs font-bold text-neon-cyan">{profile.totalXp} XP</span>
                </div>
              )}
            </div>

            {/* Streak row */}
            {streak > 0 && (
              <div className="px-4 py-2 flex items-center justify-between bg-orange-500/5 border-b border-border-default">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-xs font-medium text-text-primary">{streak} dni streak</span>
                </div>
                {multiplier > 1 && (
                  <span className="text-xs font-bold text-neon-purple bg-neon-purple/10 px-2 py-0.5 rounded-full">
                    {multiplier}x XP
                  </span>
                )}
              </div>
            )}

            {/* Challenges */}
            <div className="p-3 space-y-2">
              {challenges.map((c) => {
                const info = CHALLENGE_LABELS[c.challengeType] || { emoji: '❓', label: c.challengeType };
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${
                      c.completed ? 'bg-neon-green/5' : 'bg-dark-700/40'
                    }`}
                  >
                    {c.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-neon-green shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-text-dimmed shrink-0" />
                    )}
                    <span className="text-sm shrink-0">{info.emoji}</span>
                    <span className={`text-xs flex-1 ${c.completed ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                      {info.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bonus */}
            <div className="px-4 py-2 border-t border-border-default bg-dark-900/30">
              <p className="text-2xs text-text-dimmed text-center">
                {allDone
                  ? '🎉 Bonus +50 XP zdobyty!'
                  : `Ukończ wszystkie → +50 XP bonus`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
