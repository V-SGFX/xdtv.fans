'use client';

import type { ContentItem } from '@/lib/content/types';
import type { TileSpan } from './content-tile';
import { ClipCard } from './clip-card';
import { LiveCard } from './live-card';
import { ArticleCard } from './article-card';
import { PostCard } from './post-card';
import {
  ArticleTileSkeleton,
  ContentTileSkeleton,
  PostTileSkeleton,
} from '@/components/ui/skeleton';

/**
 * Single entry point for rendering any piece of content.
 *
 * Every surface — Home, Clips, Live, Discover, Community, Search, profiles —
 * renders through this. Nothing downstream switches on content kind, which is
 * what prevents a per-surface card system from reappearing.
 */
export function ContentCard({
  item,
  span,
  priority = false,
}: {
  item: ContentItem;
  span?: TileSpan;
  priority?: boolean;
}) {
  switch (item.kind) {
    case 'clip':
      return <ClipCard item={item} span={span ?? 'wide'} priority={priority} />;
    case 'live':
      return <LiveCard item={item} span={span ?? 'wide'} priority={priority} />;
    case 'article':
      return <ArticleCard item={item} span={span ?? 'narrow'} priority={priority} />;
    case 'post':
      return <PostCard item={item} span={span ?? 'narrow'} priority={priority} />;
  }
}

/** Loading placeholder matching the geometry of the kind it stands in for. */
export function ContentCardSkeleton({ kind = 'clip' }: { kind?: ContentItem['kind'] }) {
  if (kind === 'article') return <ArticleTileSkeleton />;
  if (kind === 'post') return <PostTileSkeleton />;
  return <ContentTileSkeleton />;
}
