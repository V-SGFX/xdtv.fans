'use client';

import { Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/layout/app-layout';
import { ClipsWall } from '@/components/content/clips-wall';

type ClipSort = 'popular' | 'new';

function ClipsScreenInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const param = searchParams.get('sort');
  const sort: ClipSort = param === 'new' ? 'new' : 'popular';

  const setSort = useCallback(
    (next: ClipSort) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (next === 'popular') qs.delete('sort');
      else qs.set('sort', next);
      const s = qs.toString();
      router.replace(s ? `/clips?${s}` : '/clips', { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <AppLayout>
      <ClipsWall sort={sort} onSortChange={setSort} />
    </AppLayout>
  );
}

export function ClipsScreen() {
  return (
    <Suspense fallback={null}>
      <ClipsScreenInner />
    </Suspense>
  );
}
