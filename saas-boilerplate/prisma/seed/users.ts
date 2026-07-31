import { PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import { findOrCreateUser } from "./helpers";

export async function seedUsers(prisma: PrismaClient) {
  console.log("\n── Users ──");

  const admin = await findOrCreateUser(prisma, "admin@saas.com", {
    email: "admin@saas.com",
    name: "Admin User",
    passwordHash: await hash("admin123", 12),
    role: UserRole.SUPER_ADMIN,
    emailVerified: new Date(),
    profile: {
      create: { bio: "System administrator", timezone: "UTC", language: "en", theme: "dark" },
    },
  });

  const user = await findOrCreateUser(prisma, "user@saas.com", {
    email: "user@saas.com",
    name: "Test User",
    passwordHash: await hash("user123", 12),
    role: UserRole.USER,
    emailVerified: new Date(),
    profile: {
      create: {
        bio: "Test user account",
        timezone: "America/New_York",
        language: "en",
        theme: "system",
      },
    },
  });

  const jane = await findOrCreateUser(prisma, "jane@saas.com", {
    email: "jane@saas.com",
    name: "Jane Developer",
    passwordHash: await hash("jane123", 12),
    role: UserRole.ADMIN,
    emailVerified: new Date(),
    profile: {
      create: {
        bio: "Developer and team admin",
        timezone: "Europe/London",
        language: "en",
        theme: "light",
      },
    },
  });

  const bob = await findOrCreateUser(prisma, "bob@saas.com", {
    email: "bob@saas.com",
    name: "Bob Tester",
    passwordHash: await hash("bob123", 12),
    role: UserRole.USER,
    emailVerified: new Date(),
    profile: {
      create: { bio: "QA engineer", timezone: "Asia/Tokyo", language: "ja", theme: "system" },
    },
  });

  return { admin, user, jane, bob };
}
