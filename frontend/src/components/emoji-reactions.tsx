'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SmilePlus, Globe, Crown, Lock, Search, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import Image from 'next/image';

/* ── Unicode reactions (free for everyone) ── */
const UNICODE_REACTIONS = [
  { emoji: '🔥', label: 'Fire' },
  { emoji: '❤️', label: 'Love' },
  { emoji: '😂', label: 'Laugh' },
  { emoji: '😮', label: 'Wow' },
  { emoji: '👍', label: 'Up' },
  { emoji: '👎', label: 'Down' },
  { emoji: '🎉', label: 'Party' },
  { emoji: '💀', label: 'Skull' },
  { emoji: '🤔', label: 'Think' },
  { emoji: '💜', label: 'Purple' },
];

/* ── Types ── */
export interface CustomEmoji {
  id: number;
  name: string;
  code: string;
  url: string;
  isAnimated: boolean;
  isGlobal: boolean;
  isPremium: boolean;
  streamerProfileId: number | null;
  streamerProfile?: { id: number; slug: string; name: string } | null;
}

interface ReactionCount {
  emoji: string;
  count: number;
  reacted: boolean;
  users?: { id: number; username: string; displayName: string | null }[];
}

/* ── Shared emoji cache ── */
let emojiCache: CustomEmoji[] | null = null;
let emojiFetchPromise: Promise<CustomEmoji[]> | null = null;

export function invalidateEmojiCache() {
  emojiCache = null;
  emojiFetchPromise = null;
}

export async function fetchEmojis(): Promise<CustomEmoji[]> {
  if (emojiCache) return emojiCache;
  if (emojiFetchPromise) return emojiFetchPromise;
  emojiFetchPromise = api.get('/emojis').then(({ data }) => {
    emojiCache = data;
    return data;
  }).catch(() => {
    emojiFetchPromise = null;
    return [];
  });
  return emojiFetchPromise;
}

/** Resolve an emoji string to either a Unicode char or a custom emoji image URL */
export function resolveEmoji(emojiStr: string, emojis: CustomEmoji[]): { type: 'unicode'; char: string } | { type: 'custom'; emoji: CustomEmoji } | null {
  if (emojiStr.startsWith(':') && emojiStr.endsWith(':')) {
    const code = emojiStr.slice(1, -1);
    const found = emojis.find((e) => e.code === code);
    if (found) return { type: 'custom', emoji: found };
    return null;
  }
  return { type: 'unicode', char: emojiStr };
}

/* ═══════════════════════════════════════════════════════════
   EmojiDisplay — renders a single emoji (unicode or custom)
   ═══════════════════════════════════════════════════════════ */
export function EmojiDisplay({ emoji, emojis, size = 'sm' }: { emoji: string; emojis: CustomEmoji[]; size?: 'sm' | 'md' | 'lg' }) {
  const resolved = resolveEmoji(emoji, emojis);
  const sizeMap = { sm: 16, md: 20, lg: 24 };
  const textSize = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };

  if (!resolved) return <span className={textSize[size]}>❓</span>;

  if (resolved.type === 'unicode') {
    return <span className={textSize[size]}>{resolved.char}</span>;
  }

  return (
    <Image
      src={resolved.emoji.url}
      alt={resolved.emoji.name}
      width={sizeMap[size]}
      height={sizeMap[size]}
      className={`inline-block ${resolved.emoji.isAnimated ? '' : ''}`}
      unoptimized={resolved.emoji.isAnimated}
    />
  );
}

/* ═══════════════════════════════════════════════════════════
   EmojiPicker — categorized picker (Reakcje / Globalne / Streamer / Premium)
   ═══════════════════════════════════════════════════════════ */
type PickerTab = 'reactions' | 'global' | 'streamer' | 'premium';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  streamerProfileId?: number | null;
  compact?: boolean;
}

export function EmojiPicker({ onSelect, onClose, streamerProfileId, compact }: EmojiPickerProps) {
  const [tab, setTab] = useState<PickerTab>('reactions');
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEmojis().then((data) => { setCustomEmojis(data); setLoading(false); });
  }, []);

  const globalEmojis = useMemo(() => customEmojis.filter((e) => e.isGlobal && !e.isPremium), [customEmojis]);
  const streamerEmojis = useMemo(
    () => streamerProfileId ? customEmojis.filter((e) => e.streamerProfileId === streamerProfileId) : [],
    [customEmojis, streamerProfileId],
  );
  const premiumEmojis = useMemo(() => customEmojis.filter((e) => e.isPremium), [customEmojis]);

  const filteredUnicode = search
    ? UNICODE_REACTIONS.filter((r) => r.label.toLowerCase().includes(search.toLowerCase()))
    : UNICODE_REACTIONS;

  const filterCustom = (list: CustomEmoji[]) =>
    search ? list.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()) || e.code.toLowerCase().includes(search.toLowerCase())) : list;

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    onClose?.();
  };

  const tabs: { key: PickerTab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: 'reactions', label: 'Reakcje', icon: <SmilePlus className="w-3.5 h-3.5" />, count: UNICODE_REACTIONS.length },
    { key: 'global', label: 'Globalne', icon: <Globe className="w-3.5 h-3.5" />, count: globalEmojis.length },
    ...(streamerEmojis.length > 0 ? [{ key: 'streamer' as PickerTab, label: 'Streamer', icon: <Sparkles className="w-3.5 h-3.5" />, count: streamerEmojis.length }] : []),
    { key: 'premium', label: 'Premium', icon: <Crown className="w-3.5 h-3.5" />, count: premiumEmojis.length },
  ];

  return (
    <div
      className={`bg-dark-800 border border-border-default rounded-xl shadow-xl shadow-black/50 ${compact ? 'w-64' : 'w-80'}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="p-2 border-b border-border-default">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-dimmed" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj emoji..."
            className="w-full bg-dark-700 border border-border-default rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-dimmed focus:outline-none focus:border-neon-purple/50"
            autoFocus
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 text-2xs font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-neon-purple text-neon-purple'
                : 'border-transparent text-text-dimmed hover:text-text-muted'
            }`}
            title={`${t.label} (${t.count})`}
          >
            {t.icon}
            {!compact && <span>{t.label}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-2 max-h-48 overflow-y-auto scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="w-5 h-5 border-2 border-neon-purple/30 border-t-neon-purple rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Unicode tab */}
            {tab === 'reactions' && (
              <div className="grid grid-cols-5 gap-1">
                {filteredUnicode.map((r) => (
                  <motion.button
                    key={r.emoji}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => handleSelect(r.emoji)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-dark-600 transition-colors text-lg"
                    title={r.label}
                  >
                    {r.emoji}
                  </motion.button>
                ))}
              </div>
            )}

            {/* Global custom */}
            {tab === 'global' && (
              <CustomEmojiGrid emojis={filterCustom(globalEmojis)} onSelect={handleSelect} emptyText="Brak globalnych emoji" />
            )}

            {/* Streamer-specific */}
            {tab === 'streamer' && (
              <CustomEmojiGrid emojis={filterCustom(streamerEmojis)} onSelect={handleSelect} emptyText="Brak emoji streamera" />
            )}

            {/* Premium */}
            {tab === 'premium' && (
              <CustomEmojiGrid emojis={filterCustom(premiumEmojis)} onSelect={handleSelect} emptyText="Brak premium emoji" isPremium />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Custom emoji grid ── */
function CustomEmojiGrid({
  emojis,
  onSelect,
  emptyText,
  isPremium,
}: {
  emojis: CustomEmoji[];
  onSelect: (emoji: string) => void;
  emptyText: string;
  isPremium?: boolean;
}) {
  if (emojis.length === 0) {
    return (
      <div className="flex flex-col items-center py-6 gap-2">
        {isPremium ? <Crown className="w-5 h-5 text-neon-yellow/50" /> : <Globe className="w-5 h-5 text-text-dimmed" />}
        <span className="text-2xs text-text-dimmed">{emptyText}</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-1">
      {emojis.map((e) => (
        <motion.button
          key={e.id}
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.85 }}
          onClick={() => onSelect(`:${e.code}:`)}
          className="relative w-9 h-9 flex items-center justify-center rounded-lg hover:bg-dark-600 transition-colors group"
          title={`:${e.code}:`}
        >
          <Image
            src={e.url}
            alt={e.name}
            width={24}
            height={24}
            className="rounded-sm"
            unoptimized={e.isAnimated}
          />
          {e.isPremium && (
            <Crown className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 text-neon-yellow" />
          )}
          {/* Tooltip */}
          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
            <div className="bg-dark-900 border border-border-default rounded-md px-2 py-1 text-2xs text-text-secondary whitespace-nowrap shadow-lg">
              :{e.code}:
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EmojiReactions — reaction bar under messages (hover picker + existing reactions)
   ═══════════════════════════════════════════════════════════ */
interface EmojiReactionsProps {
  reactions?: ReactionCount[];
  onReact?: (emoji: string) => void;
  streamerProfileId?: number | null;
}

export function EmojiReactions({ reactions = [], onReact, streamerProfileId }: EmojiReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetchEmojis().then(setCustomEmojis);
  }, []);

  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setShowPicker(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setShowPicker(false), 400);
  };

  return (
    <div className="relative flex items-center gap-1" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} onClick={(e) => e.stopPropagation()}>
      {/* Existing reactions */}
      {reactions.map((r) => (
        <ReactionBadge key={r.emoji} reaction={r} emojis={customEmojis} onReact={onReact} />
      ))}

      {/* Add reaction button */}
      <div className="relative" onMouseEnter={handleMouseEnter}>
        <motion.button
          whileHover={{ scale: 1.1 }}
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 text-text-dimmed hover:text-text-muted hover:bg-dark-700 rounded-lg transition-colors"
        >
          <SmilePlus className="w-4 h-4" />
        </motion.button>

        {/* Picker popup */}
        <AnimatePresence>
          {showPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 5 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 5 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-full left-0 mb-2 z-50"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={(e) => e.stopPropagation()}
            >
              <EmojiPicker
                onSelect={(emoji) => {
                  onReact?.(emoji);
                  setShowPicker(false);
                }}
                streamerProfileId={streamerProfileId}
                compact
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ── Single reaction badge with tooltip ── */
function ReactionBadge({
  reaction,
  emojis,
  onReact,
}: {
  reaction: ReactionCount;
  emojis: CustomEmoji[];
  onReact?: (emoji: string) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => onReact?.(reaction.emoji)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all
          ${reaction.reacted
            ? 'bg-neon-purple/15 border border-neon-purple/30 text-text-primary'
            : 'bg-dark-700 border border-border-default text-text-secondary hover:border-border-hover'
          }
        `}
      >
        <EmojiDisplay emoji={reaction.emoji} emojis={emojis} size="sm" />
        <span className="font-medium">{reaction.count}</span>
      </motion.button>

      {/* Tooltip: show who reacted */}
      <AnimatePresence>
        {showTooltip && reaction.users && reaction.users.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="bg-dark-900 border border-border-default rounded-lg px-3 py-2 shadow-xl shadow-black/50 min-w-max">
              <div className="flex items-center gap-1.5 mb-1">
                <EmojiDisplay emoji={reaction.emoji} emojis={emojis} size="md" />
                <span className="text-2xs text-text-dimmed font-medium">{reaction.count}</span>
              </div>
              <div className="space-y-0.5">
                {reaction.users.slice(0, 10).map((u) => (
                  <p key={u.id} className="text-2xs text-text-secondary">
                    {u.displayName || u.username}
                  </p>
                ))}
                {reaction.users.length > 10 && (
                  <p className="text-2xs text-text-dimmed">
                    i {reaction.users.length - 10} więcej...
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

