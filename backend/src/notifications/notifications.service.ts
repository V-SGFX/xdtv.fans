import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findForUser(userId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { userId };
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          actor: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);
    return {
      data: notifications,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
      unreadCount,
    };
  }

  async getUnreadCount(userId: number) {
    const count = await this.prisma.notification.count({ where: { userId, isRead: false } });
    return { count };
  }

  async markAsRead(userId: number, id: number) {
    await this.prisma.notification.updateMany({
      where: { id, userId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: number) {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  async create(data: {
    userId: number;
    actorId?: number | null;
    type: string;
    postId?: number;
    commentId?: number;
    message: string;
  }) {
    // Don't notify yourself
    if (data.actorId && data.userId === data.actorId) return null;

    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        actorId: data.actorId ?? null,
        type: data.type as any,
        postId: data.postId,
        commentId: data.commentId,
        message: data.message,
      },
    });
  }
}
