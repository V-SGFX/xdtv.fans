'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Check, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { queryKeys } from '@/lib/queries/keys';

type FollowTarget = { kind: 'streamer'; id: number } | { kind: 'tag'; id: number };

interface FollowButtonProps {
  target: FollowTarget;
  size?: 'sm' | 'md';
  /** Chip styling for inline use next to a game badge. */
  variant?: 'button' | 'chip';
  className?: string;
}

/**
 * Follow control for anything followable.
 *
 * Following used to exist only for streamers, and only on the streamer
 * directory — a game or a topic could not be followed at all, so the Following
 * feed could only ever reflect people, not interests. One component now covers
 * both targets so the affordance is identical wherever it appears.
 *
 * Optimistic: the state flips immediately and rolls back if the request fails,
 * because a follow toggle that waits on a round trip feels broken.
 */
export function FollowButton({ target, size = 'sm', variant = 'button', className = '' }: FollowButtonProps) {
  const t = useTranslations('streamers');
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const path = target.kind === 'tag' ? `/follows/tag/check/${target.id}` : `/follows/check/${target.id}`;
  const key = ['xdtv', 'follow', target.kind, target.id] as const;

  const { data: following = false } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get(path);
      return Boolean(data?.following);
    },
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const url = target.kind === 'tag' ? `/follows/tag/${target.id}` : `/follows/${target.id}`;
      const { data } = await api.post(url);
      return Boolean(data?.following);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<boolean>(key);
      queryClient.setQueryData(key, !prev);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx) queryClient.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
      // The Following feed depends on this edge.
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });

  // Signed-out users get no control rather than a button that only errors.
  if (!user) return null;

  const label = following ? t('following') : t('follow');

  if (variant === 'chip') {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          toggle.mutate();
        }}
        aria-pressed={following}
        aria-label={label}
        className={`inline-flex min-h-6 items-center gap-1 rounded-sm border px-1.5 text-2xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          following
            ? 'border-accent/40 bg-accent/10 text-accent'
            : 'border-line text-content-muted hover:border-line-strong hover:text-content-secondary'
        } ${className}`}
      >
        {following ? (
          <Check className="h-3 w-3" aria-hidden="true" />
        ) : (
          <Plus className="h-3 w-3" aria-hidden="true" />
        )}
        {label}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        toggle.mutate();
      }}
      aria-pressed={following}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        size === 'sm'
          ? 'h-8 [@media(pointer:coarse)]:h-9 px-3 text-xs'
          : 'h-9 [@media(pointer:coarse)]:h-10 px-4 text-sm'
      } ${
        following
          ? 'border border-line bg-surface-hover text-content-primary hover:border-line-strong'
          : 'bg-accent text-black hover:bg-accent/85'
      } ${className}`}
    >
      {following && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
      {label}
    </button>
  );
}
