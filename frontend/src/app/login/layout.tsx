import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Logowanie',
  description: 'Zaloguj się do XDTV.',
  robots: { index: false },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
