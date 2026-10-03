'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Flame, Sparkles } from 'lucide-react';

/* ── Hot take prompts per channel name ── */
const HOT_TAKES: Record<string, { question: string; template: string }[]> = {
  general: [
    { question: 'Który streamer jest najbardziej overrated?', template: 'Moim zdaniem najbardziej overrated jest ' },
    { question: 'Unpopular opinion o polskim Twitchu?', template: 'Moja unpopular opinion: ' },
    { question: 'Co jest bardziej cringe: donaty czy subsy?', template: 'Bardziej cringe są ' },
    { question: 'Najlepszy stream jaki widziałeś/aś?', template: 'Najlepszy stream jaki widziałem to ' },
  ],
  drama: [
    { question: 'Jaka drama była najbardziej overblown?', template: 'Najbardziej przesadzona drama to ' },
    { question: 'Kto powinien się pogodzić?', template: 'Powinni się pogodzić: ' },
    { question: 'Najlepsza drama 2026?', template: 'Najlepsza drama tego roku to ' },
  ],
  gaming: [
    { question: 'Jaka gra jest najbardziej overhyped?', template: 'Najbardziej overhyped gra to ' },
    { question: 'Jedna gra na resztę życia — jaka?', template: 'Na resztę życia wybieram: ' },
    { question: 'Najgorsza gra w jaką grałeś/aś?', template: 'Najgorsza gra ever: ' },
  ],
  ama: [
    { question: 'Co zawsze chciałeś zapytać, ale bałeś się?', template: 'Moje pytanie: ' },
  ],
  'przywitaj-sie': [
    { question: 'Skąd trafiłeś/aś na XDTV?', template: 'Trafiłem tu z ' },
    { question: 'Kim jesteś, czym się zajmujesz?', template: 'Siema, jestem ' },
  ],
};

const DEFAULT_HOT_TAKES = HOT_TAKES.general;

/* ── Quick-send chips for first message ── */
const QUICK_MESSAGES = [
  'Siema, jestem nowy/a! 👋',
  'Co oglądam: jeszcze nie wiem 😅',
  'Kto tu jest najlepszy?',
  'Lurker przechodzi na jasną stronę 🌗',
];

/* ── Polls for empty state ── */
const POLLS = [
  {
    question: 'Co robisz na XDTV?',
    options: [
      { emoji: '🎮', label: 'Oglądam streamy' },
      { emoji: '📺', label: 'Szukam klipów' },
      { emoji: '🗣️', label: 'Chcę pogadać' },
      { emoji: '👀', label: 'Tylko lurk' },
    ],
  },
  {
    question: 'Skąd znasz XDTV?',
    options: [
      { emoji: '📱', label: 'YouTube' },
      { emoji: '💜', label: 'Twitch' },
      { emoji: '🤝', label: 'Ktoś polecił' },
      { emoji: '🤷', label: 'Nie pamiętam' },
    ],
  },
  {
    question: 'Pierwszy raz na czacie?',
    options: [
      { emoji: '👋', label: 'Tak, siema!' },
      { emoji: '🔄', label: 'Nie, wracam' },
      { emoji: '👻', label: 'Lurker od roku' },
    ],
  },
];

/* ── Pattern 1: First Message Banner (above input) ── */
export function FirstMessageBanner({ onQuickSend }: { onQuickSend: (text: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-3 mb-2 rounded-xl border border-neon-purple/20 bg-neon-purple/5 p-3"
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-text-primary mb-2">
        <Sparkles className="w-4 h-4 text-neon-purple" />
        Nie bądź lurkerem. Napisz cokolwiek.
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_MESSAGES.map((msg) => (
          <button
            key={msg}
            onClick={() => onQuickSend(msg)}
            className="text-xs px-3 py-1.5 rounded-full border border-border-default bg-dark-800/60 text-text-muted hover:bg-neon-purple hover:text-white hover:border-neon-purple transition-all"
          >
            {msg}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Pattern 2: Hot Take Banner (top of messages) ── */
export function HotTakeBanner({
  channelSlug,
  onFillInput,
}: {
  channelSlug?: string;
  onFillInput: (text: string) => void;
}) {
  const takes = (channelSlug && HOT_TAKES[channelSlug]) || DEFAULT_HOT_TAKES;
  const take = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    return takes[day % takes.length];
  }, [takes]);

  return (
    <motion.button
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onFillInput(take.template)}
      className="mx-2 mb-2 flex items-center gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2.5 text-left transition-all hover:bg-amber-500/10 w-[calc(100%-1rem)]"
    >
      <Flame className="w-4 h-4 text-amber-400 shrink-0" />
      <span className="text-sm font-semibold text-text-primary flex-1">{take.question}</span>
      <span className="text-[0.65rem] text-text-dimmed shrink-0 hidden sm:inline">Kliknij ↓</span>
    </motion.button>
  );
}

/* ── Pattern 3: Quick Poll (empty state replacement) ── */
export function EmptyStatePoll({
  onQuickSend,
}: {
  onQuickSend: (text: string) => void;
}) {
  const [voted, setVoted] = useState(false);

  const poll = useMemo(() => {
    const day = Math.floor(Date.now() / 86_400_000);
    return POLLS[day % POLLS.length];
  }, []);

  const handleVote = (emoji: string, label: string) => {
    if (voted) return;
    setVoted(true);
    onQuickSend(`${emoji} ${label}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center h-full text-center px-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-neon-purple/10 flex items-center justify-center mb-4">
        <Zap className="w-7 h-7 text-neon-purple" />
      </div>
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-neon-purple mb-2">
        Szybka ankieta
      </p>
      <p className="text-text-primary font-semibold text-lg mb-4">{poll.question}</p>
      <div className="flex flex-wrap gap-2 justify-center max-w-sm">
        {poll.options.map((opt) => (
          <button
            key={opt.label}
            onClick={() => handleVote(opt.emoji, opt.label)}
            disabled={voted}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border-default bg-dark-800/60 text-sm text-text-primary transition-all hover:bg-neon-purple hover:text-white hover:border-neon-purple hover:scale-[1.03] disabled:opacity-40 disabled:cursor-default disabled:hover:bg-dark-800/60 disabled:hover:text-text-primary disabled:hover:border-border-default disabled:hover:scale-100"
          >
            <span>{opt.emoji}</span> {opt.label}
          </button>
        ))}
      </div>
      {!voted && (
        <p className="text-text-dimmed text-xs mt-4 italic">
          Kliknij — twoja odpowiedź pojawi się na czacie
        </p>
      )}
    </motion.div>
  );
}

/* ── System message rendering ── */
export function SystemMessage({ body, type }: { body: string; type?: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-1.5 ${type === 'daily_question' ? 'bg-neon-purple/5 border-l-2 border-neon-purple/30 my-1' : ''}`}>
      <span className="text-sm shrink-0">
        {type === 'trending' ? '📡' : type === 'daily_question' ? '📊' : type === 'pulse' ? '💬' : '🤖'}
      </span>
      <span className={`text-xs italic ${type === 'daily_question' ? 'text-text-muted font-medium' : 'text-text-dimmed'}`}>{body}</span>
    </div>
  );
}
