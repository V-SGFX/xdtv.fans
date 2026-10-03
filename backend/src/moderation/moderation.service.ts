import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ModerationService {
  constructor(private prisma: PrismaService) {}

  // ─── USERS ────────────────────────────────────────────

  async getUsers(page: number, limit: number, search?: string, role?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, username: true, displayName: true,
          avatarUrl: true, role: true, isActive: true, lastActiveAt: true, createdAt: true,
          _count: { select: { posts: true, comments: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data: users, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async changeRole(userId: number, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new BadRequestException('Cannot change admin role');
    return this.prisma.user.update({
      where: { id: userId },
      data: { role: role as any },
      select: { id: true, username: true, role: true, isActive: true },
    });
  }

  async toggleBan(userId: number) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') throw new BadRequestException('Cannot ban admin');
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, role: true, isActive: true },
    });
  }

  // ─── POSTS ────────────────────────────────────────────

  async getPosts(page: number, limit: number, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, username: true, displayName: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);
    return { data: posts, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async togglePin(postId: number) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.post.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
      select: { id: true, title: true, isPinned: true },
    });
  }

  async deletePost(postId: number) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.post.update({
      where: { id: postId },
      data: { isDeleted: true },
      select: { id: true, title: true, isDeleted: true },
    });
  }

  // ─── NSFW MODERATION ──────────────────────────────────

  async getFlaggedPosts(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { isFlagged: true, isDeleted: false };

    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, username: true, displayName: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);
    return { data: posts, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async moderateNsfw(postId: number, action: 'approve' | 'remove' | 'mark-safe') {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');

    switch (action) {
      case 'approve':
        // Approve as NSFW — keep isNsfw, clear flag
        return this.prisma.post.update({
          where: { id: postId },
          data: { isNsfw: true, isFlagged: false },
          select: { id: true, title: true, isNsfw: true, isFlagged: true },
        });
      case 'mark-safe':
        // Mark as safe — not NSFW, clear flag
        return this.prisma.post.update({
          where: { id: postId },
          data: { isNsfw: false, isFlagged: false },
          select: { id: true, title: true, isNsfw: true, isFlagged: true },
        });
      case 'remove':
        // Remove the post entirely
        return this.prisma.post.update({
          where: { id: postId },
          data: { isDeleted: true, isFlagged: false },
          select: { id: true, title: true, isDeleted: true },
        });
      default:
        throw new BadRequestException('Invalid action');
    }
  }

  async deleteComment(commentId: number) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    await this.prisma.$transaction([
      this.prisma.comment.update({
        where: { id: commentId },
        data: { isDeleted: true },
      }),
      ...(comment.postId
        ? [this.prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } })]
        : []),
      ...(comment.newsId
        ? [this.prisma.news.update({ where: { id: comment.newsId }, data: { commentCount: { decrement: 1 } } })]
        : []),
    ]);
    return { id: commentId, isDeleted: true };
  }

  // ─── REPORTS ──────────────────────────────────────────

  async getReports(page: number, limit: number, status?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, username: true, displayName: true } },
          resolvedBy: { select: { id: true, username: true } },
        },
      }),
      this.prisma.report.count({ where }),
    ]);

    // Enrich with target data
    const enriched = await Promise.all(
      reports.map(async (r) => {
        let target: any = null;
        if (r.targetType === 'POST') {
          target = await this.prisma.post.findUnique({
            where: { id: r.targetId },
            select: { id: true, title: true, content: true, isDeleted: true, author: { select: { id: true, username: true } } },
          });
        } else if (r.targetType === 'COMMENT') {
          target = await this.prisma.comment.findUnique({
            where: { id: r.targetId },
            select: { id: true, content: true, isDeleted: true, postId: true, author: { select: { id: true, username: true } } },
          });
        } else if (r.targetType === 'USER') {
          target = await this.prisma.user.findUnique({
            where: { id: r.targetId },
            select: { id: true, username: true, displayName: true, isActive: true, role: true },
          });
        }
        return { ...r, target };
      }),
    );

    return { data: enriched, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async resolveReport(reportId: number, adminId: number, data: { status: string; adminNote?: string }) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    return this.prisma.report.update({
      where: { id: reportId },
      data: {
        status: data.status as any,
        adminNote: data.adminNote || null,
        resolvedById: adminId,
      },
    });
  }

  async createReport(reporterId: number, data: { targetType: string; targetId: number; reason: string }) {
    // Check for duplicate
    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId,
        targetType: data.targetType as any,
        targetId: data.targetId,
        status: 'PENDING',
      },
    });
    if (existing) throw new BadRequestException('You already reported this');

    return this.prisma.report.create({
      data: {
        reporterId,
        targetType: data.targetType as any,
        targetId: data.targetId,
        reason: data.reason,
      },
    });
  }

  async getReportCounts() {
    const [pending, resolved, dismissed, total] = await Promise.all([
      this.prisma.report.count({ where: { status: 'PENDING' } }),
      this.prisma.report.count({ where: { status: 'RESOLVED' } }),
      this.prisma.report.count({ where: { status: 'DISMISSED' } }),
      this.prisma.report.count(),
    ]);
    return { pending, resolved, dismissed, total };
  }
}
