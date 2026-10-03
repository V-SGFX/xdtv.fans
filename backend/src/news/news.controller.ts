import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { NewsService } from './news.service';
import { NewsScraperService } from './news-scraper.service';
import { OptionalJwtGuard, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('news')
export class NewsController {
  constructor(
    private newsService: NewsService,
    private scraperService: NewsScraperService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtGuard)
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('streamerId') streamerId?: number,
    @Query('category') category?: string,
    @Query('lang') lang?: string,
  ) {
    return this.newsService.findAll(
      Math.max(1, page),
      Math.min(100, Math.max(1, limit)),
      streamerId,
      category,
      lang === 'en' ? 'en' : 'pl',
    );
  }

  /** Article counts per category, for the Discover tab chips. */
  @Get('categories')
  categories() {
    return this.newsService.getCategoryCounts();
  }

  // ── Scraper control (admin only) — must be before :id route ──

  @Get('scraper/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  scraperStatus() {
    return this.scraperService.getStatus();
  }

  @Post('scraper/trigger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  scraperTrigger() {
    return this.scraperService.triggerNow();
  }

  @Post('scraper/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  scraperEnable() {
    this.scraperService.enable();
    return { message: 'Scraper enabled' };
  }

  @Post('scraper/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  scraperDisable() {
    this.scraperService.disable();
    return { message: 'Scraper disabled' };
  }

  // ── Public routes ──

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.newsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() body: any) {
    return this.newsService.create(body);
  }
}
