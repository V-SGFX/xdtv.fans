import { Module, forwardRef } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsService } from './posts.service';
import { TagsModule } from '../tags/tags.module';
import { FeedModule } from '../feed/feed.module';
import { EngagementModule } from '../engagement/engagement.module';

@Module({
  imports: [TagsModule, forwardRef(() => FeedModule), EngagementModule],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
