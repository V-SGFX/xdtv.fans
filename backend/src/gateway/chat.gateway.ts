import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { EmojisService } from '../emojis/emojis.service';
import { ChannelsService } from '../channels/channels.service';
import { ChatSeedService } from './chat-seed.service';
import { XpService } from '../engagement/xp.service';
import { StreakService } from '../engagement/streak.service';
import { ShopService } from '../shop/shop.service';

interface AuthSocket extends Socket {
  userId?: number;
  userRole?: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

interface OnlineUser {
  id: number;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: string;
}

function sanitizeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const UNICODE_EMOJIS = ['🔥', '❤️', '😂', '😮', '👍', '👎', '🎉', '💀', '🤔', '💜'];

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // channelId -> Map<userId, OnlineUser>
  private channelUsers = new Map<number, Map<number, OnlineUser>>();
  // socketId -> { userId, channels[] }
  private socketMeta = new Map<string, { userId: number; channels: Set<number> }>();
  // Track first-time joins to emit system greeting: "userId:channelId"
  private sessionJoins = new Set<string>();

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
    private emojisService: EmojisService,
    private channelsService: ChannelsService,
    private chatSeedService: ChatSeedService,
    private xpService: XpService,
    private streakService: StreakService,
    private shopService: ShopService,
  ) {}

  afterInit() {
    this.chatSeedService.setServer(this.server);
  }

  async handleConnection(socket: AuthSocket) {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) {
        socket.disconnect();
        return;
      }
      const payload = this.jwt.verify(token as string);
      socket.userId = payload.userId;
      socket.userRole = payload.role;

      // Fetch user details for online presence
      const user = await this.prisma.user.findUnique({
        where: { id: payload.userId },
        select: { username: true, displayName: true, avatarUrl: true },
      });
      if (user) {
        socket.username = user.username;
        socket.displayName = user.displayName;
        socket.avatarUrl = user.avatarUrl;
      }

      this.socketMeta.set(socket.id, { userId: payload.userId, channels: new Set() });
      this.logger.log(`User ${socket.userId} connected`);

      this.prisma.user.update({
        where: { id: socket.userId },
        data: { lastActiveAt: new Date() },
      }).catch(() => {});
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: AuthSocket) {
    if (socket.userId) {
      const meta = this.socketMeta.get(socket.id);
      if (meta) {
        // Remove user from all channels they were in
        for (const channelId of meta.channels) {
          this.removeUserFromChannel(channelId, socket.userId);
          this.broadcastOnlineUsers(channelId);
        }
        this.socketMeta.delete(socket.id);
      }
      this.logger.log(`User ${socket.userId} disconnected`);
    }
  }

  private addUserToChannel(channelId: number, socket: AuthSocket) {
    if (!this.channelUsers.has(channelId)) {
      this.channelUsers.set(channelId, new Map());
    }
    this.channelUsers.get(channelId)!.set(socket.userId!, {
      id: socket.userId!,
      username: socket.username || 'unknown',
      displayName: socket.displayName || null,
      avatarUrl: socket.avatarUrl || null,
      role: socket.userRole || 'USER',
    });
  }

  private removeUserFromChannel(channelId: number, userId: number) {
    const users = this.channelUsers.get(channelId);
    if (users) {
      users.delete(userId);
      if (users.size === 0) this.channelUsers.delete(channelId);
    }
  }

  private broadcastOnlineUsers(channelId: number) {
    const users = this.channelUsers.get(channelId);
    const onlineList = users ? Array.from(users.values()) : [];
    this.server.to(`channel:${channelId}`).emit('online-users', { channelId, users: onlineList });
  }

  @OnEvent('channel.deleted')
  handleChannelDeleted({ channelId }: { channelId: number }) {
    this.server.to(`channel:${channelId}`).emit('channel-deleted', { channelId });
    // Clean up online users tracking
    this.channelUsers.delete(channelId);
  }

  @SubscribeMessage('join-channel')
  async handleJoinChannel(@ConnectedSocket() socket: AuthSocket, @MessageBody() channelId: number) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || !channel.isActive) return;

    // Check ban
    const isBanned = await this.channelsService.isUserBanned(channelId, socket.userId!);
    if (isBanned) {
      socket.emit('error', { message: 'Jesteś zbanowany na tym kanale' });
      return;
    }

    // Premium channel: require subscription (only for streamer channels)
    if (channel.type === 'PREMIUM' && channel.streamerProfileId) {
      const sub = await this.prisma.subscription.findFirst({
        where: {
          userId: socket.userId,
          streamerProfileId: channel.streamerProfileId,
          status: 'ACTIVE',
        },
      });
      if (!sub && socket.userRole !== 'ADMIN') {
        socket.emit('error', { message: 'Premium channel requires subscription' });
        return;
      }
    }

    socket.join(`channel:${channelId}`);
    this.addUserToChannel(channelId, socket);

    const meta = this.socketMeta.get(socket.id);
    if (meta) meta.channels.add(channelId);

    socket.emit('joined-channel', { channelId });
    this.broadcastOnlineUsers(channelId);

    // System join message for users who have never sent a message in this channel
    const joinKey = `${socket.userId}:${channelId}`;
    if (!this.sessionJoins.has(joinKey)) {
      this.sessionJoins.add(joinKey);
      const msgCount = await this.prisma.message.count({
        where: { channelId, authorId: socket.userId!, isDeleted: false },
        take: 1,
      });
      if (msgCount === 0) {
        const name = socket.displayName || socket.username || 'Ktoś';
        this.server.to(`channel:${channelId}`).emit('system_message', {
          type: 'join',
          body: `${name} właśnie dołączył/a. Przywitajcie się 👀`,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  @SubscribeMessage('leave-channel')
  handleLeaveChannel(@ConnectedSocket() socket: AuthSocket, @MessageBody() channelId: number) {
    socket.leave(`channel:${channelId}`);
    this.removeUserFromChannel(channelId, socket.userId!);

    const meta = this.socketMeta.get(socket.id);
    if (meta) meta.channels.delete(channelId);

    this.broadcastOnlineUsers(channelId);
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: any) {
    if (!data.content?.trim() || !data.channelId) return;

    // Centralized permission check
    const perm = await this.channelsService.canSendMessage(socket.userId!, socket.userRole || 'USER', data.channelId);
    if (!perm.allowed) {
      socket.emit('error', { message: perm.reason || 'Brak uprawnień' });
      return;
    }

    const message = await this.prisma.message.create({
      data: {
        channelId: data.channelId,
        authorId: socket.userId!,
        content: sanitizeHtml(data.content.slice(0, 2000)),
      },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
        reactions: { include: { user: { select: { id: true, username: true } } } },
      },
    });

    this.server.to(`channel:${data.channelId}`).emit('new-message', {
      ...message,
      reactions: [],
    });

    // Attach cosmetics asynchronously for subsequent renders
    this.shopService.getActiveCosmetics(socket.userId!).then((cosmetics) => {
      if (cosmetics.length > 0) {
        this.server.to(`channel:${data.channelId}`).emit('message-cosmetics', {
          messageId: message.id,
          userId: socket.userId,
          cosmetics: cosmetics.map((c) => ({ type: c.type, value: c.value })),
        });
      }
    }).catch(() => {});

    // Record activity for seed service (suppresses pulse messages)

    // Award XP + track streak/challenges (fire & forget)
    this.xpService.awardXp(socket.userId!, 'CHAT_MESSAGE', undefined, { channelId: data.channelId }).then((result) => {
      if (result.newBadges.length > 0) {
        socket.emit('badges-earned', { badges: result.newBadges });
        const name = socket.displayName || socket.username || 'Ktoś';
        for (const badge of result.newBadges) {
          this.server.to(`channel:${data.channelId}`).emit('system_message', {
            type: 'badge',
            body: `🏅 ${name} zdobył badge: ${badge}!`,
            createdAt: new Date().toISOString(),
          });
        }
      }
      socket.emit('xp-update', { xpAwarded: result.xpAwarded, totalXp: result.totalXp });
    }).catch(() => {});
    this.streakService.recordDailyActivity(socket.userId!).catch(() => {});
    this.streakService.completeChallenge(socket.userId!, 'CHAT_MESSAGE').catch(() => {});
  }

  @SubscribeMessage('delete-message')
  async handleDeleteMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: any) {
    const msg = await this.prisma.message.findUnique({ where: { id: data.messageId } });
    if (!msg) return;

    // Own message — always can delete. Otherwise check moderation rights.
    if (msg.authorId !== socket.userId) {
      const canMod = await this.channelsService.canUserModerate(msg.channelId, socket.userId!, socket.userRole || 'USER');
      if (!canMod) return;
    }

    await this.prisma.message.update({
      where: { id: data.messageId },
      data: { isDeleted: true },
    });

    this.server.to(`channel:${msg.channelId}`).emit('message-deleted', { messageId: data.messageId });
  }

  @SubscribeMessage('typing')
  handleTyping(@ConnectedSocket() socket: AuthSocket, @MessageBody() channelId: number) {
    socket.to(`channel:${channelId}`).emit('user-typing', {
      userId: socket.userId,
      username: socket.displayName || socket.username,
      channelId,
    });
  }

  @SubscribeMessage('react-message')
  async handleReactMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: { messageId: number; emoji: string }) {
    if (!data.messageId || !data.emoji) return;

    const emoji = data.emoji;
    const isCustom = emoji.startsWith(':') && emoji.endsWith(':') && emoji.length > 2;

    // Validate emoji
    if (isCustom) {
      const code = emoji.slice(1, -1);
      const result = await this.emojisService.canUserUseEmoji(code, socket.userId!, socket.userRole!);
      if (!result.allowed) {
        socket.emit('error', {
          message: result.emoji ? 'Potrzebujesz subskrypcji, żeby użyć tego emoji' : 'Nieznany emoji',
        });
        return;
      }
    } else if (!UNICODE_EMOJIS.includes(emoji)) {
      return;
    }

    const msg = await this.prisma.message.findUnique({ where: { id: data.messageId } });
    if (!msg || msg.isDeleted) return;

    // Toggle: if already reacted, remove; else add
    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: data.messageId, userId: socket.userId!, emoji } },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId: data.messageId, userId: socket.userId!, emoji },
      });
    }

    // Fetch updated reactions for this message
    const reactions = await this.getMessageReactions(data.messageId);
    this.server.to(`channel:${msg.channelId}`).emit('message-reactions-updated', {
      messageId: data.messageId,
      reactions,
    });

    // Award XP for adding a reaction (not removing)
    if (!existing) {
      this.xpService.awardXp(socket.userId!, 'CHAT_REACTION').catch(() => {});
      this.streakService.completeChallenge(socket.userId!, 'CHAT_REACTION').catch(() => {});
    }
  }

  @SubscribeMessage('pin-message')
  async handlePinMessage(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: { messageId: number }) {
    if (!['ADMIN', 'MODERATOR', 'STREAMER'].includes(socket.userRole!)) return;

    const msg = await this.prisma.message.findUnique({ where: { id: data.messageId } });
    if (!msg || msg.isDeleted) return;

    await this.prisma.message.update({
      where: { id: data.messageId },
      data: { isPinned: !msg.isPinned },
    });

    const updated = await this.prisma.message.findUnique({
      where: { id: data.messageId },
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
      },
    });

    this.server.to(`channel:${msg.channelId}`).emit('message-pinned', {
      message: updated,
      pinned: !msg.isPinned,
    });
  }

  @SubscribeMessage('get-pinned-messages')
  async handleGetPinnedMessages(@ConnectedSocket() socket: AuthSocket, @MessageBody() channelId: number) {
    const pinned = await this.prisma.message.findMany({
      where: { channelId, isPinned: true, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        author: { select: { id: true, username: true, displayName: true, avatarUrl: true, role: true } },
      },
    });
    socket.emit('pinned-messages', { channelId, messages: pinned });
  }

  @SubscribeMessage('mute-user')
  async handleMuteUser(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { userId: number; channelId: number; durationMinutes?: number },
  ) {
    try {
      await this.channelsService.muteUser(
        data.channelId,
        data.userId,
        socket.userId!,
        socket.userRole!,
        data.durationMinutes,
      );
      this.server.to(`channel:${data.channelId}`).emit('user-muted', {
        userId: data.userId,
        channelId: data.channelId,
        durationMinutes: data.durationMinutes,
      });
    } catch (err: any) {
      socket.emit('error', { message: err.message || 'Nie udało się wyciszyć użytkownika' });
    }
  }

  @SubscribeMessage('ban-user')
  async handleBanUser(
    @ConnectedSocket() socket: AuthSocket,
    @MessageBody() data: { userId: number; channelId: number; reason?: string },
  ) {
    try {
      await this.channelsService.banUser(
        data.channelId,
        data.userId,
        socket.userId!,
        socket.userRole!,
        data.reason,
      );
      this.server.to(`channel:${data.channelId}`).emit('user-banned', {
        userId: data.userId,
        channelId: data.channelId,
      });
    } catch (err: any) {
      socket.emit('error', { message: err.message || 'Nie udało się zbanować użytkownika' });
    }
  }

  private async getMessageReactions(messageId: number) {
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: {
        emoji: true,
        userId: true,
        user: { select: { id: true, username: true, displayName: true } },
      },
    });

    // Group by emoji
    const grouped: Record<string, {
      emoji: string;
      count: number;
      userIds: number[];
      users: { id: number; username: string; displayName: string | null }[];
    }> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, userIds: [], users: [] };
      grouped[r.emoji].count++;
      grouped[r.emoji].userIds.push(r.userId);
      grouped[r.emoji].users.push(r.user);
    }
    return Object.values(grouped);
  }
}
