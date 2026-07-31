import { PrismaClient } from "@prisma/client";

export async function findOrCreateUser(
  prisma: PrismaClient,
  email: string,
  data: Parameters<typeof prisma.user.create>[0]["data"],
) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ↳ User already exists: ${email}`);
    return existing;
  }
  const user = await prisma.user.create({ data });
  console.log(`  ✓ Created user: ${email}`);
  return user;
}

export async function findOrCreateOrg(
  prisma: PrismaClient,
  slug: string,
  data: Parameters<typeof prisma.organization.create>[0]["data"],
) {
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) {
    console.log(`  ↳ Organization already exists: ${slug}`);
    return existing;
  }
  const org = await prisma.organization.create({ data });
  console.log(`  ✓ Created organization: ${org.name}`);
  return org;
}

export async function findOrCreateFlag(
  prisma: PrismaClient,
  key: string,
  data: Parameters<typeof prisma.featureFlag.create>[0]["data"],
) {
  const existing = await prisma.featureFlag.findUnique({ where: { key } });
  if (existing) {
    console.log(`  ↳ Feature flag already exists: ${key}`);
    return existing;
  }
  const flag = await prisma.featureFlag.create({ data });
  console.log(`  ✓ Created feature flag: ${key}`);
  return flag;
}
