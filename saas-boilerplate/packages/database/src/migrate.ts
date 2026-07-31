import { prisma } from "./client";

export async function migrate() {
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS citext`);
  console.log("✅ Database extensions created");
}

export default migrate;
