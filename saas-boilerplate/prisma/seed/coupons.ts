import { PrismaClient } from "@prisma/client";
import type { Organization } from "@prisma/client";

export async function seedCoupons(prisma: PrismaClient, orgs: Record<string, Organization>) {
  console.log("\n── Coupons ──");

  const count = await prisma.coupon.count();
  if (count > 0) {
    console.log("  ↳ Coupons already exist");
    return;
  }

  await prisma.coupon.create({
    data: {
      code: "LAUNCH20",
      description: "20% off any plan - launch special",
      discountPercent: 20,
      maxRedemptions: 100,
      usedCount: 5,
      startsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.coupon.create({
    data: {
      code: "TEAM50",
      description: "50% off for team plans",
      discountPercent: 50,
      maxRedemptions: 50,
      usedCount: 0,
      organizationId: orgs.acme.id,
      startsAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  console.log("  ✓ Created 2 coupons");
}
