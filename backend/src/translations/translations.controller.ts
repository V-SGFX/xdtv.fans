import { Controller, Get, Post, Param, Query, ParseIntPipe } from '@nestjs/common';
import { TranslationsService } from './translations.service';

@Controller('translations')
export class TranslationsController {
  constructor(private translationsService: TranslationsService) {}

  @Get('languages')
  getSupportedLanguages() {
    return this.translationsService.getSupportedLanguages();
  }

  @Get(':entityType/:entityId')
  getTranslations(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseIntPipe) entityId: number,
    @Query('lang') lang: string,
  ) {
    return this.translationsService.getTranslations(entityType, entityId, lang || 'en');
  }

  @Post(':entityType/:entityId/translate')
  translateEntity(
    @Param('entityType') entityType: string,
    @Param('entityId', ParseIntPipe) entityId: number,
    @Query('lang') lang: string,
    @Query('fields') fields: string,
  ) {
    const fieldList = (fields || 'title,content').split(',').map((f) => f.trim());
    return this.translationsService.translateEntity(entityType, entityId, fieldList, lang || 'en');
  }
}
