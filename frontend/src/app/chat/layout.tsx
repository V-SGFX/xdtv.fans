import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Czat',
  description: 'Czat na żywo ze społecznością XDTV — kanały Discord-style dla streamerów.',
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
