import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TagsService } from '../tags/tags.service';
import { NsfwService } from '../nsfw/nsfw.service';
import { FeedService } from '../feed/feed.service';
import { XpService } from '../engagement/xp.service';
import { StreakService } from '../engagement/streak.service';

import DOMPurify from 'isomorphic-dompurify';

function sanitize(str: string): string {
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'a', 'code', 'pre', 'blockquote', 'h2', 'h3', 'ul', 'ol', 'li', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'data-spoiler'],
  });
}

const POST_INCLUDE = {
  author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
  streamerProfile: { select: { id: true, slug: true, name: true, avatarUrl: true, isLive: true } },
  community: { select: { id: true, slug: true, name: true, iconUrl: true, color: true } },
  tags: { include: { tag: true } },
  images: { orderBy: { order: 'asc' as const }, select: { id: true, url: true, order: true } },
  poll: {
    include: {
      options: { orderBy: { order: 'asc' as const }, select: { id: true, text: true, order: true, voteCount: true } },
    },
  },
  amaSession: {
    select: { id: true, endsAt: true, isOpen: true, _count: { select: { questions: true } } },
  },
};

@Injectable()
export class PostsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private notifications: NotificationsService,
    private tagsService: TagsService,
    private nsfwService: NsfwService,
    @Inject(forwardRef(() => FeedService)) private feedService: FeedService,
    private xpService: XpService,
    private streakService: StreakService,
  ) {}

  async findAll(opts: {
    page: number; limit: number; streamerId?: number; communityId?: number; communitySlug?: string; official?: boolean;
    sort?: string; tag?: string; nsfw?: boolean; type?: string; userId?: number; following?: boolean;
  }) {
    const { page, limit, streamerId, communityId, communitySlug, official, sort, tag, nsfw, type, userId, following } = opts;
    // No caching for personalised following feed
    const cacheKey = following ? null : `posts:list:${page}:${limit}:${streamerId || ''}:${communityId || ''}:${communitySlug || ''}:${official ?? ''}:${sort || ''}:${tag || ''}:${nsfw ?? ''}:${type || ''}`;
    if (cacheKey) {
      const cached = await this.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    // Resolve follows for the personalised feed.
    //
    // A follow now targets either a streamer or a tag, so "Following" means
    // posts from a followed streamer OR carrying a followed tag. Previously it
    // read every follow row and assumed a streamer id, which silently included
    // nulls once tag follows existed.
    let followedStreamerIds: number[] | undefined;
    let followedTagIds: number[] | undefined;
    if (following && userId) {
      const follows = await this.prisma.follow.findMany({
        where: { userId },
        select: { streamerProfileId: true, tagId: true },
      });
      followedStreamerIds = follows
        .map((f) => f.streamerProfileId)
        .filter((id): id is number => id !== null);
      followedTagIds = follows
        .map((f) => f.tagId)
        .filter((id): id is number => id !== null);
    }

    const skip = (page - 1) * limit;
    const where: any = {
      isDeleted: false,
      ...(streamerId && { streamerProfileId: streamerId }),
      ...(communityId && { communityId }),
      ...(communitySlug && { community: { slug: communitySlug } }),
      ...(official !== undefined && { isOfficial: official }),
      ...(tag && { tags: { some: { tag: { slug: tag } } } }),
      ...(nsfw === false && { isNsfw: false }),
      ...(type ? { type } : { type: { not: 'CLIP' } }),
      // Following = from a followed streamer OR carrying a followed tag.
      ...(followedStreamerIds !== undefined && {
        OR: [
          { streamerProfileId: { in: followedStreamerIds } },
          ...(followedTagIds && followedTagIds.length > 0
            ? [{ tags: { some: { tagId: { in: followedTagIds } } } }]
            : []),
        ],
      }),
    };

    /*
     * Przypięcie jest pojęciem SPOŁECZNOŚCI, nie serwisu.
     *
     * Do tej pory `isPinned` wchodziło do sortowania zawsze — także na
     * liście ogólnej. Post przypięty w jednej społeczności wypływał więc
     * na wierzch całego serwisu, ponad treściami wszystkich pozostałych.
     * Odkąd przypinać mogą moderatorzy społeczności, a nie tylko
     * administrator, jest to wprost droga na stronę główną: przypnij
     * u siebie, wyląduj u wszystkich.
     *
     * Dlatego przypięcie podnosi post wyłącznie wtedy, gdy patrzymy na
     * konkretną społeczność — i wtedy podnosi go przy KAŻDYM sortowaniu,
     * bo ogłoszenie przypięte przez moderatora ma być widoczne także dla
     * kogoś, kto przegląda „najnowsze".
     */
    const scoped = Boolean(communityId || communitySlug);
    const pinFirst = scoped ? [{ isPinned: 'desc' as const }] : [];

    let orderBy: any;
    switch (sort) {
      case 'popular':
        orderBy = [...pinFirst, { upvotes: 'desc' }, { commentCount: 'desc' }];
        break;
      case 'discussed':
        orderBy = [...pinFirst, { commentCount: 'desc' }, { createdAt: 'desc' }];
        break;
      case 'new':
      default:
        orderBy = [...pinFirst, { createdAt: 'desc' }];
        break;
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: POST_INCLUDE,
      }),
      this.prisma.post.count({ where }),
    ]);

    // Flatten tags for response
    const data = posts.map((p) => ({
      ...p,
      tags: p.tags.map((pt: any) => pt.tag),
    }));

    const result = { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
    if (cacheKey) await this.redis.set(cacheKey, JSON.stringify(result), 60);
    return result;
  }

  async findOne(id: number) {
    const post = await this.prisma.post.findFirst({
      where: { id, isDeleted: false },
      include: POST_INCLUDE,
    });
    if (!post) throw new NotFoundException('Post not found');
    return { ...post, tags: post.tags.map((pt: any) => pt.tag) };
  }

  async create(userId: number, data: any) {
    if (!data.title) {
      throw new BadRequestException('Title is required');
    }

    // Clip-specific validation
    if (data.type === 'CLIP' && !data.videoUrl) {
      throw new BadRequestException('videoUrl is required for clips');
    }

    // Poll validation
    if (data.type === 'POLL') {
      if (!Array.isArray(data.pollOptions) || data.pollOptions.length < 2 || data.pollOptions.length > 10) {
        throw new BadRequestException('Poll requires 2-10 options');
      }
    }

    // AMA validation
    if (data.type === 'AMA') {
      if (!data.amaEndsAt) {
        throw new BadRequestException('AMA requires an end time');
      }
      if (new Date(data.amaEndsAt) <= new Date()) {
        throw new BadRequestException('AMA end time must be in the future');
      }
    }

    // Auto-detect official post: author owns the target streamer profile
    let isOfficial = false;
    if (data.streamerProfileId) {
      const profile = await this.prisma.streamerProfile.findUnique({
        where: { id: data.streamerProfileId },
        select: { userId: true, isClaimed: true },
      });
      if (profile?.isClaimed && profile.userId === userId) {
        isOfficial = true;
      }
    }

    // NSFW detection
    const nsfwResult = this.nsfwService.detect(data.title, data.content, data.linkUrl);
    const isNsfw = data.isNsfw === true || nsfwResult.isNsfw;
    const isFlagged = nsfwResult.isNsfw && data.isNsfw !== true; // auto-detected but not user-marked

    // Resolve tags
    const tagIds = data.tags?.length
      ? await this.tagsService.findOrCreateMany(data.tags)
      : [];

    const post = await this.prisma.post.create({
      data: {
        title: sanitize(data.title),
        content: sanitize(data.content),
        type: data.type || 'TEXT',
        isOfficial,
        isNsfw,
        isFlagged,
        imageUrl: data.imageUrl || (data.imageUrls?.[0] ?? null),
        linkUrl: data.linkUrl,
        videoUrl: data.videoUrl || null,
        thumbnailUrl: data.thumbnailUrl || null,
        clipSource: data.clipSource || null,
        externalId: data.externalId || null,
        duration: data.duration ? parseInt(data.duration, 10) : null,
        authorId: userId,
        streamerProfileId: data.streamerProfileId,
        communityId: data.communityId || null,
        ...(tagIds.length > 0 && {
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        }),
        ...(data.imageUrls?.length > 0 && {
          images: {
            create: data.imageUrls.map((url: string, i: number) => ({ url, order: i })),
          },
        }),
        // Poll
        ...(data.type === 'POLL' && data.pollOptions?.length >= 2 && {
          poll: {
            create: {
              endsAt: data.pollEndsAt ? new Date(data.pollEndsAt) : null,
              options: {
                create: data.pollOptions.map((text: string, i: number) => ({ text: sanitize(text), order: i })),
              },
            },
          },
        }),
        // AMA
        ...(data.type === 'AMA' && data.amaEndsAt && {
          amaSession: {
            create: {
              endsAt: new Date(data.amaEndsAt),
            },
          },
        }),
      },
      include: POST_INCLUDE,
    });

    // Update tag post counts
    if (tagIds.length > 0) {
      await this.prisma.tag.updateMany({
        where: { id: { in: tagIds } },
        data: { postCount: { increment: 1 } },
      });
      await this.redis.delPattern('tags:*');
    }

    // Update community post count
    if (post.communityId) {
      await this.prisma.community.update({
        where: { id: post.communityId },
        data: { postCount: { increment: 1 } },
      });
      await this.redis.delPattern('communities:*');
    }

    await this.redis.delPattern('posts:list:*');

    // Award XP for creating a post
    this.xpService.awardXp(userId, 'POST_CREATE', undefined, { postId: post.id }).catch(() => {});
    this.streakService.recordDailyActivity(userId).catch(() => {});

    return { ...post, tags: post.tags.map((pt: any) => pt.tag) };
  }

  async update(id: number, userId: number, userRole: string, data: any) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      throw new ForbiddenException();
    }
    // Streamers can pin their own official posts; admins/mods can pin any post
    const canPin = ['ADMIN', 'MODERATOR'].includes(userRole) || (post.isOfficial && post.authorId === userId);
    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: sanitize(data.title) }),
        ...(data.content !== undefined && { content: sanitize(data.content) }),
        ...(data.isPinned !== undefined && canPin && { isPinned: data.isPinned }),
      },
    });
    await this.redis.delPattern('posts:list:*');
    return updated;
  }

  async remove(id: number, userId: number, userRole: string) {
    const post = await this.prisma.post.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    if (post.authorId !== userId && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      throw new ForbiddenException();
    }
    await this.prisma.post.update({ where: { id }, data: { isDeleted: true } });
    await this.redis.delPattern('posts:list:*');
  }

  async vote(postId: number, userId: number, direction: 'up' | 'down') {
    const post = await this.prisma.post.findFirst({ where: { id: postId, isDeleted: false } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.prisma.vote.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    const voteType = direction === 'up' ? 'UP' : 'DOWN';

    if (existing) {
      if (existing.type === voteType) {
        // Same vote — remove it (toggle off)
        await this.prisma.$transaction([
          this.prisma.vote.delete({ where: { id: existing.id } }),
          this.prisma.post.update({
            where: { id: postId },
            data: voteType === 'UP' ? { upvotes: { decrement: 1 } } : { downvotes: { decrement: 1 } },
          }),
        ]);
        const updated = await this.prisma.post.findUnique({ where: { id: postId }, select: { upvotes: true, downvotes: true } });
        return { vote: null, upvotes: updated!.upvotes, downvotes: updated!.downvotes };
      } else {
        // Flip vote
        await this.prisma.$transaction([
          this.prisma.vote.update({ where: { id: existing.id }, data: { type: voteType } }),
          this.prisma.post.update({
            where: { id: postId },
            data: voteType === 'UP'
              ? { upvotes: { increment: 1 }, downvotes: { decrement: 1 } }
              : { upvotes: { decrement: 1 }, downvotes: { increment: 1 } },
          }),
        ]);
        const updated = await this.prisma.post.findUnique({ where: { id: postId }, select: { upvotes: true, downvotes: true } });
        return { vote: voteType, upvotes: updated!.upvotes, downvotes: updated!.downvotes };
      }
    }

    // New vote
    await this.prisma.$transaction([
      this.prisma.vote.create({ data: { userId, postId, type: voteType } }),
      this.prisma.post.update({
        where: { id: postId },
        data: voteType === 'UP' ? { upvotes: { increment: 1 } } : { downvotes: { increment: 1 } },
      }),
    ]);

    // Notify post author on upvote only
    if (voteType === 'UP') {
      const voter = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true, displayName: true } });
      const name = voter?.displayName || voter?.username || 'Ktoś';
      this.notifications.create({
        userId: post.authorId,
        actorId: userId,
        type: 'VOTE_ON_POST',
        postId,
        message: `${name} polubił Twój post "${post.title.slice(0, 50)}"`,
      }).catch(() => {});
    }

    // Award XP + complete daily challenge for voting
    this.xpService.awardXp(userId, 'POST_VOTE', undefined, { postId }).catch(() => {});
    this.streakService.recordDailyActivity(userId).catch(() => {});
    this.streakService.completeChallenge(userId, 'POST_VOTE').catch(() => {});

    // Track tag preference on upvote
    if (voteType === 'UP') {
      this.prisma.postTag.findMany({ where: { postId }, include: { tag: true } })
        .then(pts => pts.forEach(pt => this.feedService.trackLikedTag(userId, pt.tag.slug)))
        .catch(() => {});
    }

    const updated = await this.prisma.post.findUnique({ where: { id: postId }, select: { upvotes: true, downvotes: true } });
    return { vote: voteType, upvotes: updated!.upvotes, downvotes: updated!.downvotes };
  }

  // ─── CLIP FEED (video-first feed with rotation) ──────

  async findFeed(page: number, limit: number) {
    // Rotate cache every 5 minutes so clips change positions
    const rotationBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const cacheKey = `posts:feed:${page}:${limit}:${rotationBucket}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const total = await this.prisma.post.count({ where: { isDeleted: false, type: 'CLIP' } });

    // First page: mix pinned + weighted-random selection from recent & popular
    if (page === 1) {
      const pinned = await this.prisma.post.findMany({
        where: { isDeleted: false, type: 'CLIP', isPinned: true },
        take: 3,
        orderBy: { createdAt: 'desc' },
        include: POST_INCLUDE,
      });

      // Fetch a larger pool and shuffle for variety
      const poolSize = Math.min(total, limit * 4);
      const pool = await this.prisma.post.findMany({
        where: { isDeleted: false, type: 'CLIP', isPinned: false },
        take: poolSize,
        orderBy: [{ createdAt: 'desc' }],
        include: POST_INCLUDE,
      });

      // Weighted shuffle: newer & more upvoted clips float higher but still mix
      const now = Date.now();
      const scored = pool.map(p => {
        const ageHours = (now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60);
        const freshness = Math.max(0, 1 - ageHours / 168); // decay over 7 days
        const popularity = Math.log2((p.upvotes || 0) + (p.viewCount || 0) + 2);
        const randomFactor = Math.random() * 0.6; // 60% randomness
        return { post: p, score: freshness * 0.3 + popularity * 0.1 + randomFactor };
      });
      scored.sort((a, b) => b.score - a.score);

      const pinnedIds = new Set(pinned.map(p => p.id));
      const remaining = scored.filter(s => !pinnedIds.has(s.post.id)).slice(0, limit - pinned.length);
      const posts = [...pinned, ...remaining.map(s => s.post)];

      const data = posts.map((p) => ({
        ...p,
        tags: p.tags.map((pt: any) => pt.tag),
      }));

      const result = { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
      await this.redis.set(cacheKey, JSON.stringify(result), 300);
      return result;
    }

    // Subsequent pages: chronological with slight shuffle
    const skip = (page - 1) * limit;
    const posts = await this.prisma.post.findMany({
      where: { isDeleted: false, type: 'CLIP' },
      skip,
      take: limit,
      orderBy: [{ createdAt: 'desc' }],
      include: POST_INCLUDE,
    });

    const data = posts.map((p) => ({
      ...p,
      tags: p.tags.map((pt: any) => pt.tag),
    }));

    const result = { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
    await this.redis.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  // ─── VIEW TRACKING ──────────────────────────────────────

  async recordView(id: number) {
    await this.prisma.post.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    }).catch(() => {});
  }

  async getUserVotes(userId: number, postIds: number[]) {
    const votes = await this.prisma.vote.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true, type: true },
    });
    return Object.fromEntries(votes.map(v => [v.postId, v.type]));
  }

  // ─── POST REACTIONS ─────────────────────────────────────

  async getReactions(postId: number, userId?: number) {
    const reactions = await this.prisma.postReaction.groupBy({
      by: ['emoji'],
      where: { postId },
      _count: { emoji: true },
    });

    // Get user's own reactions
    const userReactions = userId
      ? await this.prisma.postReaction.findMany({
          where: { postId, userId },
          select: { emoji: true },
        })
      : [];
    const userEmojiSet = new Set(userReactions.map(r => r.emoji));

    // Get users per reaction (up to 10)
    const result = await Promise.all(
      reactions.map(async (r) => {
        const users = await this.prisma.postReaction.findMany({
          where: { postId, emoji: r.emoji },
          take: 10,
          select: {
            user: { select: { id: true, username: true, displayName: true } },
          },
        });
        return {
          emoji: r.emoji,
          count: r._count.emoji,
          reacted: userEmojiSet.has(r.emoji),
          users: users.map(u => u.user),
        };
      }),
    );

    return result;
  }

  async toggleReaction(postId: number, userId: number, emoji: string) {
    const post = await this.prisma.post.findFirst({ where: { id: postId, isDeleted: false } });
    if (!post) throw new NotFoundException('Post not found');

    const existing = await this.prisma.postReaction.findUnique({
      where: { postId_userId_emoji: { postId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.postReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.postReaction.create({
        data: { postId, userId, emoji },
      });
    }

    return this.getReactions(postId, userId);
  }

  async getBatchReactions(postIds: number[], userId?: number) {
    const reactions = await this.prisma.postReaction.findMany({
      where: { postId: { in: postIds } },
      select: {
        postId: true,
        emoji: true,
        userId: true,
        user: { select: { id: true, username: true, displayName: true } },
      },
    });

    // Group by postId → emoji
    const result: Record<number, { emoji: string; count: number; reacted: boolean; users: any[] }[]> = {};
    for (const postId of postIds) {
      const postReactions = reactions.filter(r => r.postId === postId);
      const emojiMap = new Map<string, { count: number; reacted: boolean; users: any[] }>();
      for (const r of postReactions) {
        const entry = emojiMap.get(r.emoji) || { count: 0, reacted: false, users: [] };
        entry.count++;
        if (userId && r.userId === userId) entry.reacted = true;
        if (entry.users.length < 10) entry.users.push(r.user);
        emojiMap.set(r.emoji, entry);
      }
      result[postId] = Array.from(emojiMap.entries()).map(([emoji, data]) => ({
        emoji,
        ...data,
      }));
    }
    return result;
  }

  // ─── POLL ───────────────────────────────────────────────

  async pollVote(postId: number, userId: number, optionId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { poll: { include: { options: true } } },
    });
    if (!post || post.type !== 'POLL' || !post.poll) throw new NotFoundException('Poll not found');
    if (post.poll.endsAt && new Date(post.poll.endsAt) < new Date()) {
      throw new BadRequestException('Poll has ended');
    }
    const option = post.poll.options.find(o => o.id === optionId);
    if (!option) throw new BadRequestException('Invalid option');

    // Check existing vote
    const existing = await this.prisma.pollVote.findFirst({
      where: { userId, option: { pollId: post.poll.id } },
    });

    if (existing) {
      // Change vote
      await this.prisma.$transaction([
        this.prisma.pollVote.delete({ where: { id: existing.id } }),
        this.prisma.pollOption.update({ where: { id: existing.optionId }, data: { voteCount: { decrement: 1 } } }),
        this.prisma.pollVote.create({ data: { optionId, userId } }),
        this.prisma.pollOption.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.pollVote.create({ data: { optionId, userId } }),
        this.prisma.pollOption.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } }),
      ]);
    }

    return this.pollResults(postId, userId);
  }

  async pollResults(postId: number, userId?: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { poll: { include: { options: { orderBy: { order: 'asc' }, select: { id: true, text: true, order: true, voteCount: true } } } } },
    });
    if (!post?.poll) throw new NotFoundException('Poll not found');

    let userVoteOptionId: number | null = null;
    if (userId) {
      const vote = await this.prisma.pollVote.findFirst({
        where: { userId, option: { pollId: post.poll.id } },
      });
      userVoteOptionId = vote?.optionId ?? null;
    }

    const totalVotes = post.poll.options.reduce((sum, o) => sum + o.voteCount, 0);
    return {
      pollId: post.poll.id,
      endsAt: post.poll.endsAt,
      totalVotes,
      userVoteOptionId,
      options: post.poll.options.map(o => ({
        ...o,
        percentage: totalVotes > 0 ? Math.round((o.voteCount / totalVotes) * 100) : 0,
      })),
    };
  }

  // ─── AMA ────────────────────────────────────────────────

  async amaGetQuestions(postId: number, sort: string, userId?: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { amaSession: true },
    });
    if (!post?.amaSession) throw new NotFoundException('AMA session not found');

    const orderBy = sort === 'new' ? { createdAt: 'desc' as const } : { upvotes: 'desc' as const };

    const questions = await this.prisma.amaQuestion.findMany({
      where: { sessionId: post.amaSession.id },
      orderBy,
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        answer: {
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return {
      session: {
        id: post.amaSession.id,
        endsAt: post.amaSession.endsAt,
        isOpen: post.amaSession.isOpen && new Date(post.amaSession.endsAt) > new Date(),
        questionCount: questions.length,
      },
      questions,
    };
  }

  async amaAskQuestion(postId: number, userId: number, content: string) {
    if (!content?.trim()) throw new BadRequestException('Question content is required');
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { amaSession: true },
    });
    if (!post?.amaSession) throw new NotFoundException('AMA session not found');
    if (!post.amaSession.isOpen || new Date(post.amaSession.endsAt) <= new Date()) {
      throw new BadRequestException('AMA session has ended');
    }

    const question = await this.prisma.amaQuestion.create({
      data: {
        sessionId: post.amaSession.id,
        authorId: userId,
        content: sanitize(content.trim()),
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
    return question;
  }

  async amaAnswer(postId: number, questionId: number, userId: number, content: string) {
    if (!content?.trim()) throw new BadRequestException('Answer content is required');
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { amaSession: true },
    });
    if (!post?.amaSession) throw new NotFoundException('AMA session not found');
    // Only post author can answer
    if (post.authorId !== userId) throw new ForbiddenException('Only the post author can answer');

    const question = await this.prisma.amaQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.sessionId !== post.amaSession.id) throw new NotFoundException('Question not found');
    if (question.isAnswered) throw new BadRequestException('Question already answered');

    const [answer] = await this.prisma.$transaction([
      this.prisma.amaAnswer.create({
        data: {
          questionId,
          authorId: userId,
          content: sanitize(content.trim()),
        },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.amaQuestion.update({ where: { id: questionId }, data: { isAnswered: true } }),
    ]);
    return answer;
  }

  async amaUpvoteQuestion(postId: number, questionId: number, userId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { amaSession: true },
    });
    if (!post?.amaSession) throw new NotFoundException('AMA session not found');

    const question = await this.prisma.amaQuestion.findUnique({ where: { id: questionId } });
    if (!question || question.sessionId !== post.amaSession.id) throw new NotFoundException('Question not found');

    // Simple upvote increment (no tracking per user for simplicity)
    await this.prisma.amaQuestion.update({
      where: { id: questionId },
      data: { upvotes: { increment: 1 } },
    });
    return { upvotes: question.upvotes + 1 };
  }
}
