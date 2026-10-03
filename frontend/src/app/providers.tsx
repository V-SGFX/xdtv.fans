'use client';

import { AuthProvider } from '@/lib/auth-context';
import { AuthGateProvider } from '@/lib/auth-gate';
import { QueryProvider } from '@/lib/query-provider';
import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
  locale: string;
  messages: Record<string, unknown>;
}

export function Providers({ children, locale, messages }: ProvidersProps) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* QueryProvider sits above Auth so that auth-aware code can read and
          invalidate the cache (e.g. dropping personalised feed data on logout). */}
      <QueryProvider>
        <AuthProvider>
          <AuthGateProvider>{children}</AuthGateProvider>
        </AuthProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
