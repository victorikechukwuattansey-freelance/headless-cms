import type { TimelineEntry } from '../domain/types.js';

/** One normalized execution step, as exposed to clients. */
export interface ExecutionStep {
  index: number;
  timestamp: string | null;
  tool: string | null;
  prompt: string | null;
  response: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  error: string | null;
}

const TOOL_LABEL = /^(tool_call|tool_use|tool|llm|chain):\s*(.+)$/i;

function toolName(label: string): string | null {
  const m = label.match(TOOL_LABEL);
  return m ? m[2] : null;
}

/** Project canonical timeline entries into the structured execution-step shape. */
export function buildExecutionTimeline(entries: TimelineEntry[]): ExecutionStep[] {
  return entries.map((e, index) => {
    const tool = toolName(e.label);
    const isFailure = e.kind === 'failure' || e.outcome === 'error';
    const isUserMessage = e.label.toLowerCase().startsWith('message (user)');

    let prompt: string | null = null;
    let response: string | null = null;
    let error: string | null = null;

    if (isFailure) {
      error = e.content || e.outcome || null;
    } else if (e.kind === 'tool_call' || isUserMessage) {
      prompt = e.content;
    } else if (e.kind === 'response') {
      response = e.content;
    } else {
      response = e.content;
    }

    return {
      index,
      timestamp: e.timestamp ?? null,
      tool,
      prompt,
      response,
      tokensIn: e.tokensIn ?? null,
      tokensOut: e.tokensOut ?? null,
      error,
    };
  });
}
