export type WorkflowStatus = "DRAFT" | "VALIDATED" | "PUBLISHED" | "ARCHIVED";

export type WorkflowTriggerType =
  | "MANUAL"
  | "SCHEDULE"
  | "WEBHOOK"
  | "EVENT";

export type NodeStatus = "PENDING" | "READY" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED" | "RETRYING" | "WAITING";

export type ExecutionStatus =
  | "QUEUED"
  | "INITIALIZING"
  | "RUNNING"
  | "WAITING"
  | "RETRYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT";

export type NodeCategory =
  | "TRIGGER"
  | "LOGIC"
  | "CONDITION"
  | "TRANSFORM"
  | "INTEGRATION"
  | "DATA"
  | "AI"
  | "COMMUNICATION"
  | "STORAGE"
  | "UTILITY";

export interface WorkflowNodeDefinition {
  id: string;
  nodeType: string;
  category: NodeCategory;
  positionX: number;
  positionY: number;
  configuration: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface WorkflowConnectionDefinition {
  id: string;
  sourceNode: string;
  targetNode: string;
  sourcePort: string;
  targetPort: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  triggerType: WorkflowTriggerType;
  nodes: WorkflowNodeDefinition[];
  connections: WorkflowConnectionDefinition[];
}

export interface ExecutionNodeRecord {
  nodeId: string;
  status: NodeStatus;
  startedAt?: Date;
  finishedAt?: Date;
  durationMs?: number;
  attempt: number;
  error?: string | null;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface AiUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  latencyMs: number;
}

export interface NodeExecutionResult {
  status: "SUCCEEDED" | "FAILED" | "SKIPPED";
  output?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
  aiUsage?: AiUsage;
}
