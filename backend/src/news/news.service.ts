import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NewsService {
  constructor(private prisma: PrismaService, private redis: RedisService) {}

  /**
   * @param category  DRAMA | STREAMERS | EVENTS | GAMING
   * @param lang      'pl' (default) or 'en'. Articles store both; this picks
   *                  which pair the client receives so a card does not have to
   *                  know the column layout.
   */
  async findAll(
    page: number,
    limit: number,
    streamerId?: number,
    category?: string,
    lang = 'pl',
  ) {
    const cat = ['DRAMA', 'STREAMERS', 'EVENTS', 'GAMING'].includes((category || '').toUpperCase())
      ? (category as string).toUpperCase()
      : undefined;

    const cacheKey = `news:list:${page}:${limit}:${streamerId || ''}:${cat || ''}:${lang}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const skip = (page - 1) * limit;
    const where: any = {
      isPublished: true,
      ...(streamerId && { streamerProfileId: streamerId }),
      ...(cat && { category: cat }),
    };

    const [news, total] = await Promise.all([
      this.prisma.news.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: 'desc' },
        include: {
          streamerProfile: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.news.count({ where }),
    ]);

    // Serve the requested language, falling back to the other when a field is
    // missing — the 1,466 rows scraped before bilingual storage have no
    // English copy, and an empty headline is worse than a Polish one.
    const data = news.map((n) => ({
      ...n,
      title: lang === 'en' ? n.titleEn || n.title : n.title,
      summary: lang === 'en' ? n.summaryEn || n.summary : n.summary,
    }));

    const result = { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
    await this.redis.set(cacheKey, JSON.stringify(result), 180);
    return result;
  }

  /** Per-category article counts, cached — one query rather than four. */
  async getCategoryCounts() {
    const cacheKey = 'news:category-counts';
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const rows = await this.prisma.news.groupBy({
      by: ['category'],
      where: { isPublished: true },
      _count: { _all: true },
    });

    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.category] = r._count._all;

    const result = { counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
    await this.redis.set(cacheKey, JSON.stringify(result), 300);
    return result;
  }

  async findOne(id: number) {
    const article = await this.prisma.news.findFirst({
      where: { id, isPublished: true },
      include: {
        streamerProfile: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!article) throw new NotFoundException('Article not found');
    return article;
  }

  async create(data: any) {
    if (!data.title || !data.sourceUrl) {
      throw new BadRequestException('Title and sourceUrl are required');
    }
    return this.prisma.news.create({
      data: {
        title: data.title,
        summary: data.summary,
        content: data.content,
        sourceUrl: data.sourceUrl,
        source: data.source || 'MANUAL',
        sourceName: data.sourceName,
        imageUrl: data.imageUrl,
        publishedAt: new Date(),
        streamerProfileId: data.streamerProfileId,
      },
    });
  }
}
