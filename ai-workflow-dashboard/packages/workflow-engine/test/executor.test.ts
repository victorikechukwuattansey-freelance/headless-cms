import { describe, it, expect, vi } from "vitest";
import { WorkflowExecutor } from "../src/executor";
import type { EngineGraph, NodeDefinition } from "../src/types";
import { validateGraph } from "../src/validator";

const graph = (nodes: EngineGraph["nodes"], connections: EngineGraph["connections"]): EngineGraph => ({
  nodes,
  connections,
});

const node = (id: string, nodeType: string, configuration: Record<string, unknown> = {}): EngineGraph["nodes"][number] => ({
  id,
  nodeType,
  positionX: 0,
  positionY: 0,
  configuration,
});

const conn = (source: string, target: string): EngineGraph["connections"][number] => ({
  id: `${source}-${target}`,
  sourceNode: source,
  targetNode: target,
});

describe("WorkflowExecutor", () => {
  it("executes a linear graph with a trigger, ai-chat and log node", async () => {
    const ai = {
      complete: vi.fn(async () => ({
        content: "The summary.",
        provider: "ollama",
        model: "llama3.2",
        inputTokens: 12,
        outputTokens: 5,
        costUsd: 0.0001,
        latencyMs: 900,
      })),
    };
    const events: string[] = [];
    const executor = new WorkflowExecutor({
      ai,
      callbacks: {
        onNodeStart: ({ nodeKey }) => events.push(`start:${nodeKey}`),
        onNodeFinish: ({ nodeKey, status }) => events.push(`finish:${nodeKey}:${status}`),
      },
    });

    const summary = await executor.execute(
      graph(
        [
          node("trigger-1", "manual-trigger"),
          node("ai-1", "ai-chat", { model: "llama3.2", userPrompt: "Summarize: {{trigger.text}}" }),
          node("log-1", "log-output", { message: "Summary: {{ai-1.output.text}}" }),
        ],
        [conn("trigger-1", "ai-1"), conn("ai-1", "log-1")],
      ),
      {
        executionId: "ex-1",
        workflowId: "wf-1",
        organizationId: "org-1",
        trigger: { text: "hello world" },
      },
    );

    expect(summary.status).toBe("COMPLETED");
    expect(ai.complete).toHaveBeenCalledTimes(1);
    expect(ai.complete.mock.calls[0][0].userPrompt).toBe("Summarize: hello world");
    expect(summary.nodes["log-1"].output).toMatchObject({ message: "Summary: The summary." });
    expect(summary.nodes["ai-1"].aiUsage).toMatchObject({ provider: "ollama", outputTokens: 5 });
    expect(events).toEqual([
      "start:trigger-1",
      "finish:trigger-1:SUCCEEDED",
      "start:ai-1",
      "finish:ai-1:SUCCEEDED",
      "start:log-1",
      "finish:log-1:SUCCEEDED",
    ]);
  });

  it("skips downstream nodes when an if-condition fails and runs them when it passes", async () => {
    const executor = new WorkflowExecutor({ concurrency: 1 });

    const falseGraph = graph(
      [
        node("trigger-1", "manual-trigger"),
        node("cond-1", "if-condition", {
          conditions: [{ op: "eq", left: "{{trigger.score}}", right: 100 }],
          match: "all",
        }),
        node("log-1", "log-output", { message: "reached" }),
      ],
      [conn("trigger-1", "cond-1"), conn("cond-1", "log-1")],
    );

    const summary = await executor.execute(falseGraph, {
      executionId: "ex-2",
      workflowId: "wf-2",
      organizationId: "org-2",
      trigger: { score: 50 },
    });

    expect(summary.status).toBe("COMPLETED");
    expect(summary.nodes["cond-1"].status).toBe("SKIPPED");
    expect(summary.nodes["log-1"].status).toBe("SKIPPED");

    const passing = await executor.execute(
      graph(
        [
          node("trigger-1", "manual-trigger"),
          node("cond-1", "if-condition", {
            conditions: [{ op: "eq", left: "{{trigger.score}}", right: 100 }],
          }),
          node("log-1", "log-output", { message: "reached" }),
        ],
        [conn("trigger-1", "cond-1"), conn("cond-1", "log-1")],
      ),
      {
        executionId: "ex-3",
        workflowId: "wf-3",
        organizationId: "org-3",
        trigger: { score: 100 },
      },
    );

    expect(passing.nodes["cond-1"].status).toBe("SUCCEEDED");
    expect(passing.nodes["log-1"].status).toBe("SUCCEEDED");
    expect(passing.nodes["log-1"].output).toMatchObject({ message: "reached" });
  });

  it("merges outputs of multiple branches at a merge node", async () => {
    const executor = new WorkflowExecutor({ concurrency: 1 });
    const summary = await executor.execute(
      graph(
        [
          node("trigger-1", "manual-trigger"),
          node("a-1", "set-variable", { name: "a", value: "1" }),
          node("b-1", "set-variable", { name: "b", value: "2" }),
          node("m-1", "merge"),
        ],
        [conn("trigger-1", "a-1"), conn("trigger-1", "b-1"), conn("a-1", "m-1"), conn("b-1", "m-1")],
      ),
      {
        executionId: "ex-4",
        workflowId: "wf-4",
        organizationId: "org-4",
        trigger: {},
      },
    );

    expect(summary.status).toBe("COMPLETED");
    expect(summary.nodes["m-1"].output).toMatchObject({
      branches: { "a-1": { output: { name: "a", stored: true }, status: "SUCCEEDED" } },
    });
  });

  it("retries a failing node according to its retry policy", async () => {
    let attempts = 0;
    const flaky: NodeDefinition = {
      type: "flaky",
      category: "UTILITY",
      label: "Flaky",
      description: "Fails once then succeeds.",
      icon: "x",
      defaultConfig: {},
      configSchema: {},
      handler: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("boom");
        }
        return { status: "SUCCEEDED", output: { ok: true } };
      },
    };

    const executor = new WorkflowExecutor({
      extraNodes: [flaky],
      defaultRetry: { maxAttempts: 2, delayMs: 5, backoff: "fixed" },
    });

    const summary = await executor.execute(
      graph([node("flaky-1", "flaky", { retry: { maxAttempts: 2, delayMs: 5, backoff: "fixed" } })], []),
      { executionId: "ex-5", workflowId: "wf-5", organizationId: "org-5", trigger: {} },
    );

    expect(attempts).toBe(2);
    expect(summary.status).toBe("COMPLETED");
    expect(summary.nodes["flaky-1"]).toMatchObject({ status: "SUCCEEDED", attempt: 2 });
  });

  it("fails the execution when a node exhausts its retries", async () => {
    const alwaysFail: NodeDefinition = {
      type: "always-fail",
      category: "UTILITY",
      label: "AlwaysFail",
      description: "Always fails.",
      icon: "x",
      defaultConfig: {},
      configSchema: {},
      handler: async () => {
        throw new Error("nope");
      },
    };

    const executor = new WorkflowExecutor({
      extraNodes: [alwaysFail],
      defaultRetry: { maxAttempts: 2, delayMs: 5, backoff: "fixed" },
    });

    const summary = await executor.execute(
      graph([node("fail-1", "always-fail", { retry: { maxAttempts: 2, delayMs: 5, backoff: "fixed" } })], []),
      { executionId: "ex-6", workflowId: "wf-6", organizationId: "org-6", trigger: {} },
    );

    expect(summary.status).toBe("FAILED");
    expect(summary.error).toBe("nope");
    expect(summary.nodes["fail-1"].status).toBe("FAILED");
  });

  it("supports cancellation via AbortSignal", async () => {
    const executor = new WorkflowExecutor({});
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 40);
    const summary = await executor.execute(
      graph([node("delay-1", "delay", { durationMs: 5000 })], []),
      {
        executionId: "ex-7",
        workflowId: "wf-7",
        organizationId: "org-7",
        trigger: {},
        signal: controller.signal,
      },
    );

    expect(summary.status).toBe("CANCELLED");
  });

  it("resolves variables and workflow metadata in expressions", async () => {
    const executor = new WorkflowExecutor({ concurrency: 1 });
    const summary = await executor.execute(
      graph([node("set-1", "set-variable", { name: "out", value: "{{variables.foo}}/{{workflow.id}}" })], []),
      {
        executionId: "ex-8",
        workflowId: "wf-8",
        organizationId: "org-8",
        trigger: {},
        variables: { foo: "bar" },
      },
    );

    expect(summary.nodes["set-1"].output).toMatchObject({ value: "bar/wf-8" });
  });

  it("invokes onExecutionFinish with COMPLETED status", async () => {
    const onExecutionFinish = vi.fn();
    const executor = new WorkflowExecutor({ callbacks: { onExecutionFinish } });
    await executor.execute(graph([node("t-1", "manual-trigger")], []), {
      executionId: "ex-9",
      workflowId: "wf-9",
      organizationId: "org-9",
      trigger: {},
    });
    expect(onExecutionFinish).toHaveBeenCalledWith({ executionId: "ex-9", status: "COMPLETED" });
  });
});

describe("validateGraph", () => {
  it("accepts a valid graph", () => {
    const result = validateGraph(
      graph([node("a-1", "manual-trigger"), node("b-1", "log-output")], [conn("a-1", "b-1")]),
      new Set(["manual-trigger", "log-output"]),
    );
    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("rejects duplicate node ids", () => {
    const result = validateGraph(
      graph([node("a-1", "manual-trigger"), node("a-1", "log-output")], []),
      new Set(["manual-trigger", "log-output"]),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "DUPLICATE_NODE_ID")).toBe(true);
  });

  it("rejects unknown node types", () => {
    const result = validateGraph(graph([node("a-1", "nope")], []), new Set(["manual-trigger"]));
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "UNKNOWN_NODE_TYPE" && i.nodeKey === "a-1")).toBe(true);
  });

  it("rejects circular dependencies", () => {
    const result = validateGraph(
      graph([node("a-1", "manual-trigger"), node("b-1", "log-output")], [conn("a-1", "b-1"), conn("b-1", "a-1")]),
      new Set(["manual-trigger", "log-output"]),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "CIRCULAR_DEPENDENCY")).toBe(true);
  });

  it("rejects dangling connection targets", () => {
    const result = validateGraph(
      graph([node("a-1", "manual-trigger")], [conn("a-1", "ghost")]),
      new Set(["manual-trigger"]),
    );
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "MISSING_TARGET")).toBe(true);
  });
});

describe("expressions", () => {
  it("resolves nested paths with array indices", async () => {
    const executor = new WorkflowExecutor({ concurrency: 1 });
    const summary = await executor.execute(
      graph([node("log-1", "log-output", { message: "{{trigger.items.0.name}}" })], []),
      {
        executionId: "ex-10",
        workflowId: "wf-10",
        organizationId: "org-10",
        trigger: { items: [{ name: "first" }] },
      },
    );
    expect(summary.nodes["log-1"].output).toMatchObject({ message: "first" });
  });
});
