import { Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@awd/database";

export interface ExecutionListItem {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  trigger: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  createdAt: Date;
}

export interface ExecutionDetailItem {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  trigger: string;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  errorCode: string | null;
  input: unknown;
  createdAt: Date;
  nodes: Array<{
    nodeKey: string;
    nodeType: string;
    status: string;
    attempt: number;
    output: unknown;
    error: string | null;
    aiUsage: unknown;
    startedAt: Date | null;
    finishedAt: Date | null;
    durationMs: number | null;
  }>;
  logs: Array<{ id: string; level: string; message: string; nodeKey: string | null; createdAt: Date }>;
}

@Injectable()
export class ExecutionsService {
  async list(organizationId: string, workflowId?: string): Promise<ExecutionListItem[]> {
    const executions = await prisma.execution.findMany({
      where: { organizationId, ...(workflowId ? { workflowId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { workflow: { select: { name: true } } },
    });
    return executions.map((ex) => ({
      id: ex.id,
      workflowId: ex.workflowId,
      workflowName: ex.workflow.name,
      status: ex.status,
      trigger: ex.trigger,
      startedAt: ex.startedAt,
      completedAt: ex.completedAt,
      durationMs: ex.durationMs,
      error: ex.error,
      createdAt: ex.createdAt,
    }));
  }

  async get(organizationId: string, executionId: string): Promise<ExecutionDetailItem> {
    const execution = await prisma.execution.findFirst({
      where: { id: executionId, organizationId },
      include: {
        nodes: { orderBy: { startedAt: "asc" } },
        workflow: { select: { id: true, name: true } },
      },
    });
    if (!execution) throw new NotFoundException("Execution not found");
    const logs = await prisma.executionLog.findMany({
      where: { executionId },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return {
      id: execution.id,
      workflowId: execution.workflowId,
      workflowName: execution.workflow.name,
      status: execution.status,
      trigger: execution.trigger,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt,
      durationMs: execution.durationMs,
      error: execution.error,
      errorCode: execution.errorCode,
      input: execution.input,
      createdAt: execution.createdAt,
      nodes: execution.nodes.map((n) => ({
        nodeKey: n.nodeKey,
        nodeType: n.nodeType,
        status: n.status,
        attempt: n.attempt,
        output: n.output,
        error: n.error,
        aiUsage: n.aiUsage,
        startedAt: n.startedAt,
        finishedAt: n.finishedAt,
        durationMs: n.durationMs,
      })),
      logs,
    };
  }
}
