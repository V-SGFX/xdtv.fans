import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ModeratorStatus } from '@prisma/client';

/**
 * Community-scoped moderation.
 *
 * The appointment is deliberately two-step: a community owner nominates,
 * an administrator approves. Letting owners appoint directly would make
 * moderation powers self-propagating — anyone who could create a community
 * could mint moderators for it, and the only backstop would be noticing
 * afterwards.
 *
 * Every state change lands in AdminActionLog. Nadanie uprawnień bez śladu,
 * kto je nadał, jest nie do odtworzenia dokładnie wtedy, gdy trzeba je
 * odtworzyć.
 */
@Injectable()
export class CommunityModerationService {
  constructor(private prisma: PrismaService) {}

  /**
   * The single authorisation primitive. Everything that lets someone act on
   * another person's content in a community goes through here.
   *
   * A global ADMIN or MODERATOR keeps site-wide reach; a community
   * moderator reaches exactly one community, and only while ACTIVE.
   */
  async canModerate(userId: number, communityId: number, globalRole?: string): Promise<boolean> {
    if (globalRole === 'ADMIN' || globalRole === 'MODERATOR') return true;

    const row = await this.prisma.communityModerator.findUnique({
      where: { communityId_userId: { communityId, userId } },
      select: { status: true },
    });
    return row?.status === ModeratorStatus.ACTIVE;
  }

  /** Communities where this user is an approved moderator. */
  async myCommunities(userId: number) {
    return this.prisma.communityModerator.findMany({
      where: { userId, status: ModeratorStatus.ACTIVE },
      select: {
        community: { select: { id: true, name: true, slug: true, iconUrl: true, memberCount: true } },
        approvedAt: true,
      },
      orderBy: { approvedAt: 'desc' },
    });
  }

  /**
   * Put someone forward. The community owner may nominate for their own
   * community; an administrator may nominate anywhere.
   */
  async nominate(communityId: number, targetUserId: number, actorId: number, actorRole: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, name: true, createdById: true },
    });
    if (!community) throw new NotFoundException('Społeczność nie istnieje');

    const isOwner = community.createdById === actorId;
    if (!isOwner && actorRole !== 'ADMIN') {
      throw new ForbiddenException('Moderatora może zgłosić właściciel społeczności lub administrator');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, isActive: true },
    });
    if (!target) throw new NotFoundException('Użytkownik nie istnieje');
    if (!target.isActive) throw new BadRequestException('Konto jest nieaktywne');

    const existing = await this.prisma.communityModerator.findUnique({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      select: { id: true, status: true },
    });
    if (existing?.status === ModeratorStatus.ACTIVE) {
      throw new BadRequestException('Ten użytkownik już moderuje tę społeczność');
    }
    if (existing?.status === ModeratorStatus.PENDING) {
      throw new BadRequestException('Zgłoszenie tego użytkownika już czeka na zatwierdzenie');
    }

    // Ponowne zgłoszenie po odrzuceniu jest dozwolone — wcześniejszy wiersz
    // wraca do PENDING zamiast tworzyć duplikat, bo para (społeczność,
    // użytkownik) jest unikalna.
    const record = await this.prisma.communityModerator.upsert({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      create: {
        communityId,
        userId: targetUserId,
        status: ModeratorStatus.PENDING,
        nominatedById: actorId,
      },
      update: {
        status: ModeratorStatus.PENDING,
        nominatedById: actorId,
        approvedById: null,
        approvedAt: null,
        revokedAt: null,
        reason: null,
      },
      select: { id: true },
    });

    await this.log(actorId, 'COMMUNITY_MOD_NOMINATE', record.id, {
      community: community.name,
      target: target.username,
    });
    return { id: record.id, status: ModeratorStatus.PENDING };
  }

  /** Nominations waiting for an administrator — the approval queue. */
  async pending() {
    return this.prisma.communityModerator.findMany({
      where: { status: ModeratorStatus.PENDING },
      select: {
        id: true,
        createdAt: true,
        community: { select: { id: true, name: true, slug: true, memberCount: true } },
        user: { select: { id: true, username: true, avatarUrl: true, createdAt: true } },
        nominatedBy: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Everyone appointed in one community, whatever their status. */
  async listForCommunity(communityId: number) {
    return this.prisma.communityModerator.findMany({
      where: { communityId },
      select: {
        id: true,
        status: true,
        approvedAt: true,
        revokedAt: true,
        reason: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
        nominatedBy: { select: { username: true } },
        approvedBy: { select: { username: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async approve(id: number, adminId: number) {
    const row = await this.requirePending(id);
    const updated = await this.prisma.communityModerator.update({
      where: { id },
      data: {
        status: ModeratorStatus.ACTIVE,
        approvedById: adminId,
        approvedAt: new Date(),
        reason: null,
      },
      select: { id: true, status: true },
    });
    await this.log(adminId, 'COMMUNITY_MOD_APPROVE', id, {
      community: row.community.name,
      target: row.user.username,
    });
    return updated;
  }

  async reject(id: number, adminId: number, reason?: string) {
    const row = await this.requirePending(id);
    const updated = await this.prisma.communityModerator.update({
      where: { id },
      data: {
        status: ModeratorStatus.REVOKED,
        approvedById: adminId,
        revokedAt: new Date(),
        reason: reason ?? null,
      },
      select: { id: true, status: true },
    });
    await this.log(adminId, 'COMMUNITY_MOD_REJECT', id, {
      community: row.community.name,
      target: row.user.username,
      reason,
    });
    return updated;
  }

  /** Withdraw an appointment that is already active. */
  async revoke(id: number, adminId: number, reason?: string) {
    const row = await this.prisma.communityModerator.findUnique({
      where: { id },
      select: { id: true, status: true, community: { select: { name: true } }, user: { select: { username: true } } },
    });
    if (!row) throw new NotFoundException('Zgłoszenie nie istnieje');
    if (row.status !== ModeratorStatus.ACTIVE) {
      throw new BadRequestException('Ten moderator nie jest aktywny');
    }

    const updated = await this.prisma.communityModerator.update({
      where: { id },
      data: { status: ModeratorStatus.REVOKED, revokedAt: new Date(), reason: reason ?? null },
      select: { id: true, status: true },
    });
    await this.log(adminId, 'COMMUNITY_MOD_REVOKE', id, {
      community: row.community.name,
      target: row.user.username,
      reason,
    });
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Actions a community moderator may take.
  //
  // These live here rather than on ModerationController because the scope
  // has to be in the URL. The global controller is guarded once, at class
  // level, with @Roles('ADMIN','MODERATOR'); widening that guard to admit
  // community moderators would admit them to every endpoint on it,
  // including user bans and role changes.
  // ─────────────────────────────────────────────────────────────────────

  /** Throws unless the actor may moderate this community. */
  private async assertCanModerate(userId: number, communityId: number, role: string) {
    if (!(await this.canModerate(userId, communityId, role))) {
      throw new ForbiddenException('Nie moderujesz tej społeczności');
    }
  }

  /** A post can only be touched by a moderator of the community it sits in. */
  private async postInCommunity(postId: number, communityId: number) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, communityId: true, title: true },
    });
    if (!post) throw new NotFoundException('Post nie istnieje');
    if (post.communityId !== communityId) {
      throw new ForbiddenException('Ten post nie należy do tej społeczności');
    }
    return post;
  }

  async removePost(communityId: number, postId: number, actorId: number, role: string, reason?: string) {
    await this.assertCanModerate(actorId, communityId, role);
    const post = await this.postInCommunity(postId, communityId);

    await this.prisma.post.update({ where: { id: postId }, data: { isDeleted: true } });
    await this.log(actorId, 'COMMUNITY_POST_REMOVE', postId, { communityId, title: post.title, reason });
    return { id: postId, isDeleted: true };
  }

  async restorePost(communityId: number, postId: number, actorId: number, role: string) {
    await this.assertCanModerate(actorId, communityId, role);
    await this.postInCommunity(postId, communityId);

    await this.prisma.post.update({ where: { id: postId }, data: { isDeleted: false } });
    await this.log(actorId, 'COMMUNITY_POST_RESTORE', postId, { communityId });
    return { id: postId, isDeleted: false };
  }

  async togglePin(communityId: number, postId: number, actorId: number, role: string) {
    await this.assertCanModerate(actorId, communityId, role);
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, communityId: true, isPinned: true },
    });
    if (!post) throw new NotFoundException('Post nie istnieje');
    if (post.communityId !== communityId) {
      throw new ForbiddenException('Ten post nie należy do tej społeczności');
    }

    const updated = await this.prisma.post.update({
      where: { id: postId },
      data: { isPinned: !post.isPinned },
      select: { id: true, isPinned: true },
    });
    await this.log(actorId, updated.isPinned ? 'COMMUNITY_POST_PIN' : 'COMMUNITY_POST_UNPIN', postId, { communityId });
    return updated;
  }

  /**
   * Ban somebody from one community.
   *
   * CommunityBan existed and was read when checking whether a member could
   * post — but nothing ever created a row, so the check could never fire.
   * This is the write side it was missing.
   */
  async banMember(communityId: number, targetUserId: number, actorId: number, role: string, reason?: string) {
    await this.assertCanModerate(actorId, communityId, role);

    if (targetUserId === actorId) {
      throw new BadRequestException('Nie można zablokować własnego konta');
    }

    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { createdById: true, name: true },
    });
    if (!community) throw new NotFoundException('Społeczność nie istnieje');
    // Właściciel społeczności jest poza zasięgiem moderatorów, których sam
    // zgłosił — inaczej nadanie roli dałoby się obrócić przeciwko niemu.
    if (community.createdById === targetUserId && role !== 'ADMIN') {
      throw new ForbiddenException('Nie można zablokować właściciela społeczności');
    }

    const ban = await this.prisma.communityBan.upsert({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      create: { communityId, userId: targetUserId, bannedById: actorId, reason: reason ?? null },
      update: { bannedById: actorId, reason: reason ?? null },
      select: { id: true },
    });
    await this.log(actorId, 'COMMUNITY_BAN', targetUserId, { communityId, community: community.name, reason });
    return ban;
  }

  async unbanMember(communityId: number, targetUserId: number, actorId: number, role: string) {
    await this.assertCanModerate(actorId, communityId, role);
    await this.prisma.communityBan.deleteMany({ where: { communityId, userId: targetUserId } });
    await this.log(actorId, 'COMMUNITY_UNBAN', targetUserId, { communityId });
    return { ok: true };
  }

  async listBans(communityId: number, actorId: number, role: string) {
    await this.assertCanModerate(actorId, communityId, role);
    return this.prisma.communityBan.findMany({
      where: { communityId },
      select: {
        id: true,
        reason: true,
        createdAt: true,
        user: { select: { id: true, username: true, avatarUrl: true } },
        bannedBy: { select: { username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async requirePending(id: number) {
    const row = await this.prisma.communityModerator.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        community: { select: { name: true } },
        user: { select: { username: true } },
      },
    });
    if (!row) throw new NotFoundException('Zgłoszenie nie istnieje');
    if (row.status !== ModeratorStatus.PENDING) {
      throw new BadRequestException('To zgłoszenie zostało już rozpatrzone');
    }
    return row;
  }

  private async log(userId: number, action: string, targetId: number, metadata: object) {
    // Dziennik nie może wywrócić operacji, która się powiodła.
    await this.prisma.adminActionLog
      .create({
        data: {
          userId,
          action,
          targetType: 'COMMUNITY_MODERATOR',
          targetId: String(targetId),
          metadata: metadata as never,
        },
      })
      .catch(() => undefined);
  }
}
