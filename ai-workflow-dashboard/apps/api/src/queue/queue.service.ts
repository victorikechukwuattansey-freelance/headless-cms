import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Job, Queue } from "bullmq";
import { loadEnv } from "@awd/config";

export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  organizationId: string;
  trigger: "MANUAL" | "WEBHOOK" | "SCHEDULE";
  input: Record<string, unknown>;
  correlationId: string;
}

export const EXECUTION_QUEUE = "workflow-executions";

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly queue: Queue<ExecutionJobData>;

  constructor() {
    const env = loadEnv();
    this.queue = new Queue<ExecutionJobData>(EXECUTION_QUEUE, {
      connection: { url: env.REDIS_URL },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });
  }

  enqueue(data: ExecutionJobData): Promise<Job<ExecutionJobData>> {
    return this.queue.add(`execution:${data.workflowId}`, data, {
      jobId: data.correlationId,
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
