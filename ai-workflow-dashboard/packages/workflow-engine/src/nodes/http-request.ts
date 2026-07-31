import type { NodeDefinition, NodeExecutionContext } from "../types";
import type { NodeExecutionResult } from "@awd/types";
import { EngineError } from "../errors";

export const httpRequest: NodeDefinition = {
  type: "http-request",
  category: "INTEGRATION",
  label: "HTTP Request",
  description: "Performs an outbound HTTP request and returns the response.",
  icon: "globe",
  defaultConfig: {
    method: "GET",
    url: "https://example.com",
    headers: {},
    body: {},
    timeoutMs: 30_000,
  },
  configSchema: {
    method: { type: "string", required: true, label: "Method", default: "GET" },
    url: { type: "string", required: true, label: "URL" },
    headers: { type: "object", label: "Headers" },
    body: { type: "object", label: "Body" },
    timeoutMs: { type: "number", label: "Timeout (ms)", default: 30000 },
  },
  handler: async (ctx: NodeExecutionContext): Promise<NodeExecutionResult> => {
    const config = ctx.resolvedConfig;
    const method = String(config.method ?? "GET").toUpperCase();
    const url = String(config.url ?? "");
    const timeoutMs = typeof config.timeoutMs === "number" ? config.timeoutMs : 30_000;
    const headers = (config.headers as Record<string, string> | undefined) ?? {};
    const body = config.body as Record<string, unknown> | undefined;

    if (!url) {
      throw new EngineError("NODE_EXECUTION_FAILED", "http-request requires a url", ctx.node.id);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        signal: controller.signal,
        ...(body && method !== "GET" && method !== "HEAD" ? { body: JSON.stringify(body) } : {}),
      });
      const text = await res.text();
      let parsed: unknown = text;
      try {
        parsed = JSON.parse(text);
      } catch {
        // keep raw text
      }
      return {
        status: "SUCCEEDED",
        output: {
          status: res.status,
          statusText: res.statusText,
          headers: Object.fromEntries(res.headers.entries()),
          body: parsed,
        },
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new EngineError("NODE_TIMEOUT", `HTTP request timed out after ${timeoutMs}ms`, ctx.node.id, true);
      }
      throw new EngineError("NODE_EXECUTION_FAILED", `HTTP request failed: ${(err as Error).message}`, ctx.node.id, true);
    } finally {
      clearTimeout(timeout);
    }
  },
};
