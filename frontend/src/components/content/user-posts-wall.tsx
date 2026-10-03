'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { Post } from '@/lib/types';
import { toContentItem } from '@/lib/content/types';
import { ContentWall } from './content-wall';

/**
 * A user's posts, rendered by the shared wall.
 *
 * Both profile pages previously mapped over the old PostCard directly, which
 * is what kept that component alive after Home and Communities had moved on.
 */
export function UserPostsWall({
  endpoint,
  label,
  emptyTitle,
}: {
  /** e.g. `/users/me/posts` or `/users/username/foo/posts` */
  endpoint: string;
  label: string;
  emptyTitle?: string;
}) {
  const tf = useTranslations('feed');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['xdtv', 'user-posts', endpoint],
    queryFn: async () => {
      const { data } = await api.get(`${endpoint}?limit=24`);
      return (Array.isArray(data) ? data : (data?.data ?? [])) as Post[];
    },
    staleTime: 60_000,
  });

  const items = useMemo(() => (data ?? []).map(toContentItem), [data]);

  return (
    <ContentWall
      items={items}
      label={label}
      loading={isLoading}
      error={isError}
      onRetry={() => refetch()}
      emptyTitle={emptyTitle ?? tf('emptyTitle')}
      emptyDescription={tf('emptyDesc')}
    />
  );
}
