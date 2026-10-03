'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/avatar';
import { EmojiPicker, EmojiDisplay, CustomEmoji, fetchEmojis } from '@/components/emoji-reactions';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { SmilePlus, Pin, Trash2, VolumeX, Ban } from 'lucide-react';

interface ReactionUser {
  id: number;
  username: string;
  displayName: string | null;
}

interface ReactionGroup {
  emoji: string;
  count: number;
  userIds: number[];
  users?: ReactionUser[];
}

interface ChatMessageProps {
  id: number;
  content: string;
  createdAt: string;
  isPinned?: boolean;
  author: {
    id: number;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  reactions?: ReactionGroup[];
  cosmetics?: { type: string; value: string }[];
  isGrouped?: boolean;
  isOwn?: boolean;
  currentUserId?: number;
  canModerate?: boolean;
  streamerProfileId?: number | null;
  onDelete?: (id: number) => void;
  onReact?: (messageId: number, emoji: string) => void;
  onPin?: (messageId: number) => void;
  onMute?: (userId: number) => void;
  onBan?: (userId: number) => void;
}

const roleColors: Record<string, string> = {
  ADMIN: 'text-neon-red',
  MODERATOR: 'text-neon-green',
  STREAMER: 'text-neon-purple',
  USER: 'text-text-primary',
};

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-neon-red/10 text-neon-red border-neon-red/20',
  MODERATOR: 'bg-neon-green/10 text-neon-green border-neon-green/20',
  STREAMER: 'bg-neon-purple/10 text-neon-purple border-neon-purple/20',
};

const QUICK_REACTIONS = ['🔥', '❤️', '😂', '👍', '💀'];

export function ChatMessage({
  id,
  content,
  createdAt,
  isPinned,
  author,
  reactions = [],
  cosmetics = [],
  isGrouped,
  isOwn,
  currentUserId,
  canModerate,
  streamerProfileId,
  onDelete,
  onReact,
  onPin,
  onMute,
  onBan,
}: ChatMessageProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [customEmojis, setCustomEmojis] = useState<CustomEmoji[]>([]);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);
  const displayName = author.displayName || author.username;

  // Resolve cosmetic styles
  const chatColor = cosmetics.find((c) => c.type === 'CHAT_COLOR');
  const chatBorder = cosmetics.find((c) => c.type === 'CHAT_BORDER');
  const chatBadge = cosmetics.find((c) => c.type === 'CHAT_BADGE');
  const nickEffect = cosmetics.find((c) => c.type === 'NICKNAME_EFFECT');

  const nameStyle: React.CSSProperties = {};
  let nameClassName = `text-sm font-semibold ${roleColors[author.role] || 'text-text-primary'}`;
  if (chatColor) {
    if (chatColor.value === 'rainbow') {
      nameStyle.background = 'linear-gradient(90deg, #ff0000, #ff7700, #ffff00, #00ff00, #0077ff, #8b00ff)';
      nameStyle.WebkitBackgroundClip = 'text';
      nameStyle.WebkitTextFillColor = 'transparent';
    } else {
      nameStyle.color = chatColor.value;
    }
  }
  if (nickEffect?.value === 'glow') nameClassName += ' drop-shadow-[0_0_6px_currentColor]';

  const borderStyles: Record<string, string> = {
    fire: 'border-l-2 border-orange-500/50 bg-orange-500/[0.03]',
    ice: 'border-l-2 border-blue-400/50 bg-blue-400/[0.03]',
    neon: 'border-l-2 border-neon-cyan/50 bg-neon-cyan/[0.03]',
    glitch: 'border-l-2 border-purple-500/50 bg-purple-500/[0.03]',
  };
  const borderClass = chatBorder ? borderStyles[chatBorder.value] || '' : '';

  const badgeEmojis: Record<string, string> = { vip: '⭐', crown: '👑', diamond: '💎' };

  useEffect(() => {
    fetchEmojis().then(setCustomEmojis);
  }, []);

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerBtnRef.current?.contains(e.target as Node)) return;
      setShowPicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const openPicker = useCallback(() => {
    if (pickerBtnRef.current) {
      const rect = pickerBtnRef.current.getBoundingClientRect();
      const pickerW = 256; // w-64 = 16rem = 256px
      const pickerH = 320; // approximate picker height
      let top = rect.top - pickerH - 8;
      let left = rect.right - pickerW;
      // If goes above viewport, show below
      if (top < 8) top = rect.bottom + 8;
      // Keep within right edge
      if (left + pickerW > window.innerWidth - 8) left = window.innerWidth - pickerW - 8;
      if (left < 8) left = 8;
      setPickerPos({ top, left });
    }
    setShowPicker((v) => !v);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`group relative flex gap-3 px-4 ${isGrouped ? 'py-0.5' : 'py-1.5'} hover:bg-dark-800/40 transition-colors ${
        isPinned ? 'border-l-2 border-neon-purple/50 bg-neon-purple/[0.03]' : borderClass
      }`}
    >
      {/* Hover action bar */}
      <div className="absolute -top-3 right-4 opacity-0 group-hover:opacity-100 transition-all duration-150 z-10">
        <div className="flex items-center gap-0.5 bg-dark-800 border border-border-default rounded-lg shadow-xl shadow-black/30 p-0.5">
          {QUICK_REACTIONS.map((emoji) => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.8 }}
              onClick={() => onReact?.(id, emoji)}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-dark-600 text-sm transition-colors"
            >
              {emoji}
            </motion.button>
          ))}
          <div className="w-px h-5 bg-border-default mx-0.5" />
          {onReact && (
            <button
              ref={pickerBtnRef}
              onClick={openPicker}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-dimmed hover:text-text-primary hover:bg-dark-600 transition-colors"
              title="Więcej reakcji"
            >
              <SmilePlus className="w-3.5 h-3.5" />
            </button>
          )}
          {canModerate && onPin && (
            <button
              onClick={() => onPin(id)}
              className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
                isPinned
                  ? 'text-neon-purple hover:bg-neon-purple/10'
                  : 'text-text-dimmed hover:text-text-primary hover:bg-dark-600'
              }`}
              title={isPinned ? 'Odepnij' : 'Przypnij'}
            >
              <Pin className="w-3.5 h-3.5" />
            </button>
          )}
          {(isOwn || canModerate) && onDelete && (
            <button
              onClick={() => onDelete(id)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-dimmed hover:text-neon-red hover:bg-neon-red/10 transition-colors"
              title="Usuń"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canModerate && !isOwn && onMute && (
            <button
              onClick={() => onMute(author.id)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-dimmed hover:text-neon-yellow hover:bg-neon-yellow/10 transition-colors"
              title="Wycisz (15 min)"
            >
              <VolumeX className="w-3.5 h-3.5" />
            </button>
          )}
          {canModerate && !isOwn && onBan && (
            <button
              onClick={() => onBan(author.id)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-dimmed hover:text-neon-red hover:bg-neon-red/10 transition-colors"
              title="Zbanuj"
            >
              <Ban className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Extended emoji picker (fixed position to escape overflow) */}
      <AnimatePresence>
        {showPicker && pickerPos && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed z-dropdown"
            style={{ top: pickerPos.top, left: pickerPos.left }}
          >
            <EmojiPicker
              onSelect={(emoji) => {
                onReact?.(id, emoji);
                setShowPicker(false);
              }}
              onClose={() => setShowPicker(false)}
              streamerProfileId={streamerProfileId}
              compact
            />
          </motion.div>
        )}
      </AnimatePresence>

      {isGrouped ? (
        <div className="w-8 shrink-0 flex items-center justify-center">
          <span className="text-2xs text-text-dimmed opacity-0 group-hover:opacity-100 transition-opacity select-none">
            {new Date(createdAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      ) : (
        <Avatar
          src={author.avatarUrl}
          name={displayName}
          size="sm"
          status={author.role === 'STREAMER' ? 'live' : 'online'}
        />
      )}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
        <div className="flex items-center gap-2">
          <span className={nameClassName} style={nameStyle}>
            {displayName}
          </span>
          {chatBadge && (
            <span className="text-xs" title={chatBadge.value}>{badgeEmojis[chatBadge.value] || '✨'}</span>
          )}
          {author.role !== 'USER' && (
            <span className={`text-2xs font-bold uppercase px-1.5 py-0.5 rounded border ${roleBadgeColors[author.role] || ''}`}>
              {author.role}
            </span>
          )}
          {isPinned && (
            <Pin className="w-2.5 h-2.5 text-neon-purple" />
          )}
          <span className="text-2xs text-text-dimmed">
            {formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: pl })}
          </span>
        </div>
        )}
        <p className="text-sm text-text-secondary break-words mt-0.5">{content}</p>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {reactions.map((r) => {
              const reacted = currentUserId ? r.userIds.includes(currentUserId) : false;
              return (
                <ReactionBubble
                  key={r.emoji}
                  reaction={r}
                  reacted={reacted}
                  emojis={customEmojis}
                  onClick={() => onReact?.(id, r.emoji)}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ── Reaction bubble with pop animation + hover tooltip ── */
function ReactionBubble({
  reaction,
  reacted,
  emojis,
  onClick,
}: {
  reaction: ReactionGroup;
  reacted: boolean;
  emojis: CustomEmoji[];
  onClick: () => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative">
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`
          flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all
          ${reacted
            ? 'bg-neon-purple/15 border border-neon-purple/30 text-text-primary'
            : 'bg-dark-700/50 border border-border-default text-text-secondary hover:border-border-hover'
          }
        `}
      >
        <EmojiDisplay emoji={reaction.emoji} emojis={emojis} size="sm" />
        <span className="font-medium">{reaction.count}</span>
      </motion.button>

      {/* Tooltip: who reacted */}
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
              </div>
              <div className="space-y-0.5">
                {reaction.users.slice(0, 8).map((u) => (
                  <p key={u.id} className="text-2xs text-text-secondary">
                    {u.displayName || u.username}
                  </p>
                ))}
                {reaction.users.length > 8 && (
                  <p className="text-2xs text-text-dimmed">
                    i {reaction.users.length - 8} więcej...
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
