import { describe, it, expect } from "vitest";
import { prisma } from "@saas/database";

describe("database integration", () => {
  it("connects to the database", async () => {
    const count = await prisma.user.count();
    expect(typeof count).toBe("number");
  }, 15_000);
});
