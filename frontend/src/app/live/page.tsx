import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { liveQuery } from '@/lib/queries/feed-query';
import { LiveScreen } from './live-screen';

export const metadata: Metadata = {
  title: 'Na żywo — streamy trwające teraz',
  description:
    'Wszystkie transmisje na żywo w jednym miejscu: Twitch, YouTube i Kick, posortowane według liczby oglądających.',
  alternates: { canonical: 'https://xdtv.fans/live' },
  openGraph: {
    title: 'Na żywo — streamy trwające teraz',
    description: 'Streamerzy nadający w tej chwili, posortowani według oglądalności.',
    url: 'https://xdtv.fans/live',
  },
};

const LIVE_PAGE_SIZE = 48;

/**
 * Live.
 *
 * A destination for people who only want streams. Until now live existed only
 * as a six-item, desktop-only sidebar list on Home, despite the platform sync
 * tracking over a thousand concurrent streams.
 */
export default async function LivePage() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(liveQuery(LIVE_PAGE_SIZE)).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <LiveScreen limit={LIVE_PAGE_SIZE} />
    </HydrationBoundary>
  );
}
