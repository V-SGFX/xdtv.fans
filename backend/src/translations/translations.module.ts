import { Module } from '@nestjs/common';
import { TranslationsController } from './translations.controller';
import { TranslationsService } from './translations.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [TranslationsController],
  providers: [TranslationsService],
  exports: [TranslationsService],
})
export class TranslationsModule {}
