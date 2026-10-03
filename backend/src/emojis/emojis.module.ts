import { Module } from '@nestjs/common';
import { EmojisController } from './emojis.controller';
import { EmojisService } from './emojis.service';

@Module({
  controllers: [EmojisController],
  providers: [EmojisService],
  exports: [EmojisService],
})
export class EmojisModule {}
