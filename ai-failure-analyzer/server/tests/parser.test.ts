import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLog } from '../src/services/parser.service.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = (name: string): string => readFileSync(path.join(fixtures, name), 'utf-8');

describe('parseLog — format detection', () => {
  it('detects OpenAI chat format', () => {
    const r = parseLog(JSON.parse(load('openai-loop.json')));
    expect(r.format).toBe('openai');
    expect(r.timeline.length).toBeGreaterThan(5);
    expect(r.timeline.filter((t) => t.kind === 'tool_call').length).toBeGreaterThanOrEqual(4);
  });

  it('detects Anthropic tool_use format', () => {
    const r = parseLog(JSON.parse(load('anthropic-context-overflow.json')));
    expect(r.format).toBe('anthropic');
    expect(r.timeline.some((t) => t.label.includes('tool_use'))).toBe(true);
    expect(r.timeline.some((t) => t.label === 'stop_reason')).toBe(true);
  });

  it('detects LangChain event format', () => {
    const r = parseLog(JSON.parse(load('langchain-timeout.json')));
    expect(r.format).toBe('langchain');
    expect(r.timeline.some((t) => t.label.includes('tool: generate_report'))).toBe(true);
  });

  it('detects generic JSON logs', () => {
    const r = parseLog(JSON.parse(load('generic-api-failure.json')));
    expect(r.format).toBe('json');
    expect(r.timeline.every((t) => t.kind === 'failure')).toBe(true);
  });

  it('parses plain text logs', () => {
    const r = parseLog(load('plaintext-hallucination.log'));
    expect(r.format).toBe('text');
    expect(r.timeline.length).toBeGreaterThanOrEqual(5);
  });

  it('parses JSON passed as a string', () => {
    const r = parseLog(load('openai-api-call.json'));
    expect(r.format).toBe('openai');
  });

  it('parses JSONL strings', () => {
    const jsonl = '{"type": "message", "role": "assistant", "content": [{"type": "tool_use", "name": "a", "input": {}}]}\n{"type": "tool_result", "tool_use_id": "x", "content": "ok"}';
    const r = parseLog(jsonl);
    expect(r.format).toBe('anthropic');
    expect(r.timeline.length).toBe(2);
  });
});

describe('parseLog — token usage', () => {
  it('captures prompt/completion tokens', () => {
    const r = parseLog(JSON.parse(load('openai-api-call.json')));
    const withTokens = r.timeline.filter((t) => t.tokensIn !== undefined);
    expect(withTokens.length).toBeGreaterThan(0);
    expect(withTokens[0].tokensIn).toBe(431);
  });
});

describe('parseLog — secret redaction', () => {
  it('redacts API keys and bearer tokens', () => {
    const r = parseLog(JSON.parse(load('openai-secrets.json')));
    expect(r.redactions).toBeGreaterThanOrEqual(2);
    const blob = r.timeline.map((t) => t.content).join('\n');
    expect(blob).not.toContain('sk-ABC12345678901234567890');
    expect(blob).toContain('[REDACTED:OpenAI API key]');
    expect(blob).not.toMatch(/Bearer eyJ/);
    expect(blob).toContain('[REDACTED:Bearer token]');
  });
});
