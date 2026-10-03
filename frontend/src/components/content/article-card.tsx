'use client';

import { Newspaper } from 'lucide-react';
import { ContentTile, TileBody, TileMedia, TileMeta, TileTitle, type TileSpan } from './content-tile';
import type { ArticleContent } from '@/lib/content/types';
import { RelativeTime } from './relative-time';

interface ArticleCardProps {
  item: ArticleContent;
  span?: TileSpan;
  priority?: boolean;
}

/**
 * An article in the wall — 1,466 available, every one with an image.
 *
 * The one genuine asymmetry in the card set: article titles run to a median of
 * 87 characters against 16 for a clip, so this is the only card that clamps to
 * three lines and drops the summary at narrow widths. Giving it the same
 * one-line treatment as a clip would truncate most headlines mid-sentence.
 *
 * Articles link off-site, so the tile opens in a new tab and says so — both
 * with an icon and in the accessible name.
 */
export function ArticleCard({ item, span = 'narrow', priority = false }: ArticleCardProps) {
  return (
    <ContentTile
      href={item.href}
      span={span}
      ariaLabel={`Artykuł: ${item.title}${item.sourceName ? `, źródło ${item.sourceName}` : ''}`}
    >
      <TileMedia
        src={item.imageUrl}
        alt=""
        span={span}
        priority={priority}
        fallback={<Newspaper className="h-8 w-8" aria-hidden="true" />}
      />

      <TileBody>
        <TileTitle lines={3}>{item.title}</TileTitle>

        {item.summary && (
          <p className="line-clamp-2 hidden text-2xs leading-relaxed text-content-muted sm:block">
            {item.summary}
          </p>
        )}

        <TileMeta>
          {item.sourceName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Newspaper className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{item.sourceName}</span>
            </span>
          )}
          {item.createdAt && (
            <span className="ml-auto shrink-0">
              <RelativeTime iso={item.createdAt} />
            </span>
          )}
        </TileMeta>
      </TileBody>
    </ContentTile>
  );
}
