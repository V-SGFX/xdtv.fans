import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const CACHE_KEY = 'ads:active';
const CACHE_TTL = 300;

@Injectable()
export class AdsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Active slots, keyed for lookup by the page.
   *
   * Returned to everyone, including anonymous visitors — an advert nobody
   * can fetch is an advert nobody sees. Only `isActive` rows are included,
   * so switching a slot off in the panel removes it from the site rather
   * than merely hiding it in CSS, and an empty `code` never ships an empty
   * container that pushes the layout around.
   */
  async activeSlots(): Promise<Record<string, string>> {
    const cached = await this.redis.get(CACHE_KEY);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.adSlot.findMany({
      where: { isActive: true, code: { not: null } },
      select: { key: true, code: true },
    });

    const map: Record<string, string> = {};
    for (const row of rows) {
      const code = (row.code ?? '').trim();
      if (code) map[row.key] = code;
    }

    await this.redis.set(CACHE_KEY, JSON.stringify(map), CACHE_TTL);
    return map;
  }

  /** Wywoływane po zapisie w panelu, żeby zmiana była widoczna od razu. */
  async invalidate() {
    await this.redis.del(CACHE_KEY);
  }
}
