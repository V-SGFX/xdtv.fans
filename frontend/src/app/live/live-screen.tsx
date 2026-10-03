'use client';

import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/app-layout';
import { LiveWall } from '@/components/content/live-wall';
import { useLiveStreamers } from '@/lib/queries/content';
import { formatCount } from '@/lib/content/media';

export function LiveScreen({ limit }: { limit: number }) {
  const t = useTranslations('feed');
  const { data } = useLiveStreamers(limit);
  const total = data?.meta?.total;

  return (
    <AppLayout>
      <div className="mb-4 flex items-baseline gap-2">
        <h1 className="text-lg font-bold text-content-primary">{t('tabLive')}</h1>
        {total ? (
          <span className="text-sm tabular-nums text-content-muted">
            {t('liveCount', { count: formatCount(total) })}
          </span>
        ) : null}
      </div>

      <LiveWall limit={limit} />
    </AppLayout>
  );
}
