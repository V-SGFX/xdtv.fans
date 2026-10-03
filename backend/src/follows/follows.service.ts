import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class FollowsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private redis: RedisService,
  ) {}

  async toggle(userId: number, streamerProfileId: number) {
    const profile = await this.prisma.streamerProfile.findUnique({ where: { id: streamerProfileId } });
    if (!profile) throw new NotFoundException('Streamer not found');
    const existing = await this.prisma.follow.findUnique({
      where: { userId_streamerProfileId: { userId, streamerProfileId } },
    });
    if (existing) {
      await this.prisma.$transaction([
        this.prisma.follow.delete({ where: { id: existing.id } }),
        this.prisma.streamerProfile.update({
          where: { id: streamerProfileId },
          data: { followerCount: { decrement: 1 } },
        }),
      ]);
      this.redis.delPattern(`feed:v2:u${userId}:*`).catch(() => {});
      return { following: false };
    } else {
      await this.prisma.$transaction([
        this.prisma.follow.create({ data: { userId, streamerProfileId } }),
        this.prisma.streamerProfile.update({
          where: { id: streamerProfileId },
          data: { followerCount: { increment: 1 } },
        }),
      ]);

      // Notify streamer owner if the profile is claimed
      if (profile.userId) {
        const follower = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true, displayName: true } });
        const name = follower?.displayName || follower?.username || 'Ktoś';
        this.notifications.create({
          userId: profile.userId,
          actorId: userId,
          type: 'NEW_FOLLOWER',
          message: `${name} zaczął obserwować ${profile.name}`,
        }).catch(() => {});
      }

      this.redis.delPattern(`feed:v2:u${userId}:*`).catch(() => {});
      return { following: true };
    }
  }

  /**
   * Follow or unfollow a tag — a game, a category, a language.
   *
   * Same edge as a streamer follow ("show me more of this"), so it lives on
   * the same table and the Following feed reads both together.
   */
  async toggleTag(userId: number, tagId: number) {
    const tag = await this.prisma.tag.findUnique({ where: { id: tagId } });
    if (!tag) throw new NotFoundException('Tag not found');

    const existing = await this.prisma.follow.findUnique({
      where: { userId_tagId: { userId, tagId } },
    });

    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } });
      this.redis.delPattern(`feed:v2:u${userId}:*`).catch(() => {});
      return { following: false, tag: { id: tag.id, slug: tag.slug, name: tag.name } };
    }

    await this.prisma.follow.create({ data: { userId, tagId } });
    this.redis.delPattern(`feed:v2:u${userId}:*`).catch(() => {});
    return { following: true, tag: { id: tag.id, slug: tag.slug, name: tag.name } };
  }

  /**
   * Follow (save) an individual piece of content — a clip, a post, an entry.
   *
   * Same table again: "obserwowane" means one list of things the user chose to
   * keep, whether that is a person, a topic or a single clip. A separate
   * bookmarks table would split that list in three.
   */
  async togglePost(userId: number, postId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, isDeleted: true },
    });
    if (!post || post.isDeleted) throw new NotFoundException('Post not found');

    const existing = await this.prisma.follow.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } });
      return { following: false };
    }

    /*
     * Wyścig dwóch kliknięć kończył się błędem 500.
     *
     * Między `findFirst` a `create` jest okno, w które mieści się drugie
     * żądanie tego samego użytkownika — a że w bazie stoi ograniczenie
     * unikalności, drugi zapis wychodził jako nieobsłużony
     * `PrismaClientKnownRequestError` i leciał do odwiedzającego jako
     * awaria serwera.
     *
     * Ograniczenie zrobiło dokładnie to, po co jest. Błędem była reakcja
     * na nie: skoro obserwacja już istnieje, stan, o który prosił
     * użytkownik, JEST osiągnięty.
     */
    try {
      await this.prisma.follow.create({ data: { userId, postId } });
    } catch (e: any) {
      if (e?.code !== 'P2002') throw e;
    }
    return { following: true };
  }

  async checkPost(userId: number, postId: number) {
    const follow = await this.prisma.follow.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    return { following: !!follow };
  }

  /**
   * Saved state for many posts at once.
   *
   * The wall renders 24+ cards per page; one request per card would mean 24
   * round trips just to decide which bookmark icon is filled.
   */
  async checkPostsBatch(userId: number, postIds: number[]) {
    if (postIds.length === 0) return {};
    const rows = await this.prisma.follow.findMany({
      where: { userId, postId: { in: postIds } },
      select: { postId: true },
    });
    const out: Record<number, boolean> = {};
    for (const r of rows) if (r.postId != null) out[r.postId] = true;
    return out;
  }

  /** Saved content, newest first. */
  async getMySavedPosts(userId: number, page = 1, limit = 24) {
    const where = { userId, postId: { not: null } };
    const [rows, total] = await Promise.all([
      this.prisma.follow.findMany({
        where,
        include: {
          post: {
            include: {
              author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
              streamerProfile: { select: { id: true, slug: true, name: true, avatarUrl: true, isLive: true } },
              community: { select: { id: true, slug: true, name: true, iconUrl: true, color: true } },
              tags: { include: { tag: true } },
              images: { orderBy: { order: 'asc' as const }, select: { id: true, url: true, order: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.follow.count({ where }),
    ]);

    return {
      data: rows.map((r) => r.post).filter((p) => p && !p.isDeleted),
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async checkTag(userId: number, tagId: number) {
    const follow = await this.prisma.follow.findUnique({
      where: { userId_tagId: { userId, tagId } },
    });
    return { following: !!follow };
  }

  /** Everything a user follows, in one call, split by kind. */
  async getMyFollows(userId: number) {
    return this.prisma.follow.findMany({
      where: { userId, streamerProfileId: { not: null } },
      include: {
        streamerProfile: {
          select: {
            id: true, slug: true, name: true, avatarUrl: true,
            bio: true, bannerUrl: true, followerCount: true, viewCount: true,
            isVerified: true, isLive: true, twitchUrl: true, youtubeUrl: true,
            kickUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Followed tags, used by Discover and the Following feed. */
  async getMyTagFollows(userId: number) {
    const rows = await this.prisma.follow.findMany({
      where: { userId, tagId: { not: null } },
      include: { tag: { select: { id: true, slug: true, name: true, type: true, postCount: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => r.tag).filter(Boolean);
  }

  async check(userId: number, streamerProfileId: number) {
    const follow = await this.prisma.follow.findUnique({
      where: { userId_streamerProfileId: { userId, streamerProfileId } },
    });
    return { following: !!follow };
  }
}
