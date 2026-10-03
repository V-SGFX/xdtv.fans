import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { FeedService, AnonSignals } from './feed.service';
import { OptionalJwtGuard } from '../auth/jwt-auth.guard';

@Controller('feed')
export class FeedController {
  constructor(private feedService: FeedService) {}

  /**
   * GET /api/feed/mixed
   * Mixed feed: clips + hot takes + predictions interleaved
   */
  @Get('mixed')
  @UseGuards(OptionalJwtGuard)
  getMixedFeed(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('sort') sort: string | undefined,
    @Req() req,
  ) {
    const userId = req.user?.userId ?? null;
    return this.feedService.getMixedFeed(userId, Math.max(1, +page), Math.min(40, Math.max(1, +limit)), sort);
  }

  /**
   * GET /api/feed
   *
   * Query params:
   *   page        — page number (default 1)
   *   limit       — items per page (default 20, max 50)
   *   community   — filter by community slug
   *   streamers   — comma-separated streamerProfileIds (anon signal)
   *   tags        — comma-separated tag slugs (anon signal)
   */
  @Get()
  @UseGuards(OptionalJwtGuard)
  getHomeFeed(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('sort') sort: string | undefined,
    @Query('community') communitySlug: string | undefined,
    @Query('streamer') streamerSlug: string | undefined,
    @Query('type') type: string | undefined,
    @Query('excludeType') excludeType: string | undefined,
    @Query('tag') tag: string | undefined,
    @Query('streamers') streamers: string | undefined,
    @Query('tags') tags: string | undefined,
    @Query('following') following: string | undefined,
    @Req() req,
  ) {
    const userId = req.user?.userId ?? null;

    // Parse anonymous signals from query params (client stores in localStorage)
    let anonSignals: AnonSignals | undefined;
    if (!userId && (streamers || tags)) {
      anonSignals = {
        viewedStreamerIds: streamers
          ? streamers.split(',').map(Number).filter(n => !isNaN(n) && n > 0)
          : [],
        likedTagSlugs: tags
          ? tags.split(',').filter(Boolean)
          : [],
      };
    }

    return this.feedService.getHomeFeed(
      userId,
      Math.max(1, +page),
      Math.min(50, Math.max(1, +limit)),
      communitySlug,
      anonSignals,
      streamerSlug,
      type,
      sort,
      excludeType,
      tag,
      following === 'true',
    );
  }
}
