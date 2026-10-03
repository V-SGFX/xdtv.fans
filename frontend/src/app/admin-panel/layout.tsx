import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Panel Administracyjny',
  robots: { index: false },
};

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return children;
}
