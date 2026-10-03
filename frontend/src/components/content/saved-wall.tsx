'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Post } from '@/lib/types';
import { toContentItem } from '@/lib/content/types';
import { ContentWall } from './content-wall';

/**
 * Everything the user has saved — clips, posts, entries — in one wall.
 *
 * Follows are one list regardless of what they point at, so this reads the
 * same table as streamer and game follows.
 */
export function SavedWall() {
  const t = useTranslations('feed');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['xdtv', 'saved-posts'],
    queryFn: async () => {
      const { data } = await api.get('/follows/posts/me?limit=48');
      return (data?.data ?? []) as Post[];
    },
    staleTime: 60_000,
  });

  const items = useMemo(() => (data ?? []).map(toContentItem), [data]);

  return (
    <ContentWall
      items={items}
      label={t('savedTitle')}
      loading={isLoading}
      error={isError}
      onRetry={() => refetch()}
      emptyTitle={t('savedEmptyTitle')}
      emptyDescription={t('savedEmptyDesc')}
    />
  );
}
