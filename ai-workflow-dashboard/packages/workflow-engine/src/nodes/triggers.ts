import type { NodeDefinition, NodeExecutionContext } from "../types";
import type { NodeExecutionResult } from "@awd/types";

async function triggerHandler(ctx: NodeExecutionContext): Promise<NodeExecutionResult> {
  return {
    status: "SUCCEEDED",
    output: {
      ...ctx.input.trigger,
      triggeredAt: new Date().toISOString(),
      workflowId: ctx.workflowId,
    },
  };
}

const triggerBase = {
  category: "TRIGGER" as const,
  defaultConfig: {},
  configSchema: {},
};

export const manualTrigger: NodeDefinition = {
  type: "manual-trigger",
  ...triggerBase,
  label: "Manual Trigger",
  description: "Starts the workflow when run manually with optional input payload.",
  icon: "hand",
  handler: triggerHandler,
};

export const webhookTrigger: NodeDefinition = {
  type: "webhook-trigger",
  ...triggerBase,
  label: "Webhook Trigger",
  description: "Starts the workflow when an HTTP request hits the workflow webhook URL.",
  icon: "webhook",
  handler: triggerHandler,
};

export const scheduleTrigger: NodeDefinition = {
  type: "schedule-trigger",
  ...triggerBase,
  label: "Schedule Trigger",
  description: "Starts the workflow on a cron schedule.",
  icon: "clock",
  handler: triggerHandler,
};
