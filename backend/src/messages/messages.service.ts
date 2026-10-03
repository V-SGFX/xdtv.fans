import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async findByChannel(channelId: number, before?: number, limit = 50) {
    const messages = await this.prisma.message.findMany({
      where: {
        channelId,
        isDeleted: false,
        ...(before && { id: { lt: before } }),
      },
      take: limit,
      orderBy: { id: 'desc' },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
        reactions: {
          select: {
            emoji: true,
            userId: true,
            user: { select: { id: true, username: true, displayName: true } },
          },
        },
      },
    });

    // Group reactions by emoji for each message
    return messages.reverse().map((msg) => {
      const grouped: Record<string, {
        emoji: string;
        count: number;
        userIds: number[];
        users: { id: number; username: string; displayName: string | null }[];
      }> = {};
      for (const r of msg.reactions) {
        if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], users: [] };
        grouped[r.emoji].count++;
        grouped[r.emoji].userIds.push(r.userId);
        grouped[r.emoji].users.push(r.user);
      }
      return { ...msg, reactions: Object.values(grouped) };
    });
  }

  async create(userId: number, channelId: number, content: string) {
    if (!channelId || !content) {
      throw new BadRequestException('channelId and content are required');
    }
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.isActive) {
      throw new NotFoundException('Channel not found');
    }
    return this.prisma.message.create({
      data: {
        channelId,
        content: content.slice(0, 2000),
        authorId: userId,
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
      },
    });
  }

  async remove(id: number, userId: number, userRole: string) {
    const msg = await this.prisma.message.findUnique({ where: { id } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.authorId !== userId && !['ADMIN', 'MODERATOR'].includes(userRole)) {
      throw new ForbiddenException();
    }
    await this.prisma.message.update({ where: { id }, data: { isDeleted: true } });
  }
}
