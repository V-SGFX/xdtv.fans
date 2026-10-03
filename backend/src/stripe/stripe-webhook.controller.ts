import { Controller, Post, Headers, Req } from '@nestjs/common';
import { StripeService } from './stripe.service';

@Controller('webhooks')
export class StripeWebhookController {
  constructor(private stripeService: StripeService) {}

  @Post('stripe')
  async handleWebhook(@Headers('stripe-signature') signature: string, @Req() req: any) {
    await this.stripeService.handleWebhook(signature, req.rawBody);
    return { received: true };
  }
}
