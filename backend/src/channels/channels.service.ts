import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ChannelsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ── Global channels ─────────────────────────────────────

  async findGlobal() {
    return this.prisma.channel.findMany({
      where: { scope: 'GLOBAL', isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { messages: true } } },
    });
  }

  // ── Streamer channels ───────────────────────────────────

  async findByStreamer(streamerId: number) {
    return this.prisma.channel.findMany({
      where: { scope: 'STREAMER', streamerProfileId: streamerId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { _count: { select: { messages: true } } },
    });
  }

  // ── All channels for sidebar (global + followed streamers) ──

  async findAll(scope?: string, streamerId?: number) {
    const where: any = { isActive: true };
    if (scope === 'GLOBAL') where.scope = 'GLOBAL';
    else if (scope === 'STREAMER') {
      where.scope = 'STREAMER';
      if (streamerId) where.streamerProfileId = streamerId;
    }
    return this.prisma.channel.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        streamerProfile: {
          select: {
            id: true, slug: true, name: true, isLive: true,
            isClaimed: true, chatEnabled: true, userId: true,
          },
        },
        _count: { select: { messages: true } },
      },
    });
  }

  async findOne(id: number) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      include: {
        streamerProfile: { select: { id: true, slug: true, name: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async findBySlug(slug: string) {
    // For global channels: just match slug
    // For streamer channels: slug format is "streamer-slug/channel-slug"
    const channel = await this.prisma.channel.findFirst({
      where: { slug, scope: 'GLOBAL', isActive: true },
      include: {
        streamerProfile: { select: { id: true, slug: true, name: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async findStreamerChannelBySlug(streamerSlug: string, channelSlug: string) {
    const channel = await this.prisma.channel.findFirst({
      where: {
        slug: channelSlug,
        scope: 'STREAMER',
        isActive: true,
        streamerProfile: { slug: streamerSlug },
      },
      include: {
        streamerProfile: { select: { id: true, slug: true, name: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  // ── Create ──────────────────────────────────────────────

  async createGlobal(userId: number, userRole: string, data: any) {
    if (userRole !== 'ADMIN') throw new ForbiddenException('Only admins can create global channels');
    if (!data.name || !data.slug) throw new BadRequestException('name and slug are required');

    return this.prisma.channel.create({
      data: {
        scope: 'GLOBAL',
        name: data.name,
        slug: data.slug,
        description: data.description,
        type: data.type || 'PUBLIC',
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async createStreamer(userId: number, userRole: string, data: any) {
    if (!data.name || !data.slug || !data.streamerProfileId) {
      throw new BadRequestException('name, slug, and streamerProfileId are required');
    }
    const profile = await this.prisma.streamerProfile.findUnique({ where: { id: data.streamerProfileId } });
    if (!profile) throw new NotFoundException('Streamer not found');
    if (profile.userId !== userId && userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
      throw new ForbiddenException();
    }
    return this.prisma.channel.create({
      data: {
        scope: 'STREAMER',
        name: data.name,
        slug: data.slug,
        description: data.description,
        type: data.type || 'PUBLIC',
        streamerProfileId: data.streamerProfileId,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async remove(id: number, userId: number, userRole: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      include: { streamerProfile: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');

    if (channel.scope === 'GLOBAL') {
      if (userRole !== 'ADMIN') throw new ForbiddenException();
    } else {
      if (channel.streamerProfile?.userId !== userId && userRole !== 'ADMIN') {
        throw new ForbiddenException();
      }
    }
    // Notify connected users before deactivating
    this.eventEmitter.emit('channel.deleted', { channelId: id });
    await this.prisma.channel.update({ where: { id }, data: { isActive: false } });
  }

  // ── Permission check helper ─────────────────────────────

  private async assertCanModerate(channelId: number, userId: number, userRole: string) {
    if (userRole === 'ADMIN' || userRole === 'MODERATOR') return;
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: { streamerProfile: { select: { userId: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    // Global channels: only admin/mod (already handled above)
    if (channel.scope === 'GLOBAL') {
      throw new ForbiddenException('Only admin or moderator can moderate global channels');
    }
    // Streamer channels: streamer owner can moderate
    if (channel.streamerProfile?.userId !== userId) {
      throw new ForbiddenException('Only streamer, moderator, or admin can perform this action');
    }
  }

  // ── Mute ────────────────────────────────────────────────

  async muteUser(channelId: number, targetUserId: number, actorId: number, actorRole: string, durationMinutes?: number) {
    await this.assertCanModerate(channelId, actorId, actorRole);

    const expiresAt = durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null;

    return this.prisma.channelMute.upsert({
      where: { channelId_userId: { channelId, userId: targetUserId } },
      update: { expiresAt, mutedById: actorId },
      create: { channelId, userId: targetUserId, mutedById: actorId, expiresAt },
    });
  }

  async unmuteUser(channelId: number, targetUserId: number, actorId: number, actorRole: string) {
    await this.assertCanModerate(channelId, actorId, actorRole);
    await this.prisma.channelMute.deleteMany({
      where: { channelId, userId: targetUserId },
    });
  }

  async isUserMuted(channelId: number, userId: number): Promise<boolean> {
    const mute = await this.prisma.channelMute.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    if (!mute) return false;
    if (mute.expiresAt && mute.expiresAt < new Date()) {
      await this.prisma.channelMute.delete({ where: { id: mute.id } });
      return false;
    }
    return true;
  }

  // ── Ban ─────────────────────────────────────────────────

  async banUser(channelId: number, targetUserId: number, actorId: number, actorRole: string, reason?: string) {
    await this.assertCanModerate(channelId, actorId, actorRole);

    return this.prisma.channelBan.upsert({
      where: { channelId_userId: { channelId, userId: targetUserId } },
      update: { bannedById: actorId, reason },
      create: { channelId, userId: targetUserId, bannedById: actorId, reason },
    });
  }

  async unbanUser(channelId: number, targetUserId: number, actorId: number, actorRole: string) {
    await this.assertCanModerate(channelId, actorId, actorRole);
    await this.prisma.channelBan.deleteMany({
      where: { channelId, userId: targetUserId },
    });
  }

  async isUserBanned(channelId: number, userId: number): Promise<boolean> {
    const ban = await this.prisma.channelBan.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    return !!ban;
  }

  // ── Lists for moderation panel ──────────────────────────

  async getMutes(channelId: number, actorId: number, actorRole: string) {
    await this.assertCanModerate(channelId, actorId, actorRole);
    return this.prisma.channelMute.findMany({
      where: { channelId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        mutedBy: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBans(channelId: number, actorId: number, actorRole: string) {
    await this.assertCanModerate(channelId, actorId, actorRole);
    return this.prisma.channelBan.findMany({
      where: { channelId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        bannedBy: { select: { id: true, username: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Centralized permission check ────────────────────────

  /**
   * Returns { allowed, reason } for a user attempting to send a message in a channel.
   * Checks: banned, muted, channel type, ownership, channel-level mod role.
   */
  async canSendMessage(
    userId: number,
    userRole: string,
    channelId: number,
  ): Promise<{ allowed: boolean; reason?: string }> {
    if (userRole === 'ADMIN') return { allowed: true };

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: {
        id: true, scope: true, type: true, isActive: true,
        streamerProfileId: true,
        streamerProfile: { select: { userId: true } },
      },
    });

    if (!channel || !channel.isActive) {
      return { allowed: false, reason: 'Kanał nie istnieje lub jest nieaktywny' };
    }

    // Banned check
    const isBanned = await this.isUserBanned(channelId, userId);
    if (isBanned) return { allowed: false, reason: 'Jesteś zbanowany na tym kanale' };

    // Muted check
    const isMuted = await this.isUserMuted(channelId, userId);
    if (isMuted) return { allowed: false, reason: 'Jesteś wyciszony na tym kanale' };

    // Global channels — all non-banned users can write to PUBLIC
    if (channel.scope === 'GLOBAL') {
      if (channel.type === 'PUBLIC') return { allowed: true };
      // PRIVATE global channels — only ADMIN/MODERATOR
      if (['MODERATOR'].includes(userRole)) return { allowed: true };
      return { allowed: false, reason: 'Nie masz uprawnień do pisania na tym kanale' };
    }

    // Streamer channels
    if (channel.scope === 'STREAMER' && channel.streamerProfileId) {
      // Streamer owner — always allowed
      if (channel.streamerProfile?.userId === userId) return { allowed: true };

      // Global moderator — allowed
      if (userRole === 'MODERATOR') return { allowed: true };

      // Channel-level moderator — allowed
      const isChannelMod = await this.isChannelModerator(channelId, userId);
      if (isChannelMod) return { allowed: true };

      // PUBLIC streamer channels — all users can write
      if (channel.type === 'PUBLIC') return { allowed: true };

      // PRIVATE — only owner/mods (handled above)
      if (channel.type === 'PRIVATE') {
        return { allowed: false, reason: 'Nie masz uprawnień do pisania na tym kanale' };
      }

      // PREMIUM — requires subscription
      if (channel.type === 'PREMIUM') {
        const sub = await this.prisma.subscription.findFirst({
          where: {
            userId,
            streamerProfileId: channel.streamerProfileId,
            status: 'ACTIVE',
          },
        });
        if (!sub) return { allowed: false, reason: 'Kanał premium wymaga subskrypcji' };
        return { allowed: true };
      }
    }

    return { allowed: false, reason: 'Brak uprawnień' };
  }

  /**
   * Check if user can moderate a specific channel.
   */
  async canUserModerate(channelId: number, userId: number, userRole: string): Promise<boolean> {
    if (userRole === 'ADMIN' || userRole === 'MODERATOR') return true;

    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { scope: true, streamerProfile: { select: { userId: true } } },
    });
    if (!channel) return false;

    // Streamer owner
    if (channel.scope === 'STREAMER' && channel.streamerProfile?.userId === userId) return true;

    // Channel-level moderator
    return this.isChannelModerator(channelId, userId);
  }

  // ── Channel moderators management ──────────────────────

  async isChannelModerator(channelId: number, userId: number): Promise<boolean> {
    const mod = await this.prisma.channelModerator.findUnique({
      where: { channelId_userId: { channelId, userId } },
    });
    return !!mod;
  }

  async addChannelModerator(channelId: number, targetUserId: number, actorId: number, actorRole: string) {
    await this.assertCanModerate(channelId, actorId, actorRole);
    return this.prisma.channelModerator.upsert({
      where: { channelId_userId: { channelId, userId: targetUserId } },
      update: {},
      create: { channelId, userId: targetUserId },
    });
  }

  async removeChannelModerator(channelId: number, targetUserId: number, actorId: number, actorRole: string) {
    await this.assertCanModerate(channelId, actorId, actorRole);
    await this.prisma.channelModerator.deleteMany({
      where: { channelId, userId: targetUserId },
    });
  }

  async getChannelModerators(channelId: number) {
    return this.prisma.channelModerator.findMany({
      where: { channelId },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });
  }
}
