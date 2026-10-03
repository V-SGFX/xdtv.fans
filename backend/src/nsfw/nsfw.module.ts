import { Module, Global } from '@nestjs/common';
import { NsfwService } from './nsfw.service';

@Global()
@Module({
  providers: [NsfwService],
  exports: [NsfwService],
})
export class NsfwModule {}
