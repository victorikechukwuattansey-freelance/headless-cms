import { PrismaClient } from "@prisma/client";
import type { Organization } from "@prisma/client";

export async function seedBillingHistory(prisma: PrismaClient, orgs: Record<string, Organization>) {
  console.log("\n── Billing History ──");

  const count = await prisma.billingHistory.count();
  if (count > 0) {
    console.log("  ↳ Billing history already exists");
    return;
  }

  const events = [
    {
      org: orgs.acme,
      event: "subscription.created",
      amount: 2900,
      description: "Pro plan - Monthly",
    },
    { org: orgs.acme, event: "invoice.paid", amount: 2900, description: "Invoice paid" },
    { org: orgs.acme, event: "payment.succeeded", amount: 2900, description: "Payment collected" },
    { org: orgs.acme, event: "subscription.renewed", amount: 2900, description: "Auto-renewed" },
    { org: orgs.beta, event: "plan.downgraded", amount: 0, description: "Downgraded to Free" },
  ];

  for (const ev of events) {
    await prisma.billingHistory.create({
      data: {
        organizationId: ev.org.id,
        event: ev.event,
        amount: ev.amount,
        description: ev.description,
      },
    });
  }
  console.log(`  ✓ Created ${events.length} billing history entries`);
}
