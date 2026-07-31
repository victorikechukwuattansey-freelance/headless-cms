import {
  PrismaClient,
  PaymentProvider,
  SubscriptionStatus,
  PlanTier,
  SubscriptionInterval,
} from "@prisma/client";
import type { Organization } from "@prisma/client";

export async function seedSubscriptions(prisma: PrismaClient, orgs: Record<string, Organization>) {
  console.log("\n── Subscriptions ──");

  const existing = await prisma.subscription.findFirst({ where: { organizationId: orgs.acme.id } });
  if (existing) {
    console.log("  ↳ Subscriptions already exist");
    return;
  }

  await prisma.subscription.create({
    data: {
      organizationId: orgs.acme.id,
      provider: PaymentProvider.STRIPE,
      status: SubscriptionStatus.ACTIVE,
      planTier: PlanTier.PRO,
      interval: SubscriptionInterval.MONTHLY,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  console.log("  ✓ Created Pro subscription for Acme Corp");
}
