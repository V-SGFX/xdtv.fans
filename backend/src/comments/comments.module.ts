import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [EngagementModule],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
