import { Injectable, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';

const ALLOWED_VIDEO_MIMES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
  'video/x-matroska', 'video/mpeg', 'video/3gpp',
];
const MAX_VIDEO_SIZE = 500 * 1024 * 1024; // 500MB

@Injectable()
export class YoutubeUploadService {
  private readonly logger = new Logger(YoutubeUploadService.name);

  private get clientId() { return process.env.GOOGLE_CLIENT_ID; }
  private get clientSecret() { return process.env.GOOGLE_CLIENT_SECRET; }
  private get refreshToken() { return process.env.YOUTUBE_UPLOAD_REFRESH_TOKEN; }

  private async getAccessToken(): Promise<string> {
    if (!this.refreshToken) {
      throw new InternalServerErrorException('YouTube upload not configured — missing YOUTUBE_UPLOAD_REFRESH_TOKEN');
    }

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId!,
        client_secret: this.clientSecret!,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    const data = await res.json();
    if (data.error) {
      this.logger.error(`YouTube token refresh failed: ${data.error} ${data.error_description}`);
      throw new InternalServerErrorException('YouTube authentication failed');
    }

    return data.access_token;
  }

  async uploadVideo(file: { buffer: Buffer; mimetype: string; originalname: string; size: number }, metadata: {
    title: string;
    description?: string;
    tags?: string[];
  }): Promise<{ videoId: string; videoUrl: string; thumbnailUrl: string }> {
    // Validate
    if (!file) throw new BadRequestException('No video file');
    if (!ALLOWED_VIDEO_MIMES.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid video format. Allowed: MP4, WebM, MOV, AVI, MKV, MPEG`);
    }
    if (file.size > MAX_VIDEO_SIZE) {
      throw new BadRequestException(`File too large. Max 500MB`);
    }

    const accessToken = await this.getAccessToken();

    // Step 1: Initialize resumable upload
    const snippet: any = {
      title: metadata.title.slice(0, 100),
      description: metadata.description?.slice(0, 5000) || `Clip z xdtv.fans — ${metadata.title}`,
      categoryId: '20', // Gaming
    };
    if (metadata.tags && metadata.tags.length > 0) {
      snippet.tags = metadata.tags.slice(0, 30);
    }

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(file.size),
          'X-Upload-Content-Type': file.mimetype,
        },
        body: JSON.stringify({
          snippet,
          status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
        }),
      },
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      this.logger.error(`YouTube upload init failed: ${initRes.status} ${err}`);
      throw new InternalServerErrorException('YouTube upload initialization failed');
    }

    const uploadUrl = initRes.headers.get('location');
    if (!uploadUrl) {
      throw new InternalServerErrorException('YouTube did not return upload URL');
    }

    // Step 2: Upload the video bytes
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.mimetype,
        'Content-Length': String(file.size),
      },
      body: new Uint8Array(file.buffer),
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      this.logger.error(`YouTube upload failed: ${uploadRes.status} ${err}`);
      throw new InternalServerErrorException('YouTube video upload failed');
    }

    const videoData = await uploadRes.json();
    const videoId = videoData.id;

    this.logger.log(`YouTube upload successful: ${videoId} (${metadata.title})`);

    return {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
}
