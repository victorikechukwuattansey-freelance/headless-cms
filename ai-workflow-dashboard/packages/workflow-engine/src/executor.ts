import type { EngineCallbacks, EngineGraph, EngineOptions, NodeExecutionContext, NodeRetryPolicy, NodeDefinition } from "./types";
import type { NodeExecutionResult } from "@awd/types";
import { resolveConfig } from "./expressions";
import { getNodeDefinition } from "./nodes/registry";
import { EngineError, NodeExecutionError } from "./errors";
import type { Logger } from "@awd/logger";
import { createHash } from "node:crypto";

export interface ExecutionSummary {
  executionId: string;
  status: "COMPLETED" | "FAILED" | "CANCELLED";
  error?: string;
  errorCode?: string;
  durationMs: number;
  nodes: Record<string, NodeExecutionResult & { attempt: number }>;
}

interface PendingNode {
  pendingCount: number;
  upstreamSucceeded: boolean;
  upstreamSkipped: boolean;
  upstreamFailed: boolean;
}

export class WorkflowExecutor {
  private readonly callbacks: EngineCallbacks;
  private readonly options: EngineOptions;
  private readonly logger?: Logger;
  private readonly nodeDefinitions: Map<string, NodeDefinition>;

  constructor(options: EngineOptions = {}, logger?: Logger) {
    this.callbacks = options.callbacks ?? {};
    this.options = options;
    this.logger = logger;
    this.nodeDefinitions = new Map<string, NodeDefinition>();
    for (const node of (options.extraNodes ?? [])) {
      this.nodeDefinitions.set(node.type, node);
    }
  }

  private getNodeDefinition(nodeType: string): NodeDefinition | undefined {
    return this.nodeDefinitions.get(nodeType) ?? getNodeDefinition(nodeType);
  }

  graphChecksum(graph: EngineGraph): string {
    return createHash("sha256").update(JSON.stringify(graph)).digest("hex");
  }

  async execute(graph: EngineGraph, params: {
    executionId: string;
    workflowId: string;
    organizationId: string;
    trigger: Record<string, unknown>;
    variables?: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<ExecutionSummary> {
    const { executionId, workflowId, organizationId } = params;
    const startedAt = Date.now();
    const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
    const nodeResults = new Map<string, NodeExecutionResult & { attempt: number }>();
    const executionLog = (level: "debug" | "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => {
      this.logger?.[level === "debug" ? "debug" : level === "warn" ? "warn" : level === "error" ? "error" : "info"](
        message,
        { executionId, workflowId, organizationId, ...meta },
      );
    };

    // Validate node types before starting
    for (const node of graph.nodes) {
      if (!this.getNodeDefinition(node.nodeType)) {
        const err = new EngineError("GRAPH_ERROR", `Unknown node type '${node.nodeType}'`, node.id);
        await this.callbacks.onExecutionFinish?.({ executionId, status: "FAILED", error: err.message, errorCode: err.code });
        return { executionId, status: "FAILED", error: err.message, errorCode: err.code, durationMs: Date.now() - startedAt, nodes: {} };
      }
    }

    // Build adjacency
    const incoming: Map<string, PendingNode> = new Map();
    const outgoing: Map<string, string[]> = new Map();
    for (const node of graph.nodes) {
      incoming.set(node.id, { pendingCount: 0, upstreamSucceeded: false, upstreamSkipped: false, upstreamFailed: false });
      outgoing.set(node.id, []);
    }
    for (const conn of graph.connections) {
      const target = incoming.get(conn.targetNode);
      if (target) {
        target.pendingCount += 1;
        outgoing.get(conn.sourceNode)?.push(conn.targetNode);
      }
    }

    const isAborted = () => params.signal?.aborted ?? false;

    const runNode = async (nodeKey: string): Promise<NodeExecutionResult & { attempt: number }> => {
      const node = nodesById.get(nodeKey);
      if (!node) {
        throw new EngineError("GRAPH_ERROR", `Node '${nodeKey}' not found in graph`, nodeKey);
      }
      const definition = this.getNodeDefinition(node.nodeType)!;

      // Gather upstream outputs (`{{sourceKey.output.field}}` convention)
      const upstream: Record<string, Record<string, unknown>> = {};
      for (const conn of graph.connections) {
        if (conn.targetNode === nodeKey) {
          const result = nodeResults.get(conn.sourceNode);
          if (result && result.status === "SUCCEEDED" && result.output) {
            upstream[conn.sourceNode] = {
              output: result.output,
              status: result.status,
              attempt: result.attempt,
            };
          }
        }
      }

      const root: Record<string, unknown> = {
        trigger: params.trigger,
        input: params.trigger,
        workflow: { id: workflowId, executionId },
        variables: params.variables ?? {},
        ...upstream,
      };

      const resolvedConfig = resolveConfig(node.configuration, root);
      const retryPolicy = this.resolveRetryPolicy(node.configuration);
      const timeoutMs = typeof node.configuration.timeoutMs === "number" ? node.configuration.timeoutMs : (this.options.defaultTimeoutMs ?? 60_000);

      let attempt = 0;
      let lastError: Error | undefined;
      for (;;) {
        if (isAborted()) {
          throw new EngineError("EXECUTION_CANCELLED", "Execution cancelled", nodeKey);
        }
        attempt += 1;
        const attemptStartedAt = Date.now();
        const ctx: NodeExecutionContext = {
          executionId,
          workflowId,
          organizationId,
          node,
          input: { trigger: params.trigger, upstream, variables: params.variables ?? {} },
          resolvedConfig,
          attempt,
          signal: params.signal,
          ai: this.options.ai,
          log: (level, message, meta) => executionLog(level, `[${nodeKey}] ${message}`, { nodeKey, ...meta }),
        };

        await this.callbacks.onNodeStart?.({ executionId, nodeKey, nodeType: node.nodeType, attempt });

        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new EngineError("NODE_TIMEOUT", `Node '${nodeKey}' timed out after ${timeoutMs}ms`, nodeKey, true)), timeoutMs);
          if (params.signal) {
            params.signal.addEventListener("abort", () => {
              clearTimeout(timer);
              reject(new EngineError("EXECUTION_CANCELLED", "Execution cancelled", nodeKey));
            }, { once: true });
          }
        });

        try {
          const result = await Promise.race([
            Promise.resolve(definition.handler(ctx)),
            timeout,
          ]);
          clearTimeout(timer);
          const durationMs = Date.now() - attemptStartedAt;
          await this.callbacks.onNodeFinish?.({
            executionId,
            nodeKey,
            nodeType: node.nodeType,
            status: result.status,
            error: result.error,
            errorCode: result.errorCode,
            output: result.output,
            aiUsage: result.aiUsage,
            attempt,
            durationMs,
          });
          const stored: NodeExecutionResult & { attempt: number } = { ...result, attempt };
          nodeResults.set(nodeKey, stored);
          return stored;
        } catch (err) {
          clearTimeout(timer);
          lastError = err instanceof Error ? err : new Error(String(err));
          const retryable = !(err instanceof EngineError) || err.retryable || err.code === "NODE_TIMEOUT";
          const maxAttempts = retryPolicy.maxAttempts;
          if (attempt >= maxAttempts || !retryable) {
            await this.callbacks.onNodeFinish?.({
              executionId,
              nodeKey,
              nodeType: node.nodeType,
              status: "FAILED",
              error: lastError.message,
              errorCode: err instanceof EngineError ? err.code : "NODE_EXECUTION_FAILED",
              attempt,
              durationMs: Date.now() - attemptStartedAt,
            });
            throw new NodeExecutionError(lastError.message, nodeKey);
          }
          const delayMs = retryPolicy.backoff === "exponential"
            ? retryPolicy.delayMs * 2 ** (attempt - 1)
            : retryPolicy.delayMs;
          executionLog("warn", `Retrying node '${nodeKey}' (${attempt}/${maxAttempts}) in ${delayMs}ms`, { error: lastError.message });
          await new Promise((resolve) => setTimeout(resolve, Math.min(delayMs, 60_000)));
        }
      }
    };

    const failedNodes = new Set<string>();
    const skippedNodes = new Set<string>();
    const concurrency = this.options.concurrency ?? 8;
    const running = new Set<Promise<void>>();

    const tryRun = async (nodeKey: string): Promise<void> => {
      if (isAborted()) return;
      const pending = incoming.get(nodeKey)!;
      // If all upstreams skipped → skip; if any upstream failed → skip; else run.
      if (pending.upstreamFailed) {
        skippedNodes.add(nodeKey);
        await this.callbacks.onNodeFinish?.({ executionId, nodeKey, nodeType: nodesById.get(nodeKey)?.nodeType ?? "?", status: "SKIPPED", attempt: 0, durationMs: 0 });
        nodeResults.set(nodeKey, { status: "SKIPPED", attempt: 0 });
      } else if (pending.upstreamSkipped && !pending.upstreamSucceeded) {
        skippedNodes.add(nodeKey);
        await this.callbacks.onNodeFinish?.({ executionId, nodeKey, nodeType: nodesById.get(nodeKey)?.nodeType ?? "?", status: "SKIPPED", attempt: 0, durationMs: 0 });
        nodeResults.set(nodeKey, { status: "SKIPPED", attempt: 0 });
      } else {
        try {
          const result = await runNode(nodeKey);
          if (result.status === "FAILED") {
            failedNodes.add(nodeKey);
          }
        } catch (err) {
          failedNodes.add(nodeKey);
          executionLog("error", `Node '${nodeKey}' failed`, { error: (err as Error).message });
          nodeResults.set(nodeKey, { status: "FAILED", error: (err as Error).message, errorCode: err instanceof EngineError ? err.code : "NODE_EXECUTION_FAILED", attempt: 1 });
        }
      }
      await settleDownstream(nodeKey);
    };

    const settleDownstream = async (nodeKey: string): Promise<void> => {
      for (const target of outgoing.get(nodeKey) ?? []) {
        const pending = incoming.get(target);
        if (!pending) continue;
        const result = nodeResults.get(nodeKey);
        if (result?.status === "SUCCEEDED") pending.upstreamSucceeded = true;
        else if (result?.status === "SKIPPED") pending.upstreamSkipped = true;
        else pending.upstreamFailed = true;
        pending.pendingCount -= 1;
        if (pending.pendingCount === 0) {
          void enqueue(target);
        }
      }
    };

    const readyQueue: string[] = [];
    const queued = new Set<string>();
    const enqueue = (nodeKey: string): void => {
      if (queued.has(nodeKey)) return;
      queued.add(nodeKey);
      readyQueue.push(nodeKey);
    };

    // Seed queue with root nodes (deterministic order)
    const rootNodes = graph.nodes.filter((n) => (incoming.get(n.id)?.pendingCount ?? 0) === 0).map((n) => n.id).sort();
    for (const id of rootNodes) enqueue(id);

    // Drain queue with bounded concurrency
    while (readyQueue.length > 0 || running.size > 0) {
      while (running.size < concurrency && readyQueue.length > 0) {
        const next = readyQueue.shift()!;
        const p = Promise.resolve(tryRun(next)).finally(() => {
          running.delete(p);
        });
        running.add(p);
      }
      if (running.size > 0) {
        await Promise.race([...running]);
      }
    }

    // Actually await remaining running promises to surface rejections
    await Promise.all([...running]);

    const durationMs = Date.now() - startedAt;
    const nodes: Record<string, NodeExecutionResult & { attempt: number }> = {};
    for (const [key, value] of nodeResults.entries()) {
      nodes[key] = value;
    }

    if (isAborted()) {
      await this.callbacks.onExecutionFinish?.({ executionId, status: "CANCELLED" });
      return { executionId, status: "CANCELLED", durationMs, nodes };
    }
    if (failedNodes.size > 0) {
      const failed = graph.nodes.find((n) => failedNodes.has(n.id));
      const error = failed ? nodeResults.get(failed.id)?.error ?? "Node execution failed" : "Workflow execution failed";
      const errorCode = failed ? nodeResults.get(failed.id)?.errorCode : "EXECUTION_FAILED";
      await this.callbacks.onExecutionFinish?.({ executionId, status: "FAILED", error, errorCode });
      return { executionId, status: "FAILED", error, errorCode, durationMs, nodes };
    }
    await this.callbacks.onExecutionFinish?.({ executionId, status: "COMPLETED" });
    return { executionId, status: "COMPLETED", durationMs, nodes };
  }

  private resolveRetryPolicy(config: Record<string, unknown>): NodeRetryPolicy {
    const retry = config.retry as Record<string, unknown> | undefined;
    if (!retry) {
      return this.options.defaultRetry ?? { maxAttempts: 1, delayMs: 1000, backoff: "fixed" };
    }
    return {
      maxAttempts: typeof retry.maxAttempts === "number" ? retry.maxAttempts : 1,
      delayMs: typeof retry.delayMs === "number" ? retry.delayMs : 1000,
      backoff: retry.backoff === "exponential" ? "exponential" : "fixed",
    };
  }
}
