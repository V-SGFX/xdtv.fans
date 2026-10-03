import type { Metadata } from 'next';

// Server-side: use internal URL to avoid Cloudflare Tunnel loopback (ETIMEDOUT)
const INTERNAL_API = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const PUBLIC_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const res = await fetch(`${INTERNAL_API}/api/streamers/${slug}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { title: 'Streamer' };
    const streamer = await res.json();
    return {
      title: streamer.name,
      description: streamer.bio || `Profil ${streamer.name} na XDTV — statystyki, posty i społeczność.`,
      openGraph: {
        title: `${streamer.name} | XDTV`,
        description: streamer.bio || `Profil ${streamer.name} na XDTV`,
        type: 'profile',
        ...(streamer.avatarUrl && {
          images: [{ url: streamer.avatarUrl.startsWith('/') ? `${PUBLIC_URL}${streamer.avatarUrl}` : streamer.avatarUrl }],
        }),
      },
    };
  } catch {
    return { title: 'Streamer' };
  }
}

export default function StreamerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
