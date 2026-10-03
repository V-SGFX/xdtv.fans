import { Controller, Get } from '@nestjs/common';
import { AdsService } from './ads.service';

@Controller('ads')
export class AdsController {
  constructor(private ads: AdsService) {}

  /**
   * GET /api/ads
   *
   * Jedno żądanie na wejście, wspólne dla wszystkich bloków. Osobny
   * endpoint na blok oznaczałby pięć żądań na każdej stronie po to, żeby
   * przenieść kilka kilobajtów tekstu.
   */
  @Get()
  slots() {
    return this.ads.activeSlots();
  }
}
