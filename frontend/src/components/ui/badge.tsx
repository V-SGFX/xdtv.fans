'use client';

import type { ReactNode } from 'react';

/**
 * Identity variants describe *who* someone is; content variants describe *what*
 * a piece of content is. They are visually distinct on purpose — a viewer must
 * never confuse "this streamer is verified" with "this clip is Fortnite".
 */
export type BadgeVariant =
  // identity
  | 'verified' | 'mod' | 'admin' | 'streamer' | 'premium'
  // content
  | 'live' | 'game' | 'language' | 'category' | 'count'
  | 'default';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  /** Screen-reader label when the visible text is an abbreviation or a bare number. */
  srLabel?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  // ── identity ──
  verified: 'bg-accent/10 text-accent border-accent/25',
  mod: 'bg-success/10 text-success border-success/25',
  admin: 'bg-live/10 text-live border-live/25',
  streamer: 'bg-neon-purple/10 text-neon-purple border-neon-purple/25',
  premium: 'bg-warn/10 text-warn border-warn/25',

  // ── content ──
  // `live` is the only badge allowed to use the live colour, and it is the only
  // one that animates. That is what keeps LIVE meaningful.
  live: 'bg-live text-white border-live live-badge font-bold',
  // Game is the primary content signal, so it reads brighter than category.
  game: 'bg-white/[0.07] text-content-primary border-line-strong',
  language: 'bg-transparent text-content-muted border-line',
  category: 'bg-transparent text-content-secondary border-line',
  count: 'bg-black/55 text-white border-transparent backdrop-blur-sm',

  default: 'bg-white/[0.05] text-content-secondary border-line',
};

export function Badge({ variant = 'default', children, className = '', srLabel }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-2xs font-medium whitespace-nowrap ${variantStyles[variant]} ${className}`}
    >
      {srLabel && <span className="sr-only">{srLabel}</span>}
      <span aria-hidden={srLabel ? 'true' : undefined} className="inline-flex items-center gap-1">
        {children}
      </span>
    </span>
  );
}
