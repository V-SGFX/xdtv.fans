'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bookmark } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

/**
 * Save an individual piece of content — a clip, a post, an entry.
 *
 * The same "obserwowane" edge as following a streamer or a game, so it writes
 * to the same table; the difference is only what it points at. Rendered as a
 * bookmark on the tile rather than a labelled button, because a card already
 * carries a title, an author, a game and a metric and does not need a fifth
 * piece of text.
 *
 * Saved state is hydrated for the whole page at once by the wall, so this
 * normally reads from cache and issues no request of its own.
 */
export function SaveButton({ postId, className = '' }: { postId: number; className?: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ['xdtv', 'follow', 'post', postId] as const;

  const { data: saved = false } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await api.get(`/follows/post/check/${postId}`);
      return Boolean(data?.following);
    },
    enabled: Boolean(user),
    staleTime: 5 * 60_000,
  });

  const toggle = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/follows/post/${postId}`);
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
      queryClient.invalidateQueries({ queryKey: ['xdtv', 'saved-posts'] });
    },
  });

  if (!user) return null;

  return (
    <button
      type="button"
      // The tile is one big anchor; without this the click would navigate.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle.mutate();
      }}
      aria-pressed={saved}
      aria-label={saved ? 'Usuń z zapisanych' : 'Zapisz'}
      title={saved ? 'Usuń z zapisanych' : 'Zapisz'}
      className={`grid h-8 w-8 place-items-center rounded-sm backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        saved
          ? 'bg-accent/90 text-black'
          : 'bg-black/55 text-white/80 hover:bg-black/75 hover:text-white'
      } ${className}`}
    >
      <Bookmark className={`h-4 w-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
    </button>
  );
}
