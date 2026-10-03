import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminStatsService } from './admin-stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('moderation')
export class AdminStatsController {
  constructor(private adminStatsService: AdminStatsService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getStats() {
    return this.adminStatsService.getStats();
  }
}
