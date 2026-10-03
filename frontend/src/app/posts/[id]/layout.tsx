import type { Metadata } from 'next';

const INTERNAL_API = process.env.API_INTERNAL_URL || 'http://127.0.0.1:4000';
const PUBLIC_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const res = await fetch(`${INTERNAL_API}/api/posts/${id}`, { next: { revalidate: 60 }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { title: 'Post' };
    const post = await res.json();
    const desc = post.content?.slice(0, 160) || '';
    return {
      title: post.title,
      description: desc,
      openGraph: {
        title: post.title,
        description: desc,
        type: 'article',
        ...(post.imageUrl && {
          images: [{ url: post.imageUrl.startsWith('/') ? `${PUBLIC_URL}${post.imageUrl}` : post.imageUrl }],
        }),
      },
    };
  } catch {
    return { title: 'Post' };
  }
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
