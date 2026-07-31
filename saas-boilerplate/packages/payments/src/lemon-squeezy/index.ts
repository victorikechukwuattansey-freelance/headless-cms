import {
  prisma,
  PlanTier,
  SubscriptionInterval,
  PaymentProvider,
  SubscriptionStatus,
} from "@saas/database";
import { getEnv } from "@saas/config";

const env = getEnv();

interface LemonSqueezyCheckoutParams {
  organizationId: string;
  variantId: string;
  planTier: PlanTier;
  interval: SubscriptionInterval;
  email: string;
  name?: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createLemonSqueezyCheckout(params: LemonSqueezyCheckoutParams) {
  const { organizationId, variantId, planTier, interval, email, name, successUrl, cancelUrl } =
    params;

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
            },
          },
          success_url: successUrl,
          cancel_url: cancelUrl,
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
    checkoutId: result.data.id,
  };
}

export async function handleLemonSqueezyWebhook(body: string, signature: string) {
  if (!env.LEMON_SQUEEZY_WEBHOOK_SECRET) {
    throw new Error("LEMON_SQUEEZY_WEBHOOK_SECRET not set");
  }

  const secret = env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  const crypto = await import("crypto");
  const hash = crypto.createHmac("sha256", secret).update(body).digest("hex");

  if (hash !== signature) {
    throw new Error("Invalid webhook signature");
  }

  const event = JSON.parse(body);
  const eventName = event.meta?.event_name;
  const customData = event.data?.attributes?.custom_data ?? {};

  await prisma.webhookEvent.create({
    data: {
      provider: PaymentProvider.LEMON_SQUEEZY,
      eventType: eventName,
      payload: event,
      status: "processing",
    },
  });

  const organizationId = customData.organization_id as string;

  switch (eventName) {
    case "order_created": {
      const orderAttrs = event.data.attributes;
      const variantId = String(orderAttrs.variant_id ?? "");

      const planTier = inferPlanTierFromVariant(variantId);
      const interval = inferIntervalFromVariant(variantId);

      if (organizationId) {
        await prisma.subscription.upsert({
          where: { providerId: String(event.data.id) },
          update: { status: SubscriptionStatus.ACTIVE, planTier, interval },
          create: {
            organizationId,
            provider: PaymentProvider.LEMON_SQUEEZY,
            providerId: String(event.data.id),
            status: SubscriptionStatus.ACTIVE,
            planTier,
            interval,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });

        await prisma.organization.update({
          where: { id: organizationId },
          data: { planTier },
        });
      }
      break;
    }

    case "subscription_cancelled": {
      if (organizationId) {
        await prisma.subscription.updateMany({
          where: { organizationId, provider: PaymentProvider.LEMON_SQUEEZY },
          data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
        });
      }
      break;
    }
  }

  return { received: true };
}

function inferPlanTierFromVariant(variantId: string): PlanTier {
  if (variantId.includes("starter")) return PlanTier.STARTER;
  if (variantId.includes("pro")) return PlanTier.PRO;
  if (variantId.includes("business")) return PlanTier.BUSINESS;
  return PlanTier.FREE;
}

function inferIntervalFromVariant(variantId: string): SubscriptionInterval {
  if (variantId.includes("year")) return SubscriptionInterval.YEARLY;
  return SubscriptionInterval.MONTHLY;
}

export const lemonSqueezy = {};
