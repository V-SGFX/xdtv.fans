'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AppLayout } from '@/components/layout/app-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import {
  Bell, MessageSquare, ThumbsUp, Heart, Reply,
  CheckCheck, ArrowBigUp,
} from 'lucide-react';
import Link from 'next/link';
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
};

const typeColors: Record<string, string> = {
  COMMENT_ON_POST: 'text-neon-cyan',
  REPLY_TO_COMMENT: 'text-neon-purple',
  VOTE_ON_POST: 'text-neon-green',
  VOTE_ON_COMMENT: 'text-neon-green',
  NEW_FOLLOWER: 'text-neon-pink',
};

export default function NotificationsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const t = useTranslations('notifications');

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.push('/login'); return; }

    const fetch = async () => {
      try {
        const { data } = await api.get('/notifications?limit=50');
        setNotifications(data.data);
        setUnread(data.unreadCount);
      } catch { /* */ }
      setLoading(false);
    };
    fetch();
  }, [token, authLoading]);

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnread(0);
    } catch { /* */ }
  };

  const handleClick = async (n: Notification) => {
    if (!n.isRead) {
      api.post(`/notifications/${n.id}/read`).catch(() => {});
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
      setUnread((prev) => Math.max(0, prev - 1));
    }
    if (n.postId) router.push(`/posts/${n.postId}`);
  };

  if (authLoading || loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-neon-cyan border-t-transparent rounded-full animate-spin" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-pink/10 flex items-center justify-center">
              <Bell className="w-5 h-5 text-neon-pink" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white">{t('title')}</h1>
              {unread > 0 && (
                <p className="text-sm text-neon-pink">{t('newCount', { count: unread })}</p>
              )}
            </div>
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck className="w-4 h-4" /> {t('markAll')}
            </Button>
          )}
        </div>

        {/* List */}
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 text-white/20 mx-auto mb-3" />
              <p className="text-white/40">{t('empty')}</p>
            </div>
          ) : (
            notifications.map((n, i) => {
              const Icon = typeIcons[n.type] || Bell;
              const color = typeColors[n.type] || 'text-text-muted';
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => handleClick(n)}
                  className={`
                    flex items-start gap-3 p-4 rounded-xl border transition-all cursor-pointer
                    ${n.isRead
                      ? 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                      : 'bg-neon-pink/[0.04] border-neon-pink/20 hover:border-neon-pink/40'
                    }
                  `}
                >
                  <div className="relative">
                    {n.actor ? (
                      <Avatar src={n.actor.avatarUrl} name={n.actor.displayName || n.actor.username} size="sm" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center">
                        <Icon className={`w-4 h-4 ${color}`} />
                      </div>
                    )}
                    {!n.isRead && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-neon-pink rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.isRead ? 'text-white/50' : 'text-white'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-white/25 mt-0.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: pl })}
                    </p>
                  </div>
                  <Icon className={`w-4 h-4 mt-1 shrink-0 ${color}`} />
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </AppLayout>
  );
}
