import { prisma } from "@awd/database";
import type { EngineCallbacks } from "@awd/workflow-engine";

/**
 * Persists engine events into Postgres (Execution, ExecutionNodeRecord, ExecutionLog).
 */
export function createPersistence(executionId: string): EngineCallbacks {
  const startedAtMs = Date.now();

  return {
    onNodeStart: async ({ nodeKey, nodeType, attempt }) => {
      await prisma.executionNodeRecord.upsert({
        where: { executionId_nodeKey: { executionId, nodeKey } },
        create: {
          executionId,
          nodeKey,
          nodeType,
          status: "RUNNING",
          attempt,
          startedAt: new Date(),
        },
        update: { status: "RUNNING", attempt, startedAt: new Date(), error: null, errorCode: null, finishedAt: null },
      });
    },

    onNodeFinish: async ({ nodeKey, nodeType, status, error, errorCode, output, aiUsage, attempt, durationMs }) => {
      await prisma.executionNodeRecord.upsert({
        where: { executionId_nodeKey: { executionId, nodeKey } },
        create: {
          executionId,
          nodeKey,
          nodeType,
          status,
          attempt,
          output: output ? (output as object) : undefined,
          error,
          errorCode,
          aiUsage: aiUsage ? (aiUsage as unknown as object) : undefined,
          finishedAt: new Date(),
          durationMs,
        },
        update: {
          status,
          attempt,
          output: output ? (output as object) : undefined,
          error,
          errorCode,
          aiUsage: aiUsage ? (aiUsage as unknown as object) : undefined,
          finishedAt: new Date(),
          durationMs,
        },
      });
    },

    onExecutionFinish: async ({ status, error, errorCode }) => {
      await prisma.execution.update({
        where: { id: executionId },
        data: {
          status,
          error,
          errorCode,
          completedAt: new Date(),
          durationMs: Date.now() - startedAtMs,
        },
      });
    },
  };
}
