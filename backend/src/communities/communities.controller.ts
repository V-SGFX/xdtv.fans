import {
  Controller, Get, Post, Delete,
  Param, Body, Req, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { JwtAuthGuard, OptionalJwtGuard } from '../auth/jwt-auth.guard';

@Controller('communities')
export class CommunitiesController {
  constructor(private communitiesService: CommunitiesService) {}

  // ─── Public: list all communities ─────────────────────
  @Get()
  @UseGuards(OptionalJwtGuard)
  findAll(@Req() req) {
    const userId = req.user?.userId;
    return this.communitiesService.findAll(userId);
  }

  // ─── Public: trending communities ─────────────────────
  @Get('trending')
  @UseGuards(OptionalJwtGuard)
  findTrending(@Req() req) {
    const userId = req.user?.userId;
    return this.communitiesService.findTrending(userId);
  }

  // ─── Auth: my communities ─────────────────────────────
  @Get('mine')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req) {
    return this.communitiesService.findMyCommunities(req.user.userId);
  }

  // ─── Public: get community by slug ────────────────────
  @Get(':slug')
  @UseGuards(OptionalJwtGuard)
  findBySlug(@Param('slug') slug: string, @Req() req) {
    const userId = req.user?.userId;
    return this.communitiesService.findBySlug(slug, userId);
  }

  // ─── Auth: create community ───────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: { name: string; description?: string; color?: string; iconUrl?: string }, @Req() req) {
    return this.communitiesService.create(req.user.userId, body);
  }

  // ─── Auth: join community ─────────────────────────────
  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  join(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.communitiesService.join(id, req.user.userId);
  }

  // ─── Auth: leave community ────────────────────────────
  @Delete(':id/join')
  @UseGuards(JwtAuthGuard)
  leave(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.communitiesService.leave(id, req.user.userId);
  }
}
