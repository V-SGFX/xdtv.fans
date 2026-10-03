import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { clipsQuery } from '@/lib/queries/feed-query';
import { ClipsScreen } from './clips-screen';

/**
 * Clips.
 *
 * Previously this page rendered 16:9 Twitch thumbnails inside `aspect-[9/16]`
 * boxes, cropping roughly two thirds of every image away, and used the bare
 * Navbar rather than AppLayout so it had no mobile bottom nav or footer. It
 * also carried its own card implementation — the second of two clip rendering
 * systems in the codebase.
 *
 * Now it is the same wall as everywhere else.
 */
export default async function ClipsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string }>;
}) {
  const { sort } = await searchParams;
  const mode = sort === 'new' ? 'new' : 'popular';

  const queryClient = getQueryClient();
  // The wall owns its own loading and error states; a failed prefetch must
  // never take the route down.
  await queryClient.prefetchInfiniteQuery(clipsQuery(mode)).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClipsScreen />
    </HydrationBoundary>
  );
}
