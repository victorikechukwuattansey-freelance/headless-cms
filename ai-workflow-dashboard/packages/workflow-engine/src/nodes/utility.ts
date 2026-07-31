import type { NodeDefinition, NodeExecutionContext } from "../types";
import type { NodeExecutionResult } from "@awd/types";

export const logOutput: NodeDefinition = {
  type: "log-output",
  category: "UTILITY",
  label: "Log Output",
  description: "Writes a message (with expression support) to the execution log.",
  icon: "terminal",
  defaultConfig: {
    message: "Execution reached log node",
    level: "info",
  },
  configSchema: {
    message: { type: "string", required: true, label: "Message" },
    level: { type: "string", label: "Level", default: "info" },
  },
  handler: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const config = ctx.resolvedConfig;
    const level = String(config.level ?? "info");
    if (!["debug", "info", "warn", "error"].includes(level)) {
      ctx.log("warn", `Unknown log level '${level}', using info`);
    }
    const message = String(config.message ?? "");
    ctx.log(level as "info", message);
    return {
      status: "SUCCEEDED",
      output: { message, loggedAt: new Date().toISOString() },
    };
  },
};

export const setVariable: NodeDefinition = {
  type: "set-variable",
  category: "UTILITY",
  label: "Set Variable",
  description: "Stores a value in the execution variables.",
  icon: "pencil",
  defaultConfig: {
    name: "myVar",
    value: "",
  },
  configSchema: {
    name: { type: "string", required: true, label: "Variable name" },
    value: { type: "string", required: true, label: "Value (expressions allowed)" },
  },
  handler: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const config = ctx.resolvedConfig;
    const name = String(config.name ?? "");
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      return {
        status: "FAILED",
        error: `Invalid variable name '${name}'`,
        errorCode: "VALIDATION_FAILED",
      };
    }
    return {
      status: "SUCCEEDED",
      output: { name, value: config.value, stored: true },
    };
  },
};

export const merge: NodeDefinition = {
  type: "merge",
  category: "LOGIC",
  label: "Merge",
  description: "Merges outputs of multiple upstream branches and continues.",
  icon: "merge",
  defaultConfig: {},
  configSchema: {},
  handler: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const merged: Record<string, unknown> = { branches: {} };
    for (const [key, value] of Object.entries(ctx.input.upstream)) {
      (merged.branches as Record<string, unknown>)[key] = value;
      for (const [field, fieldValue] of Object.entries(value)) {
        merged[`${key}.${field}`] = fieldValue;
      }
    }
    return { status: "SUCCEEDED", output: merged };
  },
};
