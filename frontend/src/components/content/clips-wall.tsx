'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { clipsQuery } from '@/lib/queries/feed-query';
import { toClipContent } from '@/lib/content/types';
import { ContentWall } from './content-wall';
import { SegmentedControl } from '@/components/ui/segmented-control';

type ClipSort = 'popular' | 'new';

/**
 * Clips browse wall.
 *
 * Composes ContentWall directly, like LiveWall — same tiles and grid, a
 * different source. The sort control is the only chrome: the previous page
 * carried its own header, its own 9:16 card and its own pagination links.
 */
export function ClipsWall({
  sort,
  onSortChange,
}: {
  sort: ClipSort;
  onSortChange: (s: ClipSort) => void;
}) {
  const t = useTranslations('clips');
  const tf = useTranslations('feed');
  const query = useInfiniteQuery(clipsQuery(sort));

  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => (p.data ?? []).map(toClipContent)),
    [query.data],
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-content-primary">{t('title')}</h1>
        <SegmentedControl
          label={t('title')}
          value={sort}
          onChange={(v) => onSortChange(v as ClipSort)}
          options={[
            { value: 'popular', label: t('popular') },
            { value: 'new', label: t('newest') },
          ]}
        />
      </div>

      <ContentWall
        items={items}
        label={t('title')}
        loading={query.isLoading}
        error={query.isError}
        onRetry={() => query.refetch()}
        onLoadMore={() => query.fetchNextPage()}
        hasMore={Boolean(query.hasNextPage)}
        loadingMore={query.isFetchingNextPage}
        emptyTitle={tf('emptyTitle')}
        emptyDescription={tf('emptyDesc')}
      />
    </>
  );
}
