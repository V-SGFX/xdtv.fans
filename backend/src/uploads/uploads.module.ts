import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { YoutubeUploadService } from './youtube-upload.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService, YoutubeUploadService],
  exports: [UploadsService, YoutubeUploadService],
})
export class UploadsModule {}
