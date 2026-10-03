import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Newsy ze Świata Streamingu',
  description: 'Najnowsze wiadomości ze świata streamingu — Twitch, YouTube, Kick i więcej. Bądź na bieżąco z XDTV.',
  alternates: { canonical: 'https://xdtv.fans/news' },
  openGraph: {
    title: 'Newsy — XDTV',
    description: 'Najnowsze wiadomości ze świata streamingu.',
    url: 'https://xdtv.fans/news',
  },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
