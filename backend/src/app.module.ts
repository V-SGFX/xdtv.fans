import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { QueueModule } from './queue/queue.module';
// import { MetricsModule } from './metrics/metrics.module'; // TEMPORARILY DISABLED - DI issue
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { StreamersModule } from './streamers/streamers.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { ChannelsModule } from './channels/channels.module';
import { MessagesModule } from './messages/messages.module';
import { FollowsModule } from './follows/follows.module';
import { PlatformOAuthModule } from './platform-oauth/platform-oauth.module';
import { PlatformSyncModule } from './platform-sync/platform-sync.module';
import { NewsModule } from './news/news.module';
import { AdminStatsModule } from './admin-stats/admin-stats.module';
import { StripeModule } from './stripe/stripe.module';
import { ChatGatewayModule } from './gateway/gateway.module';
import { AdminModule } from './admin/admin.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { ModerationModule } from './moderation/moderation.module';
import { TagsModule } from './tags/tags.module';
import { EmojisModule } from './emojis/emojis.module';
import { NsfwModule } from './nsfw/nsfw.module';
import { TranslationsModule } from './translations/translations.module';
import { CommunitiesModule } from './communities/communities.module';
import { FeedModule } from './feed/feed.module';
import { MailModule } from './mail/mail.module';
import { EngagementModule } from './engagement/engagement.module';
import { ShopModule } from './shop/shop.module';
import { HealthController } from './health.controller';
import { AdsModule } from './ads/ads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 300 }]),
    PrismaModule,
    RedisModule,
    QueueModule,
    // MetricsModule, // TEMPORARILY DISABLED - DI issue
    MailModule,
    AuthModule,
    UsersModule,
    StreamersModule,
    PostsModule,
    CommentsModule,
    ChannelsModule,
    MessagesModule,
    FollowsModule,
    NewsModule,
    AdminStatsModule,
    StripeModule,
    ChatGatewayModule,
    AdminModule,
    UploadsModule,
    NotificationsModule,
    SearchModule,
    ModerationModule,
    TagsModule,
    EmojisModule,
    NsfwModule,
    TranslationsModule,
    AdsModule,
    CommunitiesModule,
    FeedModule,
    PlatformOAuthModule,
    PlatformSyncModule,
    EngagementModule,
    ShopModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
