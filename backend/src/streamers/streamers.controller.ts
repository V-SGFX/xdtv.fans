import { Controller, Get, Post, Patch, Param, Query, Body, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { StreamersService } from './streamers.service';
import { JwtAuthGuard, OptionalJwtGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('streamers')
export class StreamersController {
  constructor(private streamersService: StreamersService) {}

  @Get()
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('platform') platform?: string,
    @Query('filter') filter?: string,
    @Query('letter') letter?: string,
  ) {
    return this.streamersService.findAll(
      Math.max(1, Number(page) || 1),
      Math.min(5000, Math.max(1, Number(limit) || 20)),
      search,
      sort,
      platform,
      filter,
      letter,
    );
  }

  /**
   * Typeahead for the directory search box.
   *
   * Separate from the paginated list on purpose: a suggestion drop-down wants
   * a handful of rows and the four fields needed to draw them, not a page of
   * full profiles with stats and chat activity attached.
   */
  @Get('suggest')
  suggest(@Query('q') q: string, @Query('limit') limit = 8) {
    return this.streamersService.suggest(q, Math.min(15, Math.max(1, Number(limit) || 8)));
  }

  /** Per-letter and per-platform counts for the A-Z directory index. */
  @Get('directory-meta')
  getDirectoryMeta() {
    return this.streamersService.getDirectoryMeta();
  }

  @Get('me/dashboard')
  @UseGuards(JwtAuthGuard)
  getMyDashboard(@Req() req) {
    return this.streamersService.getDashboard(req.user.userId);
  }

  @Get(':slug')
  @UseGuards(OptionalJwtGuard)
  findBySlug(@Param('slug') slug: string, @Req() req) {
    return this.streamersService.findBySlug(slug, req.user?.userId ?? null);
  }

  @Get(':slug/stats')
  getStats(@Param('slug') slug: string) {
    return this.streamersService.getStatsBySlug(slug);
  }

  @Post(':id/claim')
  @UseGuards(JwtAuthGuard)
  claim(@Param('id', ParseIntPipe) id: number, @Req() req) {
    return this.streamersService.claim(id, req.user.userId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() body, @Req() req) {
    return this.streamersService.update(id, req.user.userId, req.user.role, body);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() body) {
    return this.streamersService.create(body);
  }
}
