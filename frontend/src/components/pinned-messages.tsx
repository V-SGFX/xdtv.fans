'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Pin, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';

interface PinnedMessage {
  id: number;
  content: string;
  createdAt: string;
  author: {
    id: number;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
}

interface PinnedMessagesProps {
  messages: PinnedMessage[];
  onClose: () => void;
  onUnpin?: (messageId: number) => void;
  canUnpin?: boolean;
}

export function PinnedMessages({ messages, onClose, onUnpin, canUnpin }: PinnedMessagesProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="border-b border-dark-700/50 bg-dark-900/90 backdrop-blur-md max-h-64 overflow-y-auto"
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-dark-700/50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-neon-purple/10 flex items-center justify-center">
            <Pin className="w-2.5 h-2.5 text-neon-purple" />
          </div>
          <span className="text-2xs font-bold uppercase tracking-[0.12em] text-text-muted">
            Przypięte ({messages.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-text-dimmed hover:text-text-primary rounded-lg hover:bg-dark-700/40 transition-all duration-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="divide-y divide-dark-700/30">
        {messages.map((m) => (
          <div key={m.id} className="flex gap-3 px-5 py-3 hover:bg-dark-800/40 transition-all duration-200 group">
            <Avatar
              src={m.author.avatarUrl}
              name={m.author.displayName || m.author.username}
              size="xs"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text-primary">
                  {m.author.displayName || m.author.username}
                </span>
                <span className="text-2xs text-text-dimmed/60">
                  {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: pl })}
                </span>
                {canUnpin && onUnpin && (
                  <button
                    onClick={() => onUnpin(m.id)}
                    className="ml-auto opacity-0 group-hover:opacity-100 text-2xs text-text-dimmed hover:text-neon-red px-2 py-0.5 rounded-md hover:bg-neon-red/10 transition-all duration-200"
                  >
                    Odepnij
                  </button>
                )}
              </div>
              <p className="text-xs text-text-secondary/80 break-words line-clamp-2 mt-0.5">{m.content}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
