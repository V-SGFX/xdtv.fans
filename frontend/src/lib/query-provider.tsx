'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { ReactNode } from 'react';
import { getQueryClient } from './query-client';

// Dev-only: the import lives behind a dynamic() call guarded by NODE_ENV, so
// the devtools bundle is never pulled into a production build.
const Devtools =
  process.env.NODE_ENV === 'development'
    ? dynamic(
        () => import('@tanstack/react-query-devtools').then((m) => m.ReactQueryDevtools),
        { ssr: false },
      )
    : () => null;

export function QueryProvider({ children }: { children: ReactNode }) {
  // getQueryClient() returns a per-request client on the server and a stable
  // singleton in the browser, so this is safe to call during render.
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Devtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
