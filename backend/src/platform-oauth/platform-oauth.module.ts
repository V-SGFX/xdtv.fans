import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PlatformOAuthController } from './platform-oauth.controller';
import { PlatformOAuthService } from './platform-oauth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [PlatformOAuthController],
  providers: [PlatformOAuthService],
  exports: [PlatformOAuthService],
})
export class PlatformOAuthModule {}
