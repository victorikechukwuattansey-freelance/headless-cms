import { beforeAll, afterAll } from "vitest";
import { prisma } from "@saas/database";

beforeAll(async () => {
  // Ensure database connection
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});
