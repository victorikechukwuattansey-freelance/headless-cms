import { Controller, Get, UseGuards } from "@nestjs/common";
import { prisma } from "@awd/database";
import { QueueService, EXECUTION_QUEUE } from "../queue/queue.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser, AuthUser } from "../auth/auth.types";
import { Queue } from "bullmq";
import { loadEnv } from "@awd/config";

@Controller("metrics")
@UseGuards(JwtAuthGuard)
export class MetricsController {
  private readonly queue = new Queue(EXECUTION_QUEUE, {
    connection: { url: loadEnv().REDIS_URL },
  });

  @Get()
  async metrics(@CurrentUser() user: AuthUser) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [executions, byStatus, usage, workflows, queue] = await Promise.all([
      prisma.execution.count({ where: { organizationId: user.organizationId, createdAt: { gte: since } } }),
      prisma.execution.groupBy({
        by: ["status"],
        where: { organizationId: user.organizationId, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      prisma.usageRecord.aggregate({
        where: { organizationId: user.organizationId, kind: "ai_chat", createdAt: { gte: since } },
        _sum: { quantity: true, costUsd: true },
        _count: { _all: true },
      }),
      prisma.workflow.groupBy({
        by: ["triggerType"],
        where: { organizationId: user.organizationId, deletedAt: null },
        _count: { _all: true },
      }),
      Promise.all([
        this.queue.getWaitingCount().catch(() => 0),
        this.queue.getActiveCount().catch(() => 0),
        this.queue.getDelayedCount().catch(() => 0),
      ]),
    ]);

    const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count._all]));
    const workflowCounts = Object.fromEntries(workflows.map((w) => [w.triggerType, w._count._all]));

    return {
      windowHours: 24,
      executions: { total: executions, byStatus: statusCounts },
      queue: { waiting: queue[0], active: queue[1], delayed: queue[2] },
      ai: {
        calls: usage._count._all,
        tokens: usage._sum.quantity ?? 0,
        costUsd: usage._sum.costUsd ?? 0,
      },
      workflows: workflowCounts,
      time: new Date().toISOString(),
    };
  }
}
