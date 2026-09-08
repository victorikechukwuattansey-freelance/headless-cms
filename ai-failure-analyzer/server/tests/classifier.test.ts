import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseLog } from '../src/services/parser.service.js';
import { classifyFailure } from '../src/services/classifier.service.js';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const load = (name: string): string => readFileSync(path.join(fixtures, name), 'utf-8');

function classify(fixture: string, raw = false) {
  const input = raw ? fixture : JSON.parse(fixture);
  const parsed = parseLog(input);
  return { verdict: classifyFailure(parsed.timeline), parsed };
}

describe('classifyFailure', () => {
  it('detects infinite_loop from repeated identical tool calls', () => {
    const { verdict } = classify(load('openai-loop.json'));
    expect(verdict.type).toBe('infinite_loop');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.85);
    expect(verdict.evidence.some((e) => e.label === 'Repeated action')).toBe(true);
  });

  it('detects context_overflow from Anthropic errors', () => {
    const { verdict } = classify(load('anthropic-context-overflow.json'));
    expect(verdict.type).toBe('context_overflow');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('detects timeout from LangChain events', () => {
    const { verdict } = classify(load('langchain-timeout.json'));
    expect(verdict.type).toBe('timeout');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it('detects api_failure from 429 status codes', () => {
    const { verdict } = classify(load('generic-api-failure.json'));
    expect(verdict.type).toBe('api_failure');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('detects hallucination from success claim after errors', () => {
    const { verdict } = classify(load('plaintext-hallucination.log'), true);
    expect(verdict.type).toBe('hallucination');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.55);
  });

  it('detects invalid_output from JSON parse and validation errors', () => {
    const { verdict } = classify(load('plaintext-invalid-output.log'), true);
    expect(verdict.type).toBe('invalid_output');
  });

  it('detects wrong_tool_selection from unknown tool errors', () => {
    const { verdict } = classify(load('wrong-tool-selection.json'));
    expect(verdict.type).toBe('wrong_tool_selection');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.75);
    expect(verdict.evidence.some((e) => e.label === 'Unknown tool error' || e.label === 'Multiple failed tools')).toBe(true);
  });

  it('detects missing_context from undefined references', () => {
    const { verdict } = classify(load('missing-context.json'));
    expect(verdict.type).toBe('missing_context');
    expect(verdict.confidence).toBeGreaterThanOrEqual(0.7);
    expect(verdict.evidence.some((e) => e.label === 'Missing reference')).toBe(true);
  });

  it('falls back to wrong_prompt when no mechanical failure is found', () => {
    const parsed = parseLog(JSON.parse(load('openai-api-call.json')));
    const verdict = classifyFailure(parsed.timeline);
    expect(verdict.type).toBe('wrong_prompt');
    expect(verdict.confidence).toBe(0.4);
  });

  it('always returns a fix and prevention strategy', () => {
    for (const name of ['openai-loop.json', 'anthropic-context-overflow.json', 'langchain-timeout.json', 'generic-api-failure.json', 'plaintext-hallucination.log', 'plaintext-invalid-output.log', 'wrong-tool-selection.json', 'missing-context.json']) {
      const { verdict } = classify(load(name), name.endsWith('.log'));
      expect(verdict.fix.length).toBeGreaterThan(10);
      expect(verdict.prevention.length).toBeGreaterThan(10);
      expect(verdict.rootCause.length).toBeGreaterThan(10);
    }
  });
});
