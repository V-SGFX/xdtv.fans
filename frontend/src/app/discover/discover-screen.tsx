'use client';

import { Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Gamepad2, Users, Hash, Flame, Newspaper, ArrowLeft, Image as ImageIcon } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { TabBar } from '@/components/ui/tab-bar';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Feed } from '@/components/content/feed';
import { useCommunities, useTagsByType } from '@/lib/queries/content';
import { FollowButton } from '@/components/content/follow-button';
import { StreamerDirectory } from '@/components/content/streamer-directory';
import { StreamerSearch } from '@/components/content/streamer-search';
import { NewsGrid } from '@/components/content/news-grid';
import { formatCount } from '@/lib/content/media';
import { AdSlot } from '@/components/ads/ad-slot';

type DiscoverTab = 'games' | 'streamers' | 'communities' | 'memes' | 'news' | 'trending';

/*
 * Memy stoją przed newsami świadomie: to treść tworzona przez społeczność,
 * a kolejność zakładek mówi, czego ten serwis od niej oczekuje. Wcześniej
 * dało się je zobaczyć wyłącznie wchodząc w społeczność, do której trafiły.
 */
const TABS: DiscoverTab[] = ['games', 'streamers', 'communities', 'memes', 'news', 'trending'];

function isTab(v: string | null): v is DiscoverTab {
  return v !== null && (TABS as string[]).includes(v);
}

/** Shared card shell for the directory grids, so games, streamers and
 *  communities are visibly the same kind of object. */
function DirectoryCard({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-lg border border-line bg-surface-raised p-3 transition-colors hover:border-line-strong hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {children}
    </Link>
  );
}

const GRID = 'grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3';

function GridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label="Ładowanie" className={GRID}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[68px] w-full rounded-lg" />
      ))}
    </div>
  );
}

function GamesGrid() {
  const t = useTranslations('discover');
  const { data, isLoading } = useTagsByType('GAME');

  if (isLoading) return <GridSkeleton />;
  if (!data?.length) return <EmptyState icon={Gamepad2} title={t('gamesEmpty')} />;

  // Games with no content are noise in a discovery surface.
  const games = [...data].filter((g) => g.postCount > 0).sort((a, b) => b.postCount - a.postCount);

  return (
    <div className={GRID}>
      {games.map((g) => (
        <DirectoryCard key={g.id} href={`/discover?game=${g.slug}`}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-sm bg-surface-hover">
            <Gamepad2 className="h-5 w-5 text-content-muted" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold capitalize text-content-primary group-hover:text-accent">
              {g.name.replace(/-/g, ' ')}
            </span>
            <span className="block text-2xs text-content-muted">
              {t('clipsCount', { count: formatCount(g.postCount) })}
            </span>
          </span>
        </DirectoryCard>
      ))}
    </div>
  );
}


function CommunitiesGrid() {
  const t = useTranslations('discover');
  const { data, isLoading } = useCommunities();

  if (isLoading) return <GridSkeleton count={6} />;
  if (!data?.length) return <EmptyState icon={Hash} title={t('communitiesEmpty')} />;

  const sorted = [...data].sort((a, b) => b.postCount - a.postCount);

  return (
    <div className={GRID}>
      {sorted.map((c) => (
        <DirectoryCard key={c.id} href={`/community?community=${c.slug}`}>
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-sm text-sm font-bold text-black"
            style={{ backgroundColor: c.color ?? '#00D4FF' }}
            aria-hidden="true"
          >
            {c.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-content-primary group-hover:text-accent">
              c/{c.slug}
            </span>
            <span className="block text-2xs text-content-muted">
              {t('clipsCount', { count: formatCount(c.postCount) })}
            </span>
          </span>
        </DirectoryCard>
      ))}
    </div>
  );
}

function DiscoverInner() {
  const t = useTranslations('discover');
  const router = useRouter();
  const searchParams = useSearchParams();

  const game = searchParams.get('game');
  const { data: gameTags } = useTagsByType('GAME');
  const param = searchParams.get('tab');
  const active: DiscoverTab = isTab(param) ? param : 'games';

  const setTab = useCallback(
    (tab: DiscoverTab) => {
      // Switching tab drops letter/platform/page — they belong to the
      // directory, not to Discover as a whole.
      const qs = new URLSearchParams();
      if (tab !== 'games') qs.set('tab', tab);
      const s = qs.toString();
      router.replace(s ? `/discover?${s}` : '/discover', { scroll: false });
    },
    [router],
  );

  /** Update several query params at once; null removes one. */
  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const qs = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) qs.delete(k);
        else qs.set(k, v);
      }
      const s = qs.toString();
      router.replace(s ? `/discover?${s}` : '/discover', { scroll: false });
    },
    [router, searchParams],
  );

  // A game link drops straight into a filtered wall rather than another
  // directory level — the point of picking a game is to see its clips.
  if (game) {
    // The tag id is needed to follow it; the games list is already cached.
    const gameTag = gameTags?.find((g) => g.slug === game) ?? null;
    return (
      <AppLayout>
        <div className="mb-4 flex items-center gap-3">
          <Link
            href="/discover"
            aria-label={t('backToDiscover')}
            className="grid h-8 w-8 place-items-center rounded-sm text-content-muted transition-colors hover:bg-surface-hover hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold capitalize text-content-primary">
            {game.replace(/-/g, ' ')}
          </h1>
          {gameTag && <FollowButton target={{ kind: 'tag', id: gameTag.id }} />}
        </div>

        <Feed filters={{ game }} label={game} />
      </AppLayout>
    );
  }

  const labels: Record<DiscoverTab, string> = {
    games: t('tabGames'),
    streamers: t('tabStreamers'),
    communities: t('tabCommunities'),
    memes: t('tabMemes'),
    news: t('tabNews'),
    trending: t('tabTrending'),
  };

  const icons: Record<DiscoverTab, React.ReactNode> = {
    games: <Gamepad2 className="h-3.5 w-3.5" aria-hidden="true" />,
    streamers: <Users className="h-3.5 w-3.5" aria-hidden="true" />,
    communities: <Hash className="h-3.5 w-3.5" aria-hidden="true" />,
    memes: <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" />,
    news: <Newspaper className="h-3.5 w-3.5" aria-hidden="true" />,
    trending: <Flame className="h-3.5 w-3.5" aria-hidden="true" />,
  };

  return (
    <AppLayout>
      <AdSlot slotKey="discover-top" className="mb-3 flex justify-center empty:hidden" />

      <TabBar
        idPrefix="discover"
        label={t('title')}
        value={active}
        onChange={setTab}
        items={TABS.map((v) => ({ value: v, label: labels[v], icon: icons[v] }))}
      />

      <div
        id="discover-panel"
        role="tabpanel"
        aria-labelledby={`discover-tab-${active}`}
        tabIndex={-1}
      >
        {active === 'games' && <GamesGrid />}
        {active === 'streamers' && (
          <div className="space-y-4">
            <StreamerSearch />
            <StreamerDirectory
            letter={searchParams.get('letter')}
            platform={searchParams.get('platform') || 'all'}
            page={Math.max(1, Number(searchParams.get('page') || 1))}
            onLetterChange={(l) => setParams({ letter: l, page: null })}
            onPlatformChange={(p) => setParams({ platform: p === 'all' ? null : p, page: null })}
            onPageChange={(p) => setParams({ page: p > 1 ? String(p) : null })}
            />
          </div>
        )}

        {/* Mem to post typu IMAGE — kompozytor zapisuje tak wszystko, co
            powstało pod „Dodaj mema" i miało obrazek. */}
        {active === 'memes' && (
          <Feed filters={{ type: 'IMAGE' }} label={labels.memes} />
        )}

        {active === 'news' && (
          <NewsGrid
            category={(searchParams.get('cat') as never) || null}
            onCategoryChange={(c) => setParams({ cat: c })}
          />
        )}
        {active === 'communities' && <CommunitiesGrid />}
        {active === 'trending' && (
          <Feed filters={{ mode: 'trending' }} label={labels.trending} />
        )}
      </div>
    </AppLayout>
  );
}

export function DiscoverScreen() {
  return (
    <Suspense fallback={null}>
      <DiscoverInner />
    </Suspense>
  );
}
