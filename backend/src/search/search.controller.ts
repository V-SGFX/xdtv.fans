import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  search(@Query('q') q: string, @Query('limit') limit = 10) {
    return this.searchService.search(q, Math.min(20, Math.max(1, limit)));
  }
}
