'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, ExternalLink, Languages } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Badge } from '@/components/ui/badge';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { CommentsSection } from '@/components/content/comments-section';
import { RelativeTime } from '@/components/content/relative-time';

export interface ArticleDetail {
  id: number;
  title: string;
  summary: string | null;
  titleEn: string | null;
  summaryEn: string | null;
  content: string | null;
  contentEn: string | null;
  category: string;
  commentCount: number;
  imageUrl: string | null;
  sourceUrl: string;
  sourceName: string | null;
  publishedAt: string | null;
}

const CATEGORY_KEY: Record<string, string> = {
  DRAMA: 'newsDrama',
  STREAMERS: 'newsStreamers',
  EVENTS: 'newsEvents',
  GAMING: 'newsGaming',
};

/**
 * A news article on our own domain.
 *
 * Articles used to link straight out to the publisher, so a reader left XDTV
 * at the first tap and there was nowhere to discuss anything. The page keeps
 * the reader here, shows either stored language, and credits the source
 * prominently — the summary is what we hold, so the outbound link stays the
 * way to read the full piece.
 */
export function ArticleView({ article }: { article: ArticleDetail }) {
  const t = useTranslations('discover');
  const locale = useLocale();

  const hasBoth = Boolean(article.titleEn) && article.titleEn !== article.title;
  const [lang, setLang] = useState<'pl' | 'en'>(locale === 'en' && article.titleEn ? 'en' : 'pl');

  const title = lang === 'en' ? article.titleEn || article.title : article.title;
  const summary = lang === 'en' ? article.summaryEn || article.summary : article.summary;

  /*
   * Treść artykułu — do tej pory pole było zadeklarowane w typie i nigdzie
   * nierenderowane, więc po wejściu w news widać było sam nagłówek,
   * zajawkę i odnośnik do źródła.
   *
   * Renderowana jako TEKST, nie HTML. Pochodzi ze scrapowanych kanałów RSS,
   * czyli spoza naszej kontroli; 20 z 1598 wpisów niesie znaczniki i lepiej,
   * żeby pokazały się jako litery, niż żeby cudze źródło mogło wstawić
   * cokolwiek na naszą stronę.
   */
  const rawBody = lang === 'en' ? article.contentEn || article.content : article.content;
  const body = rawBody?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;

  return (
    <AppLayout>
      <article className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/discover?tab=news"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm text-content-muted transition-colors hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {t('tabNews')}
          </Link>

          {/* Only offered when a second language actually exists — the 1,466
              articles scraped before bilingual storage have Polish only. */}
          {hasBoth && (
            <span className="inline-flex items-center gap-2">
              <Languages className="h-3.5 w-3.5 text-content-muted" aria-hidden="true" />
              <SegmentedControl
                label="Language"
                value={lang}
                onChange={(v) => setLang(v as 'pl' | 'en')}
                options={[
                  { value: 'pl', label: 'PL' },
                  { value: 'en', label: 'EN' },
                ]}
              />
            </span>
          )}
        </div>

        {article.imageUrl && (
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-surface-sunken">
            <Image
              src={article.imageUrl}
              alt=""
              fill
              sizes="(min-width: 768px) 768px, 100vw"
              priority
              className="object-cover"
            />
          </div>
        )}

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-2xs text-content-muted">
            <Badge variant="category">{t(CATEGORY_KEY[article.category] ?? 'newsGaming')}</Badge>
            {article.sourceName && <span>{article.sourceName}</span>}
            {article.publishedAt && <RelativeTime iso={article.publishedAt} />}
          </div>

          <h1 className="text-xl font-bold leading-tight text-content-primary">{title}</h1>
        </header>

        {summary && (
          <p className="text-base leading-relaxed text-content-secondary">{summary}</p>
        )}

        {/* Treść pokazujemy tylko wtedy, gdy wnosi coś ponad zajawkę.
            Część kanałów RSS wkleja w oba pola ten sam tekst, a dwa
            identyczne akapity pod sobą wyglądają jak błąd. */}
        {body && body !== summary?.trim() && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-content-secondary/90">
            {body}
          </p>
        )}

        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-medium text-content-secondary transition-colors hover:border-line-strong hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
          {article.sourceName ? `${t('newsAll')} — ${article.sourceName}` : t('newsAll')}
        </a>

        <hr className="border-line" />

        <CommentsSection newsId={article.id} initialCount={article.commentCount} />
      </article>
    </AppLayout>
  );
}
