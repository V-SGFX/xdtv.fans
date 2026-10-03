import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { XpAction } from '@prisma/client';

/* ── XP amounts per action ── */
const XP_AMOUNTS: Record<XpAction, number> = {
  CHAT_MESSAGE: 2,
  CHAT_REACTION: 1,
  BATTLE_VOTE: 5,
  POST_CREATE: 15,
  POST_VOTE: 1,
  COMMENT: 5,
  DAILY_FIRST_MESSAGE: 10,
  DAILY_CHALLENGE_BONUS: 50,
  PREDICTION_WIN: 0, // dynamic, set externally
  HOT_TAKE_VOTE: 3,
  RANKING_VOTE: 5,
};

/* ── Streak multipliers ── */
function getStreakMultiplier(streak: number): number {
  if (streak >= 60) return 5;
  if (streak >= 30) return 3;
  if (streak >= 14) return 2;
  if (streak >= 7) return 1.5;
  return 1;
}

/* ── Level thresholds — level N requires N*100 cumulative XP ── */
function calculateLevel(totalXp: number): number {
  // Level 1: 0, Level 2: 100, Level 3: 300, Level 4: 600, Level 5: 1000, ...
  // Triangular: sum(1..L)*100 = L*(L+1)/2*100 ≤ totalXp
  // Solve: L = floor((-1 + sqrt(1 + 8*totalXp/100)) / 2)
  if (totalXp <= 0) return 1;
  const level = Math.floor((-1 + Math.sqrt(1 + 8 * totalXp / 100)) / 2);
  return Math.max(1, level);
}

type ReputationTier = 'ROOKIE' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'LEGEND';

function getReputationTier(totalXp: number): ReputationTier {
  if (totalXp >= 50000) return 'LEGEND';
  if (totalXp >= 15000) return 'PLATINUM';
  if (totalXp >= 5000) return 'GOLD';
  if (totalXp >= 1000) return 'SILVER';
  if (totalXp >= 250) return 'BRONZE';
  return 'ROOKIE';
}

/* ── Badge thresholds ── */
const BADGE_CHECKS: { badge: string; check: (stats: UserStats) => boolean }[] = [
  { badge: 'nowicjusz', check: () => true },
  { badge: 'gadacz', check: (s) => s.chatMessages >= 100 },
  { badge: 'sedzia', check: (s) => s.battleVotes >= 50 },
  { badge: 'regularny', check: (s) => s.currentStreak >= 7 },
  { badge: 'uzalezniony', check: (s) => s.currentStreak >= 30 },
  { badge: 'legenda', check: (s) => s.currentStreak >= 100 },
  { badge: 'og', check: (s) => s.accountAgeDays >= 180 },
  { badge: 'prediction_sniper', check: (s) => s.predictionWins >= 10 },
  { badge: 'community_leader', check: (s) => s.communityPosts >= 20 },
  { badge: 'tier_bronze', check: (s) => s.totalXp >= 250 },
  { badge: 'tier_silver', check: (s) => s.totalXp >= 1000 },
  { badge: 'tier_gold', check: (s) => s.totalXp >= 5000 },
  { badge: 'tier_platinum', check: (s) => s.totalXp >= 15000 },
  { badge: 'tier_legend', check: (s) => s.totalXp >= 50000 },
];

interface UserStats {
  chatMessages: number;
  battleVotes: number;
  currentStreak: number;
  accountAgeDays: number;
  totalXp: number;
  predictionWins: number;
  communityPosts: number;
}

@Injectable()
export class XpService {
  private readonly logger = new Logger(XpService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Award XP for an action. Applies streak multiplier.
   * Returns { xpAwarded, totalXp, newBadges }
   */
  async awardXp(
    userId: number,
    action: XpAction,
    overrideAmount?: number,
    metadata?: Record<string, any>,
  ) {
    const baseAmount = overrideAmount ?? XP_AMOUNTS[action];
    if (baseAmount <= 0) return { xpAwarded: 0, totalXp: 0, newBadges: [] as string[] };

    // Get or create streak for multiplier
    const streak = await this.prisma.userStreak.findUnique({ where: { userId } });
    const multiplier = getStreakMultiplier(streak?.currentStreak ?? 0);
    const finalAmount = Math.round(baseAmount * multiplier);

    // Record transaction
    await this.prisma.xpTransaction.create({
      data: {
        userId,
        action,
        amount: finalAmount,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // Upsert total XP
    const xpRecord = await this.prisma.userXp.upsert({
      where: { userId },
      update: { totalXp: { increment: finalAmount } },
      create: { userId, totalXp: finalAmount },
    });

    // Update level
    const newLevel = calculateLevel(xpRecord.totalXp);
    if (newLevel !== xpRecord.level) {
      await this.prisma.userXp.update({
        where: { userId },
        data: { level: newLevel },
      });
      // Notify on level up
      this.notifications.create({
        userId,
        type: 'LEVEL_UP',
        message: `🎉 Awansowałeś na poziom ${newLevel}! Tak trzymaj!`,
      }).catch(() => {});
    }

    // Check for new badges
    const newBadges = await this.checkBadges(userId);

    return { xpAwarded: finalAmount, totalXp: xpRecord.totalXp, newBadges };
  }

  /** Check and award any badges the user qualifies for */
  async checkBadges(userId: number): Promise<string[]> {
    const [user, existingBadges, xpTxCounts, streak, xp, predictionWins, communityPosts] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
      this.prisma.userBadge.findMany({ where: { userId }, select: { badge: true } }),
      this.prisma.xpTransaction.groupBy({
        by: ['action'],
        where: { userId },
        _count: { id: true },
      }),
      this.prisma.userStreak.findUnique({ where: { userId } }),
      this.prisma.userXp.findUnique({ where: { userId }, select: { totalXp: true } }),
      this.prisma.predictionBet.count({ where: { userId, payout: { gt: 0 } } }),
      this.prisma.post.count({ where: { authorId: userId, communityId: { not: null }, isDeleted: false } }),
    ]);

    if (!user) return [];

    const existing = new Set(existingBadges.map((b) => b.badge));

    const countMap: Record<string, number> = {};
    for (const row of xpTxCounts) {
      countMap[row.action] = row._count.id;
    }

    const stats: UserStats = {
      chatMessages: countMap['CHAT_MESSAGE'] ?? 0,
      battleVotes: countMap['BATTLE_VOTE'] ?? 0,
      currentStreak: streak?.currentStreak ?? 0,
      accountAgeDays: Math.floor((Date.now() - user.createdAt.getTime()) / 86_400_000),
      totalXp: xp?.totalXp ?? 0,
      predictionWins,
      communityPosts,
    };

    const newBadges: string[] = [];
    for (const { badge, check } of BADGE_CHECKS) {
      if (!existing.has(badge) && check(stats)) {
        await this.prisma.userBadge.create({ data: { userId, badge } }).catch(() => {});
        newBadges.push(badge);
        this.logger.log(`Badge '${badge}' awarded to user ${userId}`);
      }
    }

    return newBadges;
  }

  /** Get user's XP profile */
  async getProfile(userId: number) {
    const [xp, badges, streak, recentXp] = await Promise.all([
      this.prisma.userXp.findUnique({ where: { userId } }),
      this.prisma.userBadge.findMany({ where: { userId }, orderBy: { earnedAt: 'desc' } }),
      this.prisma.userStreak.findUnique({ where: { userId } }),
      this.prisma.xpTransaction.aggregate({
        where: {
          userId,
          createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
        },
        _sum: { amount: true },
      }),
    ]);

    const currentLevel = calculateLevel(xp?.totalXp ?? 0);
    const xpForCurrentLevel = currentLevel * (currentLevel + 1) / 2 * 100;
    const xpForNextLevel = (currentLevel + 1) * (currentLevel + 2) / 2 * 100;

    return {
      totalXp: xp?.totalXp ?? 0,
      level: currentLevel,
      tier: getReputationTier(xp?.totalXp ?? 0),
      xpForNextLevel,
      xpProgress: ((xp?.totalXp ?? 0) - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel),
      weeklyXp: recentXp._sum.amount ?? 0,
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      streakMultiplier: getStreakMultiplier(streak?.currentStreak ?? 0),
      badges: badges.map((b) => ({ badge: b.badge, earnedAt: b.earnedAt })),
    };
  }

  /** Leaderboard — top users by XP this week */
  async getLeaderboard(limit = 20) {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const topUsers = await this.prisma.xpTransaction.groupBy({
      by: ['userId'],
      where: { createdAt: { gte: weekAgo } },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
    });

    if (topUsers.length === 0) return [];

    const userIds = topUsers.map((r) => r.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, displayName: true, avatarUrl: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    return topUsers.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      weeklyXp: r._sum.amount ?? 0,
      user: userMap.get(r.userId) ?? null,
    }));
  }

  /** Public user status card with persistent reputation and tier */
  async getUserStatus(userId: number) {
    const [profile, user, commentCount, predictionWins, communityPosts] = await Promise.all([
      this.getProfile(userId),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          createdAt: true,
          _count: { select: { posts: true, comments: true, follows: true } },
        },
      }),
      this.prisma.comment.count({ where: { authorId: userId, isDeleted: false } }),
      this.prisma.predictionBet.count({ where: { userId, payout: { gt: 0 } } }),
      this.prisma.post.count({ where: { authorId: userId, communityId: { not: null }, isDeleted: false } }),
    ]);

    if (!user) return null;

    const betterUsers = await this.prisma.userXp.count({ where: { totalXp: { gt: profile.totalXp } } });

    return {
      user,
      reputation: {
        totalXp: profile.totalXp,
        level: profile.level,
        tier: profile.tier,
        weeklyXp: profile.weeklyXp,
        globalRank: betterUsers + 1,
      },
      badges: profile.badges,
      streak: {
        current: profile.currentStreak,
        longest: profile.longestStreak,
        multiplier: profile.streakMultiplier,
      },
      stats: {
        comments: commentCount,
        predictionWins,
        communityPosts,
      },
    };
  }

  /** Multi-board status endpoint: commenters, prediction winners, community leaders, trending users */
  async getStatusLeaderboards(limit = 10) {
    const safeLimit = Math.min(30, Math.max(3, limit));
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [commentRows, predictionRows, communityRows, trendingRows] = await Promise.all([
      this.prisma.comment.groupBy({
        by: ['authorId'],
        where: { isDeleted: false, createdAt: { gte: weekAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: safeLimit,
      }),
      this.prisma.predictionBet.groupBy({
        by: ['userId'],
        where: { payout: { gt: 0 }, createdAt: { gte: weekAgo } },
        _count: { id: true },
        _sum: { payout: true },
        orderBy: { _sum: { payout: 'desc' } },
        take: safeLimit,
      }),
      this.prisma.post.groupBy({
        by: ['authorId'],
        where: { communityId: { not: null }, isDeleted: false, createdAt: { gte: weekAgo } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: safeLimit,
      }),
      this.prisma.xpTransaction.groupBy({
        by: ['userId'],
        where: { createdAt: { gte: dayAgo } },
        _sum: { amount: true },
        _count: { id: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: safeLimit,
      }),
    ]);

    const ids = Array.from(new Set([
      ...commentRows.map((r) => r.authorId),
      ...predictionRows.map((r) => r.userId),
      ...communityRows.map((r) => r.authorId),
      ...trendingRows.map((r) => r.userId),
    ]));

    const [users, xpRows] = await Promise.all([
      this.prisma.user.findMany({
        where: { id: { in: ids } },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      }),
      this.prisma.userXp.findMany({
        where: { userId: { in: ids } },
        select: { userId: true, totalXp: true },
      }),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const xpMap = new Map(xpRows.map((x) => [x.userId, x.totalXp]));

    const enrich = (userId: number) => ({
      userId,
      user: userMap.get(userId) ?? null,
      tier: getReputationTier(xpMap.get(userId) ?? 0),
    });

    return {
      topCommenters: commentRows.map((r, i) => ({ rank: i + 1, comments: r._count.id, ...enrich(r.authorId) })),
      topPredictionWinners: predictionRows.map((r, i) => ({ rank: i + 1, wins: r._count.id, payout: r._sum.payout ?? 0, ...enrich(r.userId) })),
      communityLeaders: communityRows.map((r, i) => ({ rank: i + 1, posts: r._count.id, ...enrich(r.authorId) })),
      trendingUsers: trendingRows.map((r, i) => ({ rank: i + 1, activityXp: r._sum.amount ?? 0, actions: r._count.id, ...enrich(r.userId) })),
    };
  }
}
