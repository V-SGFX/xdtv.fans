import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

interface CommunitySlugPageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = 'https://xdtv.fans';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function generateMetadata({ params }: CommunitySlugPageProps): Promise<Metadata> {
  const { slug } = await params;

  try {
    const res = await fetch(`${API_URL}/api/communities/${encodeURIComponent(slug)}`, {
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const c = await res.json();
      const canonical = `${BASE_URL}/community?community=${encodeURIComponent(c.slug || slug)}`;
      const desc =
        c?.description?.trim() ||
        `Społeczność c/${c?.name || slug} na XDTV: gorące dyskusje, opinie i aktualne tematy.`;

      return {
        title: `c/${c?.name || slug} - społeczność streamerów`,
        description: desc,
        alternates: { canonical },
        openGraph: {
          title: `c/${c?.name || slug} - społeczność XDTV`,
          description: desc,
          url: canonical,
          images: ['/opengraph-image'],
        },
      };
    }
  } catch {}

  return {
    title: `c/${slug} - społeczność streamerów`,
    description: `Dyskusje społeczności c/${slug} na XDTV.`,
    alternates: { canonical: `${BASE_URL}/community?community=${encodeURIComponent(slug)}` },
  };
}

export default async function CommunitySlugPage({ params }: CommunitySlugPageProps) {
  const { slug } = await params;
  redirect(`/community?community=${encodeURIComponent(slug)}`);
}
