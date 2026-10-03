import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CACHE_KEY = 'emojis:all';
const CACHE_TTL = 300; // 5 min

@Injectable()
export class EmojisService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findAll() {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const emojis = await this.prisma.chatEmoji.findMany({
      orderBy: [{ isGlobal: 'desc' }, { name: 'asc' }],
      include: { streamerProfile: { select: { id: true, slug: true, name: true } } },
    });

    await this.redis.set(CACHE_KEY, JSON.stringify(emojis), CACHE_TTL);
    return emojis;
  }

  async findByStreamer(streamerProfileId: number) {
    return this.prisma.chatEmoji.findMany({
      where: { streamerProfileId },
      orderBy: { name: 'asc' },
    });
  }

  async findGlobal() {
    return this.prisma.chatEmoji.findMany({
      where: { isGlobal: true },
      orderBy: { name: 'asc' },
    });
  }

  async findPremium() {
    return this.prisma.chatEmoji.findMany({
      where: { isPremium: true },
      orderBy: { name: 'asc' },
    });
  }

  async findByCode(code: string) {
    return this.prisma.chatEmoji.findUnique({ where: { code } });
  }

  async create(data: {
    name: string;
    code: string;
    url: string;
    isAnimated?: boolean;
    isGlobal?: boolean;
    isPremium?: boolean;
    streamerProfileId?: number;
  }) {
    // Validate code format: alphanumeric + underscores
    if (!/^[a-zA-Z0-9_]+$/.test(data.code)) {
      throw new BadRequestException('Emoji code must be alphanumeric with underscores only');
    }

    try {
      const emoji = await this.prisma.chatEmoji.create({ data });
      await this.redis.del(CACHE_KEY);
      return emoji;
    } catch (e: any) {
      if (e?.code === 'P2002') throw new ConflictException('Emoji with this name or code already exists');
      throw e;
    }
  }

  async remove(id: number) {
    const emoji = await this.prisma.chatEmoji.findUnique({ where: { id } });
    if (!emoji) throw new NotFoundException('Emoji not found');
    await this.prisma.chatEmoji.delete({ where: { id } });
    await this.redis.del(CACHE_KEY);
  }

  /**
   * Check if a user can use a specific custom emoji.
   * Returns the emoji if allowed, null if not.
   */
  async canUserUseEmoji(
    emojiCode: string,
    userId: number,
    userRole: string,
  ): Promise<{ allowed: boolean; emoji?: any }> {
    const emoji = await this.prisma.chatEmoji.findUnique({ where: { code: emojiCode } });
    if (!emoji) return { allowed: false };

    // Admins can use any emoji
    if (userRole === 'ADMIN') return { allowed: true, emoji };

    // Global non-premium → anyone
    if (emoji.isGlobal && !emoji.isPremium) return { allowed: true, emoji };

    // Premium emoji → check any active subscription
    if (emoji.isPremium) {
      const sub = await this.prisma.subscription.findFirst({
        where: { userId, status: 'ACTIVE' },
      });
      if (sub) return { allowed: true, emoji };
      return { allowed: false, emoji };
    }

    // Streamer-specific emoji → check subscription to that streamer
    if (emoji.streamerProfileId) {
      const sub = await this.prisma.subscription.findFirst({
        where: {
          userId,
          streamerProfileId: emoji.streamerProfileId,
          status: 'ACTIVE',
        },
      });
      if (sub) return { allowed: true, emoji };
      return { allowed: false, emoji };
    }

    return { allowed: true, emoji };
  }
}
