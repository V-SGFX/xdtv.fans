import { BadRequestException, Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard, OptionalJwtGuard } from '../auth/jwt-auth.guard';

@Controller('comments')
export class CommentsController {
  constructor(private commentsService: CommentsService) {}

  /**
   * Comments for a post (?postId=) or a news article (?newsId=).
   *
   * postId stays optional rather than required so the existing callers are
   * untouched while news gains its own thread.
   */
  @Get()
  @UseGuards(OptionalJwtGuard)
  findByPost(
    @Query('postId') postIdRaw: string | undefined,
    @Query('newsId') newsIdRaw: string | undefined,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('sort') sort: 'best' | 'new' | 'controversial' = 'best',
    @Req() req,
  ) {
    const postId = postIdRaw ? parseInt(postIdRaw, 10) : NaN;
    const newsId = newsIdRaw ? parseInt(newsIdRaw, 10) : NaN;
    const p = Math.max(1, +page);
    const l = Math.min(50, Math.max(1, +limit));

    if (Number.isFinite(newsId)) {
      return this.commentsService.findByNews(newsId, p, l, sort, req.user?.userId);
    }
    if (!Number.isFinite(postId)) {
      throw new BadRequestException('postId or newsId is required');
    }
    return this.commentsService.findByPost(postId, p, l, sort, req.user?.userId);
  }

  @Get('user-votes/batch')
  @UseGuards(JwtAuthGuard)
  getUserVotes(@Query('ids') ids: string, @Req() req) {
    const commentIds = ids.split(',').map(Number).filter(Boolean);
    return this.commentsService.getUserVotes(req.user.userId, commentIds);
  }

  @Get(':id/replies')
  @UseGuards(OptionalJwtGuard)
  getReplies(
    @Param('id', ParseIntPipe) id: number,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('sort') sort: 'best' | 'new' | 'controversial' = 'best',
    @Req() req,
  ) {
    return this.commentsService.getReplies(
      id,
      Math.max(1, +page),
      Math.min(50, Math.max(1, +limit)),
      sort,
      req.user?.userId,
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: { postId?: number; newsId?: number; content: string; parentId?: number }, @Req() req) {
    return this.commentsService.create(req.user.userId, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body: { content: string }, @Req() req) {
    return this.commentsService.update(id, req.user.userId, req.user.role, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.commentsService.remove(id, req.user.userId, req.user.role);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  vote(@Param('id', ParseIntPipe) id: number, @Body() body: { direction: 'up' | 'down' }, @Req() req) {
    return this.commentsService.vote(id, req.user.userId, body.direction);
  }
}
