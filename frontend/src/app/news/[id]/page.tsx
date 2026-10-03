import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleView, type ArticleDetail } from './article-view';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getArticle(id: string): Promise<ArticleDetail | null> {
  try {
    /*
     * `cache: 'no-store'`, nie `revalidate`.
     *
     * Od tej odpowiedzi zależy, czy strona w ogóle ISTNIEJE (`notFound()`).
     * Pamięć podręczna pobrań w Next leży w `.next/cache/fetch-cache`
     * i PRZEŻYWA PRZEBUDOWĘ, a xdtv nie ma żadnego mechanizmu unieważniania
     * — skasowany news oddawałby 200 z zapisanej kopii jeszcze długo po
     * wdrożeniu nowej wersji.
     */
    const res = await fetch(`${API_URL}/api/news/${id}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ArticleDetail;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const a = await getArticle(id);
  if (!a) return { title: 'News' };

  return {
    title: a.title,
    description: a.summary ?? undefined,
    alternates: { canonical: `https://xdtv.fans/news/${id}` },
    openGraph: {
      title: a.title,
      description: a.summary ?? undefined,
      url: `https://xdtv.fans/news/${id}`,
      images: a.imageUrl ? [a.imageUrl] : undefined,
      type: 'article',
    },
  };
}

export default async function NewsArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) notFound();

  return <ArticleView article={article} />;
}
