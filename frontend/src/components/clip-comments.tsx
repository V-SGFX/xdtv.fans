'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Avatar } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { useTranslations, useLocale } from 'next-intl';
import { X, Send, Heart, Loader2, MessageSquare } from 'lucide-react';

interface Comment {
  id: number;
  content: string;
  createdAt: string;
  upvotes: number;
  author: {
    id: number;
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
    role: string;
  };
  replies?: Comment[];
}

interface ClipCommentsProps {
  postId: number;
  open: boolean;
  onClose: () => void;
  onCommentAdded?: () => void;
}

export function ClipComments({ postId, open, onClose, onCommentAdded }: ClipCommentsProps) {
  const { user, token } = useAuth();
  const t = useTranslations('clips');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [votes, setVotes] = useState<Record<number, 'UP' | 'DOWN'>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/comments?postId=${postId}&limit=50`);
      setComments(data.data || data || []);
    } catch { /* */ }
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    if (open) {
      fetchComments();
      // Focus input after animation
      setTimeout(() => inputRef.current?.focus(), 400);
    }
  }, [open, fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !token || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/comments', {
        postId,
        content: newComment.trim(),
      });
      setComments(prev => [data, ...prev]);
      setNewComment('');
      onCommentAdded?.();
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch { /* */ }
    setSubmitting(false);
  };

  const handleVote = async (commentId: number) => {
    if (!token) return;
    const current = votes[commentId];
    const direction = current === 'UP' ? 'down' : 'up';
    try {
      const { data } = await api.post(`/comments/${commentId}/vote`, { direction });
      setVotes(prev => ({
        ...prev,
        [commentId]: direction === 'up' ? 'UP' : undefined as any,
      }));
      setComments(prev => prev.map(c =>
        c.id === commentId ? { ...c, upvotes: data.upvotes ?? c.upvotes } : c
      ));
    } catch { /* */ }
  };

  const roleBadge = (role: string) => {
    if (role === 'ADMIN') return <span className="px-1 py-0.5 text-2xs font-bold bg-neon-red/20 text-neon-red rounded ml-1">ADMIN</span>;
    if (role === 'MODERATOR') return <span className="px-1 py-0.5 text-2xs font-bold bg-neon-cyan/20 text-neon-cyan rounded ml-1">MOD</span>;
    if (role === 'STREAMER') return <span className="px-1 py-0.5 text-2xs font-bold bg-neon-purple/20 text-neon-purple rounded ml-1">STREAMER</span>;
    return null;
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 z-30"
            onClick={onClose}
          />
          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-40 flex flex-col bg-dark-900/95 backdrop-blur-xl rounded-t-2xl border-t border-white/10"
            style={{ maxHeight: '65vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-white/60" />
                <span className="text-sm font-semibold text-white">
                  {t('comments', { count: comments.length })}
                </span>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comments list */}
            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 text-neon-pink animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-10">
                  <MessageSquare className="w-10 h-10 text-white/20 mx-auto mb-2" />
                  <p className="text-white/40 text-sm">{t('noComments')}</p>
                  <p className="text-white/25 text-xs mt-1">{t('beFirstComment')}</p>
                </div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar
                      src={c.author.avatarUrl}
                      name={c.author.displayName || c.author.username}
                      size="xs"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs font-semibold text-white/90">
                          {c.author.displayName || c.author.username}
                        </span>
                        {roleBadge(c.author.role)}
                        <span className="text-2xs text-white/30 ml-1">
                          {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true, locale: dateLocale })}
                        </span>
                      </div>
                      <p className="text-sm text-white/80 mt-0.5 break-words whitespace-pre-wrap">{c.content}</p>
                      {/* Reply like button */}
                      <button
                        onClick={() => handleVote(c.id)}
                        className={`flex items-center gap-1 mt-1 text-2xs transition-colors ${
                          votes[c.id] === 'UP'
                            ? 'text-neon-pink'
                            : 'text-white/30 hover:text-neon-pink'
                        }`}
                      >
                        <Heart className={`w-3 h-3 ${votes[c.id] === 'UP' ? 'fill-current' : ''}`} />
                        {c.upvotes > 0 && <span>{c.upvotes}</span>}
                      </button>

                      {/* Nested replies (1 level) */}
                      {c.replies && c.replies.length > 0 && (
                        <div className="mt-2 ml-2 pl-2 border-l border-white/10 space-y-3">
                          {c.replies.map(r => (
                            <div key={r.id} className="flex gap-2">
                              <Avatar
                                src={r.author.avatarUrl}
                                name={r.author.displayName || r.author.username}
                                size="xs"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <span className="text-xs font-semibold text-white/80">{r.author.displayName || r.author.username}</span>
                                  {roleBadge(r.author.role)}
                                  <span className="text-2xs text-white/25">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true, locale: dateLocale })}</span>
                                </div>
                                <p className="text-xs text-white/70 mt-0.5 break-words">{r.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment input */}
            {token ? (
              <form onSubmit={handleSubmit} className="shrink-0 flex items-center gap-2 px-4 py-3 border-t border-white/10 bg-dark-900/80">
                <Avatar
                  src={user?.avatarUrl}
                  name={user?.displayName || user?.username || ''}
                  size="xs"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder={t('addComment')}
                  maxLength={1000}
                  className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-neon-pink/50"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || submitting}
                  className="p-2 rounded-full bg-neon-pink/80 hover:bg-neon-pink text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              <div className="shrink-0 text-center py-3 border-t border-white/10 text-white/40 text-xs">
                <a href="/login" className="text-neon-pink hover:underline">{t('loginToComment')}</a>{t('toAddComment')}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
