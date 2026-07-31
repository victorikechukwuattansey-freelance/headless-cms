import type { NodeDefinition, NodeExecutionContext } from "../types";
import type { NodeExecutionResult } from "@awd/types";
import { EngineError } from "../errors";

type ConditionOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "exists" | "not_exists";

interface Condition {
  op: ConditionOp;
  left?: unknown;
  right?: unknown;
}

function evaluateCondition(cond: Condition): boolean {
  const { op } = cond;
  const left = cond.left;
  const right = cond.right;
  switch (op) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" ? left > right : String(left) > String(right);
    case "gte":
      return typeof left === "number" && typeof right === "number" ? left >= right : String(left) >= String(right);
    case "lt":
      return typeof left === "number" && typeof right === "number" ? left < right : String(left) < String(right);
    case "lte":
      return typeof left === "number" && typeof right === "number" ? left <= right : String(left) <= String(right);
    case "contains":
      if (typeof left === "string" && typeof right === "string") return left.includes(right);
      if (Array.isArray(left)) return left.includes(right);
      return false;
    case "exists":
      return left !== undefined && left !== null && left !== "";
    case "not_exists":
      return left === undefined || left === null || left === "";
    default:
      return false;
  }
}

export const ifCondition: NodeDefinition = {
  type: "if-condition",
  category: "CONDITION",
  label: "If Condition",
  description: "Evaluates a condition. Downstream nodes on the true branch run when it passes.",
  icon: "git-branch",
  defaultConfig: {
    conditions: [{ op: "exists", left: "{{trigger}}" }],
    match: "all",
  },
  configSchema: {
    conditions: {
      type: "array",
      required: true,
      label: "Conditions",
      description: "List of { op, left, right } conditions",
    },
    match: { type: "string", label: "Match", default: "all", description: "all | any" },
  },
  handler: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const config = ctx.resolvedConfig;
    const conditions = (config.conditions as Condition[] | undefined) ?? [];
    const match = String(config.match ?? "all");

    if (conditions.length === 0) {
      throw new EngineError("NODE_EXECUTION_FAILED", "if-condition requires at least one condition", ctx.node.id);
    }

    const results = conditions.map((c) => {
      const op = c.op ?? "eq";
      if (!["eq", "neq", "gt", "gte", "lt", "lte", "contains", "exists", "not_exists"].includes(op)) {
        throw new EngineError("NODE_EXECUTION_FAILED", `Unknown condition op: ${op}`, ctx.node.id);
      }
      return evaluateCondition({ ...c, op: op as ConditionOp });
    });

    const passed = match === "any" ? results.some(Boolean) : results.every(Boolean);
    return {
      status: passed ? "SUCCEEDED" : "SKIPPED",
      output: {
        matched: passed,
        results: results.map((r, i) => ({ index: i, result: r })),
      },
    };
  },
};
