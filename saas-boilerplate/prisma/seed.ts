import { prisma } from "../packages/database/src/client";
import {
  seedUsers,
  seedOrganizations,
  seedSubscriptions,
  seedInvoices,
  seedNotifications,
  seedApiKeys,
  seedAuditLogs,
  seedFeatureFlags,
  seedBillingHistory,
  seedCoupons,
  seedAnnouncements,
} from "./seed/index";

async function main() {
  console.log("🌱 Starting seed...\n");

  const users = await seedUsers(prisma);
  const orgs = await seedOrganizations(prisma, users);
  await seedSubscriptions(prisma, orgs);
  await seedInvoices(prisma, orgs);
  await seedNotifications(prisma, users);
  await seedApiKeys(prisma, users);
  await seedAuditLogs(prisma, users, orgs);
  await seedBillingHistory(prisma, orgs);
  await seedCoupons(prisma, orgs);
  await seedAnnouncements(prisma, users);
  await seedFeatureFlags(prisma);

  console.log("\n✨ Seed completed!");
  console.log("   Admin: admin@saas.com / admin123");
  console.log("   User:  user@saas.com / user123");
  console.log("   Jane:  jane@saas.com / jane123");
  console.log("   Bob:   bob@saas.com / bob123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
