import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('clips');
  return {
    title: t('title'),
    description: t('metaDescription'),
    alternates: { canonical: 'https://xdtv.fans/clips' },
    openGraph: {
      title: t('metaOgTitle'),
      description: t('metaOgDescription'),
      url: 'https://xdtv.fans/clips',
    },
  };
}

export default function ClipsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
