'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MessageSquare } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Comment } from '@/components/comment';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import type { Comment as CommentType, PaginatedResponse } from '@/lib/types';

type SortMode = 'best' | 'new' | 'controversial';

interface Props {
  /** Exactly one of these. */
  postId?: number;
  newsId?: number;
  initialCount?: number;
}

/**
 * Comment thread for a post or a news article.
 *
 * Extracted rather than copied: the post detail page already had this logic
 * inline, and giving news its own copy is how two threads end up behaving
 * differently. The only difference between the two is which id goes on the
 * query, so that is the only thing this takes.
 */
export function CommentsSection({ postId, newsId, initialCount = 0 }: Props) {
  const t = useTranslations('comments');
  const { user } = useAuth();

  const [sort, setSort] = useState<SortMode>('best');
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const target = newsId ? `newsId=${newsId}` : `postId=${postId}`;
  const key = ['xdtv', 'comments', target, sort] as const;

  // A query rather than fetch-in-effect: the same pattern as every other
  // surface, and it avoids the cascading re-render that
  // react-hooks/set-state-in-effect flags.
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<CommentType>>(
        `/comments?${target}&limit=50&sort=${sort}`,
      );
      return data;
    },
    staleTime: 30_000,
  });

  const comments = data?.data ?? [];
  const count = data?.meta?.total ?? initialCount;
  const loading = isLoading;

  const reload = () => queryClient.invalidateQueries({ queryKey: ['xdtv', 'comments', target] });

  const submit = async () => {
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      await api.post('/comments', {
        ...(newsId ? { newsId } : { postId }),
        content: draft.trim(),
      });
      setDraft('');
      await reload();
    } catch {
      /* keep the draft so the text is not lost */
    }
    setSubmitting(false);
  };

  const handleReply = async (parentId: number, content: string) => {
    await api.post('/comments', { ...(newsId ? { newsId } : { postId }), content, parentId });
    await reload();
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/comments/${id}`);
    await reload();
  };

  const handleVote = async (id: number, direction: 'up' | 'down') => {
    const { data } = await api.post(`/comments/${id}/vote`, { direction });
    return data;
  };

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="comments-heading"
          className="inline-flex items-center gap-2 text-sm font-semibold text-content-primary"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          {t('replies')}
          <span className="tabular-nums text-content-muted">{count}</span>
        </h2>

        {comments.length > 0 && (
          <SegmentedControl
            label={t('replies')}
            value={sort}
            onChange={(v) => setSort(v as SortMode)}
            options={[
              { value: 'best', label: 'Top' },
              { value: 'new', label: t('reply') === 'Reply' ? 'New' : 'Nowe' },
            ]}
          />
        )}
      </div>

      {user ? (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('replyPlaceholder')}
            rows={3}
            aria-label={t('replyPlaceholder')}
          />
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={submit}
              loading={submitting}
              disabled={!draft.trim()}
            >
              {t('reply')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-line bg-surface-raised p-3 text-sm text-content-muted">
          <a
            href="/login"
            className="text-accent underline underline-offset-2 hover:no-underline"
          >
            {t('reply')}
          </a>
        </p>
      )}

      {loading ? (
        <div role="status" aria-busy="true" aria-label={t('loading')} className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-sm text-content-muted">{t('replyPlaceholder')}</p>
      ) : (
        <div className="divide-y divide-line">
          {comments.map((c) => (
            <Comment
              key={c.id}
              comment={c}
              currentUserId={user?.id}
              sort={sort}
              onReply={handleReply}
              onDelete={handleDelete}
              onVote={handleVote}
            />
          ))}
        </div>
      )}
    </section>
  );
}
