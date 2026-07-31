import type { NodeDefinition, NodeExecutionContext } from "../types";
import type { NodeExecutionResult } from "@awd/types";
import { EngineError } from "../errors";

export const delay: NodeDefinition = {
  type: "delay",
  category: "LOGIC",
  label: "Delay",
  description: "Pauses the execution for a configured duration.",
  icon: "hourglass",
  defaultConfig: {
    durationMs: 1000,
  },
  configSchema: {
    durationMs: { type: "number", required: true, label: "Duration (ms)", default: 1000 },
  },
  handler: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const config = ctx.resolvedConfig;
    const durationMs = typeof config.durationMs === "number" ? config.durationMs : 1000;
    if (durationMs < 0 || durationMs > 3_600_000) {
      throw new EngineError("NODE_EXECUTION_FAILED", "delay duration must be between 0 and 3,600,000 ms", ctx.node.id);
    }
    ctx.log("info", `Delaying execution for ${durationMs}ms`);
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(resolve, durationMs);
      ctx.signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
    if (ctx.signal?.aborted) {
      throw new EngineError("EXECUTION_CANCELLED", "Execution cancelled during delay", ctx.node.id);
    }
    return { status: "SUCCEEDED", output: { delayedMs: durationMs, resumedAt: new Date().toISOString() } };
  },
};
