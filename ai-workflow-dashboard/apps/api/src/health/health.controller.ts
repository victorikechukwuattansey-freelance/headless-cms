import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth.types";
import { loadEnv } from "@awd/config";
import { prisma } from "@awd/database";
import { QueueService, EXECUTION_QUEUE } from "../queue/queue.service";
import { Queue } from "bullmq";

@Controller("health")
export class HealthController {
  private readonly queue = new Queue(EXECUTION_QUEUE, {
    connection: { url: loadEnv().REDIS_URL },
  });

  @Public()
  @Get()
  health() {
    return {
      status: "ok",
      service: "ai-workflow-api",
      version: "0.1.0",
      time: new Date().toISOString(),
      provider: loadEnv().AI_DEFAULT_PROVIDER,
    };
  }

  @Public()
  @Get("full")
  async full() {
    const checks: Record<string, string> = {};
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }
    try {
      const client = (await this.queue.client) as unknown as { ping(): Promise<unknown> };
      await client.ping();
      checks.redis = "ok";
    } catch {
      checks.redis = "error";
    }
    try {
      const res = await fetch(`${loadEnv().OLLAMA_BASE_URL ?? "http://localhost:11434"}/api/tags`, {
        signal: AbortSignal.timeout(3000),
      });
      checks.ollama = res.ok ? "ok" : "error";
    } catch {
      checks.ollama = "error";
    }
    const [waiting, active, delayed] = await Promise.all([
      this.queue.getWaitingCount().catch(() => 0),
      this.queue.getActiveCount().catch(() => 0),
      this.queue.getDelayedCount().catch(() => 0),
    ]);
    const lastExecution = await prisma.execution
      .findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, status: true } })
      .catch(() => null);
    return {
      status: Object.values(checks).every((c) => c === "ok") ? "ok" : "degraded",
      checks,
      queue: { waiting, active, delayed },
      lastExecution,
      time: new Date().toISOString(),
    };
  }
}
