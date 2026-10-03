'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { Avatar } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Bell, MessageSquare, ThumbsUp, Heart, Reply,
  ArrowBigUp, CheckCheck, ExternalLink,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Notification {
  id: number;
  type: string;
  message: string;
  postId: number | null;
  commentId: number | null;
  isRead: boolean;
  createdAt: string;
  actor: { id: number; username: string; displayName: string | null; avatarUrl: string | null } | null;
}

const typeIcons: Record<string, any> = {
  COMMENT_ON_POST: MessageSquare,
  REPLY_TO_COMMENT: Reply,
  VOTE_ON_POST: ArrowBigUp,
  VOTE_ON_COMMENT: ThumbsUp,
  NEW_FOLLOWER: Heart,
  MENTION: MessageSquare,
};

const typeColors: Record<string, string> = {
  COMMENT_ON_POST: 'text-neon-cyan',
  REPLY_TO_COMMENT: 'text-neon-purple',
  VOTE_ON_POST: 'text-neon-green',
  VOTE_ON_COMMENT: 'text-neon-green',
  NEW_FOLLOWER: 'text-neon-pink',
  MENTION: 'text-neon-cyan',
};

interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  onUnreadChange?: (count: number) => void;
}

export function NotificationsDropdown({ open, onClose, anchorRef, onUnreadChange }: NotificationsDropdownProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = useTranslations('notifications');

  const fetchNotifications = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications?limit=15');
      setNotifications(data.data);
      setUnreadCount(data.unreadCount);
      onUnreadChange?.(data.unreadCount);
    } catch { /* */ }
    setLoading(false);
  }, [onUnreadChange]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, anchorRef]);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      onUnreadChange?.(0);
    } catch { /* */ }
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      onUnreadChange?.(newCount);
    }
    onClose();
    if (n.postId) router.push(`/posts/${n.postId}`);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dropdownRef}
          initial={{ opacity: 0, y: -8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="absolute right-0 top-full mt-2 w-[380px] z-dropdown bg-black/90 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-2xl shadow-black/70 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-neon-pink" />
              <span className="text-sm font-semibold text-white">{t('title')}</span>
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-neon-pink text-white text-2xs font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-2xs text-white/30 hover:text-neon-cyan transition-colors flex items-center gap-1"
                >
                  <CheckCheck className="w-3 h-3" />
                  {t('markAll')}
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="py-8 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-sm text-white/40">{t('empty')}</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((n) => {
                  const Icon = typeIcons[n.type] || Bell;
                  const color = typeColors[n.type] || 'text-text-muted';

                  return (
                    <button
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`
                        w-full flex items-start gap-3 px-4 py-3 text-left transition-colors
                        ${n.isRead
                          ? 'hover:bg-white/[0.04]'
                          : 'bg-neon-pink/[0.03] hover:bg-neon-pink/[0.06]'
                        }
                      `}
                    >
                      <div className="relative shrink-0 mt-0.5">
                        {n.actor ? (
                          <Avatar src={n.actor.avatarUrl} name={n.actor.displayName || n.actor.username} size="sm" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
                            <Icon className={`w-3.5 h-3.5 ${color}`} />
                          </div>
                        )}
                        {!n.isRead && (
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-pink rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${n.isRead ? 'text-white/50' : 'text-white'}`}>
                          {n.message}
                        </p>
                        <p className="text-2xs text-white/25 mt-0.5">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: pl })}
                        </p>
                      </div>
                      <Icon className={`w-3.5 h-3.5 mt-1 shrink-0 ${color}`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-white/[0.06] px-4 py-2.5">
            <button
              onClick={() => {
                onClose();
                router.push('/notifications');
              }}
              className="w-full text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors flex items-center justify-center gap-1"
            >
              {t('seeAll')}
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
