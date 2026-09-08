import type { ParseResult, TimelineEntry } from '../domain/types.js';
import { redactText } from './redact.service.js';

const MAX_ENTRIES = 200;
const MAX_CONTENT_CHARS = 2000;
let globalRedactions = 0;

interface RawEntry {
  kind: TimelineEntry['kind'];
  label: string;
  content: string;
  outcome?: string;
  tokensIn?: number;
  tokensOut?: number;
  timestamp?: string;
}

function push(timeline: RawEntry[], entry: RawEntry): void {
  if (timeline.length >= MAX_ENTRIES) return;
  const redacted = redactText(entry.content);
  globalRedactions += redacted.count;
  const content = redacted.text.slice(0, MAX_CONTENT_CHARS);
  timeline.push({ ...entry, content });
}

function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(textOf).join('\n');
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value == null ? '' : String(value);
}

function usageTokens(obj: Record<string, unknown> | undefined): { in?: number; out?: number } {
  if (!obj) return {};
  const usage = obj.usage as Record<string, unknown> | undefined;
  if (!usage) return {};
  const tin = Number(usage.prompt_tokens ?? usage.input_tokens ?? NaN);
  const tout = Number(usage.completion_tokens ?? usage.output_tokens ?? NaN);
  return {
    in: Number.isFinite(tin) ? tin : undefined,
    out: Number.isFinite(tout) ? tout : undefined,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/* ---------------- format detection ---------------- */

function looksLikeOpenAI(data: unknown): boolean {
  if (isRecord(data)) {
    if (Array.isArray(data.messages)) return true;
    if (Array.isArray(data.choices) && data.choices.some((c) => isRecord(c))) return true;
  }
  if (Array.isArray(data)) {
    return data.every((e) => isRecord(e) && typeof e.role === 'string');
  }
  return false;
}

function looksLikeAnthropic(data: unknown): boolean {
  const candidates = Array.isArray(data) ? data : [data];
  return candidates.some((c) => {
    if (!isRecord(c)) return false;
    if (c.type === 'tool_use' || c.type === 'tool_result' || c.type === 'message') return true;
    return Array.isArray(c.content) && c.content.some((b) => isRecord(b) && (b.type === 'tool_use' || b.type === 'tool_result' || b.type === 'text'));
  });
}

function looksLikeLangChain(data: unknown): boolean {
  if (Array.isArray(data) && data.length > 0) {
    return data.every(
      (e) =>
        isRecord(e) &&
        (typeof e.event === 'string' && e.event.startsWith('on_')) ||
        (typeof e.type === 'string' && ['llm', 'tool', 'chain', 'agent'].includes(e.type)),
    );
  }
  return false;
}

/* ---------------- adapters ---------------- */

function parseOpenAI(data: unknown): RawEntry[] {
  const timeline: RawEntry[] = [];

  const messages: unknown[] = isRecord(data) && Array.isArray(data.messages)
    ? data.messages
    : Array.isArray(data)
      ? (data as unknown[])
      : isRecord(data) && Array.isArray(data.choices) && isRecord(data.choices[0]) && isRecord(data.choices[0].message)
        ? [data.choices[0].message]
        : [];

  const tokens = isRecord(data) ? usageTokens(data) : {};
  for (const m of messages) {
    if (!isRecord(m)) continue;
    const role = typeof m.role === 'string' ? m.role : 'unknown';
    const finish = typeof m.finish_reason === 'string' ? m.finish_reason : undefined;
    const toolCalls = Array.isArray(m.tool_calls) ? m.tool_calls : Array.isArray(m.function_call) ? m.function_call : undefined;
    if (toolCalls) {
      for (const tc of toolCalls) {
        if (!isRecord(tc)) continue;
        const fn = isRecord(tc.function) ? tc.function : undefined;
        const name = typeof fn?.name === 'string' ? fn.name : typeof tc.name === 'string' ? tc.name : 'tool';
        push(timeline, {
          kind: 'tool_call',
          label: `tool_call: ${name}`,
          content: textOf(fn?.arguments ?? fn ?? tc),
          tokensIn: tokens.in,
          tokensOut: tokens.out,
        });
      }
    }
    const content = m.content;
    const cText = typeof content === 'string' ? content : Array.isArray(content) ? content.map(textOf).join('\n') : textOf(content);
    push(timeline, {
      kind: role === 'assistant' ? 'response' : 'step',
      label: `message (${role})`,
      content: cText,
      outcome: finish,
      tokensIn: tokens.in,
      tokensOut: tokens.out,
    });
  }
  return timeline;
}

function parseAnthropic(data: unknown): RawEntry[] {
  const timeline: RawEntry[] = [];
  const blocks: unknown[] = [];

  if (Array.isArray(data)) blocks.push(...data);
  else if (isRecord(data) && Array.isArray(data.content)) blocks.push(...(data.content as unknown[]));
  else if (isRecord(data) && (data.type === 'tool_use' || data.type === 'tool_result')) blocks.push(data);

  const tokens = isRecord(data) ? usageTokens(data) : {};
  for (const b of blocks) {
    if (!isRecord(b)) continue;
    if (b.type === 'message' && Array.isArray(b.content)) {
      const nested: unknown[] = b.content;
      for (const nb of nested) blocks.push(nb);
      continue;
    }
    switch (b.type) {
      case 'tool_use': {
        const name = typeof b.name === 'string' ? b.name : 'tool';
        push(timeline, {
          kind: 'tool_call',
          label: `tool_use: ${name}`,
          content: textOf(b.input),
          tokensIn: tokens.in,
          tokensOut: tokens.out,
        });
        break;
      }
      case 'tool_result': {
        const isError = b.is_error === true;
        push(timeline, {
          kind: isError ? 'failure' : 'step',
          label: 'tool_result',
          content: textOf(b.content),
          outcome: isError ? 'error' : 'success',
          tokensIn: tokens.in,
          tokensOut: tokens.out,
        });
        break;
      }
      case 'text': {
        push(timeline, {
          kind: 'response',
          label: 'text',
          content: textOf(b.text),
          tokensIn: tokens.in,
          tokensOut: tokens.out,
        });
        break;
      }
      case 'error': {
        push(timeline, {
          kind: 'failure',
          label: 'api error',
          content: textOf(b),
          outcome: 'error',
        });
        break;
      }
    }
  }

  const stopReason = isRecord(data) && typeof data.stop_reason === 'string' ? data.stop_reason : undefined;
  if (stopReason && stopReason !== 'end_turn') {
    push(timeline, {
      kind: 'failure',
      label: 'stop_reason',
      content: stopReason,
      outcome: stopReason === 'max_tokens' ? 'truncated' : 'error',
    });
  }
  return timeline;
}

function nested(data: Record<string, unknown> | undefined, keys: string[]): unknown {
  let cur: unknown = data;
  for (const k of keys) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }
  return cur;
}

function parseLangChain(data: unknown): RawEntry[] {
  const timeline: RawEntry[] = [];
  const events = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.events) ? data.events : [];
  for (const e of events) {
    if (!isRecord(e)) continue;
    const type = typeof e.event === 'string' ? e.event : typeof e.type === 'string' ? e.type : 'unknown';
    const name = typeof e.name === 'string' ? e.name : 'event';
    const dataBlock = isRecord(e.data) ? e.data : undefined;
    const ts = typeof e.time === 'string' ? e.time : undefined;

    if (type.startsWith('on_tool') || type === 'tool') {
      const isEnd = type.endsWith('_end') || type === 'tool';
      const error =
        nested(dataBlock, ['error']) ??
        nested(dataBlock, ['output', 'error']) ??
        nested(dataBlock, ['output', 'status_code']) ??
        nested(dataBlock, ['result', 'error']);
      const output = nested(dataBlock, ['output']) ?? nested(dataBlock, ['result']);
      push(timeline, {
        kind: isEnd ? (error ? 'failure' : 'step') : 'tool_call',
        label: `tool: ${name}`,
        content: isEnd ? textOf(output ?? error ?? '') : textOf(dataBlock?.input ?? ''),
        outcome: error ? 'error' : undefined,
        timestamp: ts,
      });
    } else if (type.startsWith('on_llm') || type === 'llm') {
      const error = nested(dataBlock, ['error']) ?? nested(dataBlock, ['output', 'error']);
      const output = nested(dataBlock, ['output']);
      push(timeline, {
        kind: error ? 'failure' : 'response',
        label: `llm: ${name}`,
        content: textOf(output ?? dataBlock?.input ?? ''),
        outcome: error ? 'error' : undefined,
        timestamp: ts,
      });
    } else if (type.startsWith('on_chain') || type === 'chain' || type === 'agent') {
      const error = nested(dataBlock, ['error']) ?? nested(dataBlock, ['output', 'error']);
      const input = nested(dataBlock, ['input']);
      const output = nested(dataBlock, ['output']);
      push(timeline, {
        kind: 'step',
        label: `chain: ${name}`,
        content: textOf(input ?? output ?? ''),
        outcome: error ? 'error' : undefined,
        timestamp: ts,
      });
    } else {
      push(timeline, {
        kind: 'step',
        label: `event: ${type} (${name})`,
        content: textOf(dataBlock ?? e),
        timestamp: ts,
      });
    }
  }
  return timeline;
}

function parseGenericJson(data: unknown): RawEntry[] {
  const timeline: RawEntry[] = [];
  const items = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data.logs) ? data.logs : isRecord(data) ? [data] : [];

  for (const item of items) {
    if (!isRecord(item)) continue;
    const level = typeof item.level === 'string' ? item.level : typeof item.type === 'string' ? item.type : 'info';
    const event = typeof item.event === 'string' ? item.event : '';
    const action = typeof item.action === 'string' ? item.action : '';
    const tool = typeof item.tool === 'string' ? item.tool : '';
    const role = typeof item.role === 'string' ? item.role : '';
    const message = item.message ?? item.content ?? item.text ?? item.output ?? item.error ?? item.data ?? '';
    const ts = typeof item.timestamp === 'string' ? item.timestamp
      : typeof item.ts === 'string' ? item.ts
        : typeof item.time === 'string' ? item.time
          : typeof item.created_at === 'string' ? item.created_at
            : undefined;

    const isError = /error|fail|exception|warn/i.test(`${level} ${event}`) || !!item.error || item.status === 'error' || item.ok === false;

    const label = tool
      ? `tool: ${tool}`
      : action
        ? `action: ${action}`
        : role
          ? `message (${role})`
          : event
            ? `event: ${event}`
            : `entry (${level})`;

    push(timeline, {
      kind: isError ? 'failure' : tool || action ? 'tool_call' : role === 'assistant' ? 'response' : 'step',
      label,
      content: textOf(message),
      outcome: isError ? 'error' : typeof item.status === 'string' ? item.status : undefined,
      timestamp: ts,
    });
  }
  return timeline;
}

function parsePlainText(raw: string): RawEntry[] {
  const timeline: RawEntry[] = [];
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const tsMatch = trimmed.match(/^\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s*/);
    const body = tsMatch ? trimmed.slice(tsMatch[0].length) : trimmed;

    const isError = /error|fail|exception|timeout|timed out/i.test(body);
    const toolMatch = body.match(/^(?:\[)?(?:tool|call|function)[\]:]?\s*[:=]?\s*([A-Za-z0-9_.-]+)/i);
    const kind: RawEntry['kind'] = isError ? 'failure' : toolMatch ? 'tool_call' : /assistant|response|answer/i.test(body) ? 'response' : 'step';

    push(timeline, {
      kind,
      label: toolMatch ? `tool: ${toolMatch[1]}` : kind === 'failure' ? 'error line' : kind === 'response' ? 'response' : 'step',
      content: body,
      outcome: isError ? 'error' : undefined,
      timestamp: tsMatch ? tsMatch[1] : undefined,
    });
  }
  return timeline;
}

/* ---------------- entry point ---------------- */

export function parseLog(input: unknown): ParseResult {
  globalRedactions = 0;
  let rawTimeline: RawEntry[];
  let format: string;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    let parsed: unknown = null;
    let parseError = false;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      parseError = true;
    }
    if (!parseError && parsed != null) {
      const result = parseLog(parsed);
      return result;
    }
    // JSONL: try line-by-line
    const lines = trimmed.split(/\r?\n/);
    if (lines.length > 1 && lines.filter((l) => l.trim()).every((l) => l.trim().startsWith('{'))) {
      const events: unknown[] = [];
      let allParsed = true;
      for (const l of lines) {
        if (!l.trim()) continue;
        try {
          events.push(JSON.parse(l));
        } catch {
          allParsed = false;
          break;
        }
      }
      if (allParsed && events.length > 0) {
        return parseLog(events);
      }
    }
    rawTimeline = parsePlainText(trimmed);
    format = 'text';
  } else if (looksLikeLangChain(input)) {
    rawTimeline = parseLangChain(input);
    format = 'langchain';
  } else if (looksLikeAnthropic(input)) {
    rawTimeline = parseAnthropic(input);
    format = 'anthropic';
  } else if (looksLikeOpenAI(input)) {
    rawTimeline = parseOpenAI(input);
    format = 'openai';
  } else {
    rawTimeline = parseGenericJson(input);
    format = 'json';
  }

  const timeline: TimelineEntry[] = rawTimeline.map((r, index) => ({ ...r, index }));
  return { format, timeline, redactions: globalRedactions };
}
