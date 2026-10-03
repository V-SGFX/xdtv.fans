import { Controller, Get, Post, Body, Param, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('shop')
export class ShopController {
  constructor(private shopService: ShopService) {}

  /** Get full shop catalog */
  @Get('catalog')
  getCatalog() {
    return this.shopService.getCatalog();
  }

  /** Get current user's cosmetics */
  @Get('my-cosmetics')
  @UseGuards(JwtAuthGuard)
  getMyCosmetics(@Req() req: any) {
    return this.shopService.getUserCosmetics(req.user.userId);
  }

  /** Get a user's active cosmetics (public — for chat rendering) */
  @Get('cosmetics/:userId')
  getActiveCosmetics(@Param('userId', ParseIntPipe) userId: number) {
    return this.shopService.getActiveCosmetics(userId);
  }

  /** Purchase an item */
  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  purchase(@Body() body: { itemId: string }, @Req() req: any) {
    return this.shopService.purchase(req.user.userId, body.itemId);
  }

  /** Toggle cosmetic on/off */
  @Post('toggle/:id')
  @UseGuards(JwtAuthGuard)
  toggle(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.shopService.toggleCosmetic(req.user.userId, id);
  }
}
