import { PrismaClient, PaymentProvider } from "@prisma/client";
import type { Organization } from "@prisma/client";

export async function seedInvoices(prisma: PrismaClient, orgs: Record<string, Organization>) {
  console.log("\n── Invoices ──");

  const count = await prisma.invoice.count();
  if (count > 0) {
    console.log("  ↳ Invoices already exist");
    return;
  }

  const invoices = [
    {
      org: orgs.acme,
      amount: 2900,
      status: "paid",
      description: "Pro plan - Monthly",
      paidAt: daysAgo(25),
    },
    {
      org: orgs.acme,
      amount: 2900,
      status: "paid",
      description: "Pro plan - Monthly",
      paidAt: daysAgo(55),
    },
    {
      org: orgs.acme,
      amount: 2900,
      status: "paid",
      description: "Pro plan - Monthly",
      paidAt: daysAgo(85),
    },
    {
      org: orgs.acme,
      amount: 2900,
      status: "pending",
      description: "Pro plan - Monthly",
      paidAt: null,
    },
    {
      org: orgs.beta,
      amount: 0,
      status: "overdue",
      description: "Free plan - overage",
      paidAt: null,
    },
  ];

  for (const inv of invoices) {
    await prisma.invoice.create({
      data: {
        organizationId: inv.org.id,
        provider: PaymentProvider.STRIPE,
        providerId: `in_${crypto.randomUUID().slice(0, 8)}`,
        amount: inv.amount,
        status: inv.status,
        description: inv.description,
        paidAt: inv.paidAt,
      },
    });
  }
  console.log(`  ✓ Created ${invoices.length} invoices`);
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}
