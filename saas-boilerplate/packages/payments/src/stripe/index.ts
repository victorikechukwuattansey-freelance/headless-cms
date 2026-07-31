import Stripe from "stripe";
import {
  prisma,
  PlanTier,
  SubscriptionInterval,
  PaymentProvider,
  SubscriptionStatus,
} from "@saas/database";
import type { Prisma } from "@saas/database";
import { getEnv } from "@saas/config";

const env = getEnv();

export const stripe = new Stripe(env.STRIPE_SECRET_KEY ?? "sk_test_dummy", {
  apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
  typescript: true,
});

interface CheckoutParams {
  organizationId: string;
  priceId: string;
  planTier: PlanTier;
  interval: SubscriptionInterval;
  email: string;
  name?: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
}

export async function createStripeCheckout(params: CheckoutParams) {
  const {
    organizationId,
    priceId,
    planTier,
    interval,
    email,
    name,
    successUrl,
    cancelUrl,
    trialDays,
  } = params;

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
        provider: PaymentProvider.STRIPE,
        providerId: stripeCustomer.id,
        email,
        name,
      },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customer.providerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    subscription_data: {
      trial_period_days: trialDays,
      metadata: { organizationId, planTier, interval },
    },
    metadata: { organizationId, planTier, interval },
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return { url: session.url, sessionId: session.id };
}

export async function handleStripeWebhook(body: string, signature: string) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET not set");
  }

  const event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);

  await prisma.webhookEvent.create({
    data: {
      provider: PaymentProvider.STRIPE,
      eventType: event.type,
      payload: event.data.object as unknown as Prisma.InputJsonValue,
      status: "processing",
    },
  });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const organizationId = session.metadata?.organizationId;
      const planTier = session.metadata?.planTier as PlanTier;
      const interval = session.metadata?.interval as SubscriptionInterval;

      if (organizationId && planTier && interval && session.subscription) {
        await prisma.subscription.upsert({
          where: { providerId: session.subscription as string },
          update: {
            status: SubscriptionStatus.ACTIVE,
            planTier,
            interval,
            currentPeriodStart: new Date((session as any).current_period_start * 1000),
            currentPeriodEnd: new Date((session as any).current_period_end * 1000),
          },
          create: {
            organizationId,
            provider: PaymentProvider.STRIPE,
            providerId: session.subscription as string,
            status: SubscriptionStatus.ACTIVE,
            planTier,
            interval,
            currentPeriodStart: new Date((session as any).current_period_start * 1000),
            currentPeriodEnd: new Date((session as any).current_period_end * 1000),
          },
        });

        await prisma.organization.update({
          where: { id: organizationId },
          data: { planTier },
        });

        await prisma.billingHistory.create({
          data: {
            organizationId,
            event: "subscription_created",
            amount: session.amount_total ?? undefined,
            currency: session.currency ?? "usd",
            description: `${planTier} subscription (${interval})`,
          },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      const subscription = await prisma.subscription.findUnique({
        where: { providerId: subscriptionId },
      });

      if (subscription) {
        await prisma.invoice.create({
          data: {
            organizationId: subscription.organizationId,
            provider: PaymentProvider.STRIPE,
            providerId: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "paid",
            paidAt: new Date(),
            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null,
            invoiceUrl: invoice.hosted_invoice_url,
            receiptUrl: invoice.invoice_pdf,
          },
        });

        await prisma.billingHistory.create({
          data: {
            organizationId: subscription.organizationId,
            event: "invoice_paid",
            amount: invoice.amount_paid,
            currency: invoice.currency ?? "usd",
            description: `Invoice ${invoice.id} paid`,
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
        const mappedStatus = mapStripeStatus(updatedSub.status);
        await prisma.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: mappedStatus,
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
      await prisma.subscription.update({
        where: { providerId: deletedSub.id },
        data: { status: SubscriptionStatus.CANCELED, deletedAt: new Date() },
      });
      break;
    }
  }

  return { received: true };
}

export async function createStripeCustomerPortal(organizationId: string, returnUrl: string) {
  const customer = await prisma.customer.findFirst({
    where: { organizationId, provider: PaymentProvider.STRIPE },
  });

  if (!customer) throw new Error("No Stripe customer found");

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.providerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    active: SubscriptionStatus.ACTIVE,
    canceled: SubscriptionStatus.CANCELED,
    incomplete: SubscriptionStatus.INCOMPLETE,
    incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
    past_due: SubscriptionStatus.PAST_DUE,
    trialing: SubscriptionStatus.TRIALING,
    unpaid: SubscriptionStatus.UNPAID,
    paused: SubscriptionStatus.PAUSED,
  };
  return map[status] ?? SubscriptionStatus.ACTIVE;
}
