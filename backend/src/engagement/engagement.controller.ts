import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, OptionalJwtGuard } from '../auth/jwt-auth.guard';
import { XpService } from './xp.service';
import { StreakService } from './streak.service';

@Controller('engagement')
export class EngagementController {
  constructor(
    private xpService: XpService,
    private streakService: StreakService,
  ) {}

  /** Get current user's XP profile (xp, badges, streak, multiplier) */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@Req() req: any) {
    return this.xpService.getProfile(req.user.userId);
  }

  /** Get today's daily challenges for current user */
  @Get('challenges')
  @UseGuards(JwtAuthGuard)
  async getMyChallenges(@Req() req: any) {
    return this.streakService.getDailyChallenges(req.user.userId);
  }

  /** XP leaderboard — top users this week */
  @Get('leaderboard')
  async getLeaderboard() {
    return this.xpService.getLeaderboard(20);
  }

  /** Social status boards for comments, predictions, community and trending activity */
  @Get('status/leaderboards')
  async getStatusLeaderboards(@Req() req: any) {
    const rawLimit = Number(req?.query?.limit ?? 10);
    const limit = Number.isFinite(rawLimit) ? rawLimit : 10;
    return this.xpService.getStatusLeaderboards(limit);
  }

  /** Current user's reputation status */
  @Get('status/me')
  @UseGuards(JwtAuthGuard)
  async getMyStatus(@Req() req: any) {
    return this.xpService.getUserStatus(req.user.userId);
  }

  /** Public user reputation status */
  @Get('status/:id')
  @UseGuards(OptionalJwtGuard)
  async getUserStatus(@Param('id') id: string) {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return null;
    return this.xpService.getUserStatus(userId);
  }

  /** Track streamer profile visit for daily challenge */
  @Post('visit-streamer/:id')
  @UseGuards(JwtAuthGuard)
  async trackStreamerVisit(@Req() req: any, @Param('id') id: string) {
    const streamerId = parseInt(id, 10);
    if (isNaN(streamerId)) return { tracked: false };
    await this.streakService.recordDailyActivity(req.user.userId);
    await this.streakService.completeChallenge(req.user.userId, 'VISIT_STREAMER');
    return { tracked: true };
  }
}
