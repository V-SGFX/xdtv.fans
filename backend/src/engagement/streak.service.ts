import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { XpService } from './xp.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChallengeType } from '@prisma/client';

/**
 * Daily challenges a user can actually complete.
 *
 * BATTLE_VOTE and HOT_TAKE_VOTE stay out: those features are gone, so
 * drawing them handed people a task with nowhere to perform it. They were
 * a third of every draw — sixteen of the forty-eight challenges issued so
 * far, none of which could ever be finished. A challenge that cannot be
 * completed is worse than no challenge: it reads as the site being broken.
 *
 * The enum keeps both values because old rows still reference them.
 */
const ALL_CHALLENGES: ChallengeType[] = [
  'CHAT_MESSAGE',
  'CHAT_REACTION',
  'POST_VOTE',
  'VISIT_STREAMER',
  'CREATE_COMMENT',
];

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Pick N random items from array */
function pickRandom<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

@Injectable()
export class StreakService {
  private readonly logger = new Logger(StreakService.name);

  constructor(
    private prisma: PrismaService,
    private xpService: XpService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Record that user did something today. Updates streak + creates daily challenges if needed.
   */
  async recordDailyActivity(userId: number) {
    const today = getTodayDate();

    const streak = await this.prisma.userStreak.upsert({
      where: { userId },
      update: {},
      create: { userId, currentStreak: 0, longestStreak: 0 },
    });

    if (streak.lastActiveDate === today) return streak;

    // Check if yesterday was active
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    let newStreak: number;

    if (streak.lastActiveDate === yesterday) {
      newStreak = streak.currentStreak + 1;
    } else if (streak.lastActiveDate && streak.freezesLeft > 0) {
      // Use streak freeze
      newStreak = streak.currentStreak + 1;
      await this.prisma.userStreak.update({
        where: { userId },
        data: { freezesLeft: { decrement: 1 } },
      });
      this.logger.log(`User ${userId} auto-used streak freeze`);
    } else {
      newStreak = 1;
    }

    const updatedStreak = await this.prisma.userStreak.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, streak.longestStreak),
        lastActiveDate: today,
      },
    });

    // Award streak milestone freeze at 30 days
    if (newStreak === 30 && streak.currentStreak < 30) {
      await this.prisma.userStreak.update({
        where: { userId },
        data: { freezesLeft: { increment: 1 } },
      });
    }

    // Check for streak-related badges
    await this.xpService.checkBadges(userId);

    return updatedStreak;
  }

  /**
   * Get (or generate) today's challenges for a user
   */
  async getDailyChallenges(userId: number) {
    const today = getTodayDate();

    const existing = await this.prisma.userDailyChallenge.findMany({
      where: { userId, date: today },
    });

    if (existing.length >= 3) return existing;

    // Generate 3 random challenges
    const types = pickRandom(ALL_CHALLENGES, 3);

    const challenges = await Promise.all(
      types.map((type) =>
        this.prisma.userDailyChallenge.upsert({
          where: { userId_date_challengeType: { userId, date: today, challengeType: type } },
          update: {},
          create: { userId, date: today, challengeType: type },
        }),
      ),
    );

    return challenges;
  }

  /**
   * Mark a challenge type as completed. If all 3 done → award bonus XP.
   */
  async completeChallenge(userId: number, type: ChallengeType) {
    const today = getTodayDate();

    const challenge = await this.prisma.userDailyChallenge.findUnique({
      where: { userId_date_challengeType: { userId, date: today, challengeType: type } },
    });

    if (!challenge || challenge.completed) return null;

    await this.prisma.userDailyChallenge.update({
      where: { id: challenge.id },
      data: { completed: true, completedAt: new Date() },
    });

    // Check if all challenges completed
    const all = await this.prisma.userDailyChallenge.findMany({
      where: { userId, date: today },
    });

    const allDone = all.length >= 3 && all.every((c) => c.completed || c.id === challenge.id);

    if (allDone) {
      await this.xpService.awardXp(userId, 'DAILY_CHALLENGE_BONUS');
      return { allCompleted: true, xpBonus: 50 };
    }

    return { allCompleted: false, xpBonus: 0 };
  }

  /** Get user's streak info */
  async getStreak(userId: number) {
    const streak = await this.prisma.userStreak.findUnique({ where: { userId } });
    return {
      currentStreak: streak?.currentStreak ?? 0,
      longestStreak: streak?.longestStreak ?? 0,
      freezesLeft: streak?.freezesLeft ?? 0,
    };
  }

  /**
   * Streak warning — runs daily at 20:00. Notifies users with streak ≥ 3
   * who haven't been active today that their streak is at risk.
   */
  @Cron('0 20 * * *')
  async sendStreakWarnings() {
    const today = getTodayDate();

    const atRisk = await this.prisma.userStreak.findMany({
      where: {
        currentStreak: { gte: 3 },
        lastActiveDate: { not: today },
      },
      select: { userId: true, currentStreak: true },
      take: 500,
    });

    for (const streak of atRisk) {
      this.notifications.create({
        userId: streak.userId,
        type: 'STREAK_WARNING',
        message: `🔥 Twój streak ${streak.currentStreak} dni jest zagrożony! Napisz na czacie, skomentuj albo zagłosuj na post, żeby go utrzymać.`,
      }).catch(() => {});
    }

    if (atRisk.length > 0) {
      this.logger.log(`Sent ${atRisk.length} streak warning notifications`);
    }
  }
}
