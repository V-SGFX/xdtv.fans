import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { BullBoardService } from './bull-board.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get('REDIS_HOST', '127.0.0.1'),
          port: config.get('REDIS_PORT', 6379),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: {
            age: 3600 * 24, // 24 hours
            count: 1000,
          },
          removeOnFail: {
            age: 3600 * 24 * 7, // 7 days
          },
        },
      }),
    }),
  ],
  providers: [BullBoardService],
  exports: [BullModule, BullBoardService],
})
export class QueueModule {}
