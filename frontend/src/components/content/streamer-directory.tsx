'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDirectoryMeta, useStreamerDirectoryPage } from '@/lib/queries/content';
import { formatCount } from '@/lib/content/media';

/**
 * Alphabetical streamer directory.
 *
 * Restores the index the old XDTV wiki had, which ran "0 to Z" because plenty
 * of nicks start with a digit. Three bucket kinds, matching how the names
 * actually distribute across 31,269 profiles:
 *
 *   0-9   704 names starting with a digit
 *   A-Z   the Latin alphabet, with Polish diacritics folded so Żaneta is Z
 *   #     695 Cyrillic, Korean, Japanese and Thai names, which belong nowhere
 *         in a Latin index but must still be reachable
 *
 * The archive's version filtered its "#" bucket client-side after paginating,
 * so its counts and page numbers were wrong for that bucket. This one buckets
 * in SQL, so every letter paginates and counts correctly.
 */

const LETTERS = ['0-9', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''), '#'];

const PLATFORMS = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'kick', label: 'Kick' },
  { id: 'youtube', label: 'YouTube' },
] as const;

interface Props {
  letter: string | null;
  platform: string;
  page: number;
  onLetterChange: (letter: string | null) => void;
  onPlatformChange: (platform: string) => void;
  onPageChange: (page: number) => void;
}

export function StreamerDirectory({
  letter,
  platform,
  page,
  onLetterChange,
  onPlatformChange,
  onPageChange,
}: Props) {
  const t = useTranslations('discover');
  const { data: meta } = useDirectoryMeta();
  const { data, isLoading } = useStreamerDirectoryPage({
    letter: letter ?? undefined,
    platform,
    page,
  });

  const rows = data?.data ?? [];
  const totalPages = data?.meta?.pages ?? 1;

  return (
    <div className="space-y-4">
      {/* Platform categories */}
      <div
        role="radiogroup"
        aria-label={t('tabStreamers')}
        className="scrollbar-hide -mx-4 flex gap-1.5 overflow-x-auto px-4"
      >
        {PLATFORMS.map((p) => {
          const active = platform === p.id;
          const count = p.id === 'all' ? meta?.total : meta?.platforms?.[p.id];
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onPlatformChange(p.id)}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-line text-content-muted hover:border-line-strong hover:text-content-secondary'
              }`}
            >
              {p.label}
              {count != null && (
                <span className="tabular-nums text-2xs opacity-70">{formatCount(count)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* A-Z index. Letters with no streamers are disabled rather than hidden,
          so the row does not reflow as filters change. */}
      <nav aria-label="Indeks alfabetyczny" className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onLetterChange(null)}
          aria-current={letter === null ? 'true' : undefined}
          className={`min-h-8 min-w-8 rounded-sm px-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            letter === null
              ? 'bg-accent text-black'
              : 'text-content-muted hover:bg-surface-hover hover:text-content-primary'
          }`}
        >
          {t('allLetters')}
        </button>

        {LETTERS.map((l) => {
          const count = meta?.letters?.[l] ?? 0;
          const active = letter === l;
          const empty = count === 0;
          return (
            <button
              key={l}
              type="button"
              disabled={empty}
              onClick={() => onLetterChange(l)}
              aria-current={active ? 'true' : undefined}
              title={empty ? undefined : `${l} — ${count}`}
              className={`min-h-8 min-w-8 rounded-sm px-2 text-xs font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active
                  ? 'bg-accent text-black'
                  : empty
                    ? 'cursor-not-allowed text-content-muted/30'
                    : 'text-content-muted hover:bg-surface-hover hover:text-content-primary'
              }`}
            >
              {l}
            </button>
          );
        })}
      </nav>

      {/* Results */}
      {isLoading ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Ładowanie"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={t('streamersEmpty')} />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/streamers/${s.slug}`}
                  className="group flex items-center gap-3 rounded-lg border border-line bg-surface-raised p-3 transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <Avatar
                    src={s.avatarUrl}
                    name={s.name}
                    size="md"
                    status={s.isLive ? 'live' : 'none'}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-content-primary group-hover:text-accent">
                      {s.name}
                    </span>
                    <span className="block text-2xs text-content-muted">
                      {t('followersCount', { count: formatCount(s.followerCount) })}
                    </span>
                  </span>
                  {s.isLive && <Badge variant="live">LIVE</Badge>}
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav
              aria-label="Paginacja"
              className="flex items-center justify-center gap-2 pt-2"
            >
              <button
                type="button"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                aria-label="Poprzednia strona"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-content-muted transition-colors hover:text-content-primary disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="text-xs tabular-nums text-content-muted">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                aria-label="Następna strona"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-content-muted transition-colors hover:text-content-primary disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
