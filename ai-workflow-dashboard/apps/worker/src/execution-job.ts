import { prisma } from "@awd/database";
import { WorkflowExecutor, validateGraph, NODE_TYPES } from "@awd/workflow-engine";
import type { EngineGraph } from "@awd/workflow-engine";
import type { AiExecutor } from "@awd/workflow-engine";
import { createPersistence } from "./persistence";
import { JsonLogger } from "@awd/logger";

const logger = new JsonLogger("awd-worker");

export interface ExecutionJobData {
  executionId: string;
  workflowId: string;
  organizationId: string;
  trigger: "MANUAL" | "WEBHOOK" | "SCHEDULE";
  input: Record<string, unknown>;
  correlationId: string;
}

function categoryOf(nodeType: string): "TRIGGER" | "LOGIC" | "CONDITION" | "TRANSFORM" | "INTEGRATION" | "DATA" | "AI" | "COMMUNICATION" | "STORAGE" | "UTILITY" {
  if (nodeType.endsWith("-trigger")) return "TRIGGER";
  if (nodeType.startsWith("ai-")) return "AI";
  if (nodeType.startsWith("if-")) return "CONDITION";
  if (nodeType === "http-request") return "INTEGRATION";
  if (["delay", "merge"].includes(nodeType)) return "LOGIC";
  return "UTILITY";
}

export async function processExecutionJob(
  data: ExecutionJobData,
  ai: AiExecutor,
): Promise<{ status: string; durationMs?: number }> {
  const { executionId, workflowId, organizationId, input } = data;

  await prisma.execution.update({
    where: { id: executionId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1, include: { nodes: true, connections: true } },
    },
  });
  if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

  const version = workflow.versions[0];
  if (!version) throw new Error(`Workflow ${workflowId} has no versions`);

  const graph: EngineGraph = {
    nodes: version.nodes.map((n) => ({
      id: n.nodeKey,
      nodeType: n.nodeType,
      category: categoryOf(n.nodeType),
      positionX: n.positionX,
      positionY: n.positionY,
      configuration: (n.configuration as Record<string, unknown>) ?? {},
    })),
    connections: version.connections.map((c) => ({
      id: c.id,
      sourceNode: c.sourceNode,
      targetNode: c.targetNode,
      sourcePort: c.sourcePort ?? "out",
      targetPort: c.targetPort ?? "in",
    })),
  };

  const validation = validateGraph(graph, NODE_TYPES);
  if (!validation.valid) {
    await prisma.execution.update({
      where: { id: executionId },
      data: { status: "FAILED", error: validation.issues.map((i) => i.message).join("; "), errorCode: "VALIDATION_FAILED", completedAt: new Date() },
    });
    return { status: "FAILED" };
  }

  const executor = new WorkflowExecutor(
    {
      ai,
      concurrency: 8,
      defaultTimeoutMs: 120_000,
      defaultRetry: { maxAttempts: 2, delayMs: 1_000, backoff: "exponential" },
      callbacks: createPersistence(executionId),
    },
    logger,
  );

  const summary = await executor.execute(graph, {
    executionId,
    workflowId,
    organizationId,
    trigger: input,
    variables: { triggerName: data.trigger, correlationId: data.correlationId },
  });

  logger.info(`Execution ${executionId} finished with status ${summary.status}`, {
    executionId,
    status: summary.status,
    durationMs: summary.durationMs,
  });
  return { status: summary.status, durationMs: summary.durationMs };
}
