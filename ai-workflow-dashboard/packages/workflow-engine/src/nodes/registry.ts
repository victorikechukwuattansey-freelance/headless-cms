import type { NodeDefinition } from "../types";
import { manualTrigger, webhookTrigger, scheduleTrigger } from "./triggers";
import { aiChat } from "./ai-chat";
import { httpRequest } from "./http-request";
import { ifCondition } from "./if-condition";
import { delay } from "./delay";
import { logOutput, setVariable, merge } from "./utility";

export const builtinNodes: NodeDefinition[] = [
  manualTrigger,
  webhookTrigger,
  scheduleTrigger,
  aiChat,
  httpRequest,
  ifCondition,
  delay,
  logOutput,
  setVariable,
  merge,
];

export const NODE_TYPES = new Set(builtinNodes.map((n) => n.type));

export function getNodeDefinition(nodeType: string): NodeDefinition | undefined {
  return builtinNodes.find((n) => n.type === nodeType);
}
