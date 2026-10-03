import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Req, UseGuards, ParseIntPipe, HttpCode } from '@nestjs/common';
import { PostsService } from './posts.service';
import { JwtAuthGuard, OptionalJwtGuard } from '../auth/jwt-auth.guard';

@Controller('posts')
export class PostsController {
  constructor(private postsService: PostsService) {}

  // Static routes MUST come before :id param routes
  @Get('feed')
  getFeed(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.postsService.findFeed(Math.max(1, +page), Math.min(20, Math.max(1, +limit)));
  }

  @Get('user-votes/batch')
  @UseGuards(JwtAuthGuard)
  getUserVotes(@Query('ids') ids: string, @Req() req) {
    const postIds = ids.split(',').map(Number).filter(Boolean);
    return this.postsService.getUserVotes(req.user.userId, postIds);
  }

  @Get('reactions/batch')
  @UseGuards(OptionalJwtGuard)
  getBatchReactions(@Query('ids') ids: string, @Req() req) {
    const postIds = ids.split(',').map(Number).filter(Boolean);
    return this.postsService.getBatchReactions(postIds, req.user?.userId);
  }

  @Get()
  @UseGuards(OptionalJwtGuard)
  findAll(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('streamerId') streamerId?: number,
    @Query('communityId') communityId?: number,
    @Query('communitySlug') communitySlug?: string,
    @Query('official') official?: string,
    @Query('sort') sort?: string,
    @Query('tag') tag?: string,
    @Query('nsfw') nsfw?: string,
    @Query('type') type?: string,
    @Query('following') following?: string,
  ) {
    const isOfficial = official === 'true' ? true : official === 'false' ? false : undefined;
    const showNsfw = nsfw === 'true' ? true : nsfw === 'false' ? false : undefined;
    const userId = req?.user?.userId as number | undefined;
    return this.postsService.findAll({
      page: Math.max(1, page),
      limit: Math.min(100, Math.max(1, limit)),
      streamerId,
      communityId: communityId ? +communityId : undefined,
      communitySlug,
      official: isOfficial,
      sort,
      tag,
      nsfw: showNsfw,
      type,
      userId,
      following: following === 'true',
    });
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body, @Req() req) {
    return this.postsService.create(req.user.userId, body);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body, @Req() req) {
    return this.postsService.update(id, req.user.userId, req.user.role, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  remove(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.postsService.remove(id, req.user.userId, req.user.role);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  vote(@Param('id', ParseIntPipe) id: number, @Body() body: { direction: 'up' | 'down' }, @Req() req) {
    return this.postsService.vote(id, req.user.userId, body.direction);
  }

  @Get(':id/reactions')
  @UseGuards(OptionalJwtGuard)
  getReactions(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.postsService.getReactions(id, req.user?.userId);
  }

  @Post(':id/reactions')
  @UseGuards(JwtAuthGuard)
  toggleReaction(@Param('id', ParseIntPipe) id: number, @Body() body: { emoji: string }, @Req() req) {
    return this.postsService.toggleReaction(id, req.user.userId, body.emoji);
  }

  @Post(':id/view')
  @HttpCode(204)
  recordView(@Param('id', ParseIntPipe) id: number) {
    return this.postsService.recordView(id);
  }

  // ── Poll endpoints ──

  @Post(':id/poll/vote')
  @UseGuards(JwtAuthGuard)
  pollVote(@Param('id', ParseIntPipe) postId: number, @Body() body: { optionId: number }, @Req() req) {
    return this.postsService.pollVote(postId, req.user.userId, body.optionId);
  }

  @Get(':id/poll/results')
  @UseGuards(OptionalJwtGuard)
  pollResults(@Param('id', ParseIntPipe) postId: number, @Req() req) {
    return this.postsService.pollResults(postId, req.user?.userId);
  }

  // ── AMA endpoints ──

  @Get(':id/ama/questions')
  @UseGuards(OptionalJwtGuard)
  amaQuestions(@Param('id', ParseIntPipe) postId: number, @Query('sort') sort: string, @Req() req) {
    return this.postsService.amaGetQuestions(postId, sort || 'top', req.user?.userId);
  }

  @Post(':id/ama/questions')
  @UseGuards(JwtAuthGuard)
  amaAskQuestion(@Param('id', ParseIntPipe) postId: number, @Body() body: { content: string }, @Req() req) {
    return this.postsService.amaAskQuestion(postId, req.user.userId, body.content);
  }

  @Post(':id/ama/questions/:questionId/answer')
  @UseGuards(JwtAuthGuard)
  amaAnswer(
    @Param('id', ParseIntPipe) postId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Body() body: { content: string },
    @Req() req,
  ) {
    return this.postsService.amaAnswer(postId, questionId, req.user.userId, body.content);
  }

  @Post(':id/ama/questions/:questionId/upvote')
  @UseGuards(JwtAuthGuard)
  amaUpvote(
    @Param('id', ParseIntPipe) postId: number,
    @Param('questionId', ParseIntPipe) questionId: number,
    @Req() req,
  ) {
    return this.postsService.amaUpvoteQuestion(postId, questionId, req.user.userId);
  }
}
