import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class TagsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /** Valid TagType values, used to reject junk before it reaches Prisma. */
  private static readonly TAG_TYPES = ['GAME', 'CATEGORY', 'LANGUAGE', 'FORMAT', 'TOPIC'] as const;

  private normaliseType(type?: string): string | undefined {
    if (!type) return undefined;
    const upper = type.toUpperCase();
    return (TagsService.TAG_TYPES as readonly string[]).includes(upper) ? upper : undefined;
  }

  async findAll(type?: string) {
    const kind = this.normaliseType(type);
    const cacheKey = `tags:all:${kind ?? ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const tags = await this.prisma.tag.findMany({
      ...(kind && { where: { type: kind as any } }),
      orderBy: { postCount: 'desc' },
    });
    await this.redis.set(cacheKey, JSON.stringify(tags), 300);
    return tags;
  }

  async findPopular(limit = 20, type?: string) {
    const kind = this.normaliseType(type);
    const cacheKey = `tags:popular:${limit}:${kind ?? ''}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const tags = await this.prisma.tag.findMany({
      where: { postCount: { gt: 0 }, ...(kind && { type: kind as any }) },
      orderBy: { postCount: 'desc' },
      take: limit,
    });
    await this.redis.set(cacheKey, JSON.stringify(tags), 120);
    return tags;
  }

  async findBySlug(slug: string) {
    const tag = await this.prisma.tag.findUnique({ where: { slug } });
    if (!tag) throw new NotFoundException('Tag not found');
    return tag;
  }

  async create(name: string, color?: string) {
    const slug = this.toSlug(name);
    if (!slug) throw new BadRequestException('Invalid tag name');

    const existing = await this.prisma.tag.findUnique({ where: { slug } });
    if (existing) throw new ConflictException('Tag already exists');

    const tag = await this.prisma.tag.create({
      data: { name: name.toLowerCase().trim(), slug, color },
    });
    await this.redis.delPattern('tags:*');
    return tag;
  }

  async findOrCreateMany(names: string[]): Promise<number[]> {
    const slugs = [...new Set(names.map((n) => this.toSlug(n)).filter(Boolean))];
    if (slugs.length === 0) return [];

    const existing = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
    });
    const existingSlugs = new Set(existing.map((t) => t.slug));

    const toCreate = slugs.filter((s) => !existingSlugs.has(s));
    if (toCreate.length > 0) {
      await this.prisma.tag.createMany({
        data: toCreate.map((slug) => ({
          name: slug,
          slug,
        })),
        skipDuplicates: true,
      });
    }

    const allTags = await this.prisma.tag.findMany({
      where: { slug: { in: slugs } },
      select: { id: true },
    });
    return allTags.map((t) => t.id);
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9ąćęłńóśźżА-Яа-я\s-]/gi, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}
