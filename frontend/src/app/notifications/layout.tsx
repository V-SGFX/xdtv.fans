import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Powiadomienia',
  robots: { index: false },
};

export default function NotificationsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
