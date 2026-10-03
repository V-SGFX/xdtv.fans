import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Szukaj',
  description: 'Szukaj streamerów, postów, użytkowników i newsów na XDTV.',
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
