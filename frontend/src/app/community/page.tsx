import type { Metadata } from 'next';
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { getQueryClient } from '@/lib/query-client';
import { feedQuery } from '@/lib/queries/feed-query';
import CommunityFeedPage from './community-feed-client';

const BASE_URL = 'https://xdtv.fans';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type CommunityMeta = {
  name?: string;
  slug?: string;
  description?: string | null;
  postCount?: number;
};

function toSlug(raw: string): string {
  return decodeURIComponent(raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

async function resolveCommunity(input?: string): Promise<CommunityMeta | null> {
  if (!input) return null;
  const candidate = toSlug(input);
  if (!candidate) return null;

  try {
    const bySlug = await fetch(`${API_URL}/api/communities/${encodeURIComponent(candidate)}`, {
      next: { revalidate: 300 },
    });
    if (bySlug.ok) {
      return await bySlug.json();
    }
  } catch {}

  try {
    const listRes = await fetch(`${API_URL}/api/communities`, { next: { revalidate: 300 } });
    if (!listRes.ok) return null;
    const list = await listRes.json();
    const found = Array.isArray(list)
      ? list.find((c: CommunityMeta) => toSlug(c.slug || '') === candidate || toSlug(c.name || '') === candidate)
      : null;

    if (!found?.slug) return null;

    const fullRes = await fetch(`${API_URL}/api/communities/${encodeURIComponent(found.slug)}`, {
      next: { revalidate: 300 },
    });
    if (!fullRes.ok) return found;
    return await fullRes.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const communityParam = sp?.community;
  const community = await resolveCommunity(communityParam);

  if (!community?.slug || !community?.name) {
    return {
      title: 'Społeczność streamerów - dyskusje, dramy i opinie',
      description:
        'Dołącz do społeczności XDTV: komentuj dramy streamerów, publikuj opinie i śledź najgorętsze dyskusje dnia.',
      alternates: {
        canonical: `${BASE_URL}/community`,
      },
      openGraph: {
        title: 'Społeczność streamerów - dyskusje, dramy i opinie',
        description:
          'Najaktywniejsza społeczność streamerów: dyskusje, kontrowersje i reakcje na żywo.',
        url: `${BASE_URL}/community`,
      },
    };
  }

  const canonical = `${BASE_URL}/community?community=${encodeURIComponent(community.slug)}`;
  const postCount = Number.isFinite(community.postCount) ? community.postCount : 0;
  const baseDescription =
    community.description?.trim() ||
    `Społeczność c/${community.name} na XDTV: aktualne dyskusje, opinie i najgorętsze tematy dnia.`;

  return {
    title: `c/${community.name} - ${postCount} dyskusji w społeczności`,
    description: `${baseDescription} Sprawdź, co aktualnie grzeje w c/${community.name}.`,
    keywords: [
      `c/${community.name}`,
      `${community.name} społeczność`,
      `${community.name} streamerzy`,
      'dramy streamerów',
      'xdtv community',
    ],
    alternates: {
      canonical,
    },
    openGraph: {
      title: `c/${community.name} - społeczność XDTV`,
      description: `${baseDescription} Wejdź i dołącz do rozmowy.`,
      url: canonical,
      images: ['/opengraph-image'],
    },
  };
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string }>;
}) {
  const sp = await searchParams;
  const queryClient = getQueryClient();

  // Community is a content surface, so it ships with content rather than a
  // grid of skeletons.
  await queryClient
    .prefetchInfiniteQuery(feedQuery({ community: sp?.community || undefined }))
    .catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommunityFeedPage />
    </HydrationBoundary>
  );
}
