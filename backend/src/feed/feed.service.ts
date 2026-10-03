import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const POST_INCLUDE = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
  streamerProfile: { select: { id: true, slug: true, name: true, avatarUrl: true, isLive: true } },
  community: { select: { id: true, slug: true, name: true, iconUrl: true, color: true } },
  tags: { include: { tag: true } },
  images: { orderBy: { order: 'asc' as const }, select: { id: true, url: true, order: true } },
};

// ─── GLOBAL SCORING WEIGHTS ─────────────────────────────
const W_VIEW = 0.5;
const W_VOTE = 2;
const W_COMMENT = 3;

const TYPE_BOOST: Record<string, number> = {
  CLIP: 2.5,
  VIDEO: 1.5,
  IMAGE: 1.2,
  TEXT: 1.0,
  LINK: 1.0,
};

const FRESHNESS_HALF_LIFE_H = 12;
const FRESHNESS_GRAVITY = 1.5;

const DRAMA_BOOST = 1.5;
const OFFICIAL_BOOST = 1.3;
const LIVE_STREAMER_BOOST = 1.4;

/**
 * XDTV is a gaming content wall, so content that is identifiably about a game
 * outranks content that merely has a large view count.
 *
 * This is not a thumb on the scale for its own sake. Raw view counts are not
 * comparable across sources: the median Twitch clip here has 51 views while
 * the median YouTube import has 1.98M, a ~39,000x gap that reflects two
 * different kinds of content rather than two levels of quality. Without this,
 * a handful of music videos outrank the entire gaming corpus permanently.
 */
const GAME_TAGGED_BOOST = 2.0;

// ─── PERSONALIZATION WEIGHTS ────────────────────────────
const FOLLOW_BOOST = 3.5;
const VIEWED_STREAMER_BOOST = 2.0;
const LIKED_TAG_BOOST = 2.0;
const PARTICIPATION_BOOST = 4.0;

// ─── MIXING ─────────────────────────────────────────────
const GLOBAL_RATIO = 0.5;
const PERSONAL_RATIO = 0.5;

// ─── POOL SIZE ──────────────────────────────────────────
/**
 * Freshness windows tried in order until the pool holds MIN_CANDIDATES.
 * Prefers recent content, but never returns an empty feed just because
 * ingest has paused. See fetchCandidates().
 */
const CANDIDATE_WINDOWS_DAYS = [7, 30, 90, 365, 3650];
const MIN_CANDIDATES = 40;
const MAX_CANDIDATES = 500;
const MAX_CONSECUTIVE = 3;

// ─── PREFERENCE LIMITS ──────────────────────────────────
const MAX_VIEWED_STREAMERS = 50;
const MAX_LIKED_TAGS = 30;

/**
 * Signals for anonymous users, passed via query params (sourced from localStorage).
 */
export interface AnonSignals {
  viewedStreamerIds: number[];
  likedTagSlugs: string[];
}

@Injectable()
export class FeedService {
  private readonly logger = new Logger(FeedService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  // ═══════════════════════════════════════════════════════
  //  MIXED FEED — GET /feed/mixed
  //  Combines clips + hot takes + predictions in one ranked feed
  // ═══════════════════════════════════════════════════════

  async getMixedFeed(userId: number | null, page: number, limit: number, sort = 'hot') {
    const cacheKey = `feed:mixed:${page}:${limit}:${sort}:${userId ?? 'anon'}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const skip = (page - 1) * limit;

    // Fetch clips
    const clipsWhere: any = { isDeleted: false, type: 'CLIP' };
    // Fetch posts (non-clip)
    const postsWhere: any = { isDeleted: false, type: { not: 'CLIP' } };
    // Order
    const orderBy: any = sort === 'new'
      ? [{ createdAt: 'desc' }]
      : [{ hotScore: 'desc' }, { createdAt: 'desc' }];

    const POST_SELECT = {
      id: true, title: true, content: true, type: true,
      isOfficial: true, isNsfw: true, isFlagged: true,
      upvotes: true, downvotes: true, commentCount: true,
      isPinned: true, createdAt: true, imageUrl: true,
      videoUrl: true, thumbnailUrl: true, clipSource: true,
      externalId: true, duration: true, viewCount: true, hotScore: true,
      author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
      streamerProfile: { select: { id: true, slug: true, name: true, avatarUrl: true, isLive: true } },
      community: { select: { id: true, slug: true, name: true, iconUrl: true, color: true } },
      tags: { include: { tag: true } },
    } as const;

    const [clips, posts, hotTakes, openPredictions] = await Promise.all([
      this.prisma.post.findMany({ where: clipsWhere, orderBy, take: Math.ceil(limit * 0.4), skip: 0, select: POST_SELECT }),
      this.prisma.post.findMany({ where: postsWhere, orderBy, take: Math.ceil(limit * 0.2), skip: 0, select: POST_SELECT }),
      this.prisma.hotTake.findMany({
        where: { isActive: true },
        orderBy: sort === 'new' ? [{ createdAt: 'desc' }] : [{ agreeCount: 'desc' }, { disagreeCount: 'desc' }],
        take: Math.ceil(limit * 0.2),
        skip: 0,
        include: { author: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      }),
      this.prisma.prediction.findMany({
        where: { status: 'OPEN', locksAt: { gt: new Date() } },
        orderBy: [{ locksAt: 'asc' }], // most urgent first
        take: Math.ceil(limit * 0.2),
        skip: 0,
        include: {
          options: { select: { id: true, label: true, totalBet: true } },
          createdBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
    ]);

    // Normalise into unified feed items
    const feedClips = clips.map(p => ({
      ...p,
      tags: p.tags.map((pt: any) => pt.tag),
      _feedType: 'CLIP' as const,
    }));
    const feedPosts = posts.map(p => ({
      ...p,
      tags: p.tags.map((pt: any) => pt.tag),
      _feedType: 'POST' as const,
    }));
    const feedHotTakes = hotTakes.map(h => ({
      ...h,
      _feedType: 'HOT_TAKE' as const,
    }));
    const feedPredictions = openPredictions.map(pr => ({
      ...pr,
      _feedType: 'PREDICTION' as const,
    }));

    // Interleave: 2 clips, 1 hot take, 1 post/prediction, repeat
    const merged: any[] = [];
    const clipQ = [...feedClips];
    const htQ = [...feedHotTakes];
    const postQ = [...feedPosts];
    const predQ = [...feedPredictions];

    let i = 0;
    while (merged.length < limit && (clipQ.length || htQ.length || postQ.length || predQ.length)) {
      if (clipQ.length) merged.push(clipQ.shift());
      if (clipQ.length) merged.push(clipQ.shift());
      if (htQ.length) merged.push(htQ.shift());
      else if (predQ.length) merged.push(predQ.shift());
      if (predQ.length) merged.push(predQ.shift());
      else if (postQ.length) merged.push(postQ.shift());
      i++;
      if (i > 100) break; // safety
    }

    const result = {
      data: merged.slice(0, limit),
      meta: { page, limit, hasMore: clipQ.length > 0 || htQ.length > 0 },
    };
    await this.redis.set(cacheKey, JSON.stringify(result), 120);
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  MAIN ENDPOINT — GET /feed
  // ═══════════════════════════════════════════════════════

  async getHomeFeed(
    userId: number | null,
    page: number,
    limit: number,
    communitySlug?: string,
    anonSignals?: AnonSignals,
    streamerSlug?: string,
    type?: string,
    sort?: string,
    excludeType?: string,
    tagSlug?: string,
    followingOnly = false,
  ) {
    // ─── Following: only content from what this user follows ──
    //
    // The Following tab used to send ?following=true to an endpoint that had
    // no such parameter, so it was silently dropped and the tab returned the
    // ordinary feed — identical results to For You. A follow now targets a
    // streamer or a tag, and "following" means content from either.
    if (followingOnly) {
      return this.getFollowingFeed(userId, page, limit, type);
    }

    // ─── Simple chronological mode (sort=new) ───────────
    if (sort === 'new' || sort === 'top') {
      return this.getSimpleFeed(userId, page, limit, communitySlug, streamerSlug, type, sort, excludeType, tagSlug);
    }

    // ─── Cache key ──────────────────────────────────────
    const signalHash = anonSignals
      ? this.hashSignals(anonSignals)
      : '';
    const cacheKey = userId
      ? `feed:v2:u${userId}:${page}:${limit}:${communitySlug || ''}:${streamerSlug || ''}:${type || ''}:${tagSlug || ''}`
      : `feed:v2:anon:${signalHash}:${page}:${limit}:${communitySlug || ''}:${streamerSlug || ''}:${type || ''}:${tagSlug || ''}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // ─── Resolve personalization signals ────────────────
    const signals = await this.resolveSignals(userId, anonSignals);

    const hasPersonalization =
      signals.followedIds.size > 0 ||
      signals.viewedStreamerIds.size > 0 ||
      signals.likedTagSlugs.size > 0 ||
      signals.participatedPostIds.size > 0;

    // ─── Fetch candidate pool ───────────────────────────
    const where: any = { isDeleted: false };
    if (communitySlug) {
      where.community = { slug: communitySlug };
    }
    if (streamerSlug) {
      where.streamerProfile = { slug: streamerSlug };
    }
    if (tagSlug) {
      where.tags = { some: { tag: { slug: tagSlug } } };
    }
    if (type) {
      where.type = type.toUpperCase();
    } else if (excludeType) {
      where.type = { not: excludeType.toUpperCase() };
    }

    const generalCandidates = await this.fetchCandidates(where);

    // ─── Fetch followed streamer content (wider window) ─
    // No date filter here either: content from someone the user deliberately
    // followed should not disappear because they last streamed three weeks
    // ago. Ordering plus the take cap keeps it recent-first, and freshness
    // decay still ranks it.
    let candidates = generalCandidates;
    if (signals.followedIds.size > 0) {
      const followedWhere: any = {
        isDeleted: false,
        streamerProfileId: { in: [...signals.followedIds] },
      };
      if (communitySlug) followedWhere.community = { slug: communitySlug };
      if (tagSlug) followedWhere.tags = { some: { tag: { slug: tagSlug } } };
      if (type) {
        followedWhere.type = type.toUpperCase();
      } else if (excludeType) {
        followedWhere.type = { not: excludeType.toUpperCase() };
      }

      const followedPosts = await this.prisma.post.findMany({
        where: followedWhere,
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: POST_INCLUDE,
      });

      // Merge & deduplicate
      const seenIds = new Set(generalCandidates.map(p => p.id));
      const extra = followedPosts.filter(p => !seenIds.has(p.id));
      candidates = [...generalCandidates, ...extra];
    }

    const now = Date.now();
    const baselines = await this.getSourceBaselines();

    // ─── Score every candidate ──────────────────────────
    const scored = candidates.map(post => {
      const tags: any[] = post.tags.map((pt: any) => pt.tag);
      const tagSlugs = new Set<string>(tags.map((t: any) => String(t.slug)));

      const globalScore = this.computeGlobalScore(post, tags, now, baselines);
      const personalScore = hasPersonalization
        ? this.computePersonalScore(post, tagSlugs, signals)
        : 0;

      // Weighted mix: 70% global, 30% personal (falls back to 100% global)
      const finalScore = hasPersonalization
        ? globalScore * GLOBAL_RATIO + personalScore * PERSONAL_RATIO
        : globalScore;

      return {
        ...post,
        tags,
        _score: Math.round(finalScore * 100) / 100,
        _globalScore: Math.round(globalScore * 100) / 100,
        _personalScore: Math.round(personalScore * 100) / 100,
        _reason: this.explainBoost(post, tagSlugs, signals),
      };
    });

    /*
     * Sortowanie wyłącznie po wyniku.
     *
     * Strona główna jest wspólna dla całego serwisu, a przypięcie dotyczy
     * jednej społeczności — moderator przypinający ogłoszenie u siebie nie
     * ogłasza go wszystkim. Wcześniej `isPinned` szło przed wynikiem, więc
     * dowolny przypięty post zajmował pierwsze miejsce na stronie głównej
     * niezależnie od tego, ile był wart.
     */
    scored.sort((a, b) => b._score - a._score);

    // ─── Diversity interleave ───────────────────────────
    const diverse = this.applyDiversity(scored);

    // ─── Paginate ───────────────────────────────────────
    const total = diverse.length;
    const start = (page - 1) * limit;
    const data = diverse.slice(start, start + limit);

    const result = {
      data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        personalized: hasPersonalization,
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(result), userId ? 15 : 60);
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  FOLLOWING FEED — only followed streamers and tags
  // ═══════════════════════════════════════════════════════

  /**
   * Content from the things this user follows.
   *
   * Deliberately chronological rather than scored: the point of a Following
   * tab is "what did the people and topics I chose post", so hiding a recent
   * item behind a ranking function defeats it. Signed-out users get nothing,
   * which the UI already handles as its own state.
   */
  private async getFollowingFeed(
    userId: number | null,
    page: number,
    limit: number,
    type?: string,
  ) {
    const empty = { data: [], meta: { page, limit, total: 0, pages: 0, personalized: true } };
    if (!userId) return empty;

    const follows = await this.prisma.follow.findMany({
      where: { userId, OR: [{ streamerProfileId: { not: null } }, { tagId: { not: null } }] },
      select: { streamerProfileId: true, tagId: true },
    });

    const streamerIds = follows.map((f) => f.streamerProfileId).filter((v): v is number => v !== null);
    const tagIds = follows.map((f) => f.tagId).filter((v): v is number => v !== null);
    if (streamerIds.length === 0 && tagIds.length === 0) return empty;

    const where: any = {
      isDeleted: false,
      OR: [
        ...(streamerIds.length ? [{ streamerProfileId: { in: streamerIds } }] : []),
        ...(tagIds.length ? [{ tags: { some: { tagId: { in: tagIds } } } }] : []),
      ],
    };
    if (type) where.type = type.toUpperCase();

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: POST_INCLUDE,
      }),
      this.prisma.post.count({ where }),
    ]);

    return {
      data: posts.map((p) => ({ ...p, tags: p.tags.map((pt: any) => pt.tag) })),
      meta: { page, limit, total, pages: Math.ceil(total / limit), personalized: true },
    };
  }

  // ═══════════════════════════════════════════════════════
  //  SIMPLE FEED — sort=new (chronological) / sort=top (engagement)
  // ═══════════════════════════════════════════════════════

  private async getSimpleFeed(
    userId: number | null,
    page: number,
    limit: number,
    communitySlug?: string,
    streamerSlug?: string,
    type?: string,
    sort = 'new',
    excludeType?: string,
    tagSlug?: string,
  ) {
    const cacheKey = `feed:v2:${sort}:${page}:${limit}:${communitySlug || ''}:${streamerSlug || ''}:${type || ''}:${excludeType || ''}:${tagSlug || ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const where: any = { isDeleted: false };

    // `new` is ordered by createdAt, so a date filter adds nothing except the
    // risk of an empty page — the newest content is first either way, and
    // skip/take paginates properly. Dropped.
    //
    // `top` does need a period, but a hard 7-day cut returned nothing at all
    // for this corpus. Widen only when the recent window is too thin to rank.
    if (sort === 'top') {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const recent = await this.prisma.post.count({
        where: { ...where, createdAt: { gte: since } },
      });
      if (recent >= MIN_CANDIDATES) {
        where.createdAt = { gte: since };
      }
    }

    if (communitySlug) where.community = { slug: communitySlug };
    if (streamerSlug) where.streamerProfile = { slug: streamerSlug };
    if (tagSlug) where.tags = { some: { tag: { slug: tagSlug } } };
    if (type) {
      where.type = type.toUpperCase();
    } else if (excludeType) {
      where.type = { not: excludeType.toUpperCase() };
    }

    // Ta sama zasada co w posts.service: przypięcie działa w obrębie
    // społeczności i przy każdym sortowaniu, a poza nią nie działa wcale.
    // Przy sortowaniu „najnowsze" przypięty post wcześniej nie wypływał
    // nawet we własnej społeczności — ogłoszenie ginęło pod pierwszym
    // nowym postem.
    const pinFirst = communitySlug ? [{ isPinned: 'desc' as const }] : [];
    const orderBy = sort === 'new'
      ? [...pinFirst, { createdAt: 'desc' as const }]
      : [
          ...pinFirst,
          { upvotes: 'desc' as const },
          { commentCount: 'desc' as const },
        ];

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: POST_INCLUDE,
      }),
      this.prisma.post.count({ where }),
    ]);

    const data = posts.map(post => ({
      ...post,
      tags: post.tags.map((pt: any) => pt.tag),
    }));

    const result = {
      data,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        personalized: false,
      },
    };

    await this.redis.set(cacheKey, JSON.stringify(result), 30);
    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  CANDIDATE POOL — adaptive freshness window
  // ═══════════════════════════════════════════════════════

  /**
   * Fetch scoring candidates, widening the date window until the pool is
   * usable.
   *
   * A fixed 7-day window silently emptied the feed: every clip in the corpus
   * predates it, so `/feed` returned 0 items while 16,687 clips sat behind the
   * filter. A feed that shows nothing is strictly worse than one showing good
   * older content, and the scorer already handles age — freshness decay ranks
   * recent content above old content on its own, so the window is a query
   * bound, not a product rule.
   *
   * Widening stops as soon as there is enough to rank, so this costs one query
   * in the normal case and only fans out when content really is sparse. It
   * also self-corrects: once ingest resumes, the first window matches again
   * and the feed narrows back to 7 days with no code change.
   */
  private async fetchCandidates(where: any): Promise<any[]> {
    for (const days of CANDIDATE_WINDOWS_DAYS) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const scopedWhere = { ...where, createdAt: { gte: since } };

      // Two pools, unioned: newest, and best-performing per source.
      //
      // Selecting purely by recency buried the entire gaming corpus — a
      // 365-item import happened to be the newest content, so "newest 500"
      // returned only that and the 16,322 Twitch clips behind it were
      // unreachable at any page.
      //
      // The second pool is partitioned by clip_source rather than ranked on
      // raw view count, because raw counts are not comparable across
      // platforms. A global "top by views" pool is still entirely YouTube, so
      // the best Twitch clips would never even become candidates and the
      // per-source normalisation in scoring would have nothing to work with.
      // The partitioned query is hand-written SQL and therefore only knows
      // about the date bound. Restrict it to the unfiltered home feed; a
      // filtered view (community, streamer, tag, type) is a small enough slice
      // that the recency pool covers it on its own.
      const isUnfiltered = Object.keys(where).length === 1 && 'isDeleted' in where;
      const perSource = Math.floor(MAX_CANDIDATES / 4);

      const [recent, popularIds] = await Promise.all([
        this.prisma.post.findMany({
          where: scopedWhere,
          orderBy: { createdAt: 'desc' },
          take: Math.floor(MAX_CANDIDATES / 2),
          include: POST_INCLUDE,
        }),
        isUnfiltered
          ? this.prisma.$queryRaw<{ id: number }[]>`
              SELECT id FROM (
                SELECT id,
                       ROW_NUMBER() OVER (
                         PARTITION BY clip_source
                         ORDER BY view_count DESC, comment_count DESC
                       ) AS rn
                FROM posts
                WHERE is_deleted = false AND created_at >= ${since}
              ) ranked
              WHERE rn <= ${perSource}
            `
          : Promise.resolve([] as { id: number }[]),
      ]);

      const seen = new Set(recent.map((p) => p.id));
      const missingIds = popularIds.map((r) => Number(r.id)).filter((id) => !seen.has(id));

      const popular = missingIds.length
        ? await this.prisma.post.findMany({
            where: { id: { in: missingIds } },
            include: POST_INCLUDE,
          })
        : [];

      const candidates = [...recent, ...popular];

      if (candidates.length >= MIN_CANDIDATES) return candidates;

      // Last window — return whatever exists rather than an empty feed.
      if (days === CANDIDATE_WINDOWS_DAYS[CANDIDATE_WINDOWS_DAYS.length - 1]) {
        if (candidates.length > 0) {
          this.logger.warn(
            `Feed candidate pool is thin: ${candidates.length} posts across ${days} days`,
          );
        }
        return candidates;
      }
    }
    return [];
  }

  // ═══════════════════════════════════════════════════════
  //  SOURCE BASELINES — makes view counts comparable
  // ═══════════════════════════════════════════════════════

  /**
   * Median view count per clip source, cached for an hour.
   *
   * Raw view counts cannot be compared across platforms. In this corpus the
   * median Twitch clip has 51 views and the median YouTube import has
   * 1,980,166 — a ~39,000x gap that says nothing about which is better
   * content. Ranking on the raw number let a few large YouTube videos occupy
   * the whole feed while 16,322 gaming clips were unreachable.
   *
   * Scoring against the source's own median instead answers the question that
   * actually matters: how far above typical is this, for where it came from.
   */
  private async getSourceBaselines(): Promise<Record<string, number>> {
    const cacheKey = 'feed:source-baselines';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.$queryRaw<{ clip_source: string | null; median: number }[]>`
      SELECT COALESCE(clip_source::text, 'NONE') AS clip_source,
             percentile_disc(0.5) WITHIN GROUP (ORDER BY view_count) AS median
      FROM posts
      WHERE is_deleted = false
      GROUP BY 1
    `;

    const baselines: Record<string, number> = {};
    for (const r of rows) baselines[r.clip_source ?? 'NONE'] = Number(r.median) || 0;

    await this.redis.set(cacheKey, JSON.stringify(baselines), 3600);
    return baselines;
  }

  // ═══════════════════════════════════════════════════════
  //  GLOBAL SCORE — engagement × freshness × boosts
  // ═══════════════════════════════════════════════════════

  private computeGlobalScore(
    post: any,
    tags: any[],
    now: number,
    baselines: Record<string, number> = {},
  ): number {
    // Doublings above the median for this post's own source, rather than the
    // raw count. A Twitch clip on 5k views and a YouTube video on 184M both
    // sit about 6.6 doublings above their respective medians, which is the
    // honest comparison.
    const baseline = baselines[post.clipSource ?? 'NONE'] ?? 0;
    const relativeViews = Math.max(
      0,
      Math.log2(1 + post.viewCount) - Math.log2(1 + baseline),
    );

    const base =
      relativeViews * W_VIEW +
      (post.upvotes - post.downvotes) * W_VOTE +
      post.commentCount * W_COMMENT;

    const typeMul = TYPE_BOOST[post.type] ?? 1.0;

    const hoursOld = (now - new Date(post.createdAt).getTime()) / 3_600_000;
      // Przypięte posty starzeją się tak samo jak reszta.
      // Wcześniej dostawały tu trwałe zwolnienie ze starzenia, więc post
      // przypięty w jednej społeczności trzymał się czoła strony głównej
      // bez końca — nie dlatego, że był dobry, tylko dlatego, że ktoś go
      // u siebie przypiął.
      const freshness =
        1.0 / Math.pow(1 + hoursOld / FRESHNESS_HALF_LIFE_H, FRESHNESS_GRAVITY);

    const hasDrama = tags.some(
      (t: any) => t.slug === 'drama' || t.slug?.includes('drama'),
    );
    const drama = hasDrama ? DRAMA_BOOST : 1.0;
    const official = post.isOfficial ? OFFICIAL_BOOST : 1.0;
    const live = post.streamerProfile?.isLive ? LIVE_STREAMER_BOOST : 1.0;

    // Identifiably about a game — the thing this product is a wall of.
    const gameTagged = tags.some((t: any) => t.type === 'GAME') ? GAME_TAGGED_BOOST : 1.0;

    return Math.max(0, base) * typeMul * freshness * drama * official * live * gameTagged;
  }

  // ═══════════════════════════════════════════════════════
  //  PERSONAL SCORE — user affinity signals
  // ═══════════════════════════════════════════════════════

  private computePersonalScore(
    post: any,
    tagSlugs: Set<string>,
    signals: ResolvedSignals,
  ): number {
    const base =
      Math.log2(1 + post.viewCount) * W_VIEW +
      (post.upvotes - post.downvotes) * W_VOTE +
      post.commentCount * W_COMMENT;

    let mul = 1.0;

    if (signals.participatedPostIds.has(post.id)) {
      mul *= PARTICIPATION_BOOST;
    }
    if (post.streamerProfileId && signals.followedIds.has(post.streamerProfileId)) {
      mul *= FOLLOW_BOOST;
    }
    if (post.streamerProfileId && signals.viewedStreamerIds.has(post.streamerProfileId)) {
      mul *= VIEWED_STREAMER_BOOST;
    }
    for (const slug of tagSlugs) {
      if (signals.likedTagSlugs.has(slug)) {
        mul *= LIKED_TAG_BOOST;
        break;
      }
    }

    return Math.max(0, base) * mul;
  }

  // ═══════════════════════════════════════════════════════
  //  EXPLAIN — short reason why a post was boosted
  // ═══════════════════════════════════════════════════════

  private explainBoost(
    post: any,
    tagSlugs: Set<string>,
    signals: ResolvedSignals,
  ): string | null {
    const reasons: string[] = [];
    if (signals.participatedPostIds.has(post.id)) {
      reasons.push('participated');
    }
    if (post.streamerProfileId && signals.followedIds.has(post.streamerProfileId)) {
      reasons.push('followed');
    }
    if (post.streamerProfileId && signals.viewedStreamerIds.has(post.streamerProfileId)) {
      reasons.push('viewed_streamer');
    }
    for (const slug of tagSlugs) {
      if (signals.likedTagSlugs.has(slug)) {
        reasons.push(`liked_tag:${slug}`);
        break;
      }
    }
    return reasons.length > 0 ? reasons.join(',') : null;
  }

  // ═══════════════════════════════════════════════════════
  //  RESOLVE SIGNALS — merge DB prefs + anonymous hints
  // ═══════════════════════════════════════════════════════

  private async resolveSignals(
    userId: number | null,
    anonSignals?: AnonSignals,
  ): Promise<ResolvedSignals> {
    if (userId) {
      const [follows, prefs, votedPostIds, commentedPostIds] = await Promise.all([
        // A follow row now targets a streamer or a tag; only streamer ids
        // belong in this set.
        this.prisma.follow
          .findMany({ where: { userId, streamerProfileId: { not: null } }, select: { streamerProfileId: true } })
          .then(fs => new Set(fs.map(f => f.streamerProfileId as number))),
        this.prisma.userPreference.findUnique({ where: { userId } }),
        this.prisma.vote
          .findMany({ where: { userId, postId: { not: null } }, select: { postId: true }, take: 200 })
          .then(vs => vs.map(v => v.postId!)),
        this.prisma.comment
          .findMany({ where: { authorId: userId, isDeleted: false }, select: { postId: true }, distinct: ['postId'], take: 200 })
          // Comments can now hang off a news article too; only post
          // participation is a feed-ranking signal.
          .then(cs => cs.map(c => c.postId).filter((id): id is number => id !== null)),
      ]);
      const participatedPostIds = new Set([...votedPostIds, ...commentedPostIds]);
      return {
        followedIds: follows,
        viewedStreamerIds: new Set(prefs?.viewedStreamerIds ?? []),
        likedTagSlugs: new Set(prefs?.likedTagSlugs ?? []),
        participatedPostIds,
      };
    }

    if (anonSignals) {
      return {
        followedIds: new Set<number>(),
        viewedStreamerIds: new Set(anonSignals.viewedStreamerIds.slice(0, MAX_VIEWED_STREAMERS)),
        likedTagSlugs: new Set(anonSignals.likedTagSlugs.slice(0, MAX_LIKED_TAGS)),
        participatedPostIds: new Set<number>(),
      };
    }

    return { followedIds: new Set(), viewedStreamerIds: new Set(), likedTagSlugs: new Set(), participatedPostIds: new Set() };
  }

  // ═══════════════════════════════════════════════════════
  //  TRACK SIGNALS — called from other services on user actions
  // ═══════════════════════════════════════════════════════

  async trackViewedStreamer(userId: number, streamerProfileId: number): Promise<void> {
    try {
      const existing = await this.prisma.userPreference.findUnique({ where: { userId } });
      const ids = existing?.viewedStreamerIds ?? [];
      if (ids.includes(streamerProfileId)) return;

      const updated = [...ids, streamerProfileId].slice(-MAX_VIEWED_STREAMERS);
      await this.prisma.userPreference.upsert({
        where: { userId },
        create: { userId, viewedStreamerIds: updated },
        update: { viewedStreamerIds: updated },
      });
    } catch (e) {
      this.logger.warn(`trackViewedStreamer failed: ${(e as Error).message}`);
    }
  }

  async trackLikedTag(userId: number, tagSlug: string): Promise<void> {
    try {
      const existing = await this.prisma.userPreference.findUnique({ where: { userId } });
      const slugs = existing?.likedTagSlugs ?? [];
      if (slugs.includes(tagSlug)) return;

      const updated = [...slugs, tagSlug].slice(-MAX_LIKED_TAGS);
      await this.prisma.userPreference.upsert({
        where: { userId },
        create: { userId, likedTagSlugs: updated },
        update: { likedTagSlugs: updated },
      });
    } catch (e) {
      this.logger.warn(`trackLikedTag failed: ${(e as Error).message}`);
    }
  }

  // ═══════════════════════════════════════════════════════
  //  DIVERSITY — interleave clips & non-clips
  // ═══════════════════════════════════════════════════════

  private applyDiversity(sorted: any[]): any[] {
    // Bez wyjątku dla przypiętych: na stronie głównej nie mają znaczenia,
    // a wyciąganie ich przed przeplot psuło rytm klip/nie-klip, dla którego
    // ta funkcja w ogóle istnieje.
    const clips: any[] = [];
    const others: any[] = [];
    for (const p of sorted) {
      if (p.type === 'CLIP') clips.push(p);
      else others.push(p);
    }

    const result: any[] = [];
    let ci = 0;
    let oi = 0;
    let consecutive = 0;
    let lastIsClip: boolean | null = null;

    while (ci < clips.length || oi < others.length) {
      let pickClip: boolean;

      if (ci >= clips.length) {
        pickClip = false;
      } else if (oi >= others.length) {
        pickClip = true;
      } else if (lastIsClip === true && consecutive >= MAX_CONSECUTIVE) {
        pickClip = false;
      } else if (lastIsClip === false && consecutive >= MAX_CONSECUTIVE) {
        pickClip = true;
      } else {
        pickClip = clips[ci]._score >= others[oi]._score;
      }

      if (pickClip) {
        result.push(clips[ci++]);
        consecutive = lastIsClip === true ? consecutive + 1 : 1;
        lastIsClip = true;
      } else {
        result.push(others[oi++]);
        consecutive = lastIsClip === false ? consecutive + 1 : 1;
        lastIsClip = false;
      }
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════
  //  UTILS
  // ═══════════════════════════════════════════════════════

  private hashSignals(s: AnonSignals): string {
    const raw = s.viewedStreamerIds.sort().join(',') + '|' + s.likedTagSlugs.sort().join(',');
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
    }
    return hash.toString(36);
  }

  // ─── HOT SCORE CRON (every 10 minutes) ────────────────
  @Cron('*/10 * * * *')
  async updateHotScores() {
    const epoch = 1704067200; // 2024-01-01 UTC
    try {
      await this.prisma.$executeRaw`
        UPDATE posts SET hot_score = (
          LOG(GREATEST(ABS(upvotes - downvotes), 1)) +
          SIGN(upvotes - downvotes) * (EXTRACT(EPOCH FROM created_at) - ${epoch}) / 45000.0
        )
        WHERE created_at > NOW() - INTERVAL '7 days' AND is_deleted = false
      `;
      this.logger.log('Hot scores updated');
    } catch (e) {
      this.logger.error('Failed to update hot scores', e);
    }
  }
}

interface ResolvedSignals {
  followedIds: Set<number>;
  viewedStreamerIds: Set<number>;
  likedTagSlugs: Set<string>;
  participatedPostIds: Set<number>;
}
