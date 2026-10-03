'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { News } from '@/lib/types';
import { queryKeys, type FeedFilters } from './keys';
import { DEFAULT_LIMIT, feedQuery, liveQuery, tagsByTypeQuery, type LiveStreamer, type Paged } from './feed-query';

// Re-exported so consumers have a single import site for the data layer.
export { feedQuery, liveQuery, tagsByTypeQuery, DEFAULT_LIMIT };
export type { Paged, LiveStreamer };
export type { FeedItem } from './feed-query';

/** Infinite feed for the Content Wall. */
export function useFeed(filters: FeedFilters = {}, limit = DEFAULT_LIMIT) {
  return useInfiniteQuery(feedQuery(filters, limit));
}

/** Currently-live streamers. Refreshed on the same cadence as the sync cron. */
export function useLiveStreamers(limit = 24, enabled = true) {
  return useQuery({
    ...liveQuery(limit),
    enabled,
    refetchInterval: enabled ? 120_000 : false,
  });
}

/** Latest articles. */
export function useNews(limit = 12) {
  return useQuery({
    queryKey: queryKeys.news.list({ limit }),
    queryFn: async () => {
      const { data } = await api.get(`/news?limit=${limit}`);
      return data as Paged<News>;
    },
    staleTime: 5 * 60_000,
  });
}

/**
 * Batch-hydrate reactions and the current user's votes for a set of posts.
 *
 * Kept as one hook because the wall always needs both together, and both are
 * single round trips regardless of how many cards are on screen.
 */
export function usePostInteractions(ids: number[], enabled = true) {
  const sorted = [...ids].sort((a, b) => a - b);
  const idParam = sorted.join(',');

  const reactions = useQuery({
    queryKey: queryKeys.post.reactions(sorted),
    queryFn: async () => {
      const { data } = await api.get(`/posts/reactions/batch?ids=${idParam}`);
      return data as Record<number, { emoji: string; count: number; reacted: boolean }[]>;
    },
    enabled: enabled && sorted.length > 0,
    staleTime: 30_000,
  });

  const votes = useQuery({
    queryKey: queryKeys.post.votes(sorted),
    queryFn: async () => {
      const { data } = await api.get(`/posts/user-votes/batch?ids=${idParam}`);
      return data as Record<number, 'UP' | 'DOWN'>;
    },
    enabled: enabled && sorted.length > 0,
    staleTime: 30_000,
  });

  return { reactions, votes };
}

// ─── Discover ───────────────────────────────────────────────────────────────

/** Tags of one domain type, e.g. every GAME. */
export function useTagsByType(type: 'GAME' | 'CATEGORY' | 'LANGUAGE' | 'FORMAT' | 'TOPIC') {
  return useQuery(tagsByTypeQuery(type));
}

/** Streamer directory, most-followed first. */
export function useStreamerDirectory(limit = 48) {
  return useQuery({
    queryKey: queryKeys.streamer.list({ limit, sort: 'popular' }),
    queryFn: async () => {
      const { data } = await api.get(`/streamers?sort=popular&limit=${limit}`);
      return data as Paged<LiveStreamer>;
    },
    staleTime: 5 * 60_000,
  });
}

/** All communities. */
export function useCommunities() {
  return useQuery({
    queryKey: queryKeys.community.list(),
    queryFn: async () => {
      const { data } = await api.get('/communities');
      return data as {
        id: number; name: string; slug: string; description: string | null;
        color: string | null; iconUrl: string | null; postCount: number; memberCount: number;
      }[];
    },
    staleTime: 10 * 60_000,
  });
}

/** Per-letter and per-platform counts for the A-Z streamer directory. */
export function useDirectoryMeta() {
  return useQuery({
    queryKey: ['xdtv', 'streamer', 'directory-meta'],
    queryFn: async () => {
      const { data } = await api.get('/streamers/directory-meta');
      return data as {
        letters: Record<string, number>;
        platforms: Record<string, number>;
        total: number;
      };
    },
    staleTime: 10 * 60_000,
  });
}

/** One page of the alphabetical streamer directory. */
export function useStreamerDirectoryPage(opts: {
  letter?: string;
  platform?: string;
  page: number;
  limit?: number;
}) {
  const { letter, platform, page, limit = 48 } = opts;
  return useQuery({
    queryKey: queryKeys.streamer.list({ letter, platform, page, limit }),
    queryFn: async () => {
      const p = new URLSearchParams({ page: String(page), limit: String(limit), sort: 'name' });
      if (letter) p.set('letter', letter);
      if (platform && platform !== 'all') p.set('platform', platform);
      const { data } = await api.get(`/streamers?${p}`);
      return data as Paged<LiveStreamer>;
    },
    staleTime: 5 * 60_000,
  });
}

/** News for the Discover tab, filtered by category and served in the UI locale. */
export function useNewsByCategory(category: string | null, lang: string) {
  return useQuery({
    queryKey: queryKeys.news.list({ limit: 48, ...(category ? { type: category } : {}) }),
    queryFn: async () => {
      const p = new URLSearchParams({ limit: '48', lang });
      if (category) p.set('category', category);
      const { data } = await api.get(`/news?${p}`);
      return data as Paged<News>;
    },
    staleTime: 5 * 60_000,
  });
}

/** Per-category article counts for the news chips. */
export function useNewsCategories() {
  return useQuery({
    queryKey: ['xdtv', 'news', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/news/categories');
      return data as { counts: Record<string, number>; total: number };
    },
    staleTime: 10 * 60_000,
  });
}

/** Streamer name typeahead. */
export function useStreamerSuggest(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['xdtv', 'streamer', 'suggest', q.toLowerCase()],
    queryFn: async () => {
      const { data } = await api.get(`/streamers/suggest?q=${encodeURIComponent(q)}`);
      return data as { id: number; slug: string; name: string; avatarUrl: string | null; isLive: boolean; followerCount: number }[];
    },
    // Two characters is where the endpoint starts answering; below that a
    // request would only ever come back empty.
    enabled: q.length >= 2,
    staleTime: 60_000,
  });
}
