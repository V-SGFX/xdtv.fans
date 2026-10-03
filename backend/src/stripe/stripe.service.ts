import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class StripeService {
  private stripe: Stripe | null = null;
  private readonly logger = new Logger(StripeService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {
    const key = this.config.get('STRIPE_SECRET_KEY', '');
    if (key) {
      this.stripe = new Stripe(key, {
        apiVersion: '2025-03-31.basil' as any,
      });
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set – Stripe features disabled');
    }
  }

  private ensureStripe(): Stripe {
    if (!this.stripe) throw new BadRequestException('Stripe is not configured');
    return this.stripe;
  }

  async getOrCreateCustomer(userId: number): Promise<string> {
    const stripe = this.ensureStripe();
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    // @ts-ignore - stripeCustomerId field planned for schema
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customer = await stripe.customers.create({
      email: user.email,
      metadata: { userId: String(userId) },
    });

    await this.prisma.user.update({
      where: { id: userId },
      // @ts-ignore - stripeCustomerId field planned for schema
      data: { stripeCustomerId: customer.id },
    });

    return customer.id;
  }

  async createCheckoutSession(userId: number, streamerProfileId: number, tier: number) {
    const profile = await this.prisma.streamerProfile.findUnique({ where: { id: streamerProfileId } });
    if (!profile) throw new NotFoundException('Streamer not found');

    const existing = await this.prisma.subscription.findUnique({
      where: { userId_streamerProfileId: { userId, streamerProfileId } },
    });
    if (existing && existing.status === 'ACTIVE') {
      throw new BadRequestException('Already subscribed to this streamer');
    }

    const customerId = await this.getOrCreateCustomer(userId);

    const priceMap: Record<number, string> = {
      1: this.config.get('STRIPE_PRICE_TIER1', ''),
      2: this.config.get('STRIPE_PRICE_TIER2', ''),
      3: this.config.get('STRIPE_PRICE_TIER3', ''),
    };
    const priceId = priceMap[tier];
    if (!priceId) throw new BadRequestException('Invalid subscription tier');

    const session = await this.ensureStripe().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${this.config.get('CORS_ORIGIN', 'http://localhost:3002').split(',')[0]}/streamers/${profile.slug}?subscribed=true`,
      cancel_url: `${this.config.get('CORS_ORIGIN', 'http://localhost:3002').split(',')[0]}/streamers/${profile.slug}`,
      metadata: {
        userId: String(userId),
        streamerProfileId: String(streamerProfileId),
        tier: String(tier),
      },
    });

    return { url: session.url, sessionId: session.id };
  }

  async createPortalSession(userId: number) {
    const customerId = await this.getOrCreateCustomer(userId);
    const session = await this.ensureStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${this.config.get('CORS_ORIGIN', 'http://localhost:3002').split(',')[0]}/profile`,
    });
    return { url: session.url };
  }

  async getMySubscriptions(userId: number) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: {
        streamerProfile: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async handleWebhook(signature: string, rawBody: Buffer) {
    const webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET', '');
    let event: Stripe.Event;
    try {
      event = this.ensureStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (err: any) {
      this.logger.error('Webhook signature verification failed:', err.message);
      throw new BadRequestException('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as any);
        break;
      default:
        this.logger.debug(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutComplete(session: any) {
    const userId = parseInt(session.metadata?.userId || '0');
    const streamerProfileId = parseInt(session.metadata?.streamerProfileId || '0');
    const tier = parseInt(session.metadata?.tier || '1');
    if (!userId || !streamerProfileId) return;

    await this.prisma.subscription.upsert({
      where: { userId_streamerProfileId: { userId, streamerProfileId } },
      create: {
        userId,
        streamerProfileId,
        stripeSubscriptionId: session.subscription,
        stripePriceId: session.metadata?.priceId,
        tier,
        status: 'ACTIVE',
      },
      update: {
        stripeSubscriptionId: session.subscription,
        status: 'ACTIVE',
        tier,
      },
    });

    await this.redis.del('admin:platform_stats');
    this.logger.log(`Subscription created: user ${userId} -> streamer ${streamerProfileId} tier ${tier}`);
  }

  private async handleSubscriptionUpdate(subscription: any) {
    const dbSub = await this.prisma.subscription.findUnique({
      // @ts-ignore - stripeSubscriptionId field planned for schema
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!dbSub) return;

    const statusMap: Record<string, string> = {
      active: 'ACTIVE',
      past_due: 'PAST_DUE',
      canceled: 'CANCELLED',
      unpaid: 'EXPIRED',
    };

    await this.prisma.subscription.update({
      where: { id: dbSub.id },
      data: {
        status: (statusMap[subscription.status] || 'ACTIVE') as any,
        expiresAt: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
      },
    });
  }

  private async handleSubscriptionDeleted(subscription: any) {
    const dbSub = await this.prisma.subscription.findUnique({
      // @ts-ignore - stripeSubscriptionId field planned for schema
      where: { stripeSubscriptionId: subscription.id },
    });
    if (!dbSub) return;

    await this.prisma.subscription.update({
      where: { id: dbSub.id },
      data: { status: 'CANCELLED' },
    });

    await this.redis.del('admin:platform_stats');
    this.logger.log(`Subscription cancelled: ${subscription.id}`);
  }

  private async handlePaymentFailed(invoice: any) {
    const subId = invoice.subscription;
    if (!subId) return;

    const dbSub = await this.prisma.subscription.findUnique({
      // @ts-ignore - stripeSubscriptionId field planned for schema
      where: { stripeSubscriptionId: subId },
    });
    if (!dbSub) return;

    await this.prisma.subscription.update({
      where: { id: dbSub.id },
      // @ts-ignore - PAST_DUE status planned for schema
      data: { status: 'PAST_DUE' },
    });

    this.logger.warn(`Payment failed for subscription: ${subId}`);
  }
}
