import { Controller, Get, Post, Query, Body, Param, UseGuards } from '@nestjs/common';
import { TagsService } from './tags.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  /** `type` filters by domain dimension: GAME | CATEGORY | LANGUAGE | FORMAT | TOPIC */
  @Get()
  findAll(@Query('type') type?: string) {
    return this.tagsService.findAll(type);
  }

  @Get('popular')
  findPopular(@Query('limit') limit = 20, @Query('type') type?: string) {
    return this.tagsService.findPopular(Math.min(50, Math.max(1, limit)), type);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tagsService.findBySlug(slug);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: { name: string; color?: string }) {
    return this.tagsService.create(body.name, body.color);
  }
}
