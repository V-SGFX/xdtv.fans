'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Newspaper } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ContentWall } from './content-wall';
import { toArticleContent } from '@/lib/content/types';
import { useNewsByCategory, useNewsCategories } from '@/lib/queries/content';

type NewsCategory = 'DRAMA' | 'STREAMERS' | 'EVENTS' | 'GAMING';

const CATEGORIES: { id: NewsCategory; key: string }[] = [
  { id: 'DRAMA', key: 'newsDrama' },
  { id: 'STREAMERS', key: 'newsStreamers' },
  { id: 'EVENTS', key: 'newsEvents' },
  { id: 'GAMING', key: 'newsGaming' },
];

/**
 * News on Discover.
 *
 * Renders through ContentWall like everything else — an article is a content
 * type the wall already knows, so this adds a category filter and nothing
 * more. Articles are stored in Polish and English; the locale decides which
 * pair the API returns, so the card never has to know.
 */
export function NewsGrid({
  category,
  onCategoryChange,
}: {
  category: NewsCategory | null;
  onCategoryChange: (c: NewsCategory | null) => void;
}) {
  const t = useTranslations('discover');
  const locale = useLocale();
  const { data: meta } = useNewsCategories();
  const { data, isLoading, isError, refetch } = useNewsByCategory(category, locale === 'en' ? 'en' : 'pl');

  const items = (data?.data ?? []).map(toArticleContent);

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label={t('tabNews')}
        className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4"
      >
        {[{ id: null, key: 'newsAll' }, ...CATEGORIES].map((c) => {
          const active = category === c.id;
          const count = c.id === null ? meta?.total : meta?.counts?.[c.id as string];
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onCategoryChange(c.id as NewsCategory | null)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-line text-content-muted hover:border-line-strong hover:text-content-secondary'
              }`}
            >
              {t(c.key)}
              {count != null && <span className="tabular-nums text-2xs opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Ładowanie"
          className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="aspect-video w-full rounded-lg" />
          ))}
        </div>
      ) : items.length === 0 && !isError ? (
        <EmptyState icon={Newspaper} title={t('newsEmpty')} />
      ) : (
        <ContentWall
          items={items}
          label={t('tabNews')}
          error={isError}
          onRetry={() => refetch()}
          emptyTitle={t('newsEmpty')}
        />
      )}
    </div>
  );
}
