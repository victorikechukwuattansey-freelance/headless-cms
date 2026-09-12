'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { APPROVED_COLUMNS, rowToObject } = require('../src/schema');
const { OUTREACH_COLUMNS } = require('../src/reconcile');
const { executeFromSheets, logRowToArray } = require('../src/execution');
const { providerFor } = require('../src/provider');
const {
  EXECUTION_NAMESPACE,
  EXECUTION_REGEX,
  loadExecutionFixtures,
} = require('../src/execution-fixtures');
const { GoogleSheetsClient, GoogleSheetsError } = require('../src/google-sheets-client');

const APPROVED_TAB = 'Approved Outreach';
const OUTREACH_TAB = 'Outreach Log';

const DEFAULT_SCENARIO = 'TEST-EXEC-001';
const DEFAULT_MODE = 'DRY_RUN';
const DEFAULT_PROVIDER = 'NOT_CONFIGURED';

const READ_ERROR_DOC = 'scenario simulates sheet read errors which cannot occur against a live spreadsheet; covered by unit tests (src/execution.js + src/embedded-execution.js)';

function parseArgs(argv) {
  const args = {
    execute: false,
    noInteractive: false,
    local: false,
    phases: [],
    scenario: DEFAULT_SCENARIO,
    mode: DEFAULT_MODE,
    provider: DEFAULT_PROVIDER,
    reportsDir: path.join(__dirname, '..', 'reports'),
  };
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true;
    else if (arg === '--no-interactive') args.noInteractive = true;
    else if (arg === '--local') args.local = true;
    else if (arg.startsWith('--scenario=')) args.scenario = arg.split('=')[1].trim();
    else if (arg.startsWith('--mode=')) args.mode = arg.split('=')[1].trim().toUpperCase();
    else if (arg.startsWith('--provider=')) args.provider = arg.split('=')[1].trim().toUpperCase();
    else if (arg.startsWith('--reports-dir=')) args.reportsDir = arg.split('=')[1];
    else if (arg === '--seed') args.phases.push('seed');
    else if (arg === '--run') args.phases.push('run');
    else if (arg === '--verify') args.phases.push('verify');
    else if (arg === '--cleanup') args.phases.push('cleanup');
    else if (arg === '--verify-final') args.phases.push('verify-final');
    else if (arg === '--all') args.phases = ['seed', 'run', 'verify', 'cleanup', 'verify-final'];
  }
  return args;
}

function usage() {
  return `
Usage: node scripts/run-execution-live.js [phases] [flags]

Phases (order fixed: seed -> run -> verify -> cleanup -> verify-final):
  --all                full SEED -> RUN -> VERIFY -> CLEANUP -> VERIFY-FINAL cycle
  --seed               seed TEST-EXEC-* fixtures (Approved Outreach + Outreach Log)
  --run                attempt the n8n execution (needs creds) or run locally (--local)
  --verify             read both tabs, validate log rows and idempotency, write artifact
  --cleanup            delete TEST-EXEC-* rows (namespace-guarded) from both tabs
  --verify-final       confirm zero TEST-EXEC-* rows remain after cleanup

Flags:
  --execute            allow actual spreadsheet mutations (seeding/appends/deletes).
                      Default is dry-run; NOTHING is written without --execute.
  --scenario=<id>      execution fixture to validate (default ${DEFAULT_SCENARIO})
  --mode=<M>           DRY_RUN (default) | REAL. MUST match how the n8n run was configured.
  --provider=<P>       SUCCESS | FAILURE | NOT_CONFIGURED (default). Mock only.
  --local              run the engine locally instead of posting to n8n (offline, deterministic)
  --no-interactive     never prompt; REQUIRE n8n creds for --run (unless --local), else fail
  --reports-dir=<dir>  artifact output directory (default ./reports)

Env (see .env.example):
  GOOGLE_SHEET_ID, GOOGLE_ACCESS_TOKEN, GOOGLE_SERVICE_ACCOUNT_JSON,
  N8N_BASE_URL, N8N_API_KEY, N8N_WORKFLOW_ID

Safety:
  - Only TEST-EXEC-* rows are ever deleted; non-namespaced rows are refused.
  - REAL mode only ever writes Outreach Log rows for provider-confirmed attempts.
  - With an unconfigured provider (the default), REAL runs refuse and write nothing.
`;
}

function assertLiveableScenario(scenario) {
  if (scenario.read_errors && (scenario.read_errors.approved || scenario.read_errors.outreach)) {
    throw new Error(`scenario ${scenario.id} cannot run live: ${READ_ERROR_DOC}`);
  }
}

function assertNamespacedExecution(leadId) {
  if (!EXECUTION_REGEX.test(String(leadId).trim())) {
    throw new Error(`Refusing to delete non-namespaced lead_id: ${leadId}`);
  }
}

function assertMatchTestName(name, what) {
  if (!EXECUTION_REGEX.test(String(name).trim())) {
    throw new Error(`Refusing to seed ${what}: ${name} is not in ${EXECUTION_NAMESPACE} namespace`);
  }
}

function isHeader(row, columns) {
  return row && row[0] === columns[0];
}

function rowsForNamespace(grid, columns, leadColumn) {
  const rows = [];
  (grid || []).forEach((row, index) => {
    if (isHeader(row, columns)) return;
    const leadId = String(row[leadColumn] ?? '').trim();
    if (!EXECUTION_REGEX.test(leadId)) return;
    rows.push({ index, leadId, obj: rowToObject(row, columns) });
  });
  rows.sort((a, b) => a.index - b.index);
  return rows;
}

async function seed(env, client, args) {
  assertMatchTestName(args.scenario, 'scenario');
  const scenario = loadExecutionFixtures().find((f) => f.id === args.scenario);
  if (!scenario) {
    console.error(`[seed] unknown scenario ${args.scenario}`);
    process.exit(1);
  }
  assertLiveableScenario(scenario);

  const approvedGrid = await client.listRows(APPROVED_TAB);
  const approvedIds = new Set(approvedGrid.map((r) => String(r[0] ?? '').trim()).filter(Boolean));
  const approvedToAppend = scenario.approvedRows
    .filter((r) => !approvedIds.has(r.lead_id))
    .map((r) => APPROVED_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  const outreachGrid = await client.listRows(OUTREACH_TAB);
  const outreachLeadIds = new Set(outreachGrid.map((r) => String(r[1] ?? '').trim()).filter(Boolean));
  const outreachToAppend = scenario.outreachRows
    .filter((r) => !outreachLeadIds.has(r.lead_id))
    .map((r) => OUTREACH_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  console.log(`[seed] scenario ${args.scenario}: Approved=${scenario.approvedRows.length} Outreach=${scenario.outreachRows.length}`);
  console.log(`[seed] to append: Approved=${approvedToAppend.length} Outreach=${outreachToAppend.length}`);
  if (!args.execute) {
    console.warn('[seed] DRY-RUN: pass --execute to actually write. Nothing written.');
    return;
  }
  if (approvedToAppend.length) await client.appendRows(APPROVED_TAB, approvedToAppend);
  if (outreachToAppend.length) await client.appendRows(OUTREACH_TAB, outreachToAppend);
  console.log('[seed] done');
}

function executionScoped({ approvedRows, outreachRows, mode, provider, messageVariants }) {
  return executeFromSheets({
    approvedRows,
    outreachRows,
    messageVariants,
    mode,
    provider: providerFor(provider),
  }).then(({ report }) => report);
}

async function runLocal(client, args) {
  const scenario = loadExecutionFixtures().find((f) => f.id === args.scenario);
  const messageVariants = scenario ? scenario.message_variants : {};
  const approvedRows = rowsForNamespace(await client.listRows(APPROVED_TAB), APPROVED_COLUMNS, 0).map((r) => r.obj);
  const outreachRows = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1).map((r) => r.obj);
  const report = await executionScoped({ approvedRows, outreachRows, mode: args.mode, provider: args.provider, messageVariants });

  const logRows = report.log_rows || [];
  if (report.status === 'COMPLETED' && logRows.length > 0) {
    if (!args.execute) {
      console.warn(`[run] LOCAL: ${logRows.length} confirmed attempt(s) staged but DRY-RUN; pass --execute to append. Nothing written.`);
    } else {
      const rows = logRows.map(logRowToArray);
      await client.appendRows(OUTREACH_TAB, rows);
      console.log(`[run] LOCAL: appended ${rows.length} Outreach Log row(s) for provider-confirmed attempts`);
    }
  } else {
    console.log(`[run] LOCAL: no log rows staged (status=${report.status} mode=${report.mode} provider=${report.provider} provider_configured=${report.provider_configured})`);
  }

  await writeReportArtifact(report, args);
  console.log(`[run] report: run_id=${report.run_id} status=${report.status} executed_succeeded=${report.executed_succeeded} log_rows_written=${report.log_rows_written}`);
  return report;
}

async function runN8n(env, args) {
  const { N8N_BASE_URL, N8N_API_KEY, N8N_WORKFLOW_ID } = env;
  if (!N8N_BASE_URL || !N8N_API_KEY || !N8N_WORKFLOW_ID) return null;
  const workflowPath = path.join(__dirname, '..', 'Outreach-Execution-and-Delivery V1.json');
  const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  try {
    const res = await fetch(`${N8N_BASE_URL}/api/v1/executions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_API_KEY },
      body: JSON.stringify({ workflowData: workflow }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new GoogleSheetsError(`n8n execution create failed: ${res.status} ${text}`, res.status, text);
    }
    const json = await res.json();
    console.log(`[run] n8n execution created: ${json.id || json.executionId || JSON.stringify(json)}`);
    console.warn('[run] NOTE: confirm in the n8n UI that Execute Ready Queue produced the report output.');
    return json;
  } catch (err) {
    console.warn(`[run] n8n API attempt failed (${err.message}). Falling back to MANUAL execution.`);
    console.warn('[run] No LIVE pass is claimed unless the execution is confirmed.');
    return null;
  }
}

function manualRunPrompt() {
  console.log('[run] MANUAL step required:');
  console.log('  1. Open n8n and trigger "Lead Recovery Engine — Outreach Execution & Delivery V1".');
  console.log('  2. Confirm Execute Ready Queue output on the Execution Complete node.');
  console.log('  3. Press Enter to continue to VERIFY.');
}

async function run(env, args, client) {
  if (args.local) {
    return runLocal(client, args);
  }
  const result = await runN8n(env, args);
  if (result) return 'LIVE-ATTEMPTED';
  if (args.noInteractive) {
    console.error('[run] FAIL: --no-interactive requires working N8N creds (or use --local).');
    console.error('[run] No result claimed; aborting before VERIFY.');
    process.exit(3);
  }
  manualRunPrompt();
  return 'MANUAL';
}

/**
 * Post-run expectation: exactly the leader-success paths become committed rows,
 * so a second run over the committed sheet suppresses them and writes nothing.
 */
function expectedPostRun(clean) {
  const successes = clean.executed_succeeded;
  return {
    status: 'COMPLETED',
    approved_total: clean.approved_total,
    queue_total: clean.queue_total,
    ready_candidates: clean.ready_candidates,
    executed_attempted: clean.executed_attempted - successes,
    executed_succeeded: 0,
    executed_failed: clean.executed_failed,
    executed_skipped: clean.executed_skipped,
    executed_rejected: clean.executed_rejected,
    duplicate_suppressed: successes,
    log_rows_written: 0,
    provider_calls: clean.executed_attempted - successes,
  };
}

function stripSentAt(row) {
  return JSON.parse(JSON.stringify(row, (key, val) => (key === 'sent_at' ? undefined : val)));
}

async function writeReportArtifact(report, args) {
  fs.mkdirSync(args.reportsDir, { recursive: true });
  const target = path.join(args.reportsDir, `${report.run_id}-execution.json`);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[verify] report artifact written: ${target}`);
  return target;
}

async function verify(env, client, args) {
  const scenario = loadExecutionFixtures().find((f) => f.id === args.scenario);
  if (!scenario) {
    throw new Error(`unknown scenario ${args.scenario}`);
  }
  assertLiveableScenario(scenario);
  const outcome = await buildVerifyOutcome({
    approvedGrid: await client.listRows(APPROVED_TAB),
    outreachGrid: await client.listRows(OUTREACH_TAB),
    scenario,
    mode: args.mode,
    provider: args.provider,
  });
  await writeReportArtifact(outcome.clean, args);
  if (!outcome.ok) {
    const failed = outcome.lines.filter((l) => !l.ok).map((l) => l.label);
    console.error(`[verify] FAIL: checks off for scenario ${args.scenario}: ${failed.join(', ')}`);
  }
  return outcome;
}

async function buildVerifyOutcome({ approvedGrid, outreachGrid, scenario, mode, provider }) {
  const lines = [];

  const clean = await executionScoped({
    approvedRows: scenario.approvedRows,
    outreachRows: scenario.outreachRows,
    mode,
    provider,
    messageVariants: scenario.message_variants,
  });
  const expected = scenario.expected;

  const metricChecks = [
    ['status', clean.status, expected.status],
    ['approved_total', clean.approved_total, expected.approved_total],
    ['queue_total', clean.queue_total, expected.queue_total],
    ['ready_candidates', clean.ready_candidates, expected.ready_candidates],
    ['executed_succeeded', clean.executed_succeeded, expected.executed_succeeded],
    ['executed_failed', clean.executed_failed, expected.executed_failed],
    ['executed_skipped', clean.executed_skipped, expected.executed_skipped],
    ['executed_rejected', clean.executed_rejected, expected.executed_rejected],
    ['duplicate_suppressed', clean.duplicate_suppressed, expected.duplicate_suppressed],
    ['log_rows_written', clean.log_rows_written, expected.log_rows_written],
    ['provider_calls', clean.provider_calls, expected.provider_calls],
  ];
  for (const [label, actual, want] of metricChecks) {
    const ok = deepEqualStrict(actual, want);
    lines.push({
      ok,
      label: `${label} = ${format(actual)} (expect ${format(want)})`,
      detail: ok ? 'matches scenario' : 'does NOT match scenario',
      tag: 'AUTOMATED',
    });
  }

  const approved = rowsForNamespace(approvedGrid, APPROVED_COLUMNS, 0);
  const outreach = rowsForNamespace(outreachGrid, OUTREACH_COLUMNS, 1);
  const actualRun = await executionScoped({
    approvedRows: approved.map((r) => r.obj),
    outreachRows: outreach.map((r) => r.obj),
    mode,
    provider,
    messageVariants: scenario.message_variants,
  });
  const postExpected = expectedPostRun(clean);

  const postChecks = [
    ['status', actualRun.status, postExpected.status],
    ['approved_total', actualRun.approved_total, postExpected.approved_total],
    ['queue_total', actualRun.queue_total, postExpected.queue_total],
    ['ready_candidates', actualRun.ready_candidates, postExpected.ready_candidates],
    ['executed_attempted', actualRun.executed_attempted, postExpected.executed_attempted],
    ['executed_succeeded', actualRun.executed_succeeded, postExpected.executed_succeeded],
    ['executed_failed', actualRun.executed_failed, postExpected.executed_failed],
    ['executed_skipped', actualRun.executed_skipped, postExpected.executed_skipped],
    ['executed_rejected', actualRun.executed_rejected, postExpected.executed_rejected],
    ['duplicate_suppressed', actualRun.duplicate_suppressed, postExpected.duplicate_suppressed],
    ['log_rows_written', actualRun.log_rows_written, postExpected.log_rows_written],
    ['provider_calls', actualRun.provider_calls, postExpected.provider_calls],
  ];
  for (const [label, actual, want] of postChecks) {
    const ok = deepEqualStrict(actual, want);
    lines.push({
      ok,
      label: `post-run ${label} = ${format(actual)} (expect ${format(want)})`,
      detail: ok ? 'idempotent second-run state' : 'NOT idempotent',
      tag: 'AUTOMATED',
    });
  }

  const cleanRowIds = new Set(clean.log_rows.map((r) => r.outreach_id));
  const committed = outreach.filter((r) => cleanRowIds.has(r.obj.outreach_id));
  const committedOk = committed.length === clean.log_rows.length;
  lines.push({
    ok: committedOk,
    label: `committed rows = ${committed.length} (expect ${clean.log_rows.length})`,
    detail: committedOk ? 'every confirmed attempt landed an Outreach Log row' : 'committed rows do NOT match confirmed attempts',
    tag: 'AUTOMATED',
  });
  for (const cleanRow of clean.log_rows) {
    const match = committed.find((r) => r.obj.outreach_id === cleanRow.outreach_id);
    const ok = Boolean(match) && deepEqualStrict(stripSentAt(match.obj), stripSentAt(cleanRow));
    lines.push({
      ok,
      label: `log row ${cleanRow.outreach_id} (${cleanRow.channel}) matches engine`,
      detail: ok ? 'content identical' : 'content differs or missing',
      tag: 'AUTOMATED',
    });
  }

  const passed = lines.filter((l) => l.ok).length;
  return { lines, passed, total: lines.length, ok: passed === lines.length, clean };
}

function format(value) {
  return value === null ? 'null' : String(value);
}

function deepEqualStrict(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function printOutcome(outcome, title) {
  const banner = [
    '='.repeat(40),
    title,
    '='.repeat(40),
  ];
  for (const line of banner) console.log(line);
  for (const line of outcome.lines) {
    const tag = line.tag && line.tag !== 'AUTOMATED' ? ` (${line.tag})` : '';
    console.log(`${line.ok ? '[PASS]' : '[FAIL]'} ${line.label}${tag}`);
    console.log(`       ${line.detail}`);
  }
  console.log('---');
  console.log(`RESULT: ${outcome.passed}/${outcome.total} PASS`);
  return outcome;
}

async function cleanup(env, client, args) {
  const approved = rowsForNamespace(await client.listRows(APPROVED_TAB), APPROVED_COLUMNS, 0);
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1);
  for (const row of [...approved, ...outreach]) assertNamespacedExecution(row.leadId);
  const total = approved.length + outreach.length;
  console.log(`[cleanup] TEST-EXEC rows found: Approved=${approved.length} Outreach=${outreach.length}`);
  if (total === 0) {
    console.log('[cleanup] nothing to clean (idempotent no-op)');
    return true;
  }
  if (!args.execute) {
    console.warn('[cleanup] DRY-RUN: pass --execute to actually delete. Nothing deleted.');
    return false;
  }
  await client.deleteRows(APPROVED_TAB, approved.map((r) => r.index));
  await client.deleteRows(OUTREACH_TAB, outreach.map((r) => r.index));

  const after = rowsForNamespace(await client.listRows(APPROVED_TAB), APPROVED_COLUMNS, 0).length
    + rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1).length;
  if (after !== 0) {
    console.error(`[cleanup] FAIL: ${after} TEST-EXEC rows remain after delete.`);
    return false;
  }
  console.log('[cleanup] verified: zero TEST-EXEC rows remain in Approved Outreach and Outreach Log');
  return true;
}

async function verifyFinal(client) {
  const approved = rowsForNamespace(await client.listRows(APPROVED_TAB), APPROVED_COLUMNS, 0);
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1);
  const total = approved.length + outreach.length;
  const ok = total === 0;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} final isolation: ${total} TEST-EXEC rows remain`);
  console.log(`RESULT: ${ok ? 1 : 0}/${1} PASS`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.phases.length === 0) {
    console.log(usage());
    process.exit(1);
  }
  const env = process.env;
  const spreadsheetId = env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    console.error('GOOGLE_SHEET_ID is required. See .env.example.');
    process.exit(1);
  }
  const client = GoogleSheetsClient.fromEnv(env);
  for (const phase of args.phases) {
    if (phase === 'seed') {
      await seed(env, client, args);
    } else if (phase === 'run') {
      await run(env, args, client);
    } else if (phase === 'verify') {
      const outcome = await verify(env, client, args);
      printOutcome(outcome, `OUTREACH-EXECUTION-AND-DELIVERY V1 live verify (${args.scenario}, ${args.mode}/${args.provider})`);
    } else if (phase === 'cleanup') {
      await cleanup(env, client, args);
    } else if (phase === 'verify-final') {
      await verifyFinal(client);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[outreach-execution] ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  seed,
  run,
  runLocal,
  verify,
  buildVerifyOutcome,
  cleanup,
  verifyFinal,
  rowsForNamespace,
  executionScoped,
  expectedPostRun,
};