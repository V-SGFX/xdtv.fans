import { Controller, Get, Post, Param, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('follows')
export class FollowsController {
  constructor(private followsService: FollowsService) {}

  @Post(':streamerProfileId')
  @UseGuards(JwtAuthGuard)
  toggle(@Param('streamerProfileId', ParseIntPipe) streamerProfileId: number, @Req() req) {
    return this.followsService.toggle(req.user.userId, streamerProfileId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyFollows(@Req() req) {
    return this.followsService.getMyFollows(req.user.userId);
  }

  /** Toggle following a tag (game / category / language). */
  @Post('tag/:tagId')
  @UseGuards(JwtAuthGuard)
  toggleTag(@Param('tagId', ParseIntPipe) tagId: number, @Req() req) {
    return this.followsService.toggleTag(req.user.userId, tagId);
  }

  @Get('tags/me')
  @UseGuards(JwtAuthGuard)
  getMyTagFollows(@Req() req) {
    return this.followsService.getMyTagFollows(req.user.userId);
  }

  @Get('tag/check/:tagId')
  @UseGuards(JwtAuthGuard)
  checkTag(@Param('tagId', ParseIntPipe) tagId: number, @Req() req) {
    return this.followsService.checkTag(req.user.userId, tagId);
  }

  /** Toggle saving an individual post / clip / entry. */
  @Post('post/:postId')
  @UseGuards(JwtAuthGuard)
  togglePost(@Param('postId', ParseIntPipe) postId: number, @Req() req) {
    return this.followsService.togglePost(req.user.userId, postId);
  }

  @Get('post/check/:postId')
  @UseGuards(JwtAuthGuard)
  checkPost(@Param('postId', ParseIntPipe) postId: number, @Req() req) {
    return this.followsService.checkPost(req.user.userId, postId);
  }

  /** Saved state for a set of posts — one call per wall page, not per card. */
  @Get('posts/check-batch')
  @UseGuards(JwtAuthGuard)
  checkPostsBatch(@Query('ids') ids: string, @Req() req) {
    const parsed = (ids || '')
      .split(',')
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n));
    return this.followsService.checkPostsBatch(req.user.userId, parsed.slice(0, 100));
  }

  @Get('posts/me')
  @UseGuards(JwtAuthGuard)
  getMySavedPosts(@Req() req, @Query('page') page = 1, @Query('limit') limit = 24) {
    return this.followsService.getMySavedPosts(
      req.user.userId,
      Math.max(1, +page),
      Math.min(50, Math.max(1, +limit)),
    );
  }

  @Get('check/:streamerProfileId')
  @UseGuards(JwtAuthGuard)
  check(@Param('streamerProfileId', ParseIntPipe) streamerProfileId: number, @Req() req) {
    return this.followsService.check(req.user.userId, streamerProfileId);
  }
}
