import { Module } from '@nestjs/common';
import { PlatformSyncService } from './platform-sync.service';
import { ClipGrabberService } from './clip-grabber.service';

@Module({
  providers: [PlatformSyncService, ClipGrabberService],
  exports: [PlatformSyncService, ClipGrabberService],
})
export class PlatformSyncModule {}
