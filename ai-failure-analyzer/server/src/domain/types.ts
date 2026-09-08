export const FAILURE_TYPES = [
  'wrong_prompt',
  'wrong_tool_selection',
  'missing_context',
  'hallucination',
  'infinite_loop',
  'timeout',
  'invalid_output',
  'api_failure',
  'context_overflow',
] as const;

export type FailureType = (typeof FAILURE_TYPES)[number];

export type TimelineKind = 'step' | 'tool_call' | 'response' | 'failure' | 'unknown';

export interface TimelineEntry {
  index: number;
  kind: TimelineKind;
  label: string;
  content: string;
  outcome?: string;
  tokensIn?: number;
  tokensOut?: number;
  timestamp?: string;
}

export interface EvidenceItem {
  label: string;
  detail: string;
  severity: 'signal' | 'strong';
}

export interface ParseResult {
  format: string;
  timeline: TimelineEntry[];
  redactions: number;
}

export interface FailureVerdict {
  type: FailureType;
  rootCause: string;
  confidence: number;
  evidence: EvidenceItem[];
  fix: string;
  prevention: string;
}

export interface AnalysisResult {
  failure: FailureVerdict;
  timeline: TimelineEntry[];
  redactions: number;
}
