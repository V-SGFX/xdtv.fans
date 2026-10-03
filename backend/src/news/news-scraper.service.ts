import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import Parser from 'rss-parser';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NewsScraperService implements OnModuleInit {
  private readonly logger = new Logger(NewsScraperService.name);
  private parser = new Parser();
  private isEnabled = false;

  constructor(
    private prisma: PrismaService,
    private schedulerRegistry: SchedulerRegistry,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultSources();
    if (!this.isEnabled) {
      this.logger.log('Scraper is disabled, skipping startup scrape');
      return;
    }
    this.scrapeAll().catch((err) => this.logger.error('Startup scrape failed', err));
  }

  /**
   * Seed only if the table is empty.
   *
   * The previous defaults included dotesports.com/streaming/feed, which now
   * answers 403, and carried no category. Sources are curated in the database
   * (see the categorised set seeded alongside this change); this exists so a
   * fresh install is not left with nothing.
   */
  private async ensureDefaultSources() {
    const count = await this.prisma.rssSource.count();
    if (count === 0) {
      await this.prisma.rssSource.createMany({
        data: [
          { name: 'Dexerto — Twitch', url: 'https://www.dexerto.com/feed/category/twitch/', language: 'en', category: 'STREAMERS' },
          { name: 'Dexerto — Entertainment', url: 'https://www.dexerto.com/feed/category/entertainment/', language: 'en', category: 'DRAMA' },
          { name: 'Dexerto — Esports', url: 'https://www.dexerto.com/feed/category/esports/', language: 'en', category: 'EVENTS' },
          { name: 'Dexerto — Gaming', url: 'https://www.dexerto.com/feed/category/gaming/', language: 'en', category: 'GAMING' },
        ],
      });
      this.logger.log('Seeded default RSS sources');
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES, { name: 'news-scraper' })
  async scheduledScrape() {
    if (!this.isEnabled) {
      this.logger.log('Scraper is disabled, skipping scheduled run');
      return;
    }
    await this.scrapeAll();
  }

  async scrapeAll() {
    const sources = await this.prisma.rssSource.findMany({ where: { isActive: true } });
    this.logger.log(`Starting RSS scrape for ${sources.length} sources...`);

    for (const source of sources) {
      await this.scrapeSource(source);
    }

    this.logger.log('RSS scrape complete');
  }

  async scrapeSource(source: { id: number; name: string; url: string; language: string; category?: string }) {
    let addedCount = 0;
    try {
      const result = await this.parser.parseURL(source.url);
      for (const item of result.items.slice(0, 20)) {
        if (!item.link || !item.title) continue;

        const existing = await this.prisma.news.findUnique({
          where: { sourceUrl: item.link },
        });
        if (existing) continue;

        const raw = item.title;
        const rawSummary = item.contentSnippet?.slice(0, 500) || null;

        // Store both languages.
        //
        // The original is kept verbatim rather than being overwritten by the
        // translation, which is what used to happen — so an English feed
        // costs one translation call (into Polish) and a Polish feed costs one
        // (into English), never two, and the source wording is never lost.
        // Treść artykułu idzie przez tłumaczenie razem z tytułem i zajawką.
        // Bez tego czytelnik z angielskim interfejsem dostawał angielski
        // nagłówek i polski tekst pod nim — czyli dokładnie to, po co
        // w artykuł wchodzi, w niewłaściwym języku.
        const rawContent = item.content || null;

        let titlePl = raw;
        let summaryPl = rawSummary;
        let contentPl = rawContent;
        let titleEn: string | null = source.language === 'en' ? raw : null;
        let summaryEn: string | null = source.language === 'en' ? rawSummary : null;
        let contentEn: string | null = source.language === 'en' ? rawContent : null;

        try {
          if (source.language !== 'pl') {
            titlePl = (await this.translateText(raw, source.language, 'pl')) || raw;
            if (rawSummary) {
              summaryPl = (await this.translateText(rawSummary, source.language, 'pl')) || rawSummary;
            }
            if (rawContent) {
              contentPl = (await this.translateText(rawContent, source.language, 'pl')) || rawContent;
            }
          } else {
            titleEn = await this.translateText(raw, 'pl', 'en');
            if (rawSummary) summaryEn = await this.translateText(rawSummary, 'pl', 'en');
            if (rawContent) contentEn = await this.translateText(rawContent, 'pl', 'en');
          }
        } catch (err: any) {
          // A translation outage must not stop ingest — the article is stored
          // in whatever languages resolved.
          this.logger.warn(`Translation failed for "${raw}": ${err.message}`);
        }

        await this.prisma.news.create({
          data: {
            title: titlePl,
            summary: summaryPl,
            titleEn,
            summaryEn,
            category: (source.category as any) || 'GAMING',
            content: contentPl,
            contentEn,
            sourceUrl: item.link,
            source: 'RSS',
            sourceName: source.name,
            imageUrl: item.enclosure?.url || null,
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            isPublished: true,
          },
        });
        addedCount++;
        this.logger.log(`Added [${source.category ?? 'GAMING'}]: ${titlePl}`);
      }

      await this.prisma.rssSource.update({
        where: { id: source.id },
        data: {
          lastScrapedAt: new Date(),
          articlesCount: { increment: addedCount },
        },
      });
    } catch (err: any) {
      this.logger.error(`Error fetching ${source.url}:`, err.message);
    }
  }

  private async translateText(text: string, from: string, to: string): Promise<string | null> {
    try {
      const translate = (await import('google-translate-api-x')).default;
      const res = await translate(text, { from, to });
      return res.text || null;
    } catch (err: any) {
      this.logger.warn(`Google Translate error: ${err.message}`);
      return null;
    }
  }

  // ── Control methods for AdminJS ──

  getStatus() {
    return {
      isEnabled: this.isEnabled,
      cronName: 'news-scraper',
    };
  }

  enable() {
    this.isEnabled = true;
    this.logger.log('Scraper enabled');
  }

  disable() {
    this.isEnabled = false;
    this.logger.log('Scraper disabled');
  }

  async triggerNow() {
    this.logger.log('Manual scrape triggered');
    await this.scrapeAll();
    return { message: 'Scrape completed' };
  }
}
