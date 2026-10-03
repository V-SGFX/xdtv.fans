import { Module } from '@nestjs/common';
import { ModerationController, ReportsController } from './moderation.controller';
import { ModerationService } from './moderation.service';

@Module({
  controllers: [ModerationController, ReportsController],
  providers: [ModerationService],
})
export class ModerationModule {}
