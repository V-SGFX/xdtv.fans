import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsService } from './news.service';
import { NewsScraperService } from './news-scraper.service';

@Module({
  controllers: [NewsController],
  providers: [NewsService, NewsScraperService],
  exports: [NewsScraperService],
})
export class NewsModule {}
