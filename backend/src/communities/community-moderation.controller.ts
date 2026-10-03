import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { CommunityModerationService } from './community-moderation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * Appointing community moderators.
 *
 * Literal paths are declared before parameterised ones. `moderators/pending`
 * would otherwise be swallowed by `moderators/:id`, and the queue would
 * answer "nie znaleziono zgłoszenia o identyfikatorze pending".
 */
@Controller('communities')
export class CommunityModerationController {
  constructor(private moderation: CommunityModerationService) {}

  /** The approval queue, across every community. Administrators only. */
  @Get('moderators/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  pending() {
    return this.moderation.pending();
  }

  /** Communities the caller moderates — drives the scoped moderation view. */
  @Get('moderators/mine')
  @UseGuards(JwtAuthGuard)
  mine(@Req() req) {
    return this.moderation.myCommunities(req.user.userId);
  }

  @Get(':id/moderators')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MODERATOR')
  listForCommunity(@Param('id', ParseIntPipe) id: number) {
    return this.moderation.listForCommunity(id);
  }

  /** Owner of the community, or an administrator, puts someone forward. */
  @Post(':id/moderators')
  @UseGuards(JwtAuthGuard)
  nominate(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { userId: number },
    @Req() req,
  ) {
    return this.moderation.nominate(id, Number(body.userId), req.user.userId, req.user.role);
  }

  // ─── Actions inside one community ─────────────────────────────────────
  // No @Roles here on purpose: the right to act comes from the appointment,
  // which the service checks against the community in the path. A global
  // ADMIN or MODERATOR passes the same check.

  @Delete(':id/posts/:postId')
  @UseGuards(JwtAuthGuard)
  removePost(
    @Param('id', ParseIntPipe) id: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Body() body: { reason?: string },
    @Req() req,
  ) {
    return this.moderation.removePost(id, postId, req.user.userId, req.user.role, body?.reason);
  }

  @Patch(':id/posts/:postId/restore')
  @UseGuards(JwtAuthGuard)
  restorePost(
    @Param('id', ParseIntPipe) id: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Req() req,
  ) {
    return this.moderation.restorePost(id, postId, req.user.userId, req.user.role);
  }

  @Patch(':id/posts/:postId/pin')
  @UseGuards(JwtAuthGuard)
  togglePin(
    @Param('id', ParseIntPipe) id: number,
    @Param('postId', ParseIntPipe) postId: number,
    @Req() req,
  ) {
    return this.moderation.togglePin(id, postId, req.user.userId, req.user.role);
  }

  @Get(':id/bans')
  @UseGuards(JwtAuthGuard)
  listBans(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.moderation.listBans(id, req.user.userId, req.user.role);
  }

  @Post(':id/bans')
  @UseGuards(JwtAuthGuard)
  ban(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { userId: number; reason?: string },
    @Req() req,
  ) {
    return this.moderation.banMember(id, Number(body.userId), req.user.userId, req.user.role, body?.reason);
  }

  @Delete(':id/bans/:userId')
  @UseGuards(JwtAuthGuard)
  unban(
    @Param('id', ParseIntPipe) id: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req,
  ) {
    return this.moderation.unbanMember(id, userId, req.user.userId, req.user.role);
  }

  @Patch('moderators/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  approve(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.moderation.approve(id, req.user.userId);
  }

  @Patch('moderators/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Req() req) {
    return this.moderation.reject(id, req.user.userId, body?.reason);
  }

  @Patch('moderators/:id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  revoke(@Param('id', ParseIntPipe) id: number, @Body() body: { reason?: string }, @Req() req) {
    return this.moderation.revoke(id, req.user.userId, body?.reason);
  }
}
