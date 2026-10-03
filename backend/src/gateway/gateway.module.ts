import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { ChatSeedService } from './chat-seed.service';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmojisModule } from '../emojis/emojis.module';
import { ChannelsModule } from '../channels/channels.module';
import { EngagementModule } from '../engagement/engagement.module';
import { ShopModule } from '../shop/shop.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'change-me'),
      }),
    }),
    EmojisModule,
    ChannelsModule,
    EngagementModule,
    ShopModule,
  ],
  providers: [ChatGateway, ChatSeedService],
  exports: [ChatGateway, ChatSeedService],
})
export class ChatGatewayModule {}
