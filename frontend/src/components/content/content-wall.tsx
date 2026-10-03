'use client';

import { Fragment, useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ContentCard, ContentCardSkeleton } from './content-card';
import { assignLayout, skeletonLayout } from '@/lib/content/layout';
import { useSavedHydration } from '@/lib/queries/saved';
import type { ContentItem } from '@/lib/content/types';
import { AdSlot } from '@/components/ads/ad-slot';

interface ContentWallProps {
  items: ContentItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Fetch the next page. Omit for a finite wall (profile tab, search page). */
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Accessible name for the region, e.g. "Feed: Dla Ciebie". */
  label: string;
  /** Placeholder count on first load. */
  skeletonCount?: number;
}

/**
 * The content wall.
 *
 * Every content surface renders through this — Home, Clips, Live, Discover,
 * Community, Search, profiles. It owns the grid, the loading/empty/error
 * states and infinite scroll; it does not own data fetching, so the same wall
 * serves an infinite feed and a finite list equally.
 *
 * Grid: 4 columns from 1280px, 2 from 768px, 1 below. Spans come from
 * assignLayout(), which keeps every row homogeneous — see the reasoning there
 * for why this is not a dense-packed grid.
 */
export function ContentWall({
  items,
  loading = false,
  error = false,
  onRetry,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
  emptyTitle,
  emptyDescription,
  label,
  skeletonCount = 12,
}: ContentWallProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  // One batch call per page of content, rather than one check per card.
  const postIds = useMemo(
    () =>
      items
        .filter((i) => i.kind === 'clip' || i.kind === 'post')
        .map((i) => (i as { postId: number }).postId),
    [items],
  );
  useSavedHydration(postIds);

  // Infinite scroll. The 600px margin starts the next page before the user
  // reaches the end, so a fast scroll does not hit a blank stretch.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !onLoadMore || !hasMore || loadingMore || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore, loading]);

  if (error && items.length === 0) {
    return <ErrorState onRetry={onRetry} />;
  }

  if (loading && items.length === 0) {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Ładowanie treści"
        className={GRID_CLASS}
      >
        {skeletonLayout(skeletonCount).map((s, i) => (
          <div key={i} className={SPAN_CLASS[s.span]}>
            <ContentCardSkeleton kind={s.kind} />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const laidOut = assignLayout(items);

  return (
    <>
      <section aria-label={label} className={GRID_CLASS}>
        {laidOut.map(({ item, span, priority }, index) => (
          <Fragment key={item.key}>
            <ContentCard item={item} span={span} priority={priority} />
            {/* Wstawka reklamowa co ósmą kartę.
                Zajmuje jedną komórkę siatki, więc nie rozbija układu ani
                nie przesuwa kart, które są już na ekranie. Nie pokazuje się
                na samym początku — pierwsza rzecz, jaką widzi wchodzący,
                ma być treścią. */}
            {(index + 1) % AD_EVERY === 0 && (
              <AdSlot slotKey="feed-inline" className="flex items-center justify-center empty:hidden" />
            )}
          </Fragment>
        ))}
      </section>

      {/* Sentinel sits outside the grid so it can never occupy a cell. */}
      {hasMore && onLoadMore && <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />}

      {/* Status is announced once per state change rather than per tile. */}
      <div role="status" aria-live="polite" className="py-6 text-center">
        {loadingMore && (
          <span className="inline-flex items-center gap-2 text-sm text-content-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Ładowanie kolejnych…
          </span>
        )}
        {!hasMore && !loadingMore && items.length > 0 && (
          <span className="text-sm text-content-muted">To już wszystko.</span>
        )}
        {error && items.length > 0 && (
          <span className="text-sm text-live">Nie udało się dobrać kolejnych treści.</span>
        )}
      </div>
    </>
  );
}

/**
 * `content-visibility: auto` lets the browser skip layout and paint for tiles
 * scrolled out of view, which is most of them once infinite scroll has run for
 * a while. It gets the bulk of what a virtualiser would give here without the
 * complexity, because tile height is already predictable from the aspect ratio.
 */
/** Co ile kart pojawia się wstawka reklamowa. */
const AD_EVERY = 8;

const GRID_CLASS =
  'grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4 [&>*]:[content-visibility:auto] [&>*]:[contain-intrinsic-size:auto_320px]';

const SPAN_CLASS = {
  narrow: 'col-span-1',
  wide: 'col-span-1 md:col-span-2',
  hero: 'col-span-1 md:col-span-2 xl:col-span-4',
} as const;
