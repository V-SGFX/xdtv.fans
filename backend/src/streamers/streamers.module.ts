import { Module } from '@nestjs/common';
import { StreamersController } from './streamers.controller';
import { StreamersService } from './streamers.service';
import { FeedModule } from '../feed/feed.module';

@Module({
  imports: [FeedModule],
  controllers: [StreamersController],
  providers: [StreamersService],
  exports: [StreamersService],
})
export class StreamersModule {}
