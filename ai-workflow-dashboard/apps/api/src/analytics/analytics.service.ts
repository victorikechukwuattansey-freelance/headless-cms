import { Injectable } from "@nestjs/common";
import { prisma } from "@awd/database";

export interface AnalyticsSummary {
  executions: {
    total: number;
    completed: number;
    failed: number;
    running: number;
    queued: number;
    cancelled: number;
  };
  avgDurationMs: number | null;
  ai: {
    totalCalls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
  };
  daily: Array<{
    date: string;
    executions: number;
    aiCalls: number;
    tokens: number;
  }>;
}

@Injectable()
export class AnalyticsService {
  async summary(organizationId: string): Promise<AnalyticsSummary> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 6);
    since.setUTCHours(0, 0, 0, 0);

    const [byStatus, duration, aiAgg, usageAgg, executions, usage, tokenBreakdown] = await Promise.all([
      prisma.execution.groupBy({
        by: ["status"],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.execution.aggregate({
        where: { organizationId, status: { in: ["COMPLETED", "FAILED"] }, durationMs: { not: null } },
        _avg: { durationMs: true },
      }),
      prisma.usageRecord.aggregate({
        where: { organizationId, kind: "ai_chat" },
        _count: { _all: true },
        _sum: { quantity: true, costUsd: true },
      }),
      prisma.usageRecord.groupBy({
        by: ["createdAt"],
        where: { organizationId, kind: "ai_chat", createdAt: { gte: since } },
        _sum: { quantity: true },
      }),
      prisma.execution.findMany({
        where: { organizationId, createdAt: { gte: since } },
        select: { id: true, createdAt: true },
      }),
      prisma.usageRecord.findMany({
        where: { organizationId, kind: "ai_chat", createdAt: { gte: since } },
        select: { id: true, createdAt: true, quantity: true },
      }),
      prisma.$queryRaw<Array<{ inputTokens: number | null; outputTokens: number | null }>>`
        SELECT
          COALESCE(SUM(CAST(metadata->>'inputTokens' AS INTEGER)), 0)::int AS "inputTokens",
          COALESCE(SUM(CAST(metadata->>'outputTokens' AS INTEGER)), 0)::int AS "outputTokens"
        FROM usage_records
        WHERE organization_id = ${organizationId}::uuid AND kind = 'ai_chat'
      `,
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      statusCounts[row.status] = row._count._all;
    }

    const meta = aiAgg._sum ?? { quantity: null, costUsd: null };
    const aiCalls = aiAgg._count._all;

    const dailyMap = new Map<string, { executions: number; aiCalls: number; tokens: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(since);
      d.setUTCDate(d.getUTCDate() + i);
      dailyMap.set(d.toISOString().slice(0, 10), { executions: 0, aiCalls: 0, tokens: 0 });
    }
    for (const ex of executions) {
      const key = ex.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) entry.executions += 1;
    }
    for (const row of usage) {
      const key = row.createdAt.toISOString().slice(0, 10);
      const entry = dailyMap.get(key);
      if (entry) {
        entry.aiCalls += 1;
        entry.tokens += row.quantity;
      }
    }

    const tokenRow = tokenBreakdown[0] ?? { inputTokens: 0, outputTokens: 0 };

    return {
      executions: {
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
        completed: statusCounts.COMPLETED ?? 0,
        failed: statusCounts.FAILED ?? 0,
        running: statusCounts.RUNNING ?? 0,
        queued: statusCounts.QUEUED ?? 0,
        cancelled: statusCounts.CANCELLED ?? 0,
      },
      avgDurationMs: duration._avg.durationMs ?? null,
      ai: {
        totalCalls: aiCalls,
        inputTokens: tokenRow.inputTokens ?? 0,
        outputTokens: tokenRow.outputTokens ?? 0,
        totalTokens: meta.quantity ?? 0,
        totalCostUsd: meta.costUsd ?? 0,
      },
      daily: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })),
    };
  }
}
