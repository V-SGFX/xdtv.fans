import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const STATS_CACHE_KEY = 'admin:platform_stats';
const STATS_TTL = 60;

@Injectable()
export class AdminStatsService {
  private readonly logger = new Logger(AdminStatsService.name);

  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async getStats() {
    const cached = await this.redis.get(STATS_CACHE_KEY);
    if (cached) {
      this.logger.debug('Stats served from cache');
      return JSON.parse(cached);
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const [
      usersTotal,
      activeUsers,
      messagesToday,
      postsToday,
      newUsersToday,
      activeSubscriptions,
      streamersTotal,
      channelsTotal,
      newsTotal,
      revenueActive,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastActiveAt: { gte: fiveMinutesAgo } } }),
      this.prisma.message.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.post.count({ where: { createdAt: { gte: todayStart }, isDeleted: false } }),
      this.prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.streamerProfile.count(),
      this.prisma.channel.count({ where: { isActive: true } }),
      this.prisma.news.count({ where: { isPublished: true } }),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    const stats = {
      usersTotal,
      activeUsers,
      messagesToday,
      postsToday,
      newUsersToday,
      activeSubscriptions,
      streamersTotal,
      channelsTotal,
      newsTotal,
      revenueActive,
      cachedAt: now.toISOString(),
    };

    await this.redis.set(STATS_CACHE_KEY, JSON.stringify(stats), STATS_TTL);
    return stats;
  }

  async invalidateCache() {
    await this.redis.del(STATS_CACHE_KEY);
  }
}
