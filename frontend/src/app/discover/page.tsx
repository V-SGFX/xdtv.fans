import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { feedQuery, tagsByTypeQuery } from '@/lib/queries/feed-query';
import { DiscoverScreen } from './discover-screen';

type Params = { tab?: string; game?: string };

const gameTagsQuery = tagsByTypeQuery('GAME');

// The query client is created per request, so staleTime never spans two
// renders — every hit on /discover used to call /tags?type=GAME. Crawlers
// reach this page thousands of times an hour (the /posts redirect lands
// here), so the directory is shared across requests for five minutes.
const getGameTags = unstable_cache(
  async () => gameTagsQuery.queryFn!({} as never),
  ['discover-game-tags'],
  { revalidate: 300 },
);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Params>;
}): Promise<Metadata> {
  const { game } = await searchParams;

  // A game view is a real landing page — "fortnite clips" is something people
  // search for — so it gets its own title and canonical rather than inheriting
  // the directory's.
  if (game) {
    const name = game.replace(/-/g, ' ');
    const title = `${name} — klipy i streamy`;
    return {
      title,
      description: `Najlepsze klipy z ${name} na XDTV. Momenty ze streamów, highlighty i transmisje na żywo.`,
      alternates: { canonical: `https://xdtv.fans/discover?game=${game}` },
      openGraph: { title, url: `https://xdtv.fans/discover?game=${game}` },
    };
  }

  return {
    title: 'Odkrywaj — gry, streamerzy i społeczności',
    description:
      'Przeglądaj gry, streamerów i społeczności XDTV. Znajdź klipy z Fortnite, CS2, GTA, League of Legends i dziesiątek innych tytułów.',
    alternates: { canonical: 'https://xdtv.fans/discover' },
    openGraph: {
      title: 'Odkrywaj — gry, streamerzy i społeczności',
      description: 'Gry, streamerzy i społeczności w jednym miejscu.',
      url: 'https://xdtv.fans/discover',
    },
  };
}

/**
 * Discover.
 *
 * Replaces /explore, which was a redirect to Home, and gives the previously
 * orphaned streamer and community directories a real entry point. The Games
 * tab is the first surface built on the TagType work — before that the app
 * could not tell a game tag from a language tag.
 */
export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const { game } = await searchParams;
  const queryClient = getQueryClient();

  await (game
    ? queryClient.prefetchInfiniteQuery(feedQuery({ game }))
    : queryClient.prefetchQuery({ ...gameTagsQuery, queryFn: getGameTags })
  ).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DiscoverScreen />
    </HydrationBoundary>
  );
}
