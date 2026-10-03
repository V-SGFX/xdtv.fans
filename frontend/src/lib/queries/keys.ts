/**
 * Query key factory.
 *
 * Every cache key in the app is built here so that invalidation stays
 * predictable. Keys are hierarchical: invalidating `queryKeys.feed.all`
 * drops every feed variant, invalidating `queryKeys.all` drops everything.
 *
 * Rule: never inline a raw array key at a call site.
 */

export type FeedMode = 'for-you' | 'following' | 'trending' | 'live';

export interface FeedFilters {
  /** Feed tab. Maps to different endpoints / sort params. */
  mode?: FeedMode;
  /** Tag slug of type GAME. */
  game?: string;
  /** Tag slug of type LANGUAGE. Undefined = no language filter. */
  language?: string;
  /** Post type filter, e.g. 'CLIP'. */
  type?: string;
  /** Community slug. */
  community?: string;
  /** Streamer slug. */
  streamer?: string;
  /** Page size. Two walls on the same filters but different page sizes are
   *  genuinely different caches, so this participates in the key. */
  limit?: number;
}

/** Stable key fragment — undefined/empty entries are dropped so that
 *  {game: undefined} and {} produce the same cache key. */
function normalize(filters: FeedFilters = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') out[k] = String(v);
  }
  return out;
}

export const queryKeys = {
  all: ['xdtv'] as const,

  feed: {
    all: ['xdtv', 'feed'] as const,
    list: (filters: FeedFilters = {}) => ['xdtv', 'feed', 'list', normalize(filters)] as const,
  },

  clips: {
    all: ['xdtv', 'clips'] as const,
    list: (filters: FeedFilters = {}) => ['xdtv', 'clips', 'list', normalize(filters)] as const,
  },

  live: {
    all: ['xdtv', 'live'] as const,
    list: (filters: { platform?: string; limit?: number } = {}) =>
      ['xdtv', 'live', 'list', normalize(filters as FeedFilters)] as const,
  },

  news: {
    all: ['xdtv', 'news'] as const,
    list: (filters: { limit?: number } = {}) =>
      ['xdtv', 'news', 'list', normalize(filters as FeedFilters)] as const,
  },

  post: {
    all: ['xdtv', 'post'] as const,
    detail: (id: number) => ['xdtv', 'post', id] as const,
    /** Batch-hydrated interaction state, keyed by the id set it covers. */
    reactions: (ids: number[]) => ['xdtv', 'post', 'reactions', [...ids].sort((a, b) => a - b)] as const,
    votes: (ids: number[]) => ['xdtv', 'post', 'votes', [...ids].sort((a, b) => a - b)] as const,
  },

  streamer: {
    all: ['xdtv', 'streamer'] as const,
    list: (filters: Record<string, unknown> = {}) =>
      ['xdtv', 'streamer', 'list', normalize(filters as FeedFilters)] as const,
    detail: (slug: string) => ['xdtv', 'streamer', slug] as const,
  },

  community: {
    all: ['xdtv', 'community'] as const,
    list: () => ['xdtv', 'community', 'list'] as const,
    detail: (slug: string) => ['xdtv', 'community', slug] as const,
  },

  tags: {
    all: ['xdtv', 'tags'] as const,
    /** Tags filtered by domain type — GAME, LANGUAGE, CATEGORY, ... */
    byType: (type: string) => ['xdtv', 'tags', 'type', type] as const,
  },

  search: {
    all: ['xdtv', 'search'] as const,
    query: (q: string) => ['xdtv', 'search', q] as const,
  },
} as const;
