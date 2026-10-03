import type { News, Post, Tag } from '@/lib/types';
import type { LiveStreamer } from '@/lib/queries/content';

/**
 * The wall renders content from three unrelated API shapes: Post (clips and
 * posts), StreamerProfile + StreamerStats (live), and News (articles).
 * Normalising them here is what lets ContentWall stay a layout component
 * instead of a switch statement over raw payloads — and it is the seam that
 * keeps one content system rather than one per surface.
 */

export type ContentKind = 'clip' | 'live' | 'post' | 'article';

export interface ContentAuthor {
  name: string;
  avatarUrl: string | null;
  href: string | null;
}

interface ContentBase {
  kind: ContentKind;
  /** Unique across kinds — ids collide between Post and News otherwise. */
  key: string;
  href: string;
  title: string;
  createdAt: string | null;
}

export interface ClipContent extends ContentBase {
  kind: 'clip';
  postId: number;
  thumbnailUrl: string | null;
  duration: number | null;
  viewCount: number;
  commentCount: number;
  author: ContentAuthor | null;
  streamer: { name: string; slug: string; avatarUrl: string | null; isLive: boolean } | null;
  game: Tag | null;
  language: Tag | null;
  platform: string | null;
  isNsfw: boolean;
}

export interface LiveContent extends ContentBase {
  kind: 'live';
  streamerSlug: string;
  thumbnailUrl: string | null;
  viewerCount: number | null;
  platform: string | null;
  avatarUrl: string | null;
  streamerName: string;
}

export interface PostContent extends ContentBase {
  kind: 'post';
  postId: number;
  body: string;
  imageUrl: string | null;
  imageCount: number;
  score: number;
  commentCount: number;
  author: ContentAuthor | null;
  community: { name: string; slug: string; color: string | null } | null;
  game: Tag | null;
  isNsfw: boolean;
  hasPoll: boolean;
}

export interface ArticleContent extends ContentBase {
  kind: 'article';
  imageUrl: string | null;
  summary: string | null;
  sourceName: string | null;
  sourceUrl: string;
}

export type ContentItem = ClipContent | LiveContent | PostContent | ArticleContent;

// ─── tag helpers ────────────────────────────────────────────────────────────

/**
 * Tags arrive either flattened (feed) or as PostTag join rows (posts detail).
 * FORMAT tags (`clip`, `twitch`) are pure noise on a card — the card already
 * says it is a clip — so nothing here surfaces them.
 */
type MaybeJoined = Tag | { tag: Tag };

function flattenTags(tags: MaybeJoined[] | undefined): Tag[] {
  if (!tags?.length) return [];
  return tags.map((t) => ('tag' in t ? t.tag : t)).filter(Boolean);
}

function pickTag(tags: Tag[], type: string): Tag | null {
  return tags.find((t) => (t as Tag & { type?: string }).type === type) ?? null;
}

// ─── adapters ───────────────────────────────────────────────────────────────

export function toClipContent(post: Post): ClipContent {
  const tags = flattenTags(post.tags as MaybeJoined[] | undefined);

  return {
    kind: 'clip',
    key: `clip-${post.id}`,
    postId: post.id,
    href: `/posts/${post.id}`,
    title: post.title,
    createdAt: post.createdAt,
    thumbnailUrl: post.thumbnailUrl ?? null,
    duration: post.duration ?? null,
    viewCount: post.viewCount ?? 0,
    commentCount: post.commentCount ?? 0,
    author: post.author
      ? {
          name: post.author.displayName || post.author.username,
          avatarUrl: post.author.avatarUrl,
          href: `/profile/${post.author.username}`,
        }
      : null,
    streamer: post.streamerProfile
      ? {
          name: post.streamerProfile.name,
          slug: post.streamerProfile.slug,
          avatarUrl: post.streamerProfile.avatarUrl ?? null,
          isLive: Boolean(post.streamerProfile.isLive),
        }
      : null,
    game: pickTag(tags, 'GAME'),
    language: pickTag(tags, 'LANGUAGE'),
    platform: post.clipSource ?? null,
    isNsfw: Boolean(post.isNsfw),
  };
}

export function toPostContent(post: Post): PostContent {
  const tags = flattenTags(post.tags as MaybeJoined[] | undefined);
  const images = post.images ?? [];
  const firstImage = images[0]?.url ?? post.imageUrl ?? null;

  return {
    kind: 'post',
    key: `post-${post.id}`,
    postId: post.id,
    href: `/posts/${post.id}`,
    title: post.title,
    createdAt: post.createdAt,
    body: post.content ?? '',
    imageUrl: firstImage,
    imageCount: images.length || (post.imageUrl ? 1 : 0),
    score: (post.upvotes ?? 0) - (post.downvotes ?? 0),
    commentCount: post.commentCount ?? 0,
    author: post.author
      ? {
          name: post.author.displayName || post.author.username,
          avatarUrl: post.author.avatarUrl,
          href: `/profile/${post.author.username}`,
        }
      : null,
    community: post.community
      ? { name: post.community.name, slug: post.community.slug, color: post.community.color ?? null }
      : null,
    game: pickTag(tags, 'GAME'),
    isNsfw: Boolean(post.isNsfw),
    hasPoll: Boolean(post.poll),
  };
}

/** Routes a Post to the right content kind. */
export function toContentItem(post: Post): ClipContent | PostContent {
  return post.type === 'CLIP' ? toClipContent(post) : toPostContent(post);
}

export function toLiveContent(streamer: LiveStreamer): LiveContent {
  // A streamer can be live on more than one platform; show the busiest.
  const liveStats = (streamer.stats ?? []).filter((s) => s.isLive);
  const best = liveStats.sort((a, b) => (b.viewerCount ?? 0) - (a.viewerCount ?? 0))[0];

  return {
    kind: 'live',
    key: `live-${streamer.id}`,
    streamerSlug: streamer.slug,
    href: `/streamers/${streamer.slug}`,
    // Falls back to the streamer name: 99% of live rows have a stream title,
    // but a tile with an empty heading is worse than a redundant one.
    title: best?.streamTitle || streamer.name,
    createdAt: null,
    thumbnailUrl: best?.thumbnailUrl ?? null,
    viewerCount: best?.viewerCount ?? null,
    platform: best?.platform ?? null,
    avatarUrl: streamer.avatarUrl ?? null,
    streamerName: streamer.name,
  };
}

export function toArticleContent(news: News): ArticleContent {
  return {
    kind: 'article',
    key: `article-${news.id}`,
    // Our own page, not the publisher's. An article used to link straight
    // out, so a reader left XDTV at the first tap and had nowhere to comment.
    href: `/news/${news.id}`,
    title: news.title,
    createdAt: news.publishedAt,
    imageUrl: news.imageUrl,
    summary: news.summary,
    sourceName: news.sourceName,
    sourceUrl: news.sourceUrl,
  };
}
