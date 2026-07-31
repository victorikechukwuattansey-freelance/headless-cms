import { PrismaClient } from "@prisma/client";
import type { User } from "@prisma/client";

export async function seedApiKeys(prisma: PrismaClient, users: Record<string, User>) {
  console.log("\n── API Keys ──");

  const count = await prisma.apiKey.count();
  if (count > 0) {
    console.log("  ↳ API keys already exist");
    return;
  }

  const keys = [
    { user: users.user, name: "Production", permissions: ["read", "write"] },
    { user: users.user, name: "Development", permissions: ["read"] },
  ];

  for (const k of keys) {
    await prisma.apiKey.create({
      data: {
        userId: k.user.id,
        name: k.name,
        key: `sk_${crypto.randomUUID().replace(/-/g, "")}`,
        keyPrefix: `sk_${k.name.slice(0, 4).toLowerCase()}`,
        permissions: k.permissions,
        ipWhitelist: [],
      },
    });
  }
  console.log(`  ✓ Created ${keys.length} API keys`);
}
