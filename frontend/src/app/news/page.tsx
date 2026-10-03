'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '@/lib/api';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { PostCardSkeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { Newspaper, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorState } from '@/components/ui/error-state';
import { useTranslations } from 'next-intl';

interface NewsItem {
  id: number; title: string; summary: string | null; sourceUrl: string;
  sourceName: string | null; imageUrl: string | null; publishedAt: string | null;
  streamerProfile: { slug: string; name: string } | null;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = useTranslations('news');

  const fetchNews = async () => {
    setLoading(true);
    setError(false);
    try {
      const { data } = await api.get(`/news?page=${page}&limit=20`);
      setNews(data.data);
      setTotalPages(data.meta.pages);
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNews();
  }, [page]);

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-neon-pink/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-neon-pink" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-text-primary">{t('title')}</h1>
            <p className="text-sm text-text-muted">{t('subtitle')}</p>
          </div>
        </div>

        {/* News list */}
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <PostCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <ErrorState onRetry={fetchNews} />
        ) : (
          <div className="space-y-3">
            {news.map((n, i) => (
              <motion.a
                key={n.id}
                href={n.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="group card-neon block p-5 space-y-3"
              >
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                      {n.sourceName && (
                        <span className="text-neon-cyan/70 font-medium">{n.sourceName}</span>
                      )}
                      {n.publishedAt && (
                        <>
                          <span className="text-text-dimmed">•</span>
                          <span>{formatDistanceToNow(new Date(n.publishedAt), { addSuffix: true, locale: pl })}</span>
                        </>
                      )}
                      {n.streamerProfile && (
                        <>
                          <span className="text-text-dimmed">•</span>
                          <span className="text-neon-purple">{n.streamerProfile.name}</span>
                        </>
                      )}
                      <ExternalLink className="w-3 h-3 ml-auto text-text-dimmed opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h2 className="text-lg font-semibold text-text-primary group-hover:text-neon-cyan transition-colors">
                      {n.title}
                    </h2>
                    {n.summary && (
                      <p className="text-sm text-text-muted line-clamp-3">{n.summary}</p>
                    )}
                  </div>
                  {n.imageUrl && (
                    <div className="shrink-0 w-32 h-24 rounded-lg overflow-hidden bg-dark-800">
                      <img
                        src={n.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              </motion.a>
            ))}
            {news.length === 0 && (
              <div className="text-center py-16">
                <p className="text-text-muted text-lg">{t('empty')}</p>
              </div>
            )}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" /> {t('prev')}
            </Button>
            <span className="text-sm text-text-muted tabular-nums">
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
            >
              {t('next')} <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
