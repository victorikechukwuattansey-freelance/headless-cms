import type { AiUsage, NodeExecutionResult, WorkflowConnectionDefinition, WorkflowNodeDefinition } from "@awd/types";

export interface NodeInput {
  /** Payload from the trigger (webhook body, schedule meta, manual input). */
  trigger: Record<string, unknown>;
  /** Outputs of upstream nodes, keyed by upstream nodeKey. */
  upstream: Record<string, Record<string, unknown>>;
  /** Variables of the current execution. */
  variables: Record<string, unknown>;
}

export interface NodeExecutionContext {
  executionId: string;
  workflowId: string;
  organizationId: string;
  node: WorkflowNodeDefinition;
  input: NodeInput;
  resolvedConfig: Record<string, unknown>;
  attempt: number;
  signal?: AbortSignal;
  ai?: AiExecutor;
  log: (level: "debug" | "info" | "warn" | "error", message: string, meta?: Record<string, unknown>) => void;
}

export interface AiExecutor {
  complete(options: {
    provider?: string;
    model: string;
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    correlationId?: string;
  }): Promise<{
    content: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    latencyMs: number;
  }>;
}

export type NodeHandler = (ctx: NodeExecutionContext) => Promise<NodeExecutionResult>;

export interface NodeDefinition {
  type: string;
  category: "TRIGGER" | "LOGIC" | "CONDITION" | "TRANSFORM" | "INTEGRATION" | "DATA" | "AI" | "COMMUNICATION" | "STORAGE" | "UTILITY";
  label: string;
  description: string;
  icon: string;
  defaultConfig: Record<string, unknown>;
  configSchema: Record<string, { type: string; required?: boolean; default?: unknown; label?: string; description?: string }>;
  handler: NodeHandler;
}

export interface NodeRetryPolicy {
  maxAttempts: number;
  delayMs: number;
  backoff: "fixed" | "exponential";
}

export interface EngineCallbacks {
  onNodeStart?(ctx: { executionId: string; nodeKey: string; nodeType: string; attempt: number }): void | Promise<void>;
  onNodeFinish?(ctx: {
    executionId: string;
    nodeKey: string;
    nodeType: string;
    status: NodeExecutionResult["status"];
    error?: string;
    errorCode?: string;
    output?: Record<string, unknown>;
    aiUsage?: AiUsage;
    attempt: number;
    durationMs: number;
  }): void | Promise<void>;
  onExecutionFinish?(ctx: { executionId: string; status: "COMPLETED" | "FAILED" | "CANCELLED"; error?: string; errorCode?: string }): void | Promise<void>;
}

export interface EngineOptions {
  callbacks?: EngineCallbacks;
  ai?: AiExecutor;
  concurrency?: number;
  defaultTimeoutMs?: number;
  defaultRetry?: NodeRetryPolicy;
  /** Additional node definitions merged with the builtin registry (plugins). */
  extraNodes?: NodeDefinition[];
}

export interface EngineGraph {
  nodes: WorkflowNodeDefinition[];
  connections: WorkflowConnectionDefinition[];
}

export interface ValidationIssue {
  code: string;
  message: string;
  nodeKey?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
