import {
  prisma,
  PlanTier as PrismaPlanTier,
  SubscriptionInterval as PrismaInterval,
  PaymentProvider,
  SubscriptionStatus as PrismaStatus,
} from "@saas/database";
import { getEnv } from "@saas/config";
import type { BillingService } from "../../service";
import type {
  CheckoutOptions,
  CheckoutResult,
  Customer,
  Invoice,
  PlanTier,
  Subscription,
  SubscriptionInterval,
} from "../../types";

const env = getEnv();

export class LemonSqueezyAdapter implements BillingService {
  async createCheckoutSession(
    variantId: string,
    planTier: PlanTier,
    interval: SubscriptionInterval,
    organizationId: string,
    email: string,
    name?: string,
    opts?: CheckoutOptions,
  ): Promise<CheckoutResult> {
    if (!env.LEMON_SQUEEZY_API_KEY) {
      throw new Error("LEMON_SQUEEZY_API_KEY not set");
    }

    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LEMON_SQUEEZY_API_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            store_id: parseInt(env.LEMON_SQUEEZY_STORE_ID ?? "0"),
            variant_id: parseInt(variantId),
            checkout_data: {
              email,
              name,
              custom: {
                organization_id: organizationId,
                plan_tier: planTier,
                interval,
                ...opts?.metadata,
              },
            },
            success_url: opts?.successUrl ?? `${env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
            cancel_url: opts?.cancelUrl ?? `${env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
          },
        },
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`Lemon Squeezy checkout failed: ${JSON.stringify(result)}`);
    }

    return {
      url: result.data.attributes.url,
      sessionId: result.data.id,
    };
  }

  async createCustomerPortalLink(): Promise<string> {
    throw new Error("Lemon Squeezy customer portal not yet implemented");
  }

  async getSubscription(organizationId: string): Promise<Subscription | null> {
    const sub = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    if (!sub) return null;

    return {
      id: sub.id,
      organizationId: sub.organizationId,
      provider: sub.provider.toLowerCase() as any,
      providerId: sub.providerId,
      status: sub.status.toLowerCase() as any,
      planTier: sub.planTier.toLowerCase() as any,
      interval: sub.interval.toLowerCase() as any,
      quantity: sub.quantity,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialStart: sub.trialStart,
      trialEnd: sub.trialEnd,
      canceledAt: sub.canceledAt,
      canceledReason: sub.canceledReason,
      createdAt: sub.createdAt,
    };
  }

  async updateSubscription(): Promise<Subscription> {
    throw new Error(
      "Subscription update via API not yet implemented — use Lemon Squeezy dashboard",
    );
  }

  async cancelSubscription(_organizationId: string, _atPeriodEnd = true): Promise<void> {
    throw new Error("Subscription cancellation not yet implemented via Lemon Squeezy adapter");
  }

  async resumeSubscription(): Promise<Subscription> {
    throw new Error("Subscription resume not yet implemented via Lemon Squeezy adapter");
  }

  async getInvoices(organizationId: string): Promise<Invoice[]> {
    const invoices = await prisma.invoice.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return invoices.map((inv) => ({
      id: inv.id,
      organizationId: inv.organizationId,
      provider: inv.provider.toLowerCase() as any,
      providerId: inv.providerId,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      description: inv.description,
      paidAt: inv.paidAt,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      invoiceUrl: inv.invoiceUrl,
      receiptUrl: inv.receiptUrl,
      createdAt: inv.createdAt,
    }));
  }

  async getInvoice(invoiceId: string): Promise<Invoice> {
    const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!inv) throw new Error("Invoice not found");

    return {
      id: inv.id,
      organizationId: inv.organizationId,
      provider: inv.provider.toLowerCase() as any,
      providerId: inv.providerId,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      description: inv.description,
      paidAt: inv.paidAt,
      periodStart: inv.periodStart,
      periodEnd: inv.periodEnd,
      invoiceUrl: inv.invoiceUrl,
      receiptUrl: inv.receiptUrl,
      createdAt: inv.createdAt,
    };
  }

  async getOrCreateCustomer(
    organizationId: string,
    email: string,
    name?: string,
  ): Promise<Customer> {
    let customer = await prisma.customer.findUnique({
      where: { providerId: email },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          organizationId,
          provider: "LEMON_SQUEEZY" as any,
          providerId: email,
          email,
          name,
        },
      });
    }

    return {
      id: customer.id,
      organizationId: customer.organizationId,
      provider: customer.provider.toLowerCase() as any,
      providerId: customer.providerId,
      email: customer.email,
      name: customer.name,
    };
  }

  async handleWebhook(body: string, signature: string): Promise<{ received: boolean }> {
    if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
      throw new Error("LEMON_SQUEEZY_WEBHOOK_SECRET not set");
    }

    const crypto = await import("node:crypto");
    const hash = crypto
      .createHmac("sha256", env.LEMON_SQUEEZY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (hash !== signature) {
      throw new Error("Invalid webhook signature");
    }

    const event = JSON.parse(body);
    const eventName = event.meta?.event_name;
    const customData = event.data?.attributes?.custom_data ?? {};

    await prisma.webhookEvent.create({
      data: {
        provider: "LEMON_SQUEEZY" as any,
        eventType: eventName ?? "unknown",
        payload: event,
        status: "processing",
      },
    });

    const orgId = customData.organization_id as string;

    switch (eventName) {
      case "order_created": {
        const orderAttrs = event.data.attributes;
        const variantId = String(orderAttrs.variant_id ?? "");
        const planTier = this.inferPlanTier(variantId);
        const interval = this.inferInterval(variantId);

        if (orgId) {
          await prisma.subscription.upsert({
            where: { providerId: String(event.data.id) },
            update: { status: "ACTIVE" as any, planTier, interval },
            create: {
              organizationId: orgId,
              provider: "LEMON_SQUEEZY" as any,
              providerId: String(event.data.id),
              status: "ACTIVE" as any,
              planTier,
              interval,
              currentPeriodStart: new Date(),
              currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          await prisma.organization.update({
            where: { id: orgId },
            data: { planTier },
          });
        }
        break;
      }

      case "subscription_cancelled": {
        if (orgId) {
          await prisma.subscription.updateMany({
            where: { organizationId: orgId, provider: "LEMON_SQUEEZY" as any },
            data: { status: "CANCELED" as any, canceledAt: new Date() },
          });
        }
        break;
      }
    }

    return { received: true };
  }

  private inferPlanTier(variantId: string): PrismaPlanTier {
    const id = variantId.toLowerCase();
    if (id.includes("starter")) return PrismaPlanTier.STARTER;
    if (id.includes("pro")) return PrismaPlanTier.PRO;
    if (id.includes("business")) return PrismaPlanTier.BUSINESS;
    return PrismaPlanTier.FREE;
  }

  private inferInterval(variantId: string): PrismaInterval {
    return variantId.toLowerCase().includes("year")
      ? PrismaInterval.YEARLY
      : PrismaInterval.MONTHLY;
  }
}
