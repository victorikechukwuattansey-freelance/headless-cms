import { PrismaClient } from "@prisma/client";
import { findOrCreateFlag } from "./helpers";

export async function seedFeatureFlags(prisma: PrismaClient) {
  console.log("\n── Feature Flags ──");

  const flags = [
    { key: "ai-features", name: "AI Features", description: "Enable AI-powered features" },
    {
      key: "advanced-analytics",
      name: "Advanced Analytics",
      description: "Enable advanced analytics dashboard",
    },
    {
      key: "team-collaboration",
      name: "Team Collaboration",
      description: "Enable team collaboration features",
    },
    { key: "api-access", name: "API Access", description: "Enable REST API access" },
    { key: "white-label", name: "White Label", description: "Enable white labeling" },
  ];

  for (const flag of flags) {
    await findOrCreateFlag(prisma, flag.key, {
      ...flag,
      enabled: true,
      environment: "development",
    });
  }
}
