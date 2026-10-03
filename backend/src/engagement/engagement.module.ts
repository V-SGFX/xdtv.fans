import { Module } from '@nestjs/common';
import { EngagementController } from './engagement.controller';
import { XpService } from './xp.service';
import { StreakService } from './streak.service';

@Module({
  controllers: [EngagementController],
  providers: [XpService, StreakService],
  exports: [XpService, StreakService],
})
export class EngagementModule {}
