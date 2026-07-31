import { PrismaClient } from "@prisma/client";
import type { User, Organization } from "@prisma/client";

export async function seedAuditLogs(
  prisma: PrismaClient,
  users: Record<string, User>,
  orgs: Record<string, Organization>,
) {
  console.log("\n── Audit Logs ──");

  const count = await prisma.auditLog.count();
  if (count > 0) {
    console.log("  ↳ Audit logs already exist");
    return;
  }

  const logs = [
    {
      org: orgs.acme,
      user: users.admin,
      action: "user.created",
      entity: "user",
      entityId: users.admin.id,
    },
    {
      org: orgs.acme,
      user: users.admin,
      action: "organization.created",
      entity: "organization",
      entityId: orgs.acme.id,
    },
    {
      org: orgs.acme,
      user: users.admin,
      action: "user.invited",
      entity: "membership",
      entityId: users.user.id,
    },
    {
      org: orgs.acme,
      user: users.user,
      action: "settings.updated",
      entity: "profile",
      entityId: users.user.id,
    },
    {
      org: orgs.acme,
      user: users.admin,
      action: "payment.processed",
      entity: "invoice",
      entityId: "in_001",
    },
    {
      org: orgs.acme,
      user: users.user,
      action: "api_key.created",
      entity: "api_key",
      entityId: "ak_001",
    },
  ];

  for (const log of logs) {
    await prisma.auditLog.create({
      data: {
        organizationId: log.org.id,
        userId: log.user.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
      },
    });
  }
  console.log(`  ✓ Created ${logs.length} audit log entries`);
}
