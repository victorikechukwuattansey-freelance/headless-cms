import type { NodeExecutionResult } from "@awd/types";

export type EngineErrorCode =
  | "VALIDATION_FAILED"
  | "NODE_EXECUTION_FAILED"
  | "NODE_TIMEOUT"
  | "EXECUTION_CANCELLED"
  | "NO_ADAPTER_CONFIGURED"
  | "GRAPH_ERROR";

export class EngineError extends Error {
  constructor(
    readonly code: EngineErrorCode,
    message: string,
    readonly nodeKey?: string,
    readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

export class NodeExecutionError extends EngineError {
  constructor(message: string, nodeKey: string, retryable: boolean = false) {
    super("NODE_EXECUTION_FAILED", message, nodeKey, retryable);
    this.name = "NodeExecutionError";
  }
}

export function isEngineError(err: unknown): err is EngineError {
  return err instanceof EngineError;
}

export function toNodeResult(err: unknown, nodeKey: string): NodeExecutionResult {
  if (err instanceof EngineError) {
    return {
      status: "FAILED",
      error: err.message,
      errorCode: err.code,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    status: "FAILED",
    error: message,
    errorCode: "NODE_EXECUTION_FAILED",
  };
}
