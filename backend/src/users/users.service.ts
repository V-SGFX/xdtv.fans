import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, username: true, displayName: true,
          avatarUrl: true, role: true, isActive: true, lastActiveAt: true, createdAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);
    return { data: users, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        role: true, createdAt: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByUsername(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        role: true, createdAt: true,
        _count: { select: { posts: true, comments: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPostsByUsername(username: string, page: number, limit: number) {
    const user = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found');
    const skip = (page - 1) * limit;
    const where = { authorId: user.id, isDeleted: false };
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          streamerProfile: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);
    return { data: posts, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, username: true, displayName: true, avatarUrl: true,
        role: true, createdAt: true,
        _count: { select: { posts: true, comments: true, follows: true, votes: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getMyPosts(userId: number, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const where = { authorId: userId, isDeleted: false };
    const [posts, total] = await Promise.all([
      this.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          streamerProfile: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.post.count({ where }),
    ]);
    return { data: posts, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async updateMe(userId: number, data: { displayName?: string; avatarUrl?: string; currentPassword?: string; newPassword?: string }) {
    const updateData: Record<string, unknown> = {};

    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.avatarUrl !== undefined) updateData.avatarUrl = data.avatarUrl;

    if (data.newPassword) {
      if (!data.currentPassword) throw new BadRequestException('Current password is required');
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException();
      if (!user.passwordHash) throw new BadRequestException('Password login not available for this account');
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) throw new BadRequestException('Current password is incorrect');
      updateData.passwordHash = await bcrypt.hash(data.newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) throw new BadRequestException('Nothing to update');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, email: true, username: true, displayName: true,
        avatarUrl: true, role: true, createdAt: true,
      },
    });
    return updated;
  }

  async update(id: number, requesterId: number, requesterRole: string, data: any) {
    if (requesterId !== id && requesterRole !== 'ADMIN') {
      throw new ForbiddenException();
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
      select: {
        id: true, username: true, displayName: true, avatarUrl: true,
        role: true, createdAt: true,
      },
    });
  }
}
