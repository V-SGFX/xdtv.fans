'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, type ReactNode } from 'react';
import { WALL_TILE_SIZES } from '@/lib/content/media';

export type TileSpan = 'narrow' | 'wide' | 'hero';

/**
 * The shell every content card sits in.
 *
 * One place owns the click target, focus ring, hover treatment and grid span,
 * which is what makes a clip, a live stream, an article and a post feel like
 * one system rather than four.
 *
 * Accessibility: the whole tile is a single anchor rather than a div with an
 * onClick, so it is reachable by keyboard, announced as a link, and supports
 * middle-click and "open in new tab" for free. Nested interactive elements
 * (game badge, author link) stop propagation instead of being nested anchors.
 */

const spanClass: Record<TileSpan, string> = {
  // Mobile is always one column; spans only apply from the 2-col breakpoint up.
  narrow: 'col-span-1',
  wide: 'col-span-1 md:col-span-2',
  hero: 'col-span-1 md:col-span-2 xl:col-span-4',
};

interface ContentTileProps {
  href: string;
  /** External links (articles) open in a new tab. */
  external?: boolean;
  span?: TileSpan;
  /** Full accessible name — the visible title alone is often not enough. */
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

export function ContentTile({
  href,
  external = false,
  span = 'wide',
  ariaLabel,
  children,
  className = '',
}: ContentTileProps) {
  const externalProps = external ? { target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <article className={spanClass[span]}>
      <Link
        href={href}
        {...externalProps}
        aria-label={ariaLabel}
        className={`
          group relative flex h-full flex-col overflow-hidden rounded-lg
          border border-line bg-surface-raised
          transition-colors duration-[120ms]
          hover:border-line-strong hover:bg-surface-hover
          focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
          ${className}
        `}
      >
        {children}
      </Link>
    </article>
  );
}

interface TileMediaProps {
  src: string | null;
  alt: string;
  span?: TileSpan;
  /** Above-the-fold tiles skip lazy loading so the first screen paints fast. */
  priority?: boolean;
  /** Overlaid chips — duration, live state, viewer count. */
  overlay?: ReactNode;
  fallback?: ReactNode;
  blurred?: boolean;
}

/**
 * 16:9 media area.
 *
 * Fixed to aspect-video because the corpus is ~99% 16:9 (Twitch clip
 * thumbnails 480x272, live previews 440x248). Reserving the box before the
 * image loads is what keeps the grid from reflowing during infinite scroll.
 */
export function TileMedia({
  src,
  alt,
  span = 'wide',
  priority = false,
  overlay,
  fallback,
  blurred = false,
}: TileMediaProps) {
  /*
   * Nieudane wczytanie obrazka schodzi na zastępczą ikonę.
   *
   * Obrazki newsów pochodzą z serwisów, które podaje scraper, a lista
   * dozwolonych hostów siedzi w `next.config.ts` i jest ustalana przy
   * budowaniu. Nowe źródło RSS oznacza więc host, którego optymalizator
   * Next.js odrzuca kodem 400 — i kafelkę z ikoną zepsutego obrazka.
   * Zdarzyło się to przy dołożeniu Polygona i Future: 36 artykułów
   * wyświetlało się jako uszkodzone.
   *
   * Sama lista jest uzupełniona, ale to nie wystarcza — kolejne źródło
   * zepsułoby to samo. Tutaj awaria kończy się tym samym widokiem, co
   * artykuł bez obrazka.
   */
  const [failed, setFailed] = useState(false);

  return (
    <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-surface-sunken">
      {src && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={WALL_TILE_SIZES[span]}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          onError={() => setFailed(true)}
          className={`object-cover transition-transform duration-300 group-hover:scale-[1.03] ${
            blurred ? 'blur-xl' : ''
          }`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-content-muted">
          {fallback}
        </div>
      )}

      {/* Legibility scrim for the overlaid chips. Pointer-events off so it
          never eats a click meant for the tile. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent"
      />

      {overlay}
    </div>
  );
}

/** Body region under the media. Consistent padding across every card. */
export function TileBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex min-w-0 flex-1 flex-col gap-1.5 p-2.5 ${className}`}>{children}</div>;
}

/**
 * Tile heading.
 *
 * `lines` differs by kind on purpose: clip titles are a median of 16
 * characters and fit one line, while article titles run to a median of 87 and
 * need two. Clamping rather than letting height vary is what keeps the grid
 * even without resorting to masonry.
 */
export function TileTitle({
  children,
  lines = 1,
  className = '',
}: {
  children: ReactNode;
  lines?: 1 | 2 | 3;
  className?: string;
}) {
  const clamp = lines === 1 ? 'line-clamp-1' : lines === 2 ? 'line-clamp-2' : 'line-clamp-3';
  return (
    <h3
      className={`text-sm font-semibold leading-snug text-content-primary transition-colors group-hover:text-accent ${clamp} ${className}`}
    >
      {children}
    </h3>
  );
}

/** Metadata row — one line, always. */
export function TileMeta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`mt-auto flex min-w-0 items-center gap-2 text-2xs text-content-muted ${className}`}
    >
      {children}
    </div>
  );
}
