import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

const LIBRETRANSLATE_URL = process.env.LIBRETRANSLATE_URL || 'http://localhost:5000';
const SUPPORTED_LANGS = ['en', 'de', 'es', 'fr', 'uk', 'ru', 'pt', 'it'];

@Injectable()
export class TranslationsService {
  private readonly logger = new Logger(TranslationsService.name);

  constructor(private prisma: PrismaService, private redis: RedisService) {}

  async translate(entityType: string, entityId: number, fieldName: string, targetLang: string): Promise<string | null> {
    if (!SUPPORTED_LANGS.includes(targetLang)) return null;

    // Check cache
    const cacheKey = `trans:${entityType}:${entityId}:${fieldName}:${targetLang}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    // Check DB
    const existing = await this.prisma.translation.findUnique({
      where: { entityType_entityId_fieldName_targetLang: { entityType, entityId, fieldName, targetLang } },
    });
    if (existing) {
      await this.redis.set(cacheKey, existing.translatedText, 3600);
      return existing.translatedText;
    }

    // Fetch source text
    const sourceText = await this.getSourceText(entityType, entityId, fieldName);
    if (!sourceText) return null;

    // Call LibreTranslate
    const translated = await this.callLibreTranslate(sourceText, 'pl', targetLang);
    if (!translated) return null;

    // Store
    await this.prisma.translation.upsert({
      where: { entityType_entityId_fieldName_targetLang: { entityType, entityId, fieldName, targetLang } },
      create: { entityType, entityId, fieldName, targetLang, translatedText: translated },
      update: { translatedText: translated },
    });
    await this.redis.set(cacheKey, translated, 3600);

    return translated;
  }

  async getTranslations(entityType: string, entityId: number, targetLang: string) {
    const translations = await this.prisma.translation.findMany({
      where: { entityType, entityId, targetLang },
    });
    const map: Record<string, string> = {};
    for (const t of translations) {
      map[t.fieldName] = t.translatedText;
    }
    return map;
  }

  async translateEntity(entityType: string, entityId: number, fields: string[], targetLang: string) {
    const results: Record<string, string | null> = {};
    for (const field of fields) {
      results[field] = await this.translate(entityType, entityId, field, targetLang);
    }
    return results;
  }

  getSupportedLanguages() {
    return [
      { code: 'pl', name: 'Polski', native: 'Polski' },
      { code: 'en', name: 'English', native: 'English' },
      { code: 'de', name: 'German', native: 'Deutsch' },
      { code: 'es', name: 'Spanish', native: 'Español' },
      { code: 'fr', name: 'French', native: 'Français' },
      { code: 'uk', name: 'Ukrainian', native: 'Українська' },
      { code: 'ru', name: 'Russian', native: 'Русский' },
      { code: 'pt', name: 'Portuguese', native: 'Português' },
      { code: 'it', name: 'Italian', native: 'Italiano' },
    ];
  }

  private async getSourceText(entityType: string, entityId: number, fieldName: string): Promise<string | null> {
    switch (entityType) {
      case 'post': {
        const post = await this.prisma.post.findUnique({ where: { id: entityId }, select: { title: true, content: true } });
        return post?.[fieldName as keyof typeof post] as string || null;
      }
      case 'clip': {
        const clip = await this.prisma.post.findUnique({ where: { id: entityId }, select: { title: true, content: true } });
        return clip?.[fieldName as keyof typeof clip] as string || null;
      }
      case 'news': {
        const news = await this.prisma.news.findUnique({ where: { id: entityId }, select: { title: true, summary: true, content: true } });
        return news?.[fieldName as keyof typeof news] as string || null;
      }
      default:
        return null;
    }
  }

  private async callLibreTranslate(text: string, source: string, target: string): Promise<string | null> {
    try {
      const res = await fetch(`${LIBRETRANSLATE_URL}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text.slice(0, 5000), source, target, format: 'text' }),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        this.logger.warn(`LibreTranslate returned ${res.status}`);
        return null;
      }
      const data = await res.json();
      return data.translatedText || null;
    } catch (err) {
      this.logger.warn(`LibreTranslate error: ${err}`);
      return null;
    }
  }
}
