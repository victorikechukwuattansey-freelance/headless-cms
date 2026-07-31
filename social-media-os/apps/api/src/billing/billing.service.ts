import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly PLAN_LIMITS: Record<string, { postsPerMonth: number; accounts: number; users: number; aiGenerations: number }> = {
    FREE: { postsPerMonth: 30, accounts: 3, users: 1, aiGenerations: 50 },
    STARTER: { postsPerMonth: 100, accounts: 10, users: 3, aiGenerations: 500 },
    PRO: { postsPerMonth: 500, accounts: 25, users: 10, aiGenerations: 2000 },
    AGENCY: { postsPerMonth: 2000, accounts: 100, users: 50, aiGenerations: 10000 },
    ENTERPRISE: { postsPerMonth: -1, accounts: -1, users: -1, aiGenerations: -1 },
  };

  constructor(private prisma: PrismaService) {}

  async getPlan(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscriptions: true },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const subscription = org.subscriptions[0];
    const tier = org.subscriptionTier;
    const limits = this.PLAN_LIMITS[tier] || this.PLAN_LIMITS.FREE;

    return {
      tier,
      limits,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
    };
  }

  async getUsage(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });

    if (!org) throw new NotFoundException('Organization not found');

    const workspaces = await this.prisma.workspace.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const workspaceIds = workspaces.map((w) => w.id);

    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const [postsCount, accountsCount, membersCount, aiGenerations] = await Promise.all([
      this.prisma.post.count({
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: currentMonth },
        },
      }),
      this.prisma.socialAccount.count({
        where: {
          workspaceId: { in: workspaceIds },
          isActive: true,
        },
      }),
      this.prisma.workspaceMember.count({
        where: { workspaceId: { in: workspaceIds } },
      }),
      this.prisma.aIGeneration.count({
        where: {
          workspaceId: { in: workspaceIds },
          createdAt: { gte: currentMonth },
        },
      }),
    ]);

    return {
      period: {
        start: currentMonth,
        end: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0),
      },
      usage: {
        postsPublished: postsCount,
        accountsConnected: accountsCount,
        teamMembers: membersCount,
        aiGenerations,
      },
    };
  }

  async createCheckoutSession(orgId: string, tier: string) {
    const validTiers = ['STARTER', 'PRO', 'AGENCY', 'ENTERPRISE'];
    if (!validTiers.includes(tier)) {
      throw new BadRequestException(`Invalid tier. Must be one of: ${validTiers.join(', ')}`);
    }

    const org = await this.prisma.organization.findUnique({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');

    const priceMap: Record<string, number> = {
      STARTER: 2900,
      PRO: 9900,
      AGENCY: 29900,
      ENTERPRISE: 99900,
    };

    const amount = priceMap[tier];

    if (process.env.STRIPE_SECRET_KEY) {
      try {
        const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            'mode': 'subscription',
            'success_url': `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            'cancel_url': `${process.env.CORS_ORIGIN || 'http://localhost:3000'}/billing/cancel`,
            'client_reference_id': orgId,
            'line_items[0][price_data][currency]': 'usd',
            'line_items[0][price_data][product_data][name]': `Social Media OS - ${tier}`,
            'line_items[0][price_data][unit_amount]': amount.toString(),
            'line_items[0][price_data][recurring][interval]': 'month',
            'line_items[0][quantity]': '1',
          }),
        });

        const session = await stripeResponse.json();
        return { url: session.url, sessionId: session.id };
      } catch (error) {
        this.logger.warn('Stripe unavailable, falling back to direct update');
      }
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { subscriptionTier: tier as any },
    });

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.prisma.subscription.create({
      data: {
        organizationId: orgId,
        tier: tier as any,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
    });

    return { message: `Upgraded to ${tier}`, tier };
  }

  async getInvoices(orgId: string) {
    return this.prisma.invoice.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUsageRecords(orgId: string, feature?: string) {
    const where: Record<string, unknown> = { organizationId: orgId };
    if (feature) where.feature = feature;

    return this.prisma.usageRecord.findMany({
      where,
      orderBy: { periodStart: 'desc' },
      take: 100,
    });
  }

  async trackUsage(orgId: string, feature: string, quantity: number = 1) {
    const periodStart = new Date();
    periodStart.setDate(1);
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const existing = await this.prisma.usageRecord.findUnique({
      where: {
        organizationId_feature_periodStart: {
          organizationId: orgId,
          feature,
          periodStart,
        },
      },
    });

    if (existing) {
      return this.prisma.usageRecord.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    }

    return this.prisma.usageRecord.create({
      data: {
        organizationId: orgId,
        feature,
        quantity,
        periodStart,
        periodEnd,
      },
    });
  }
}
