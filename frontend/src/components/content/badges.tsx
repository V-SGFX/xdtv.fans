'use client';

import Link from 'next/link';
import { Eye, Users, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCount, formatDuration } from '@/lib/content/media';
import type { Tag } from '@/lib/types';

/**
 * Content badges.
 *
 * Only 42% of clips carry a game tag (measured), so GameBadge returns null
 * rather than rendering a placeholder — the 1,085 `irl` and 1,023
 * `just-chatting` clips genuinely have no game, and an "Unknown" chip on
 * 58% of the wall would be pure noise.
 */

export function GameBadge({ game, className = '' }: { game: Tag | null; className?: string }) {
  if (!game) return null;
  return (
    <Link
      href={`/discover?game=${game.slug}`}
      onClick={(e) => e.stopPropagation()}
      className={`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent rounded-sm ${className}`}
    >
      <Badge variant="game" className="transition-colors hover:border-accent/40 hover:text-accent">
        {game.name}
      </Badge>
    </Link>
  );
}

export function LanguageBadge({ language }: { language: Tag | null }) {
  if (!language) return null;
  return <Badge variant="language">{language.slug.slice(0, 2).toUpperCase()}</Badge>;
}

/** Live state. The pulsing dot comes from `.live-badge` in globals.css. */
export function LiveBadge({ viewers }: { viewers?: number | null }) {
  return (
    <Badge variant="live">
      LIVE
      {viewers != null && viewers > 0 && (
        <span className="font-semibold tabular-nums">{formatCount(viewers)}</span>
      )}
    </Badge>
  );
}

/**
 * View count.
 *
 * Promoted to the primary metric on clips: views are populated on 99.98% of
 * the corpus while votes sit at 0.02% and comments at 0.03%. The old cards
 * gave a 52px rail to votes and an 11px corner chip to views.
 */
export function ViewCount({ count, className = '' }: { count: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${className}`}>
      <Eye className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Wyświetlenia: </span>
      {formatCount(count)}
    </span>
  );
}

export function ViewerCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Users className="h-3 w-3" aria-hidden="true" />
      <span className="sr-only">Oglądających: </span>
      {formatCount(count)}
    </span>
  );
}

/** Duration chip, bottom-right of a media tile. */
export function DurationBadge({ seconds }: { seconds: number | null }) {
  const label = formatDuration(seconds);
  if (!label) return null;
  return (
    <Badge variant="count" className="tabular-nums">
      <Clock className="h-2.5 w-2.5" aria-hidden="true" />
      <span className="sr-only">Długość: </span>
      {label}
    </Badge>
  );
}

const PLATFORM_LABEL: Record<string, string> = {
  TWITCH: 'Twitch',
  YOUTUBE: 'YouTube',
  KICK: 'Kick',
  TIKTOK: 'TikTok',
  UPLOAD: 'Upload',
};

export function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  return <Badge variant="category">{PLATFORM_LABEL[platform] ?? platform}</Badge>;
}
