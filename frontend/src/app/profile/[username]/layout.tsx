import type { Metadata } from 'next';

const INTERNAL_API = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const PUBLIC_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  try {
    const res = await fetch(`${INTERNAL_API}/api/users/username/${username}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { title: 'Profil' };
    const user = await res.json();
    const name = user.displayName || user.username;
    return {
      title: name,
      description: `Profil ${name} na XDTV — posty, komentarze i aktywność.`,
      openGraph: {
        title: `${name} | XDTV`,
        description: `Profil ${name} na XDTV.`,
        url: `https://xdtv.fans/profile/${username}`,
        type: 'profile',
        ...(user.avatarUrl && {
          images: [{ url: user.avatarUrl.startsWith('/') ? `${PUBLIC_URL}${user.avatarUrl}` : user.avatarUrl }],
        }),
      },
    };
  } catch {
    return { title: 'Profil' };
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
