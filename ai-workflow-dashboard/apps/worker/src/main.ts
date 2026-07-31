import { Worker, Queue } from "bullmq";
import { CronExpressionParser } from "cron-parser";
import { loadEnv } from "@awd/config";
import { prisma } from "@awd/database";
import { createAiExecutor, createGateway } from "./ai-executor";
import { processExecutionJob } from "./execution-job";
import type { ExecutionJobData } from "./execution-job";
import { JsonLogger } from "@awd/logger";

const EXECUTION_QUEUE = "workflow-executions";
const logger = new JsonLogger("awd-worker");

async function main() {
  const env = loadEnv();
  const gateway = createGateway();
  const ai = createAiExecutor(gateway);

  const worker = new Worker<ExecutionJobData>(
    EXECUTION_QUEUE,
    async (job) => {
      try {
        await processExecutionJob(job.data, ai);
      } catch (err) {
        logger.error(`Job ${job.id} failed`, { jobId: job.id, error: (err as Error).message });
        throw err;
      }
    },
    {
      connection: { url: env.REDIS_URL },
      concurrency: 4,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error(`Job ${job?.id} failed permanently`, { error: err.message });
    void prisma.execution
      .update({
        where: { id: job?.data.executionId },
        data: { status: "FAILED", error: err.message, errorCode: "WORKER_ERROR", completedAt: new Date() },
      })
      .catch(() => undefined);
  });

  logger.info(`Worker listening on queue '${EXECUTION_QUEUE}'`);

  // Scheduler: check SCHEDULE workflows every minute
  const queue = new Queue<ExecutionJobData>(EXECUTION_QUEUE, { connection: { url: env.REDIS_URL } });

  setInterval(async () => {
    try {
      const now = new Date();
      const workflows = await prisma.workflow.findMany({
        where: { triggerType: "SCHEDULE", status: "PUBLISHED", deletedAt: null, scheduleCron: { not: null } },
      });
      for (const workflow of workflows) {
        if (!workflow.scheduleCron) continue;
        let due = false;
        try {
          const interval = CronExpressionParser.parse(workflow.scheduleCron, { currentDate: now });
          const prev = interval.prev();
          due = prev.getTime() >= now.getTime() - 60_000;
        } catch {
          continue;
        }
        if (!due) continue;
        const stamp = now.toISOString().slice(0, 16).replace(/[:T]/g, "-");
        const correlationId = `cron-${workflow.id}-${stamp}`;
        const execution = await prisma.execution.create({
          data: {
            organizationId: workflow.organizationId,
            workflowId: workflow.id,
            workflowVersion: workflow.currentVersion,
            status: "QUEUED",
            trigger: "SCHEDULE",
            input: { scheduledAt: now.toISOString() },
            correlationId,
          },
        });
        await queue.add(`execution:${workflow.id}`, {
          executionId: execution.id,
          workflowId: workflow.id,
          organizationId: workflow.organizationId,
          trigger: "SCHEDULE",
          input: { scheduledAt: now.toISOString() },
          correlationId,
        }, { jobId: correlationId });
        logger.info(`Scheduled execution enqueued for workflow ${workflow.id}`);
      }
    } catch (err) {
      logger.error("Scheduler tick failed", { error: (err as Error).message });
    }
  }, 60_000);

  process.on("SIGINT", async () => {
    await worker.close();
    await queue.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

void main().catch(async (err) => {
  logger.error("Worker crashed", { error: (err as Error).message });
  await prisma.$disconnect();
  process.exit(1);
});
