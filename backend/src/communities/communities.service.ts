import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class CommunitiesService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private async getDiscussionCountMap(communityIds: number[]): Promise<Map<number, number>> {
    if (!communityIds.length) return new Map();

    const rows = await this.prisma.post.groupBy({
      by: ['communityId'],
      where: {
        isDeleted: false,
        communityId: { in: communityIds },
        type: { not: 'CLIP' },
      },
      _count: { _all: true },
    });

    return new Map(rows.map((r) => [r.communityId || 0, r._count._all]));
  }

  private applyDiscussionCounts<T extends { id: number; postCount: number }>(communities: T[], countMap: Map<number, number>): T[] {
    return communities.map((c) => ({ ...c, postCount: countMap.get(c.id) || 0 }));
  }

  // ─── LIST ALL COMMUNITIES ─────────────────────────────

  async findAll(userId?: number) {
    const cacheKey = 'communities:all';
    let communities: any[];

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      communities = JSON.parse(cached);
    } else {
      communities = await this.prisma.community.findMany({
        orderBy: { memberCount: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          color: true,
          iconUrl: true,
          bannerUrl: true,
          isOfficial: true,
          postCount: true,
          memberCount: true,
          createdAt: true,
          createdBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });
      const countMap = await this.getDiscussionCountMap(communities.map((c) => c.id));
      communities = this.applyDiscussionCounts(communities, countMap);
      await this.redis.set(cacheKey, JSON.stringify(communities), 60);
    }

    if (userId) {
      const memberships = await this.prisma.communityMember.findMany({
        where: { userId },
        select: { communityId: true },
      });
      const joinedIds = new Set(memberships.map(m => m.communityId));
      return communities.map(c => ({ ...c, isJoined: joinedIds.has(c.id) }));
    }

    return communities.map(c => ({ ...c, isJoined: false }));
  }

  // ─── TRENDING COMMUNITIES ─────────────────────────────

  async findTrending(userId?: number) {
    const cacheKey = 'communities:trending';
    let communities: any[];

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      communities = JSON.parse(cached);
    } else {
      communities = await this.prisma.community.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          color: true,
          iconUrl: true,
          isOfficial: true,
          postCount: true,
          memberCount: true,
        },
      });
      const countMap = await this.getDiscussionCountMap(communities.map((c) => c.id));
      communities = this.applyDiscussionCounts(communities, countMap)
        .sort((a, b) => {
          if (b.memberCount !== a.memberCount) return b.memberCount - a.memberCount;
          return b.postCount - a.postCount;
        })
        .slice(0, 10);
      await this.redis.set(cacheKey, JSON.stringify(communities), 120);
    }

    if (userId) {
      const memberships = await this.prisma.communityMember.findMany({
        where: { userId },
        select: { communityId: true },
      });
      const joinedIds = new Set(memberships.map(m => m.communityId));
      return communities.map(c => ({ ...c, isJoined: joinedIds.has(c.id) }));
    }

    return communities.map(c => ({ ...c, isJoined: false }));
  }

  // ─── MY COMMUNITIES ──────────────────────────────────

  async findMyCommunities(userId: number) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      include: {
        community: {
          select: {
            id: true,
            name: true,
            slug: true,
            color: true,
            iconUrl: true,
            postCount: true,
            memberCount: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return memberships.map(m => ({ ...m.community, isJoined: true }));
  }

  // ─── GET BY SLUG ──────────────────────────────────────

  async findBySlug(slug: string, userId?: number) {
    const community = await this.prisma.community.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        color: true,
        iconUrl: true,
        bannerUrl: true,
        isOfficial: true,
        postCount: true,
        memberCount: true,
        createdAt: true,
        createdBy: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        moderators: {
          select: { user: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
        },
      },
    });

    if (!community) throw new NotFoundException('Community not found');

    const countMap = await this.getDiscussionCountMap([community.id]);
    const normalizedCommunity = {
      ...community,
      postCount: countMap.get(community.id) || 0,
    };

    let isJoined = false;
    if (userId) {
      const membership = await this.prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId } },
      });
      isJoined = !!membership;
    }

    return { ...normalizedCommunity, isJoined };
  }

  // ─── CREATE COMMUNITY ────────────────────────────────

  async create(userId: number, data: { name: string; description?: string; color?: string; iconUrl?: string }) {
    const slug = data.name
      .toLowerCase()
      .replace(/[\u0105\u0104]/g, 'a').replace(/[\u0107\u0106]/g, 'c').replace(/[\u0119\u0118]/g, 'e')
      .replace(/[\u0142\u0141]/g, 'l').replace(/[\u0144\u0143]/g, 'n').replace(/[\u00f3\u00d3]/g, 'o')
      .replace(/[\u015b\u015a]/g, 's').replace(/[\u017a\u0179\u017c\u017b]/g, 'z')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);

    const existing = await this.prisma.community.findFirst({
      where: { OR: [{ slug }, { name: data.name }] },
    });
    if (existing) throw new ConflictException('Community with this name already exists');

    const community = await this.prisma.$transaction(async (tx) => {
      const c = await tx.community.create({
        data: {
          name: data.name,
          slug,
          description: data.description,
          color: data.color || '#6366f1',
          iconUrl: data.iconUrl,
          createdById: userId,
          memberCount: 1,
        },
        select: {
          id: true, name: true, slug: true, description: true,
          color: true, iconUrl: true, postCount: true, memberCount: true,
        },
      });

      await tx.communityMember.create({ data: { communityId: c.id, userId } });
      await tx.communityModerator.create({ data: { communityId: c.id, userId } });

      return c;
    });

    await this.redis.delPattern('communities:*');
    return { ...community, isJoined: true };
  }

  // ─── JOIN COMMUNITY ───────────────────────────────────

  async join(communityId: number, userId: number) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    const ban = await this.prisma.communityBan.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (ban) throw new ForbiddenException('You are banned from this community');

    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (existing) return { message: 'Already joined', memberCount: community.memberCount, isJoined: true };

    await this.prisma.$transaction([
      this.prisma.communityMember.create({ data: { communityId, userId } }),
      this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { increment: 1 } },
      }),
    ]);

    await this.redis.delPattern('communities:*');
    return { message: 'Joined', memberCount: community.memberCount + 1, isJoined: true };
  }

  // ─── LEAVE COMMUNITY ─────────────────────────────────

  async leave(communityId: number, userId: number) {
    const community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException('Community not found');

    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!existing) return { message: 'Not a member', memberCount: community.memberCount, isJoined: false };

    await this.prisma.$transaction([
      this.prisma.communityMember.delete({
        where: { communityId_userId: { communityId, userId } },
      }),
      this.prisma.community.update({
        where: { id: communityId },
        data: { memberCount: { decrement: 1 } },
      }),
    ]);

    await this.redis.delPattern('communities:*');
    return { message: 'Left', memberCount: Math.max(0, community.memberCount - 1), isJoined: false };
  }
}
