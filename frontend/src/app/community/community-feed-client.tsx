'use client';

import { useEffect, Suspense, useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PenLine, Hash } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Feed } from '@/components/content/feed';
import { Composer, type ComposerType } from '@/components/content/composer';
import { Button } from '@/components/ui/button';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useCommunities } from '@/lib/queries/content';
import { queryKeys } from '@/lib/queries/keys';
import { useAuth } from '@/lib/auth-context';

type SortMode = 'hot' | 'new' | 'top';

/**
 * Communities.
 *
 * Was 1,058 lines: a feed, a marquee ticker, a "most reacted in 30 minutes"
 * panel, a conflict-prompt block, a momentum rail, a sidebar and a ~300-line
 * inline composer — most of it duplicated from the old Home, and drifting from
 * it. The composer now lives in components/content/composer.tsx so every
 * surface can open it, and the feed is the shared wall.
 *
 * The URL stays /community?community=<slug>: it is what the existing metadata,
 * canonicals and sitemap point at, and churning it would cost SEO for no user
 * benefit.
 */
/** Tryby, które wolno otworzyć adresem. Musi zgadzać się z ComposerType. */
const COMPOSER_TYPES: ComposerType[] = ['TEXT', 'CLIP', 'LINK', 'MEDIA', 'POLL', 'AMA'];

function CommunityInner() {
  const t = useTranslations('community');
  const tf = useTranslations('feed');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const slug = searchParams.get('community');
  const sortParam = searchParams.get('sort');
  const sort: SortMode = sortParam === 'new' || sortParam === 'top' ? sortParam : 'hot';

  /*
   * `?postType=` otwiera kompozytor od razu, w zadanym trybie.
   *
   * Przycisk „+" na stronie głównej prowadzi tutaj z tym parametrem —
   * „Dodaj mema" na `postType=MEDIA`, „Zapytaj społeczność" na `TEXT`.
   * Strona czytała dotąd wyłącznie `community` i `sort`, więc parametr
   * był po cichu wyrzucany: użytkownik klikał „Dodaj mema" i lądował na
   * zwykłej liście społeczności, bez żadnego formularza i bez informacji,
   * że coś poszło nie tak.
   */
  const requestedType = searchParams.get('postType')?.toUpperCase() ?? null;
  const initialType = COMPOSER_TYPES.includes(requestedType as ComposerType)
    ? (requestedType as ComposerType)
    : null;

  const [composerOpen, setComposerOpen] = useState(false);

  // Otwarcie w efekcie, nie w stanie początkowym. Wartość z adresu jest
  // ta sama na serwerze i w przeglądarce, ale stan początkowy zależny od
  // parametru zapytania to najprostszy sposób na rozjazd przy hydratacji —
  // a otwarty modal w HTML z serwera i tak nie ma sensu.
  useEffect(() => {
    if (initialType) setComposerOpen(true);
  }, [initialType]);
  const { data: communities } = useCommunities();

  const active = useMemo(
    () => communities?.find((c) => c.slug === slug) ?? null,
    [communities, slug],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const qs = new URLSearchParams(searchParams.toString());
      if (value) qs.set(key, value);
      else qs.delete(key);
      const s = qs.toString();
      router.replace(s ? `/community?${s}` : '/community', { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <AppLayout>
      <header className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-content-primary">
              {active ? `c/${active.slug}` : t('title')}
            </h1>
            {active?.description && (
              <p className="mt-0.5 line-clamp-1 text-sm text-content-muted">{active.description}</p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <SegmentedControl
              label={t('title')}
              value={sort}
              onChange={(v) => setParam('sort', v === 'hot' ? null : v)}
              options={[
                { value: 'hot', label: 'Hot' },
                { value: 'new', label: tf('tabForYou') === 'For You' ? 'New' : 'Nowe' },
                { value: 'top', label: 'Top' },
              ]}
            />
            {user && (
              <Button variant="primary" size="sm" onClick={() => setComposerOpen(true)}>
                <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                {t('createPost')}
              </Button>
            )}
          </div>
        </div>

        {/* Community switcher. A horizontal strip rather than a sidebar, so it
            works identically on mobile — the old sidebar was desktop-only. */}
        {communities && communities.length > 0 && (
          <nav aria-label={t('title')} className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
            <Link
              href="/community"
              className={`shrink-0 rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors ${
                !slug
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-line text-content-muted hover:text-content-secondary'
              }`}
            >
              {t('allCommunities')}
            </Link>
            {communities
              .filter((c) => c.postCount > 0)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/community?community=${c.slug}`}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors ${
                    slug === c.slug
                      ? 'border-accent/40 bg-accent/10 text-accent'
                      : 'border-line text-content-muted hover:text-content-secondary'
                  }`}
                >
                  <Hash className="h-3 w-3" aria-hidden="true" />
                  {c.slug}
                </Link>
              ))}
          </nav>
        )}
      </header>

      <Feed
        filters={{
          community: slug ?? undefined,
          mode: sort === 'top' ? 'trending' : undefined,
        }}
        label={active ? `c/${active.slug}` : t('title')}
        emptyTitle={tf('emptyTitle')}
        emptyDescription={tf('emptyDesc')}
      />

      <Composer
        open={composerOpen}
        onClose={() => {
          setComposerOpen(false);
          // Parametr znika z adresu po zamknięciu — inaczej odświeżenie
          // strony albo powrót wstecz otwierałby formularz na nowo.
          if (initialType) setParam('postType', null);
        }}
        defaultType={initialType ?? undefined}
        defaultCommunityId={active?.id ?? null}
        onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.feed.all })}
      />
    </AppLayout>
  );
}

export default function CommunityFeedPage() {
  return (
    <Suspense fallback={null}>
      <CommunityInner />
    </Suspense>
  );
}
