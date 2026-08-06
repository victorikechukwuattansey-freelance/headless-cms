import { prisma } from "@saas/database";
import { plans, getPlanLimits } from "@saas/config";

export async function isFeatureEnabled(
  key: string,
  organizationId?: string,
  userId?: string,
): Promise<boolean> {
  if (organizationId) {
    const orgFlag = await prisma.featureFlag.findFirst({
      where: { key, organizationId, enabled: true },
    });
    if (orgFlag) return true;
  }

  if (userId) {
    const userFlag = await prisma.featureFlag.findFirst({
      where: { key, organizationId: null, enabled: true },
    });
    if (userFlag) return true;
  }

  const globalFlag = await prisma.featureFlag.findFirst({
    where: {
      key,
      organizationId: null,
      enabled: true,
      environment: process.env.NODE_ENV ?? "development",
    },
  });

  return globalFlag !== null;
}

export async function getEnabledFeatures(
  organizationId?: string,
  userId?: string,
): Promise<string[]> {
  const flags = await prisma.featureFlag.findMany({
    where: {
      OR: [{ organizationId: organizationId ?? "" }, { organizationId: null }],
      enabled: true,
    },
    select: { key: true },
  });

  return [...new Set(flags.map((f) => f.key))];
}

export async function hasReachedLimit(
  resource: keyof typeof plans.free.limits,
  organizationId: string,
  currentUsage: number,
): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { planTier: true },
  });

  if (!org) return true;

  const limits = getPlanLimits(org.planTier);
  const limit = limits[resource];

  return limit !== -1 && currentUsage >= limit;
}

export async function getUsagePercent(
  resource: keyof typeof plans.free.limits,
  organizationId: string,
  currentUsage: number,
  planTier?: string,
): Promise<number> {
  // Callers that already hold the org row (with planTier) can pass it in and
  // skip this query entirely.
  const tier =
    planTier ??
    (
      await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { planTier: true },
      })
    )?.planTier;

  if (!tier) return 100;

  const limits = getPlanLimits(tier);
  const limit = limits[resource];

  if (limit === -1) return 0;

  return Math.round((currentUsage / limit) * 100);
}

export async function getAllFeatureFlags() {
  return prisma.featureFlag.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function toggleFeatureFlag(id: string, enabled: boolean) {
  return prisma.featureFlag.update({
    where: { id },
    data: { enabled },
  });
}

export async function createFeatureFlag(data: {
  name: string;
  key: string;
  description?: string;
  enabled?: boolean;
  organizationId?: string;
  environment?: string;
}) {
  return prisma.featureFlag.create({ data });
}
