import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { HomeScreen } from '@/components/home/home-screen';
import { getQueryClient } from '@/lib/query-client';
import { feedQuery, liveQuery, LIVE_INLINE_COUNT } from '@/lib/queries/feed-query';

export const metadata: Metadata = {
  title: 'XDTV: klipy, streamy na żywo i gaming community',
  description:
    'Ściana treści z gamingowego internetu: klipy z Twitcha, streamy na żywo, dyskusje i newsy — wszystko w jednym feedzie.',
  alternates: {
    canonical: 'https://xdtv.fans/',
  },
  openGraph: {
    title: 'XDTV: klipy, streamy na żywo i gaming community',
    description:
      'Klipy, streamy na żywo, społeczności i dyskusje ze świata gamingu w jednej ścianie treści.',
    url: 'https://xdtv.fans/',
    images: ['/opengraph-image'],
  },
};

export default async function HomePage() {
  // Prefetch the first page on the server so Home ships with content in the
  // HTML rather than a grid of skeletons. Without this the primary surface of
  // the product renders empty to crawlers and costs a round trip before
  // anything is visible — the opposite of "content in the first second".
  //
  // Anonymous only: personalisation depends on a token held in localStorage,
  // so a signed-in visitor gets this as the shared baseline and TanStack
  // refetches their personalised feed on hydration.
  const queryClient = getQueryClient();

  // Both queries, because the wall weaves live tiles in at fixed positions —
  // fetching them only on the client would reflow the grid after hydration.
  await Promise.allSettled([
    queryClient.prefetchInfiniteQuery(feedQuery()),
    queryClient.prefetchQuery(liveQuery(LIVE_INLINE_COUNT)),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'XDTV — ściana treści',
            itemListOrder: 'Descending',
            numberOfItems: 4,
            itemListElement: [
              { '@type': 'ListItem', position: 1, url: 'https://xdtv.fans/clips' },
              { '@type': 'ListItem', position: 2, url: 'https://xdtv.fans/discover?tab=streamers' },
              { '@type': 'ListItem', position: 3, url: 'https://xdtv.fans/community' },
              { '@type': 'ListItem', position: 4, url: 'https://xdtv.fans/news' },
            ],
          }),
        }}
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <HomeScreen />
      </HydrationBoundary>
    </>
  );
}
