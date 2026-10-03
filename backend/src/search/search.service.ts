import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(query: string, limit: number = 10) {
    if (!query || query.trim().length < 2) return { streamers: [], posts: [], users: [], news: [], clips: [] };

    const q = query.trim();

    const [streamers, posts, users, news, clips] = await Promise.all([
      this.prisma.streamerProfile.findMany({
        where: { OR: [{ name: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }] },
        select: { id: true, slug: true, name: true, avatarUrl: true, isLive: true, followerCount: true },
        take: limit,
        orderBy: { followerCount: 'desc' },
      }),
      this.prisma.post.findMany({
        where: {
          isDeleted: false,
          type: { not: 'CLIP' },
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }],
        },
        select: {
          id: true, title: true, content: true, type: true, createdAt: true, upvotes: true, downvotes: true, commentCount: true,
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: {
          isActive: true,
          OR: [{ username: { contains: q, mode: 'insensitive' } }, { displayName: { contains: q, mode: 'insensitive' } }],
        },
        select: { id: true, username: true, displayName: true, avatarUrl: true, role: true },
        take: limit,
      }),
      this.prisma.news.findMany({
        where: {
          isPublished: true,
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { summary: { contains: q, mode: 'insensitive' } }],
        },
        select: { id: true, title: true, summary: true, imageUrl: true, publishedAt: true, sourceUrl: true, sourceName: true },
        take: limit,
        orderBy: { publishedAt: 'desc' },
      }),
      // Clips are posts with type=CLIP
      this.prisma.post.findMany({
        where: {
          isDeleted: false,
          type: 'CLIP',
          OR: [{ title: { contains: q, mode: 'insensitive' } }, { content: { contains: q, mode: 'insensitive' } }],
        },
        select: {
          id: true, title: true, thumbnailUrl: true, viewCount: true, duration: true, clipSource: true, createdAt: true,
          author: { select: { id: true, username: true, displayName: true } },
          streamerProfile: { select: { id: true, slug: true, name: true } },
        },
        take: limit,
        orderBy: { viewCount: 'desc' },
      }),
    ]);

    return { streamers, posts, users, news, clips };
  }
}
