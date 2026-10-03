import { Controller, Get, Post, Delete, Param, Query, Body, Req, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { ChannelsService } from './channels.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('channels')
export class ChannelsController {
  constructor(private channelsService: ChannelsService) {}

  @Get()
  find(@Query('scope') scope?: string, @Query('streamerId') streamerId?: string) {
    if (scope === 'GLOBAL') return this.channelsService.findGlobal();
    if (streamerId) return this.channelsService.findByStreamer(parseInt(streamerId));
    return this.channelsService.findAll(scope, streamerId ? parseInt(streamerId) : undefined);
  }

  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.channelsService.findBySlug(slug);
  }

  @Get('by-slug/:streamerSlug/:channelSlug')
  findStreamerChannelBySlug(
    @Param('streamerSlug') streamerSlug: string,
    @Param('channelSlug') channelSlug: string,
  ) {
    return this.channelsService.findStreamerChannelBySlug(streamerSlug, channelSlug);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.channelsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any, @Req() req: any) {
    if (body.scope === 'GLOBAL' || (!body.streamerProfileId && !body.scope)) {
      return this.channelsService.createGlobal(req.user.userId, req.user.role, body);
    }
    return this.channelsService.createStreamer(req.user.userId, req.user.role, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.channelsService.remove(id, req.user.userId, req.user.role);
  }

  // ── Channel Moderation ──────────────────────────────────

  @Post(':id/mute')
  @UseGuards(JwtAuthGuard)
  muteUser(
    @Param('id', ParseIntPipe) channelId: number,
    @Body() body: { userId: number; durationMinutes?: number },
    @Req() req,
  ) {
    return this.channelsService.muteUser(channelId, body.userId, req.user.userId, req.user.role, body.durationMinutes);
  }

  @Delete(':id/mute/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  unmuteUser(
    @Param('id', ParseIntPipe) channelId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req,
  ) {
    return this.channelsService.unmuteUser(channelId, userId, req.user.userId, req.user.role);
  }

  @Post(':id/ban')
  @UseGuards(JwtAuthGuard)
  banUser(
    @Param('id', ParseIntPipe) channelId: number,
    @Body() body: { userId: number; reason?: string },
    @Req() req,
  ) {
    return this.channelsService.banUser(channelId, body.userId, req.user.userId, req.user.role, body.reason);
  }

  @Delete(':id/ban/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  unbanUser(
    @Param('id', ParseIntPipe) channelId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req,
  ) {
    return this.channelsService.unbanUser(channelId, userId, req.user.userId, req.user.role);
  }

  @Get(':id/mutes')
  @UseGuards(JwtAuthGuard)
  getMutes(@Param('id', ParseIntPipe) channelId: number, @Req() req) {
    return this.channelsService.getMutes(channelId, req.user.userId, req.user.role);
  }

  @Get(':id/bans')
  @UseGuards(JwtAuthGuard)
  getBans(@Param('id', ParseIntPipe) channelId: number, @Req() req) {
    return this.channelsService.getBans(channelId, req.user.userId, req.user.role);
  }

  // ── Channel Moderators ──────────────────────────────────

  @Get(':id/moderators')
  getModerators(@Param('id', ParseIntPipe) channelId: number) {
    return this.channelsService.getChannelModerators(channelId);
  }

  @Post(':id/moderators')
  @UseGuards(JwtAuthGuard)
  addModerator(
    @Param('id', ParseIntPipe) channelId: number,
    @Body() body: { userId: number },
    @Req() req,
  ) {
    return this.channelsService.addChannelModerator(channelId, body.userId, req.user.userId, req.user.role);
  }

  @Delete(':id/moderators/:userId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  removeModerator(
    @Param('id', ParseIntPipe) channelId: number,
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req,
  ) {
    return this.channelsService.removeChannelModerator(channelId, userId, req.user.userId, req.user.role);
  }

  // ── Permission check endpoint ───────────────────────────

  @Get(':id/can-send')
  @UseGuards(JwtAuthGuard)
  canSend(@Param('id', ParseIntPipe) channelId: number, @Req() req) {
    return this.channelsService.canSendMessage(req.user.userId, req.user.role, channelId);
  }
}
