import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.report.count();
  if (existing > 0) {
    console.log(`Seed skipped — ${existing} report(s) already exist.`);
    return;
  }

  await prisma.report.create({
    data: {
      summary:
        'The agent failed with an infinite loop (85% confidence) after 14 timeline events, including 9 tool calls and 4 errors.',
      failureType: 'infinite_loop',
      rootCause:
        'The agent repeated the same action with identical arguments instead of progressing. Loop guards (max steps/iterations) eventually stopped the run.',
      confidence: 0.85,
      recommendedFix:
        'Add an iteration cap and loop detection (e.g. stop after the same tool call with identical arguments repeats 3 times). When a loop is detected, break with a mid-loop checkpoint so work is not lost.',
      preventionStrategy:
        'Set max-iterations guards, deduplicate repeated tool calls, and alert when the same state recurs.',
      sourceFormat: 'langchain',
      redactions: 2,
      steps: {
        create: [
          { order: 0, kind: 'step', label: 'chain: agent', content: 'input: "Fix the bug in src/worker.js"' },
          { order: 1, kind: 'tool_call', label: 'tool: read_file', content: 'path: src/worker.js', outcome: 'success' },
          { order: 2, kind: 'tool_call', label: 'tool: apply_patch', content: 'patch: replace line 12', outcome: 'error' },
          { order: 3, kind: 'tool_call', label: 'tool: read_file', content: 'path: src/worker.js', outcome: 'success' },
          { order: 4, kind: 'tool_call', label: 'tool: apply_patch', content: 'patch: replace line 12', outcome: 'error' },
          { order: 5, kind: 'tool_call', label: 'tool: read_file', content: 'path: src/worker.js', outcome: 'success' },
          { order: 6, kind: 'tool_call', label: 'tool: apply_patch', content: 'patch: replace line 12', outcome: 'error' },
          { order: 7, kind: 'tool_call', label: 'tool: read_file', content: 'path: src/worker.js', outcome: 'success' },
          { order: 8, kind: 'tool_call', label: 'tool: apply_patch', content: 'patch: replace line 12', outcome: 'error' },
          { order: 9, kind: 'failure', label: 'llm: agent', content: 'error: Max iterations exceeded (10)', outcome: 'error' },
          { order: 10, kind: 'response', label: 'llm: agent', content: 'I could not fix the bug because the patch kept failing.' },
        ],
      },
      evidences: {
        create: [
          { label: 'Repeated action', detail: 'Identical call "tool: apply_patch" executed 4 times in a row.', severity: 'strong' },
          { label: 'Loop guard message', detail: 'error: Max iterations exceeded (10)', severity: 'strong' },
        ],
      },
    },
  });

  await prisma.report.create({
    data: {
      summary: 'The agent failed with an API failure (75% confidence) after 6 timeline events, including 3 tool calls and 2 errors.',
      failureType: 'api_failure',
      rootCause: 'The LLM provider (or an external API) rejected or failed the request — rate limit, quota, authentication, or server error.',
      confidence: 0.75,
      recommendedFix:
        'Check the API provider status, verify the API key/quota, and add retry-with-backoff for transient errors (429/5xx). Ensure the agent treats API errors as recoverable, not fatal.',
      preventionStrategy:
        'Add a provider status check before runs, rate-limit aware scheduling, and circuit breakers around the LLM API calls.',
      sourceFormat: 'openai',
      redactions: 1,
      steps: {
        create: [
          { order: 0, kind: 'step', label: 'message (user)', content: 'Summarize the Q3 report' },
          { order: 1, kind: 'response', label: 'message (assistant)', content: 'I will fetch the report first.' },
          { order: 2, kind: 'tool_call', label: 'tool_call: get_report', content: '{"report_id": "q3"}' },
          { order: 3, kind: 'failure', label: 'message (assistant)', content: '{"error": {"message": "Rate limit exceeded", "type": "requests", "code": 429}}', outcome: 'error' },
          { order: 4, kind: 'failure', label: 'message (assistant)', content: '{"error": {"message": "Rate limit exceeded", "type": "requests", "code": 429}}', outcome: 'error' },
          { order: 5, kind: 'failure', label: 'message (assistant)', content: '{"error": {"message": "Rate limit exceeded", "type": "requests", "code": 429}}', outcome: 'error' },
        ],
      },
      evidences: {
        create: [
          { label: 'API error', detail: '{"error": {"message": "Rate limit exceeded", "type": "requests", "code": 429}}', severity: 'strong' },
        ],
      },
    },
  });

  console.log('Seed complete — 2 example reports created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
