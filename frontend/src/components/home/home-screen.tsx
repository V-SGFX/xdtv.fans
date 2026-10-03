'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AppLayout } from '@/components/layout/app-layout';
import { EmptyState } from '@/components/ui/empty-state';
import { Feed } from '@/components/content/feed';
import { LiveWall } from '@/components/content/live-wall';
import { FeedTabs, type FeedTab } from '@/components/content/feed-tabs';
import { useLiveStreamers } from '@/lib/queries/content';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { AdSlot } from '@/components/ads/ad-slot';

const TABS: FeedTab[] = ['for-you', 'following', 'trending', 'live'];

function isTab(value: string | null): value is FeedTab {
  return value !== null && (TABS as string[]).includes(value);
}

/**
 * Home.
 *
 * The first consumer of the content system, and deliberately not a special
 * case: it mounts FeedTabs and the wall, and owns nothing else.
 *
 * What is gone, versus the previous Home: a gradient hero, a sticky marquee
 * ticker, a sort control, six filter pills, a community rail, a clip promo
 * rail, a "most reacted in 30 minutes" panel, promo cards injected every
 * fourth item, and a four-widget sidebar. Content now starts in the first
 * viewport on every breakpoint.
 */
function HomeScreenInner() {
  const t = useTranslations('feed');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const param = searchParams.get('tab');
  const active: FeedTab = isTab(param) ? param : 'for-you';

  // Keep the tab in the URL so a mode is linkable and survives a refresh,
  // without pushing a history entry for every switch.
  const setTab = useCallback(
    (tab: FeedTab) => {
      const next = new URLSearchParams(searchParams.toString());
      if (tab === 'for-you') next.delete('tab');
      else next.set('tab', tab);
      const qs = next.toString();
      router.replace(qs ? `/?${qs}` : '/', { scroll: false });
    },
    [router, searchParams],
  );

  // Cheap enough to keep mounted: it is the same cached query the wall uses,
  // so the count in the tab costs no extra request.
  const liveQuery = useLiveStreamers(6, true);
  const liveCount = liveQuery.data?.meta?.total;

  const labels: Record<FeedTab, string> = {
    'for-you': t('tabForYou'),
    following: t('tabFollowing'),
    trending: t('tabTrending'),
    live: t('tabLive'),
  };

  return (
    <AppLayout>
      <AdSlot slotKey="home-top" className="mb-3 flex justify-center empty:hidden" />

      <FeedTabs active={active} onChange={setTab} labels={labels} liveCount={liveCount} />

      <div id="feed-panel" role="tabpanel" aria-labelledby={`feed-tab-${active}`} tabIndex={-1}>
        {active === 'for-you' && (
          <Feed
            label={t('feedLabel')}
            withLive
            emptyTitle={t('emptyTitle')}
            emptyDescription={t('emptyDesc')}
          />
        )}

        {active === 'following' &&
          (user ? (
            <Feed
              filters={{ mode: 'following' }}
              label={labels.following}
              emptyTitle={t('followingEmptyTitle')}
              emptyDescription={t('followingEmptyDesc')}
            />
          ) : (
            // Signed-out is a distinct state from "you follow nobody", and
            // saying so is more useful than an empty grid.
            <div className="flex flex-col items-center">
              <EmptyState
                icon={LogIn}
                title={t('followingAuthTitle')}
                description={t('followingAuthDesc')}
              />
              {/* A link, not a Button — this navigates, and an anchor inside a
                  button would be invalid markup and unreachable by keyboard. */}
              <Link
                href="/login"
                className="-mt-6 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-black transition-colors hover:bg-accent/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {t('followingAuthTitle')}
              </Link>
            </div>
          ))}

        {active === 'trending' && (
          <Feed
            filters={{ mode: 'trending' }}
            label={labels.trending}
            emptyTitle={t('emptyTitle')}
            emptyDescription={t('emptyDesc')}
          />
        )}

        {active === 'live' && <LiveWall />}
      </div>
    </AppLayout>
  );
}

export function HomeScreen() {
  // useSearchParams needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <HomeScreenInner />
    </Suspense>
  );
}
