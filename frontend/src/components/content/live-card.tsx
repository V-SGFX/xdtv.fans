'use client';

import { Radio } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { ContentTile, TileBody, TileMedia, TileMeta, TileTitle, type TileSpan } from './content-tile';
import { LiveBadge, PlatformBadge } from './badges';
import { liveThumbnail } from '@/lib/content/media';
import type { LiveContent } from '@/lib/content/types';

interface LiveCardProps {
  item: LiveContent;
  span?: TileSpan;
  priority?: boolean;
}

/**
 * A live stream in the wall.
 *
 * Deliberately the same tile geometry as ClipCard — live previews are 440x248
 * and clip thumbnails 480x272, both 16:9 — so the two read as one system. The
 * distinction is carried entirely by the LIVE badge and the accent border,
 * not by a different shape.
 *
 * Data is real as of the platform-sync repair: 1,034 live, 99% with a stream
 * title, 98% with viewer counts, 100% with a thumbnail. Viewer count is the
 * headline metric because it is the one that says "this is happening now".
 */
export function LiveCard({ item, span = 'wide', priority = false }: LiveCardProps) {
  const src = liveThumbnail(item.thumbnailUrl, span === 'narrow' ? 640 : 1280);

  return (
    <ContentTile
      href={item.href}
      span={span}
      ariaLabel={`Na żywo: ${item.streamerName}${item.viewerCount ? `, ${item.viewerCount} oglądających` : ''} — ${item.title}`}
      className="border-live/25 hover:border-live/45"
    >
      <TileMedia
        src={src}
        alt=""
        span={span}
        priority={priority}
        fallback={<Radio className="h-8 w-8" aria-hidden="true" />}
        overlay={
          <div className="absolute left-2 top-2 z-raised">
            <LiveBadge viewers={item.viewerCount} />
          </div>
        }
      />

      <TileBody>
        {/* The stream title is the content; the streamer is the attribution.
            Ordered accordingly, matching ClipCard. */}
        <TileTitle lines={2}>{item.title}</TileTitle>

        <TileMeta>
          <span className="flex min-w-0 items-center gap-1.5">
            <Avatar src={item.avatarUrl} name={item.streamerName} size="xs" status="live" />
            <span className="truncate text-content-secondary">{item.streamerName}</span>
          </span>
          <span className="ml-auto shrink-0">
            <PlatformBadge platform={item.platform} />
          </span>
        </TileMeta>
      </TileBody>
    </ContentTile>
  );
}
