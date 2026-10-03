import { Injectable, BadRequestException } from '@nestjs/common';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

const LIMITS = {
  avatar: { maxSize: 2 * 1024 * 1024, width: 256, height: 256 },
  banner: { maxSize: 5 * 1024 * 1024, width: 1200, height: 400 },
  post: { maxSize: 5 * 1024 * 1024, width: 1200, height: 1200 },
};

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

@Injectable()
export class UploadsService {
  async processUpload(
    file: { buffer: Buffer; mimetype: string; size: number },
    category: 'avatars' | 'posts' | 'banners',
  ): Promise<string> {
    if (!file) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, and GIF images are allowed');
    }

    const limitKey = category === 'avatars' ? 'avatar' : category === 'banners' ? 'banner' : 'post';
    const limit = LIMITS[limitKey];

    if (file.size > limit.maxSize) {
      throw new BadRequestException(`File too large. Max ${limit.maxSize / 1024 / 1024}MB`);
    }

    const dir = path.join(UPLOADS_DIR, category);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const hash = crypto.randomBytes(12).toString('hex');
    const filename = `${hash}.webp`;
    const filepath = path.join(dir, filename);

    await sharp(file.buffer)
      .resize(limit.width, limit.height, { fit: 'cover', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toFile(filepath);

    return `/uploads/${category}/${filename}`;
  }

  deleteFile(fileUrl: string): void {
    if (!fileUrl || !fileUrl.startsWith('/uploads/')) return;
    // Sanitize path traversal
    const sanitized = path.normalize(fileUrl).replace(/^(\.\.(\/|\\|$))+/, '');
    if (!sanitized.startsWith('/uploads/') && !sanitized.startsWith('uploads/')) return;
    const filepath = path.join(process.cwd(), sanitized);
    const uploadsRoot = path.resolve(UPLOADS_DIR);
    // Ensure resolved path stays within uploads directory
    if (!path.resolve(filepath).startsWith(uploadsRoot)) return;
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
}
