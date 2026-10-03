import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { News, Post, StreamerProfile } from '@/lib/types';
import { queryKeys, type FeedFilters } from './keys';

/**
 * Query definitions shared by the server and the client.
 *
 * Deliberately has no 'use client' directive. The hooks in content.ts do, and
 * anything exported from that module is a client reference — calling it from a
 * server component fails with "Attempted to call feedQuery() from the server
 * but feedQuery is on the client". Keeping the options object here is what
 * lets a route prefetch exactly the query the wall will mount.
 */

/** Envelope returned by /feed and /posts. */
export interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total?: number; pages?: number; hasMore?: boolean };
}

/**
 * A feed row. The scorer in FeedService attaches its ranking metadata to each
 * post; `_reason` is the human-readable explanation of why it was boosted.
 */
export type FeedItem = Post & {
  _score?: number;
  _globalScore?: number;
  _personalScore?: number;
  _reason?: string | null;
};

/** A live streamer row, including the per-platform stats the LiveCard needs. */
export type LiveStreamer = StreamerProfile & {
  stats?: {
    platform: string;
    isLive: boolean;
    viewerCount: number;
    streamTitle: string | null;
    thumbnailUrl: string | null;
  }[];
};

export type { News };

export const DEFAULT_LIMIT = 24;

/**
 * How many live tiles the main feed weaves in. Shared so the server prefetch
 * and the client-side weave request the same number — a mismatch would mean
 * either a wasted fetch or a post-hydration reflow.
 */
export const LIVE_INLINE_COUNT = 6;

/** Translate FeedFilters into the query params the existing API expects. */
function toParams(filters: FeedFilters, page: number, limit: number): string {
  const p = new URLSearchParams();
  p.set('page', String(page));
  p.set('limit', String(limit));

  if (filters.mode === 'trending') p.set('sort', 'top');
  if (filters.mode === 'following') p.set('following', 'true');
  if (filters.type) p.set('type', filters.type);
  if (filters.community) p.set('community', filters.community);
  if (filters.streamer) p.set('streamer', filters.streamer);

  // Game and language are both tag slugs. The current /feed endpoint accepts a
  // single `tag` param, so only one can be applied server-side today.
  if (filters.game) p.set('tag', filters.game);
  else if (filters.language) p.set('tag', filters.language);

  return p.toString();
}

async function fetchFeedPage(
  filters: FeedFilters,
  page: number,
  limit: number,
): Promise<Paged<FeedItem>> {
  const { data } = await api.get(`/feed?${toParams(filters, page, limit)}`);
  return data;
}

/** Did the server indicate more pages? Handles both meta shapes in use. */
function nextPageParam(last: Paged<FeedItem>): number | undefined {
  if (!last?.data?.length) return undefined;
  const page = Number(last.meta?.page ?? 1);
  if (typeof last.meta?.hasMore === 'boolean') return last.meta.hasMore ? page + 1 : undefined;
  const pages = Number(last.meta?.pages ?? page);
  return page < pages ? page + 1 : undefined;
}

/**
 * Shared options so a route can prefetch the same query the wall mounts:
 *   await queryClient.prefetchInfiniteQuery(feedQuery(filters))
 */
export function feedQuery(filters: FeedFilters = {}, limit = DEFAULT_LIMIT) {
  return infiniteQueryOptions({
    // `limit` belongs in the key: two walls reading the same filters at
    // different page sizes are different caches.
    queryKey: queryKeys.feed.list({ ...filters, limit }),
    queryFn: ({ pageParam }) => fetchFeedPage(filters, pageParam, limit),
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    // Feed responses are Redis-cached server-side; don't refetch faster.
    staleTime: 60_000,
  });
}

/**
 * Clips browse query.
 *
 * Targets /posts rather than /feed on purpose. The scored feed ranks a bounded
 * candidate pool — right for a "what should I see" home feed, wrong for a
 * browse surface, where the point is to page through all 16,687 clips.
 * /posts has real skip/take pagination over the whole corpus.
 */
export function clipsQuery(sort: 'new' | 'popular' = 'popular', limit = DEFAULT_LIMIT) {
  return infiniteQueryOptions({
    queryKey: queryKeys.clips.list({ type: 'CLIP', mode: sort === 'new' ? undefined : 'trending', limit }),
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get(
        `/posts?type=CLIP&sort=${sort}&page=${pageParam}&limit=${limit}`,
      );
      return data as Paged<FeedItem>;
    },
    initialPageParam: 1,
    getNextPageParam: nextPageParam,
    staleTime: 60_000,
  });
}

/**
 * Live streamers, ordered by real concurrent viewers.
 *
 * Shared with the server for the same reason as feedQuery: the main feed
 * weaves live tiles in at fixed positions, so if they only arrived after
 * hydration the grid would visibly reflow around them.
 */
export function liveQuery(limit = 24) {
  return queryOptions({
    queryKey: queryKeys.live.list({ limit }),
    queryFn: async () => {
      const { data } = await api.get(`/streamers?filter=live&sort=viewers&limit=${limit}`);
      return data as Paged<LiveStreamer>;
    },
    // The platform-sync cron writes every 2 minutes; polling faster is wasted.
    staleTime: 120_000,
  });
}

/**
 * Tags of one domain type. Shared with the server so Discover can render its
 * directory in the HTML rather than as a grid of placeholders.
 */
export function tagsByTypeQuery(type: 'GAME' | 'CATEGORY' | 'LANGUAGE' | 'FORMAT' | 'TOPIC') {
  return queryOptions({
    queryKey: queryKeys.tags.byType(type),
    queryFn: async () => {
      const { data } = await api.get(`/tags?type=${type}`);
      return data as { id: number; name: string; slug: string; postCount: number }[];
    },
    staleTime: 10 * 60_000,
  });
}

/** A single streamer profile. Shared so the route can render its header in the
 *  HTML instead of blocking the whole page behind a client fetch. */
export function streamerQuery(slug: string) {
  return queryOptions({
    queryKey: queryKeys.streamer.detail(slug),
    queryFn: async () => {
      const { data } = await api.get(`/streamers/${slug}`);
      return data;
    },
    staleTime: 60_000,
  });
}
