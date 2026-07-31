import { NextResponse, NextRequest } from "next/server";
import { auth } from "@saas/auth";
import { createStripeCheckout } from "@saas/payments/stripe";
import { prisma, SubscriptionInterval } from "@saas/database";
import { plans } from "@saas/config";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const plan = req.nextUrl.searchParams.get("plan");
  const interval = (req.nextUrl.searchParams.get("interval") ?? "monthly") as "monthly" | "yearly";

  if (!plan || !plans[plan as keyof typeof plans]) {
    return NextResponse.redirect(new URL("/billing?error=invalid-plan", req.url));
  }

  const org = await prisma.organization.findFirst({
    where: { memberships: { some: { userId: session.user.id } } },
  });

  if (!org) {
    return NextResponse.redirect(new URL("/billing?error=no-org", req.url));
  }

  const planConfig = plans[plan as keyof typeof plans];
  const amount = planConfig.price[interval];

  if (amount === 0) {
    await prisma.organization.update({
      where: { id: org.id },
      data: { planTier: plan.toUpperCase() as any },
    });
    return NextResponse.redirect(new URL("/billing?success=plan-updated", req.url));
  }

  const dbInterval =
    interval === "monthly" ? SubscriptionInterval.MONTHLY : SubscriptionInterval.YEARLY;

  const stripePriceId =
    process.env[`STRIPE_${plan.toUpperCase()}_PRICE_ID`] ?? `price_${plan}_${interval}`;

  const { url } = await createStripeCheckout({
    organizationId: org.id,
    priceId: stripePriceId,
    planTier: plan.toUpperCase() as any,
    interval: dbInterval,
    email: session.user.email!,
    name: session.user.name ?? undefined,
    successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?success=true`,
    cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/billing?canceled=true`,
    trialDays: 14,
  });

  return NextResponse.redirect(url!);
}
