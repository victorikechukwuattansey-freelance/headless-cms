import { PrismaClient, PlanTier, MembershipRole } from "@prisma/client";
import { findOrCreateOrg } from "./helpers";
import type { User } from "@prisma/client";

export async function seedOrganizations(prisma: PrismaClient, users: Record<string, User>) {
  console.log("\n── Organizations ──");

  const acme = await findOrCreateOrg(prisma, "acme-corp", {
    name: "Acme Corp",
    slug: "acme-corp",
    description: "A sample organization for testing",
    planTier: PlanTier.PRO,
    ownerId: users.admin.id,
    billingEmail: "admin@saas.com",
    memberships: {
      create: [
        { userId: users.admin.id, role: MembershipRole.OWNER },
        { userId: users.user.id, role: MembershipRole.MEMBER },
      ],
    },
  });

  const beta = await findOrCreateOrg(prisma, "beta-testers", {
    name: "Beta Testers Inc",
    slug: "beta-testers",
    description: "Beta testing organization",
    planTier: PlanTier.FREE,
    ownerId: users.jane.id,
    billingEmail: "jane@saas.com",
    memberships: {
      create: [
        { userId: users.jane.id, role: MembershipRole.OWNER },
        { userId: users.bob.id, role: MembershipRole.MEMBER },
      ],
    },
  });

  return { acme, beta };
}
