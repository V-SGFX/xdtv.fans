import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subscriptions')
export class StripeController {
  constructor(private stripeService: StripeService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(@Body() body: any, @Req() req: any) {
    return this.stripeService.createCheckoutSession(req.user.userId, body.streamerProfileId, body.tier || 1);
  }

  @Post('portal')
  @UseGuards(JwtAuthGuard)
  createPortal(@Req() req: any) {
    return this.stripeService.createPortalSession(req.user.userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMySubscriptions(@Req() req: any) {
    return this.stripeService.getMySubscriptions(req.user.userId);
  }
}
