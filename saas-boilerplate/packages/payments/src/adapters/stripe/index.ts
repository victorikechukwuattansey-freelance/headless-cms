import Stripe from "stripe";
import { prisma } from "@saas/database";
import { getEnv } from "@saas/config";
import { stripe } from "../../stripe";
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
import { CustomerNotFoundError } from "../../types";

const env = getEnv();

const mapStatus: Record<string, string> = {
  active: "active",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "incomplete_expired",
  past_due: "past_due",
  trialing: "trialing",
  unpaid: "unpaid",
  paused: "paused",
};

export class StripeBillingAdapter implements BillingService {
  async createCheckoutSession(
    priceId: string,
    planTier: PlanTier,
    interval: SubscriptionInterval,
    organizationId: string,
    email: string,
    name?: string,
    opts?: CheckoutOptions,
  ): Promise<CheckoutResult> {
    const customer = await this.getOrCreateCustomer(organizationId, email, name);

    const session = await stripe.checkout.sessions.create({
      customer: customer.providerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: opts?.trialDays,
        metadata: { organizationId, planTier, interval },
      },
      metadata: { organizationId, planTier, interval, ...opts?.metadata },
      success_url: opts?.successUrl ?? `${env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
      cancel_url: opts?.cancelUrl ?? `${env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
    });

    return { url: session.url!, sessionId: session.id };
  }

  async createCustomerPortalLink(organizationId: string, returnUrl: string): Promise<string> {
    const customer = await prisma.customer.findFirst({
      where: { organizationId, provider: "STRIPE" as any },
    });

    if (!customer) throw new CustomerNotFoundError();

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.providerId,
      return_url: returnUrl,
    });

    return session.url;
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
    throw new Error("Subscription update via API not yet implemented — use customer portal");
  }

  async cancelSubscription(organizationId: string, atPeriodEnd = true): Promise<void> {
    const sub = await prisma.subscription.findFirst({
      where: { organizationId, provider: "STRIPE" as any },
      orderBy: { createdAt: "desc" },
    });

    if (!sub?.providerId) throw new Error("No active Stripe subscription found");

    await stripe.subscriptions.update(sub.providerId, {
      cancel_at_period_end: atPeriodEnd,
    });

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { canceledAt: new Date() },
    });
  }

  async resumeSubscription(_organizationId: string): Promise<Subscription> {
    throw new Error("Subscription resume via API not yet implemented — use customer portal");
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
      const stripeCustomer = await stripe.customers.create({
        email,
        name,
        metadata: { organizationId },
      });

      customer = await prisma.customer.create({
        data: {
          organizationId,
          provider: "STRIPE" as any,
          providerId: stripeCustomer.id,
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
    const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET!);

    await prisma.webhookEvent.create({
      data: {
        provider: "STRIPE" as any,
        eventType: event.type,
        payload: event.data.object as any,
        status: "processing",
      },
    });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.organizationId;
        const planTier = session.metadata?.planTier as any;
        const interval = session.metadata?.interval as any;

        if (orgId && planTier && interval && session.subscription) {
          await prisma.subscription.upsert({
            where: { providerId: session.subscription as string },
            update: {
              status: "ACTIVE" as any,
              planTier,
              interval,
              currentPeriodStart: new Date((session as any).current_period_start * 1000),
              currentPeriodEnd: new Date((session as any).current_period_end * 1000),
            },
            create: {
              organizationId: orgId,
              provider: "STRIPE" as any,
              providerId: session.subscription as string,
              status: "ACTIVE" as any,
              planTier,
              interval,
              currentPeriodStart: new Date((session as any).current_period_start * 1000),
              currentPeriodEnd: new Date((session as any).current_period_end * 1000),
            },
          });

          await prisma.organization.update({
            where: { id: orgId },
            data: { planTier },
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = invoice.subscription as string;
        const sub = await prisma.subscription.findUnique({ where: { providerId: subId } });

        if (sub) {
          await prisma.invoice.create({
            data: {
              organizationId: sub.organizationId,
              provider: "STRIPE" as any,
              providerId: invoice.id,
              amount: invoice.amount_paid,
              currency: invoice.currency ?? "usd",
              status: "paid",
              paidAt: new Date(),
              periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
              periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
              invoiceUrl: invoice.hosted_invoice_url ?? undefined,
              receiptUrl: invoice.invoice_pdf ?? undefined,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const updatedSub = event.data.object as Stripe.Subscription;
        const existingSub = await prisma.subscription.findUnique({
          where: { providerId: updatedSub.id },
        });
        if (existingSub) {
          await prisma.subscription.update({
            where: { id: existingSub.id },
            data: {
              status: (mapStatus[updatedSub.status] ?? "ACTIVE") as any,
              currentPeriodStart: updatedSub.current_period_start
                ? new Date(updatedSub.current_period_start * 1000)
                : undefined,
              currentPeriodEnd: updatedSub.current_period_end
                ? new Date(updatedSub.current_period_end * 1000)
                : undefined,
              canceledAt: updatedSub.canceled_at ? new Date(updatedSub.canceled_at * 1000) : null,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const deletedSub = event.data.object as Stripe.Subscription;
        await prisma.subscription.updateMany({
          where: { providerId: deletedSub.id },
          data: { status: "CANCELED" as any, deletedAt: new Date() },
        });
        break;
      }
    }

    return { received: true };
  }
}
