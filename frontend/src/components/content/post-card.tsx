'use client';

import Link from 'next/link';
import { ArrowBigUp, BarChart3, EyeOff, Images, MessageSquare } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { ContentTile, TileBody, TileMedia, TileMeta, TileTitle, type TileSpan } from './content-tile';
import { GameBadge } from './badges';
import { SaveButton } from './save-button';
import { RelativeTime } from './relative-time';
import { resolveMediaUrl } from '@/lib/content/media';
import type { PostContent } from '@/lib/content/types';

interface PostCardProps {
  item: PostContent;
  span?: TileSpan;
  priority?: boolean;
}

/** Strips stored rich-text markup down to a plain preview line. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A community post.
 *
 * A full citizen of the system, as decided — same tile shell, same spacing,
 * same interaction model as every other card. Two things make it different,
 * and both are driven by the content rather than by preference:
 *
 *  - It is the only kind whose media is optional, so it renders with or
 *    without an image and keeps a consistent height either way.
 *  - It is the only kind where votes and comments are meaningful signals, so
 *    they appear in the meta row. On clips those metrics are populated on
 *    0.02% of rows and are omitted instead.
 *
 * Caveat worth stating plainly: production currently holds 9 real posts, all
 * test data, so this card is verified structurally and against synthetic
 * content, not against a real corpus the way the other three are.
 */
export function PostCard({ item, span = 'narrow', priority = false }: PostCardProps) {
  const image = resolveMediaUrl(item.imageUrl);
  const preview = item.body ? toPlainText(item.body) : '';
  const hasMedia = Boolean(image) && !item.isNsfw;

  return (
    <ContentTile
      href={item.href}
      span={span}
      ariaLabel={`Post: ${item.title}${item.author ? `, ${item.author.name}` : ''}`}
    >
      {hasMedia && (
        <TileMedia
          src={image}
          alt=""
          span={span}
          priority={priority}
          overlay={
            item.imageCount > 1 ? (
              <div className="absolute bottom-2 right-2 z-raised">
                <span className="inline-flex items-center gap-1 rounded-sm bg-black/55 px-1.5 py-0.5 text-2xs text-white backdrop-blur-sm">
                  <Images className="h-2.5 w-2.5" aria-hidden="true" />
                  <span className="sr-only">Liczba zdjęć: </span>
                  {item.imageCount}
                </span>
              </div>
            ) : null
          }
        />
      )}

      <TileBody>
        {/* Author leads only when there is no media above it to anchor the
            tile — otherwise the title stays the first thing read. */}
        {!hasMedia && item.author && (
          <span className="flex min-w-0 items-center gap-1.5 text-2xs text-content-muted">
            <Avatar src={item.author.avatarUrl} name={item.author.name} size="xs" />
            <span className="truncate">{item.author.name}</span>
            {item.community && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate" style={{ color: item.community.color ?? undefined }}>
                  c/{item.community.slug}
                </span>
              </>
            )}
          </span>
        )}

        <TileTitle lines={2}>{item.title}</TileTitle>

        {item.isNsfw ? (
          <p className="inline-flex items-center gap-1.5 text-2xs text-content-muted">
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            Treść oznaczona 18+
          </p>
        ) : (
          preview && (
            <p className="line-clamp-2 text-2xs leading-relaxed text-content-muted">{preview}</p>
          )
        )}

        {item.game && (
          <div className="flex flex-wrap items-center gap-1">
            <GameBadge game={item.game} />
          </div>
        )}

        <TileMeta>
          {hasMedia && item.author ? (
            <Link
              href={item.author.href ?? '#'}
              onClick={(e) => e.stopPropagation()}
              className="flex min-w-0 items-center gap-1.5 rounded-sm transition-colors hover:text-content-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Avatar src={item.author.avatarUrl} name={item.author.name} size="xs" />
              <span className="truncate">{item.author.name}</span>
            </Link>
          ) : (
            item.createdAt && <RelativeTime iso={item.createdAt} />
          )}

          <span className="ml-auto flex shrink-0 items-center gap-2.5">
            <SaveButton postId={item.postId} className="h-6 w-6 bg-transparent text-content-muted hover:bg-surface-hover hover:text-content-primary" />
            {item.hasPoll && (
              <span className="inline-flex items-center gap-1">
                <BarChart3 className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Ankieta</span>
              </span>
            )}
            {item.score !== 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ArrowBigUp className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Punkty: </span>
                {item.score}
              </span>
            )}
            {item.commentCount > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <MessageSquare className="h-3 w-3" aria-hidden="true" />
                <span className="sr-only">Komentarze: </span>
                {item.commentCount}
              </span>
            )}
          </span>
        </TileMeta>
      </TileBody>
    </ContentTile>
  );
}
