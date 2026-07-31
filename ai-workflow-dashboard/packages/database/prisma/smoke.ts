import "dotenv/config";
import { PrismaClient } from "../generated/client";
import { WorkflowExecutor } from "@awd/workflow-engine";
import type { EngineGraph } from "@awd/workflow-engine";

const prisma = new PrismaClient();

async function main() {
  const version = await prisma.workflowVersion.findFirst({
    where: { workflow: { name: "Demo: AI Text Workflow" } },
    include: { nodes: true, connections: true, workflow: true },
  });
  if (!version) throw new Error("Demo workflow version not found");

  const graph: EngineGraph = {
    nodes: version.nodes.map((n) => ({
      id: n.nodeKey,
      nodeType: n.nodeType,
      positionX: n.positionX,
      positionY: n.positionY,
      configuration: (n.configuration as Record<string, unknown>) ?? {},
    })),
    connections: version.connections.map((c) => ({
      id: c.id,
      sourceNode: c.sourceNode,
      targetNode: c.targetNode,
    })),
  };

  const executor = new WorkflowExecutor({
    ai: {
      complete: async ({ userPrompt }) => ({
        content: `AI SUMMARY of "${userPrompt.slice(0, 40)}"`,
        provider: "ollama",
        model: "llama3.2",
        inputTokens: 10,
        outputTokens: 8,
        costUsd: 0.00001,
        latencyMs: 42,
      }),
    },
  });

  const summary = await executor.execute(graph, {
    executionId: "smoke-1",
    workflowId: version.workflowId,
    organizationId: version.workflow.organizationId,
    trigger: { text: "The quick brown fox jumps over the lazy dog." },
  });

  console.log(JSON.stringify({ status: summary.status, nodes: summary.nodes }, null, 2));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
