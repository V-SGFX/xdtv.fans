'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { useTranslations, useLocale } from 'next-intl';
import { ArrowBigUp, ArrowBigDown, MessageSquare, CornerDownRight, Trash2, ChevronDown, Minus, X } from 'lucide-react';
import { ReportButton } from '@/components/report-modal';
import type { Comment as CommentType } from '@/lib/types';

interface CommentProps {
  comment: CommentType;
  depth?: number;
  currentUserId?: number;
  sort?: string;
  onReply: (parentId: number, content: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onVote: (id: number, direction: 'up' | 'down') => Promise<{ vote: 'UP' | 'DOWN' | null; upvotes: number; downvotes: number }>;
}

const MAX_DEPTH = 10;

const ROLE_BADGE: Record<string, 'admin' | 'mod' | 'streamer' | undefined> = {
  ADMIN: 'admin',
  MODERATOR: 'mod',
  STREAMER: 'streamer',
};

export function Comment({ comment, depth = 0, currentUserId, sort = 'best', onReply, onDelete, onVote }: CommentProps) {
  const t = useTranslations('comments');
  const locale = useLocale();
  const dateLocale = locale === 'pl' ? pl : enUS;
  const [showReply, setShowReply] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState((comment.upvotes - comment.downvotes) < -5);
  const [localVote, setLocalVote] = useState<'UP' | 'DOWN' | null>(comment.userVote ?? null);
  const [localUp, setLocalUp] = useState(comment.upvotes);
  const [localDown, setLocalDown] = useState(comment.downvotes);
  const [extraReplies, setExtraReplies] = useState<CommentType[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState((comment.replyCount ?? 0) > (comment.replies?.length ?? 0));

  const isOwn = currentUserId === comment.author.id;
  const score = localUp - localDown;

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, replyContent.trim());
      setReplyContent('');
      setShowReply(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (direction: 'up' | 'down') => {
    try {
      const result = await onVote(comment.id, direction);
      setLocalVote(result.vote);
      setLocalUp(result.upvotes);
      setLocalDown(result.downvotes);
    } catch {}
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      const currentCount = (comment.replies?.length ?? 0) + extraReplies.length;
      const page = Math.floor(currentCount / 10) + 1;
      const { data } = await api.get(`/comments/${comment.id}/replies?sort=${sort}&page=${page}&limit=10`);
      const newReplies = data.data.filter(
        (r: CommentType) => !(comment.replies ?? []).some(e => e.id === r.id) && !extraReplies.some(e => e.id === r.id)
      );
      setExtraReplies(prev => [...prev, ...newReplies]);
      const totalLoaded = currentCount + newReplies.length;
      setHasMore(totalLoaded < (comment.replyCount ?? 0));
    } catch {} finally {
      setLoadingMore(false);
    }
  };

  const allReplies = [...(comment.replies ?? []), ...extraReplies];

  if (collapsed) {
    return (
      <div className={depth > 0 ? 'ml-6 pl-4 border-l border-dark-600' : ''}>
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          <ChevronDown className="w-3 h-3" />
          <Avatar
            src={comment.author.avatarUrl}
            name={comment.author.displayName || comment.author.username}
            size="xs"
          />
          <span className="font-medium">{comment.author.displayName || comment.author.username}</span>
          <span className="text-text-dimmed">{score} {t('points')}</span>
          <span className="text-text-dimmed">• {comment.replyCount ?? allReplies.length} {t('replies')}</span>
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: depth > 0 ? -10 : 0 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={depth > 0 ? 'ml-6 pl-4 border-l border-dark-600' : ''}
    >
      <div className="py-3 group">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <button onClick={() => setCollapsed(true)} className="text-text-dimmed hover:text-text-muted transition-colors">
            <Minus className="w-3 h-3" />
          </button>
          <Avatar
            src={comment.author.avatarUrl}
            name={comment.author.displayName || comment.author.username}
            size="xs"
          />
          <span className="text-sm font-medium text-text-primary">
            {comment.author.displayName || comment.author.username}
          </span>
          {ROLE_BADGE[comment.author.role] && (
            <Badge variant={ROLE_BADGE[comment.author.role]!}>
              {comment.author.role}
            </Badge>
          )}
          <span className="text-xs text-text-muted">
            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: dateLocale })}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm text-text-secondary whitespace-pre-wrap mb-2">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 bg-dark-700 rounded-lg px-0.5">
            <button
              onClick={() => handleVote('up')}
              className={`p-1 transition-colors ${localVote === 'UP' ? 'text-neon-green' : 'text-text-muted hover:text-neon-green'}`}
            >
              <ArrowBigUp className={`w-3.5 h-3.5 ${localVote === 'UP' ? 'fill-current' : ''}`} />
            </button>
            <span className={`text-xs font-medium min-w-[16px] text-center ${
              localVote === 'UP' ? 'text-neon-green' : localVote === 'DOWN' ? 'text-neon-red' : 'text-text-secondary'
            }`}>
              {score}
            </span>
            <button
              onClick={() => handleVote('down')}
              className={`p-1 transition-colors ${localVote === 'DOWN' ? 'text-neon-red' : 'text-text-muted hover:text-neon-red'}`}
            >
              <ArrowBigDown className={`w-3.5 h-3.5 ${localVote === 'DOWN' ? 'fill-current' : ''}`} />
            </button>
          </div>

          {currentUserId && depth < MAX_DEPTH && (
            <button
              onClick={() => setShowReply(!showReply)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-neon-cyan transition-colors rounded-md hover:bg-dark-700"
            >
              <CornerDownRight className="w-3 h-3" />
              {t('reply')}
            </button>
          )}

          {isOwn && (
            <button
              onClick={() => onDelete(comment.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-neon-red transition-colors rounded-md hover:bg-dark-700 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="w-3 h-3" />
              {t('delete')}
            </button>
          )}

          {currentUserId && !isOwn && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ReportButton targetType="COMMENT" targetId={comment.id} />
            </div>
          )}
        </div>

        {/* Reply form */}
        <AnimatePresence>
          {showReply && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex gap-2">
                <Textarea
                  placeholder={t('replyPlaceholder')}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleReply}
                    loading={submitting}
                    disabled={submitting || !replyContent.trim()}
                    aria-label={t('reply')}
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowReply(false)}
                    aria-label={t('cancel')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nested replies */}
      {allReplies.length > 0 && (
        <div>
          {allReplies.map((reply) => (
            <Comment
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              currentUserId={currentUserId}
              sort={sort}
              onReply={onReply}
              onDelete={onDelete}
              onVote={onVote}
            />
          ))}
        </div>
      )}

      {/* Load more replies */}
      {hasMore && (
        <div className={depth > 0 ? 'ml-6 pl-4' : ''}>
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="flex items-center gap-1.5 py-1.5 px-3 text-xs text-neon-cyan hover:text-neon-cyan/80 transition-colors"
          >
            <ChevronDown className="w-3 h-3" />
            {loadingMore ? t('loading') : t('showMoreReplies', { count: (comment.replyCount ?? 0) - allReplies.length })}
          </button>
        </div>
      )}
    </motion.div>
  );
}
