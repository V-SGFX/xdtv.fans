import {
  Controller, Post, UseGuards, UseInterceptors,
  UploadedFile, UploadedFiles, Param, Req, Body, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UploadsService } from './uploads.service';
import { YoutubeUploadService } from './youtube-upload.service';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB
const MAX_FILES = 10;

@Controller('uploads')
export class UploadsController {
  constructor(
    private uploadsService: UploadsService,
    private youtubeUploadService: YoutubeUploadService,
  ) {}

  @Post('youtube-clip')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_VIDEO_SIZE },
    }),
  )
  async uploadYoutubeClip(
    @UploadedFile() file: any,
    @Body('title') title: string,
    @Body('description') description: string,
    @Body('tags') tags: string,
    @Req() req,
  ) {
    if (!file) throw new BadRequestException('No video file uploaded');
    if (!title?.trim()) throw new BadRequestException('Title is required');

    const parsedTags = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

    const result = await this.youtubeUploadService.uploadVideo(file, {
      title: title.trim(),
      description: description?.trim(),
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    });

    return result;
  }

  @Post(':category')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async upload(
    @UploadedFile() file: any,
    @Param('category') category: string,
    @Req() req,
  ) {
    const allowed = ['avatars', 'posts', 'banners'];
    if (!allowed.includes(category)) {
      throw new BadRequestException(`Invalid category. Allowed: ${allowed.join(', ')}`);
    }

    const url = await this.uploadsService.processUpload(
      file,
      category as 'avatars' | 'posts' | 'banners',
    );

    return { url };
  }

  @Post(':category/batch')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      limits: { fileSize: MAX_FILE_SIZE },
    }),
  )
  async uploadBatch(
    @UploadedFiles() files: any[],
    @Param('category') category: string,
    @Req() req,
  ) {
    const allowed = ['posts'];
    if (!allowed.includes(category)) {
      throw new BadRequestException(`Batch upload only allowed for: ${allowed.join(', ')}`);
    }
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }
    if (files.length > MAX_FILES) {
      throw new BadRequestException(`Max ${MAX_FILES} files allowed`);
    }

    const urls = await Promise.all(
      files.map((file) =>
        this.uploadsService.processUpload(file, category as 'avatars' | 'posts' | 'banners'),
      ),
    );

    return { urls };
  }
}
