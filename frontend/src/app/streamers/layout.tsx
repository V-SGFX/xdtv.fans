import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Streamerzy — Polscy Streamerzy Twitch, Kick, YouTube',
  description: 'Przeglądaj ponad 19 000 polskich streamerów na XDTV — Twitch, YouTube, Kick. Znajdź swoich ulubionych, sprawdź kto jest na żywo.',
  alternates: { canonical: 'https://xdtv.fans/streamers' },
  openGraph: {
    title: 'Streamerzy — XDTV',
    description: 'Przeglądaj ponad 19 000 polskich streamerów na XDTV.',
    url: 'https://xdtv.fans/streamers',
  },
};

export default function StreamersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
