'use client';

import Link from 'next/link';
import { Play, EyeOff } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { ContentTile, TileBody, TileMedia, TileMeta, TileTitle, type TileSpan } from './content-tile';
import { DurationBadge, GameBadge, LiveBadge, ViewCount } from './badges';
import { SaveButton } from './save-button';
import { clipThumbnail } from '@/lib/content/media';
import type { ClipContent } from '@/lib/content/types';

interface ClipCardProps {
  item: ClipContent;
  span?: TileSpan;
  priority?: boolean;
}

/**
 * The primary content format — 16,687 of the corpus.
 *
 * Hierarchy is media → title → streamer → game → views, which inverts the old
 * card: that one led with an avatar, username, up to three role badges, the
 * streamer, the community, a timestamp and a heat label before reaching the
 * title.
 *
 * Metrics reflect what is actually populated: views 99.98%, votes 0.02%,
 * comments 0.03%. So views are on the tile and voting lives on the detail
 * page, rather than a 52px vote rail rendering "0" across the whole wall.
 *
 * Performance: a poster image only. The previous card mounted a live YouTube
 * iframe 600ms after hover, which on a dense wall meant several concurrent
 * embeds. Video playback belongs to the detail view.
 */
export function ClipCard({ item, span = 'wide', priority = false }: ClipCardProps) {
  const src = clipThumbnail(
    { thumbnailUrl: item.thumbnailUrl, clipSource: item.platform, externalId: null },
    span === 'narrow' ? 640 : 1280,
  );

  const streamerName = item.streamer?.name ?? item.author?.name ?? null;

  return (
    <ContentTile
      href={item.href}
      span={span}
      ariaLabel={`Klip: ${item.title}${streamerName ? `, ${streamerName}` : ''}`}
    >
      <TileMedia
        src={item.isNsfw ? null : src}
        alt=""
        span={span}
        priority={priority}
        fallback={
          item.isNsfw ? (
            <span className="flex flex-col items-center gap-1 text-2xs">
              <EyeOff className="h-5 w-5" aria-hidden="true" />
              18+
            </span>
          ) : (
            <Play className="h-8 w-8" aria-hidden="true" />
          )
        }
        overlay={
          <>
            {/* Play affordance — appears on hover, hidden from AT since the
                whole tile is already a link. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full bg-black/60 backdrop-blur-sm">
                <Play className="ml-0.5 h-5 w-5 fill-white text-white" />
              </span>
            </div>

            <div className="absolute bottom-2 right-2 z-raised">
              <DurationBadge seconds={item.duration} />
            </div>

            {item.streamer?.isLive && (
              <div className="absolute left-2 top-2 z-raised">
                <LiveBadge />
              </div>
            )}

            {/* Appears on hover on pointer devices; always visible on touch,
                where there is no hover to reveal it. */}
            <div className="absolute right-2 top-2 z-raised opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 focus-within:opacity-100 [@media(pointer:coarse)]:opacity-100">
              <SaveButton postId={item.postId} />
            </div>
          </>
        }
      />

      <TileBody>
        <TileTitle lines={2}>{item.title}</TileTitle>

        <TileMeta>
          {item.streamer ? (
            <Link
              href={`/streamers/${item.streamer.slug}`}
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 items-center gap-1.5 rounded-sm transition-colors hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Avatar src={item.streamer.avatarUrl} name={item.streamer.name} size="xs" />
              <span className="truncate">{item.streamer.name}</span>
            </Link>
          ) : (
            streamerName && <span className="truncate">{streamerName}</span>
          )}

          <ViewCount count={item.viewCount} className="ml-auto shrink-0" />
        </TileMeta>

        {item.game && (
          <div className="flex flex-wrap items-center gap-1">
            <GameBadge game={item.game} />
          </div>
        )}
      </TileBody>
    </ContentTile>
  );
}
