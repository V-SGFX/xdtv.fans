import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { feedQuery, streamerQuery } from '@/lib/queries/feed-query';
import { StreamerScreen } from './streamer-screen';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getStreamer(slug: string) {
  try {
    const res = await fetch(`${API_URL}/api/streamers/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as { name?: string; bio?: string | null; avatarUrl?: string | null };
  } catch {
    return null;
  }
}

/**
 * The page was a client component with no metadata at all, so every streamer
 * profile shared the site-wide title and description. Each one is now its own
 * document for crawlers and link previews.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const streamer = await getStreamer(slug);
  const name = streamer?.name || slug;
  const title = `${name} — klipy i streamy`;
  const description =
    streamer?.bio?.trim() ||
    `Klipy, streamy na żywo i posty od ${name} na XDTV.`;

  return {
    title,
    description,
    alternates: { canonical: `https://xdtv.fans/streamers/${slug}` },
    openGraph: {
      title,
      description,
      url: `https://xdtv.fans/streamers/${slug}`,
      images: streamer?.avatarUrl ? [streamer.avatarUrl] : undefined,
    },
  };
}

export default async function StreamerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const queryClient = getQueryClient();
  await Promise.allSettled([
    queryClient.prefetchQuery(streamerQuery(slug)),
    queryClient.prefetchInfiniteQuery(feedQuery({ streamer: slug, type: 'CLIP' })),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StreamerScreen slug={slug} />
    </HydrationBoundary>
  );
}
