import type { EvidenceItem, FailureType, FailureVerdict, TimelineEntry } from '../domain/types.js';

interface RuleMatch {
  type: FailureType;
  confidence: number;
  rootCause: string;
  fix: string;
  prevention: string;
  evidence: EvidenceItem[];
}

function evidence(label: string, detail: string, severity: EvidenceItem['severity'] = 'signal'): EvidenceItem {
  return { label, detail: detail.slice(0, 500), severity };
}

function addEvidence(m: RuleMatch, e: EvidenceItem): RuleMatch {
  m.evidence.push(e);
  if (e.severity === 'strong' && m.confidence < 0.95) m.confidence = Math.min(0.95, m.confidence + 0.05);
  return m;
}

const FIXES: Record<FailureType, { fix: string; prevention: string }> = {
  wrong_prompt: {
    fix: 'Rewrite the system prompt with explicit task constraints, a defined output format, and step-by-step instructions. Add a "stop" condition so the agent knows when it is done.',
    prevention: 'Maintain a prompt checklist (goal, constraints, output schema, stop condition) and version your prompts so regressions can be diffed.',
  },
  wrong_tool_selection: {
    fix: 'Verify the tool registry the agent sees matches the tools actually available. Add clear descriptions of when each tool should be used, and log which tool was selected and why.',
    prevention: 'Add a tool-selection audit log and pin tool schemas in version control; test selection with a golden set of tasks.',
  },
  missing_context: {
    fix: 'Supply the missing information in the prompt or conversation history — e.g. the full schema, the previous step output, or the user requirement the agent referenced. Retry with the context included.',
    prevention: 'Set up a context contract: every step declares which context keys it reads/writes, and a pre-flight check fails fast when a key is missing.',
  },
  hallucination: {
    fix: 'Re-run the agent with constrained decoding where possible (e.g. JSON schema enforcement), and verify claims against the actual tool outputs before accepting them. Add a verification step that checks the final answer against the evidence in the timeline.',
    prevention: 'Add a mandatory verification pass, ground all statements in tool outputs, and log confidence per claim to spot fabrication patterns.',
  },
  infinite_loop: {
    fix: 'Add an iteration cap and loop detection (e.g. stop after the same tool call with identical arguments repeats 3 times). When a loop is detected, break with a mid-loop checkpoint so work is not lost.',
    prevention: 'Set max-iterations guards, deduplicate repeated tool calls, and alert when the same state recurs.',
  },
  timeout: {
    fix: 'Increase the timeout, split the task into smaller steps, or stream the response. If the timeout is caused by a slow tool, add retry-with-backoff and a deadline.',
    prevention: 'Set explicit deadlines per step, monitor step durations, and fail fast with a partial result instead of a hard abort.',
  },
  invalid_output: {
    fix: 'Enforce the output schema with validation on the agent side (e.g. structured output / function calling with JSON schema) and surface the validation error to the agent so it can self-correct.',
    prevention: 'Add output validation to CI-style checks and unit-test the schema against edge cases before deploying prompts.',
  },
  api_failure: {
    fix: 'Check the API provider status, verify the API key/quota, and add retry-with-backoff for transient errors (429/5xx). Ensure the agent treats API errors as recoverable, not fatal.',
    prevention: 'Add a provider status check before runs, rate-limit aware scheduling, and circuit breakers around the LLM API calls.',
  },
  context_overflow: {
    fix: 'Reduce the prompt size: trim conversation history, summarize earlier steps, or increase the model context window. Stream the log so the overflow point is visible.',
    prevention: 'Add token-budget tracking per step with a warning threshold, and automatic summarization of old steps.',
  },
};

const EVIDENCE_MAX = 6;

export function classifyFailure(timeline: TimelineEntry[]): FailureVerdict {
  const blob = timeline.map((t) => `${t.label} ${t.content} ${t.outcome ?? ''}`).join('\n').toLowerCase();
  const failures = timeline.filter((t) => t.kind === 'failure');
  const toolCalls = timeline.filter((t) => t.kind === 'tool_call');
  const responses = timeline.filter((t) => t.kind === 'response');
  const finalResponse = responses[responses.length - 1];
  const matches: RuleMatch[] = [];

  /* ---------- context overflow ---------- */
  {
    const m: RuleMatch = {
      type: 'context_overflow',
      confidence: 0.8,
      rootCause:
        'The conversation exceeded the model context window. Token-budget exhaustion truncated the history, and the agent lost earlier instructions or state.',
      fix: FIXES.context_overflow.fix,
      prevention: FIXES.context_overflow.prevention,
      evidence: [],
    };
    const byToken = timeline.some((t) => (t.tokensIn ?? 0) > 120_000);
    const byText = /context length|context window|context_length_exceeded|maximum context|token limit|prompt is too long|too many tokens|max_context|context overflow|truncat.*token|token.*truncat/i.test(blob);
    if (byToken) addEvidence(m, evidence('Token count', `A step used ${Math.max(...timeline.map((t) => t.tokensIn ?? 0))} input tokens (>120k threshold).`, 'strong'));
    if (byText) {
      const hit = failures.find((f) => /context|token/i.test(f.content)) ?? timeline.find((t) => /context|token/i.test(t.content));
      addEvidence(m, evidence('Provider error', hit?.content ?? 'Context-length error present in log.', 'strong'));
    }
    if (byToken || byText) matches.push(m);
  }

  /* ---------- timeout ---------- */
  {
    const m: RuleMatch = {
      type: 'timeout',
      confidence: 0.85,
      rootCause: 'A step exceeded its deadline. The agent (or a tool it called) did not complete within the allowed time, so the run aborted.',
      fix: FIXES.timeout.fix,
      prevention: FIXES.timeout.prevention,
      evidence: [],
    };
    const byOutcome = timeline.some((t) => (t.outcome ?? '').toLowerCase().includes('timeout'));
    const byText = /timed ?out|timeout|deadline (?:exceeded|reached)|request took too long|operation timed out|ECONNABORTED|max time|time limit/i.test(blob);
    if (byOutcome || byText) {
      const hit = failures.find((f) => /timeout|timed/i.test(f.content)) ?? timeline.find((t) => /timeout|timed/i.test(t.content));
      if (hit) addEvidence(m, evidence('Timeout signal', hit.content, 'strong'));
      matches.push(m);
    }
  }

  /* ---------- api failure ---------- */
  {
    const m: RuleMatch = {
      type: 'api_failure',
      confidence: 0.75,
      rootCause: 'The LLM provider (or an external API) rejected or failed the request — rate limit, quota, authentication, or server error.',
      fix: FIXES.api_failure.fix,
      prevention: FIXES.api_failure.prevention,
      evidence: [],
    };
    const byText = /(?:status(?:code)?[:=\s]+)?(429|401|403|5\d\d)\b|rate ?limit|insufficient_quota|quota (?:exceeded|exhausted)|ECONNREFUSED|connection (?:refused|reset)|upstream|502|503|500|invalid_api_key|authentication error|api key/i.test(blob);
    if (byText) {
      const hit = failures.find((f) => /429|401|403|5\d\d|quota|rate|refused|key/i.test(f.content));
      if (hit) addEvidence(m, evidence('API error', hit.content, 'strong'));
      matches.push(m);
    }
  }

  /* ---------- infinite loop ---------- */
  {
    const m: RuleMatch = {
      type: 'infinite_loop',
      confidence: 0.85,
      rootCause: 'The agent repeated the same action with identical arguments instead of progressing. Loop guards (max steps/iterations) eventually stopped the run.',
      fix: FIXES.infinite_loop.fix,
      prevention: FIXES.infinite_loop.prevention,
      evidence: [],
    };
    const byText = /max (?:iterations|steps|retries|recursion|turns)|too many (?:steps|iterations|retries|attempts)|recursion (?:limit|depth)|loop (?:detected|limit)|repetitive|stuck in a loop/i.test(blob);
    let loopCount = 0;
    let loopLabel = '';
    const seen = new Map<string, number>();
    for (const tc of toolCalls) {
      const key = `${tc.label}::${tc.content}`;
      const n = (seen.get(key) ?? 0) + 1;
      seen.set(key, n);
      if (n > loopCount) {
        loopCount = n;
        loopLabel = tc.label;
      }
    }
    const byLoop = loopCount >= 3;
    if (byLoop) {
      addEvidence(m, evidence('Repeated action', `Identical call "${loopLabel}" executed ${loopCount} times in a row.`, 'strong'), );
    }
    if (byText) {
      const hit = failures.find((f) => /iterations|steps|loop|recursion|retries/i.test(f.content));
      if (hit) addEvidence(m, evidence('Loop guard message', hit.content, 'strong'));
    }
    if (byLoop || byText) matches.push(m);
  }

  /* ---------- invalid output ---------- */
  {
    const m: RuleMatch = {
      type: 'invalid_output',
      confidence: 0.7,
      rootCause: 'The agent produced output that did not conform to the expected structure (JSON parse failure, schema violation, or malformed tool call arguments).',
      fix: FIXES.invalid_output.fix,
      prevention: FIXES.invalid_output.prevention,
      evidence: [],
    };
    const byText = /invalid (?:response|output|format|tool call)|unexpected token|JSON[ ._-]?parse|failed to parse|does not conform|(?:schema|validation) (?:error|failed)|output validation|malformed|missing required (?:field|property)|expected .* but got|expecting value|unterminated/i.test(blob);
    if (byText) {
      const hit = failures.find((f) => /invalid|parse|schema|validation|malformed|json/i.test(f.content));
      if (hit) addEvidence(m, evidence('Structure violation', hit.content, 'strong'));
      matches.push(m);
    }
  }

  /* ---------- hallucination ---------- */
  {
    const m: RuleMatch = {
      type: 'hallucination',
      confidence: 0.55,
      rootCause: 'The agent asserted something that contradicts the evidence in its own log — e.g. claiming success after a tool error, or fabricating results, files, or data that never existed.',
      fix: FIXES.hallucination.fix,
      prevention: FIXES.hallucination.prevention,
      evidence: [],
    };
    const byText = /fabricat|made up|hallucinat|invented|imagined/i.test(blob);
    const lastFailures = failures.filter((f) => (f.outcome ?? '') === 'error' || /error|fail/i.test(`${f.label} ${f.content}`));
    const successMarkers = /\b(done|success|completed|finished|saved|created|wrote|all set|works perfectly)\b/i;
    const finalSaysSuccess = !!finalResponse && successMarkers.test(finalResponse.content);
    const byContradiction = finalSaysSuccess && lastFailures.length > 0;
    if (byContradiction) {
      m.confidence = 0.85;
      addEvidence(m, evidence('Claimed success after error', `Final response says "done/success" but ${lastFailures.length} earlier step(s) ended in error, e.g. "${lastFailures[lastFailures.length - 1].content.slice(0, 200)}"`, 'strong'));
    }
    if (byText) {
      const hit = failures.find((f) => /fabricat|made up|hallucinat/i.test(f.content)) ?? timeline.find((t) => /fabricat|made up|hallucinat/i.test(t.content));
      if (hit) addEvidence(m, evidence('Fabrication marker', hit.content, 'strong'));
    }
    if (byText || byContradiction) matches.push(m);
  }

  /* ---------- missing context ---------- */
  {
    const m: RuleMatch = {
      type: 'missing_context',
      confidence: 0.7,
      rootCause: 'The agent referenced information that was never provided — an undefined variable, a missing parameter, or a requirement that only exists implicitly.',
      fix: FIXES.missing_context.fix,
      prevention: FIXES.missing_context.prevention,
      evidence: [],
    };
    const byText = /\bnot defined\b|undefined (?:variable|key|property|name)|KeyError|cannot find|couldn'?t find|doesn'?t exist|unknown (?:variable|parameter|field|identifier)|missing (?:argument|parameter|field|context|requirement)|not found|is not defined|nameerror|referenceerror/i.test(blob);
    if (byText) {
      const hit = failures.find((f) => /not defined|undefined|keyerror|cannot find|missing|not found|doesn/i.test(f.content));
      if (hit) addEvidence(m, evidence('Missing reference', hit.content, 'strong'));
      matches.push(m);
    }
  }

  /* ---------- wrong tool selection ---------- */
  {
    const m: RuleMatch = {
      type: 'wrong_tool_selection',
      confidence: 0.75,
      rootCause: 'The agent picked a tool that does not exist, is not available, or is wrong for the task — then either retried with another tool or failed outright.',
      fix: FIXES.wrong_tool_selection.fix,
      prevention: FIXES.wrong_tool_selection.prevention,
      evidence: [],
    };
    const byText = /unknown tool|tool not found|no such tool|invalid tool|unrecognized function|tool call error|function not found|not a valid tool|does not support/i.test(blob);
    if (byText) {
      const hit = failures.find((f) => /tool|function/i.test(f.content));
      if (hit) addEvidence(m, evidence('Unknown tool error', hit.content, 'strong'));
    }
    const failedToolNames = new Map<string, number>();
    for (const f of failures) {
      const name = /tool[:_ ]+([A-Za-z0-9_.-]+)/i.exec(`${f.label} ${f.content}`);
      if (name) failedToolNames.set(name[1], (failedToolNames.get(name[1]) ?? 0) + 1);
    }
    const distinctFailedTools = [...failedToolNames.keys()];
    if (distinctFailedTools.length >= 2) {
      addEvidence(m, evidence('Multiple failed tools', `${distinctFailedTools.length} different tools failed: ${distinctFailedTools.join(', ')}. The agent guessed tools instead of knowing the right one.`, 'strong'));
    }
    if (byText || distinctFailedTools.length >= 2) matches.push(m);
  }

  /* ---------- fallback: wrong prompt ---------- */
  {
    const m: RuleMatch = {
      type: 'wrong_prompt',
      confidence: 0.4,
      rootCause:
        'No mechanical failure (timeout, loop, API, schema) was detected. The most likely cause is that the instructions themselves were ambiguous, under-specified, or asked for something the agent cannot infer — so the agent produced an unusable or off-target result.',
      fix: FIXES.wrong_prompt.fix,
      prevention: FIXES.wrong_prompt.prevention,
      evidence: [
        evidence('No system-level failure', 'The log contains no timeout, loop, API, schema, or context errors — pointing to an instructions-level failure.'),
      ],
    };
    matches.push(m);
  }

  const winner = [...matches].sort((a, b) => b.confidence - a.confidence)[0];
  return {
    type: winner.type,
    rootCause: winner.rootCause,
    confidence: Number(winner.confidence.toFixed(2)),
    evidence: winner.evidence.slice(0, EVIDENCE_MAX),
    fix: winner.fix,
    prevention: winner.prevention,
  };
}
