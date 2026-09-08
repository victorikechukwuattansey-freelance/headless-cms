import type { FailureVerdict, TimelineEntry } from '../domain/types.js';

export interface Report {
  summary: string;
  failureType: string;
  rootCause: string;
  confidence: number;
  recommendedFix: string;
  preventionStrategy: string;
}

export function buildReport(verdict: FailureVerdict, timeline: TimelineEntry[]): Report {
  const steps = timeline.length;
  const toolCalls = timeline.filter((t) => t.kind === 'tool_call').length;
  const failures = timeline.filter((t) => t.kind === 'failure').length;
  const confidencePct = Math.round(verdict.confidence * 100);

  const summary = [
    `The agent failed with ${describeType(verdict.type)} (${confidencePct}% confidence) after ${steps} timeline event${steps === 1 ? '' : 's'}`,
    toolCalls > 0 ? `, including ${toolCalls} tool call${toolCalls === 1 ? '' : 's'}` : '',
    failures > 0 ? ` and ${failures} error${failures === 1 ? '' : 's'}` : '',
    '.',
  ].join('');

  return {
    summary,
    failureType: verdict.type,
    rootCause: verdict.rootCause,
    confidence: verdict.confidence,
    recommendedFix: verdict.fix,
    preventionStrategy: verdict.prevention,
  };
}

export function describeType(type: string): string {
  const labels: Record<string, string> = {
    wrong_prompt: 'a prompt/instruction problem',
    wrong_tool_selection: 'wrong tool selection',
    missing_context: 'missing context',
    hallucination: 'a hallucinated result',
    infinite_loop: 'an infinite loop',
    timeout: 'a timeout',
    invalid_output: 'an invalid output',
    api_failure: 'an API failure',
    context_overflow: 'context overflow',
  };
  return labels[type] ?? 'an unspecified failure';
}
