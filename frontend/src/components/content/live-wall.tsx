'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useLiveStreamers } from '@/lib/queries/content';
import { toLiveContent } from '@/lib/content/types';
import { ContentWall } from './content-wall';

/**
 * Live-only wall.
 *
 * Composes ContentWall directly rather than going through Feed, because the
 * source is the streamer list rather than the post feed. Same tiles, same
 * grid, same states — the difference is only where the rows come from.
 */
export function LiveWall({ limit = 48 }: { limit?: number }) {
  const t = useTranslations('feed');
  const query = useLiveStreamers(limit);

  const items = useMemo(
    () => (query.data?.data ?? []).map(toLiveContent),
    [query.data],
  );

  return (
    <ContentWall
      items={items}
      label={t('tabLive')}
      loading={query.isLoading}
      error={query.isError}
      onRetry={() => query.refetch()}
      emptyTitle={t('liveEmptyTitle')}
      emptyDescription={t('liveEmptyDesc')}
    />
  );
}
