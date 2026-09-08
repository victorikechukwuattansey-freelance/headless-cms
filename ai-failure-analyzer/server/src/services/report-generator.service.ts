import type { EvidenceItem, TimelineEntry } from '../domain/types.js';
import { describeType } from './report.service.js';

/** Input shape — mirrors what getReport() returns. */
export interface ReportSource {
  id: string;
  summary: string;
  failureType: string;
  rootCause: string;
  confidence: number;
  recommendedFix: string;
  preventionStrategy: string;
  sourceFormat: string;
  stepCount: number;
  evidenceCount: number;
  redactions: number;
  createdAt: Date;
  steps: (TimelineEntry & { order: number })[];
  evidences: EvidenceItem[];
}

export interface RootCauseReport {
  id: string;
  failureType: string;
  confidence: number;
  executiveSummary: string;
  timeline: string[];
  rootCause: string;
  evidence: string[];
  suggestedFixes: string;
  preventionStrategy: string;
  document: string;
}

const TOOL_NAME = /^(?:tool_call|tool_use|tool|llm|chain):\s*(.+)$/i;
const MAX_TIMELINE_STEPS = 25;
const LINE_CAP = 160;

function renderStep(step: TimelineEntry & { order: number }): string {
  const tool = step.label.match(TOOL_NAME)?.[1];
  const ts = step.timestamp ? `[${step.timestamp}] ` : '';
  const body = step.content.length > LINE_CAP ? `${step.content.slice(0, LINE_CAP)}...` : step.content;
  switch (step.kind) {
    case 'tool_call':
      return `${ts}Called the tool "${tool ?? step.label}" with input: ${body}`;
    case 'response':
      return `${ts}The agent responded: "${body}"`;
    case 'failure':
      return `${ts}Step failed: "${body}"`;
    default:
      return step.outcome && /success|ok/i.test(step.outcome)
        ? `${ts}Tool returned: ${body}`
        : `${ts}Log entry: ${body}`;
  }
}

function renderTimeline(steps: (TimelineEntry & { order: number })[]): string[] {
  if (steps.length === 0) return ['The log contained no steps.'];
  const omitted = steps.length - MAX_TIMELINE_STEPS;
  const shown = omitted > 0 ? steps.slice(-MAX_TIMELINE_STEPS) : steps;
  const lines = shown.map(renderStep);
  return omitted > 0 ? [`${omitted} earlier step(s) omitted to keep this report readable.`, ...lines] : lines;
}

function buildExecutiveSummary(src: ReportSource): string {
  const confidencePct = Math.round(src.confidence * 100);
  const toolCalls = src.steps.filter((s) => s.kind === 'tool_call').length;
  const errors = src.steps.filter((s) => s.kind === 'failure').length;
  const parts = [
    `The agent failed with ${describeType(src.failureType)} (${confidencePct}% confidence).`,
    `The run produced ${src.stepCount} timeline event${src.stepCount === 1 ? '' : 's'}, including ${toolCalls} tool call${toolCalls === 1 ? '' : 's'} and ${errors} error${errors === 1 ? '' : 's'}.`,
    src.redactions > 0 ? `${src.redactions} sensitive value${src.redactions === 1 ? '' : 's'} were redacted before this analysis.` : '',
  ].filter(Boolean);
  return `${parts.join(' ')} ${src.rootCause}`;
}

function renderEvidence(evidences: EvidenceItem[]): string[] {
  if (evidences.length === 0) return ['No specific evidence items were recorded.'];
  return evidences.map((e) => `**${e.label}** (${e.severity}) — ${e.detail}`);
}

/** Compose a complete plain-English root cause analysis report. */
export function generateRootCauseReport(src: ReportSource): RootCauseReport {
  const executiveSummary = buildExecutiveSummary(src);
  const timeline = renderTimeline(src.steps);
  const evidence = renderEvidence(src.evidences);
  const confidencePct = Math.round(src.confidence * 100);

  const document = [
    '# Root Cause Analysis Report',
    '',
    `**Failure type:** ${src.failureType}`,
    `**Confidence:** ${confidencePct}%`,
    '',
    '## Executive Summary',
    executiveSummary,
    '',
    '## Failure Timeline',
    ...timeline.map((line) => `- ${line}`),
    '',
    '## Root Cause',
    src.rootCause,
    '',
    '## Evidence',
    ...evidence.map((line) => `- ${line}`),
    '',
    '## Suggested Fixes',
    src.recommendedFix,
    '',
    '## Prevention Strategy',
    src.preventionStrategy,
    '',
  ].join('\n');

  return {
    id: src.id,
    failureType: src.failureType,
    confidence: src.confidence,
    executiveSummary,
    timeline,
    rootCause: src.rootCause,
    evidence,
    suggestedFixes: src.recommendedFix,
    preventionStrategy: src.preventionStrategy,
    document,
  };
}
