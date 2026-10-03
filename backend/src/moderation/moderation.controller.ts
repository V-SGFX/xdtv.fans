import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Body, Req, UseGuards,
  ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  // ─── USERS (ADMIN only) ───────────────────────────────

  @Get('users')
  @Roles('ADMIN')
  getUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('role') role?: string,
  ) {
    return this.moderationService.getUsers(+page, Math.min(100, +limit), search, role);
  }

  @Patch('users/:id/role')
  @Roles('ADMIN')
  changeRole(@Param('id', ParseIntPipe) id: number, @Body() body: { role: string }) {
    return this.moderationService.changeRole(id, body.role);
  }

  @Patch('users/:id/ban')
  @Roles('ADMIN')
  toggleBan(@Param('id', ParseIntPipe) id: number) {
    return this.moderationService.toggleBan(id);
  }

  // ─── POSTS ────────────────────────────────────────────

  @Get('posts')
  getPosts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return this.moderationService.getPosts(+page, Math.min(100, +limit), search);
  }

  @Patch('posts/:id/pin')
  togglePin(@Param('id', ParseIntPipe) id: number) {
    return this.moderationService.togglePin(id);
  }

  @Delete('posts/:id')
  @HttpCode(204)
  deletePost(@Param('id', ParseIntPipe) id: number) {
    return this.moderationService.deletePost(id);
  }

  // ─── NSFW ─────────────────────────────────────────────

  @Get('posts/flagged')
  getFlaggedPosts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.moderationService.getFlaggedPosts(+page, Math.min(100, +limit));
  }

  @Patch('posts/:id/nsfw')
  moderateNsfw(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { action: 'approve' | 'remove' | 'mark-safe' },
  ) {
    return this.moderationService.moderateNsfw(id, body.action);
  }

  @Delete('comments/:id')
  @HttpCode(204)
  deleteComment(@Param('id', ParseIntPipe) id: number) {
    return this.moderationService.deleteComment(id);
  }

  // ─── REPORTS ──────────────────────────────────────────

  @Get('reports')
  getReports(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
  ) {
    return this.moderationService.getReports(+page, Math.min(100, +limit), status);
  }

  @Get('reports/counts')
  getReportCounts() {
    return this.moderationService.getReportCounts();
  }

  @Patch('reports/:id')
  resolveReport(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: string; adminNote?: string },
    @Req() req,
  ) {
    return this.moderationService.resolveReport(id, req.user.userId, body);
  }
}

// Separate controller for user-facing reports (requires login only)
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private moderationService: ModerationService) {}

  @Post()
  createReport(@Body() body: { targetType: string; targetId: number; reason: string }, @Req() req) {
    return this.moderationService.createReport(req.user.userId, body);
  }
}
