import { describe, expect, it } from 'vitest';
import { buildReport } from '../src/services/report.service.js';
import type { FailureVerdict, TimelineEntry } from '../src/domain/types.js';

const timeline: TimelineEntry[] = [
  { index: 0, kind: 'step', label: 'step', content: 'start' },
  { index: 1, kind: 'tool_call', label: 'tool: a', content: 'x' },
  { index: 2, kind: 'tool_call', label: 'tool: a', content: 'x' },
  { index: 3, kind: 'tool_call', label: 'tool: a', content: 'x' },
  { index: 4, kind: 'tool_call', label: 'tool: a', content: 'x' },
  { index: 5, kind: 'failure', label: 'error', content: 'max iterations', outcome: 'error' },
];

const verdict: FailureVerdict = {
  type: 'infinite_loop',
  rootCause: 'Repeated the same action.',
  confidence: 0.9,
  evidence: [{ label: 'Repeated action', detail: '4x identical', severity: 'strong' }],
  fix: 'Add an iteration cap.',
  prevention: 'Set max-iterations guards.',
};

describe('buildReport', () => {
  it('produces all five report sections', () => {
    const r = buildReport(verdict, timeline);
    expect(r.summary.length).toBeGreaterThan(10);
    expect(r.failureType).toBe('infinite_loop');
    expect(r.rootCause).toBe(verdict.rootCause);
    expect(r.recommendedFix).toBe(verdict.fix);
    expect(r.preventionStrategy).toBe(verdict.prevention);
    expect(r.confidence).toBe(0.9);
  });

  it('mentions step and tool counts in the summary', () => {
    const r = buildReport(verdict, timeline);
    expect(r.summary).toContain('6 timeline events');
    expect(r.summary).toContain('4 tool calls');
    expect(r.summary).toContain('1 error');
  });
});
