'use client';

import { useMemo } from 'react';
import { useFeed, useLiveStreamers } from '@/lib/queries/content';
import { LIVE_INLINE_COUNT } from '@/lib/queries/feed-query';
import type { FeedFilters } from '@/lib/queries/keys';
import { toContentItem, toLiveContent, type ContentItem } from '@/lib/content/types';
import { ContentWall } from './content-wall';

interface FeedProps {
  filters?: FeedFilters;
  label: string;
  emptyTitle?: string;
  emptyDescription?: string;
  limit?: number;
  /**
   * Weave live streams into the wall.
   *
   * Live is content, not a separate part of the app, so on the main feed it
   * appears among clips rather than in a sidebar list. The dedicated Live tab
   * still exists for people who only want streams.
   */
  withLive?: boolean;
}

/** One live tile every N content tiles. */
const LIVE_EVERY = 7;

/**
 * Interleave live streams at fixed positions.
 *
 * Deterministic by index so the wall does not reshuffle as pages append or
 * when the live query refetches on its 2-minute cadence.
 */
function weaveLive(content: ContentItem[], live: ContentItem[]): ContentItem[] {
  if (live.length === 0) return content;

  const out: ContentItem[] = [];
  let liveIdx = 0;

  content.forEach((item, i) => {
    out.push(item);
    const slot = i + 1;
    if (slot % LIVE_EVERY === 0 && liveIdx < Math.min(live.length, LIVE_INLINE_COUNT)) {
      out.push(live[liveIdx++]);
    }
  });

  return out;
}

/**
 * Data-connected content wall.
 *
 * Thin by design: it turns queries into the flat item list the wall renders
 * and nothing else. Surfaces needing a different source compose ContentWall
 * directly rather than extending this.
 */
export function Feed({
  filters,
  label,
  emptyTitle,
  emptyDescription,
  limit,
  withLive = false,
}: FeedProps) {
  const query = useFeed(filters, limit);
  const liveQuery = useLiveStreamers(LIVE_INLINE_COUNT, withLive);

  const items = useMemo(() => {
    const content = (query.data?.pages ?? []).flatMap((page) =>
      (page.data ?? []).map(toContentItem),
    );
    if (!withLive) return content;

    const live = (liveQuery.data?.data ?? []).map(toLiveContent);
    return weaveLive(content, live);
  }, [query.data, liveQuery.data, withLive]);

  return (
    <ContentWall
      items={items}
      label={label}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => query.refetch()}
      onLoadMore={() => query.fetchNextPage()}
      hasMore={Boolean(query.hasNextPage)}
      loadingMore={query.isFetchingNextPage}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
