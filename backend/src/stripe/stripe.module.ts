import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  controllers: [StripeController, StripeWebhookController],
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
