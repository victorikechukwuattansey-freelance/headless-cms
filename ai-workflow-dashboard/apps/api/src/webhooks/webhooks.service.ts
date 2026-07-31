import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@awd/database";
import { QueueService } from "../queue/queue.service";

@Injectable()
export class WebhooksService {
  constructor(private readonly queue: QueueService) {}

  async handle(token: string, body: unknown) {
    const workflow = await prisma.workflow.findFirst({
      where: { webhookToken: token, deletedAt: null, status: "PUBLISHED" },
    });
    if (!workflow) throw new NotFoundException("Webhook not found or workflow not published");
    const execution = await prisma.execution.create({
      data: {
        organizationId: workflow.organizationId,
        workflowId: workflow.id,
        workflowVersion: workflow.currentVersion,
        status: "QUEUED",
        trigger: "WEBHOOK",
        input: (body ?? {}) as object,
        correlationId: `webhook:${workflow.id}:${Date.now()}`,
      },
    });
    await this.queue.enqueue({
      executionId: execution.id,
      workflowId: execution.workflowId,
      organizationId: workflow.organizationId,
      trigger: "WEBHOOK",
      input: (body ?? {}) as Record<string, unknown>,
      correlationId: execution.correlationId,
    });
    return { executionId: execution.id, status: "QUEUED" };
  }
}
