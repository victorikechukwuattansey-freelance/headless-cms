'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { RESPONSE_COLUMNS } = require('../src/response-capture');
const { OUTREACH_COLUMNS } = require('../src/reconcile');
const { rowToObject } = require('../src/schema');
const { reconcileResponses } = require('../src/response-reconcile');
const {
  RESP_RECON_NAMESPACE,
  RESP_RECON_REGEX,
  loadResponseReconcileFixtures,
} = require('../src/response-reconcile-fixtures');
const { GoogleSheetsClient } = require('../src/google-sheets-client');

const RESPONSE_TAB = 'Response Log';
const RESPONSE_LEAD_INDEX = 2;
const OUTREACH_TAB = 'Outreach Log';
const OUTREACH_LEAD_INDEX = 1;

const DEFAULT_SCENARIO = 'TEST-RESP-RECON-001';

const FIXED_NOW = Date.parse('2026-09-11T09:00:00.000Z');

/**
 * The reconcile phases mirror spec §16 (seed -> ingest/read -> verify ->
 * repeat -> verify-idempotency -> cleanup -> verify-cleanup). The read-only
 * "ingest/read" phase is named `run` here.
 */
function parseArgs(argv) {
  const args = {
    execute: false,
    noInteractive: false,
    phases: [],
    scenario: DEFAULT_SCENARIO,
    reportsDir: path.join(__dirname, '..', 'reports'),
  };
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true;
    else if (arg === '--no-interactive') args.noInteractive = true;
    else if (arg.startsWith('--scenario=')) args.scenario = arg.split('=')[1].trim();
    else if (arg.startsWith('--reports-dir=')) args.reportsDir = arg.split('=')[1];
    else if (arg === '--seed') args.phases.push('seed');
    else if (arg === '--run') args.phases.push('run');
    else if (arg === '--verify') args.phases.push('verify');
    else if (arg === '--repeat') args.phases.push('repeat');
    else if (arg === '--verify-idempotency') args.phases.push('verify-idempotency');
    else if (arg === '--cleanup') args.phases.push('cleanup');
    else if (arg === '--verify-cleanup') args.phases.push('verify-cleanup');
    else if (arg === '--all' || arg === '--full-cycle') {
      args.phases = ['seed', 'run', 'verify', 'repeat', 'verify-idempotency', 'cleanup', 'verify-cleanup'];
    }
  }
  return args;
}

function usage() {
  return `
Usage: node scripts/run-response-reconciliation-live.js [phases] [flags]

Phases (order fixed: seed -> run -> verify -> repeat -> verify-idempotency -> cleanup -> verify-cleanup):
  --all / --full-cycle  full cycle through every phase
  --seed                seed the scenario's pre-existing Response Log + Outreach Log rows (namespace-guarded)
  --run                 run the deterministic reconciliation engine over the scenario and write a report artifact
                       (read-only; never touches the spreadsheet)
  --verify              read the live Response Log + Outreach Log, reconcile against the scenario, validate metrics
  --repeat              re-run the reconcile locally; assert the report is byte-identical (determinism)
  --verify-idempotency  reconcile over the live rows twice and assert byte-identical reports with no sheet mutation
  --cleanup             delete TEST-RESP-RECON-* rows from both tabs (namespace-guarded)
  --verify-cleanup      confirm zero TEST-RESP-RECON-* rows remain in both tabs

Flags:
  --execute             allow actual spreadsheet mutations (seeding/deletes). Default is
                        dry-run; NOTHING is written without --execute.
  --scenario=<id>       response-reconcile fixture to validate (default ${DEFAULT_SCENARIO})
  --no-interactive      never prompt; fail fast when required env is missing
  --reports-dir=<dir>   evidence artifact directory (writes <dir>/<run_id>-response-reconciliation.json)

Env (see .env.example):
  GOOGLE_SHEET_ID, GOOGLE_ACCESS_TOKEN, GOOGLE_SERVICE_ACCOUNT_JSON

Read-only contract:
  - This artifact NEVER writes queue/approval data, never sends, never invokes a
    provider, never interprets response intent, and repairs nothing.
  - Only TEST-RESP-RECON-* Response Log and Outreach Log rows are ever seeded or
    deleted. Cleanup requires the lead_id namespace on BOTH tabs.
  - The reconcile itself is a pure, deterministic engine run; the spreadsheet is
    only ever read during verify.
`;
}

/**
 * Liveability: a scenario must be fully cleanable by the TEST-RESP-RECON lead_id
 * namespace on BOTH tabs and must not simulate read failures (which cannot occur
 * against a live spreadsheet). Scenarios that persist durable rows under empty
 * or non-namespaced lead_ids (e.g. UNMATCHED capture rows) are covered by the
 * engine/fixture tests only.
 */
function assertLiveableScenario(scenario) {
  if (scenario.response_read_error || scenario.outreach_read_error) {
    throw new Error(
      `scenario ${scenario.id} cannot run live: it simulates sheet read errors which cannot occur against a live spreadsheet; covered by unit tests (src/response-reconcile.js)`,
    );
  }
  for (const row of scenario.initialResponseRows || []) {
    const leadId = String(row.lead_id).trim();
    if (!RESP_RECON_REGEX.test(leadId)) {
      throw new Error(
        `scenario ${scenario.id} cannot run live: Response Log row has non-namespaced or empty lead_id (${leadId}); the ${RESP_RECON_NAMESPACE} namespace cannot clean it`,
      );
    }
  }
  for (const row of scenario.initialOutreachRows || []) {
    const leadId = String(row.lead_id).trim();
    if (!RESP_RECON_REGEX.test(leadId)) {
      throw new Error(
        `scenario ${scenario.id} cannot run live: Outreach Log row has non-namespaced or empty lead_id (${leadId}); the ${RESP_RECON_NAMESPACE} namespace cannot clean it`,
      );
    }
  }
}

function assertNamespacedLead(leadId) {
  if (!RESP_RECON_REGEX.test(String(leadId).trim())) {
    throw new Error(`Refusing to delete non-namespaced lead_id: ${leadId}`);
  }
}

function assertNamespacedScenario(scenarioId) {
  if (!RESP_RECON_REGEX.test(String(scenarioId).trim())) {
    throw new Error(`Refusing to run scenario: ${scenarioId} is not in ${RESP_RECON_NAMESPACE} namespace`);
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
    if (!RESP_RECON_REGEX.test(leadId)) return;
    rows.push({ index, leadId, obj: rowToObject(row, columns) });
  });
  rows.sort((a, b) => a.index - b.index);
  return rows;
}

async function seed(env, client, args) {
  assertNamespacedScenario(args.scenario);
  const scenario = loadResponseReconcileFixtures().find((f) => f.id === args.scenario);
  if (!scenario) {
    console.error(`[seed] unknown scenario ${args.scenario}`);
    process.exit(1);
  }
  assertLiveableScenario(scenario);

  const responseGrid = await client.listRows(RESPONSE_TAB);
  const responsePresent = new Set(
    rowsForNamespace(responseGrid, RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX).map((r) => r.obj.response_id),
  );
  const responseToAppend = scenario.initialResponseRows
    .filter((r) => !responsePresent.has(String(r.response_id).trim()))
    .map((r) => RESPONSE_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  const outreachGrid = await client.listRows(OUTREACH_TAB);
  const outreachKey = (row) => String(row.lead_id).trim() + '::' + String(row.outreach_id).trim();
  const outreachPresent = new Set(
    rowsForNamespace(outreachGrid, OUTREACH_COLUMNS, OUTREACH_LEAD_INDEX).map((r) => outreachKey(r.obj)),
  );
  const outreachToAppend = scenario.initialOutreachRows
    .filter((r) => !outreachPresent.has(outreachKey(r)))
    .map((r) => OUTREACH_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  console.log(
    `[seed] scenario ${args.scenario}: response rows=${scenario.initialResponseRows.length} (append ${responseToAppend.length}), ` +
      `outreach rows=${scenario.initialOutreachRows.length} (append ${outreachToAppend.length})`,
  );
  if (!args.execute) {
    console.warn('[seed] DRY-RUN: pass --execute to actually write. Nothing written.');
    return;
  }
  if (responseToAppend.length) await client.appendRows(RESPONSE_TAB, responseToAppend);
  if (outreachToAppend.length) await client.appendRows(OUTREACH_TAB, outreachToAppend);
  console.log('[seed] done (Response Log + Outreach Log only; no other tab is ever touched)');
}

/** Deterministic engine run over a scenario's recorded rows (read-only). */
function reconcileScoped({ responseRows, outreachRows, responseReadError, outreachReadError, now = FIXED_NOW, runId }) {
  return reconcileResponses({
    responseRows,
    outreachRows,
    responseReadError,
    outreachReadError,
    now,
    runId,
  });
}

async function writeReconArtifact(report, args) {
  fs.mkdirSync(args.reportsDir, { recursive: true });
  const target = path.join(args.reportsDir, `${report.run_id}-response-reconciliation.json`);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[artifact] reconciliation report written: ${target}`);
  return target;
}

async function run(env, client, args) {
  const scenario = loadResponseReconcileFixtures().find((f) => f.id === args.scenario);
  assertLiveableScenario(scenario);
  const report = reconcileScoped({
    responseRows: scenario.initialResponseRows,
    outreachRows: scenario.initialOutreachRows,
    responseReadError: scenario.response_read_error,
    outreachReadError: scenario.outreach_read_error,
    now: FIXED_NOW,
  });
  await writeReconArtifact(report, args);
  console.log(
    `[run] status=${report.status} response_records=${report.summary.response_records} matched=${report.summary.matched_records} ` +
      `not_verifiable=${report.summary.not_verifiable} violations=${report.summary.violations} exceptions=${report.summary.exception_count}`,
  );
  return report;
}

/** Re-run the reconcile; determinism requires byte-identical reports. */
async function repeat(env, client, args) {
  const scenario = loadResponseReconcileFixtures().find((f) => f.id === args.scenario);
  assertLiveableScenario(scenario);
  const first = reconcileScoped({
    responseRows: scenario.initialResponseRows,
    outreachRows: scenario.initialOutreachRows,
    responseReadError: scenario.response_read_error,
    outreachReadError: scenario.outreach_read_error,
    now: FIXED_NOW,
    runId: 'REPEAT-RUN-1',
  });
  const second = reconcileScoped({
    responseRows: scenario.initialResponseRows,
    outreachRows: scenario.initialOutreachRows,
    responseReadError: scenario.response_read_error,
    outreachReadError: scenario.outreach_read_error,
    now: FIXED_NOW,
    runId: 'REPEAT-RUN-2',
  });
  const clean = (r) => {
    const { run_id, run_at, detected_at, ...rest } = r;
    return rest;
  };
  const identical = JSON.stringify(clean(first)) === JSON.stringify(clean(second));
  console.log(`[repeat] deterministic=${identical} status=${second.status} responses=${second.summary.response_records} exceptions=${second.summary.exception_count}`);
  if (!identical) {
    console.error('[repeat] FAIL: second reconcile differs from the first; determinism violated.');
  }
  return second;
}

function format(value) {
  return value === null ? 'null' : String(value);
}

function deepEqualStrict(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function buildVerifyOutcome({ responseGrid, outreachGrid, scenario, now = FIXED_NOW }) {
  const lines = [];

  const clean = reconcileScoped({
    responseRows: scenario.initialResponseRows,
    outreachRows: scenario.initialOutreachRows,
    responseReadError: scenario.response_read_error,
    outreachReadError: scenario.outreach_read_error,
    now,
  });
  const expected = scenario.expected;

  const metricChecks = [
    ['status', clean.status, expected.status],
    ['response_records', clean.summary.response_records, expected.response_records],
    ['matched_records', clean.summary.matched_records, expected.matched_records],
    ['unmatched_records', clean.summary.unmatched_records, expected.unmatched_records],
    ['linked_records', clean.summary.linked_records, expected.linked_records],
    ['not_verifiable', clean.summary.not_verifiable, expected.not_verifiable],
    ['invalid_records', clean.summary.invalid_records, expected.invalid_records],
    ['duplicate_records', clean.summary.duplicate_records, expected.duplicate_records],
    ['violations', clean.summary.violations, expected.violations],
    ['coverage_rate', clean.summary.coverage_rate, expected.coverage_rate],
    ['exception_count', clean.summary.exception_count, expected.exception_count],
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

  const liveResponse = rowsForNamespace(responseGrid, RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX);
  const liveOutreach = rowsForNamespace(outreachGrid, OUTREACH_COLUMNS, OUTREACH_LEAD_INDEX);
  const actualRun = reconcileScoped({
    responseRows: liveResponse.map((r) => r.obj),
    outreachRows: liveOutreach.map((r) => r.obj),
    responseReadError: '',
    outreachReadError: '',
    now,
  });
  for (const [label, want] of metricChecks) {
    const actual = label === 'status' ? actualRun.status : actualRun.summary[label];
    const ok = deepEqualStrict(actual, want);
    lines.push({
      ok,
      label: `live-sheet ${label} = ${format(actual)} (expect ${format(want)})`,
      detail: ok ? 'live sheets reconcile identically' : 'live sheets do NOT match expectation',
      tag: 'AUTOMATED',
    });
  }

  const passed = lines.filter((l) => l.ok).length;
  return { lines, passed, total: lines.length, ok: passed === lines.length, report: clean, actual: actualRun };
}

async function verify(env, client, args) {
  const scenario = loadResponseReconcileFixtures().find((f) => f.id === args.scenario);
  if (!scenario) throw new Error(`unknown scenario ${args.scenario}`);
  assertLiveableScenario(scenario);
  const outcome = await buildVerifyOutcome({
    responseGrid: await client.listRows(RESPONSE_TAB),
    outreachGrid: await client.listRows(OUTREACH_TAB),
    scenario,
  });
  await writeReconArtifact(outcome.report, args);
  if (!outcome.ok) {
    const failed = outcome.lines.filter((l) => !l.ok).map((l) => l.label);
    console.error(`[verify] FAIL: checks off for scenario ${args.scenario}: ${failed.join(', ')}`);
  }
  return outcome;
}

/**
 * Reconciling is read-only, so idempotency is proven by running twice over the
 * same live rows and asserting byte-identical reports (modulo run identity).
 */
async function verifyIdempotency(env, client, args) {
  const scenario = loadResponseReconcileFixtures().find((f) => f.id === args.scenario);
  if (!scenario) throw new Error(`unknown scenario ${args.scenario}`);
  assertLiveableScenario(scenario);
  const responseGrid = await client.listRows(RESPONSE_TAB);
  const outreachGrid = await client.listRows(OUTREACH_TAB);
  const rows = {
    responseRows: rowsForNamespace(responseGrid, RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX).map((r) => r.obj),
    outreachRows: rowsForNamespace(outreachGrid, OUTREACH_COLUMNS, OUTREACH_LEAD_INDEX).map((r) => r.obj),
  };
  const a = reconcileScoped(Object.assign({}, rows, { now: FIXED_NOW, runId: 'IDEM-A' }));
  const b = reconcileScoped(Object.assign({}, rows, { now: FIXED_NOW, runId: 'IDEM-B' }));
  const clean = (r) => {
    const { run_id, run_at, detected_at, ...rest } = r;
    return rest;
  };
  const ok = JSON.stringify(clean(a)) === JSON.stringify(clean(b));
  const line = {
    ok,
    label: `identical reports across two reconciles over the same live rows (responses=${rows.responseRows.length})`,
    detail: ok ? 'reconciliation is idempotent and read-only' : 'reconcile output diverges across identical inputs',
    tag: 'AUTOMATED',
  };
  console.log(`[verify-idempotency] ${ok ? 'PASS' : 'FAIL'} identical=${ok} responses=${rows.responseRows.length} outreach=${rows.outreachRows.length}`);
  return { lines: [line], passed: ok ? 1 : 0, total: 1, ok, report: a };
}

function printOutcome(outcome, title) {
  const banner = ['='.repeat(40), title, '='.repeat(40)];
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
  const response = rowsForNamespace(await client.listRows(RESPONSE_TAB), RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX);
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, OUTREACH_LEAD_INDEX);
  for (const row of response) assertNamespacedLead(row.leadId);
  for (const row of outreach) assertNamespacedLead(row.leadId);
  const total = response.length + outreach.length;
  console.log(`[cleanup] TEST-RESP-RECON rows found: ${response.length} in Response Log, ${outreach.length} in Outreach Log`);
  if (total === 0) {
    console.log('[cleanup] nothing to clean (idempotent no-op)');
    return true;
  }
  if (!args.execute) {
    console.warn('[cleanup] DRY-RUN: pass --execute to actually delete. Nothing deleted.');
    return false;
  }
  if (response.length) await client.deleteRows(RESPONSE_TAB, response.map((r) => r.index));
  if (outreach.length) await client.deleteRows(OUTREACH_TAB, outreach.map((r) => r.index));

  const responseAfter = rowsForNamespace(await client.listRows(RESPONSE_TAB), RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX).length;
  const outreachAfter = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, OUTREACH_LEAD_INDEX).length;
  if (responseAfter !== 0 || outreachAfter !== 0) {
    console.error(`[cleanup] FAIL: ${responseAfter} Response + ${outreachAfter} Outreach TEST-RESP-RECON rows remain after delete.`);
    return false;
  }
  console.log('[cleanup] verified: zero TEST-RESP-RECON rows remain in both tabs');
  return true;
}

async function verifyCleanup(client) {
  const response = rowsForNamespace(await client.listRows(RESPONSE_TAB), RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX);
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, OUTREACH_LEAD_INDEX);
  const total = response.length + outreach.length;
  const ok = total === 0;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} final isolation: ${response.length} Response + ${outreach.length} Outreach TEST-RESP-RECON rows remain`);
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
  if (!env.GOOGLE_SHEET_ID) {
    console.error('GOOGLE_SHEET_ID is required. See .env.example.');
    process.exit(1);
  }
  const client = GoogleSheetsClient.fromEnv(env);
  for (const phase of args.phases) {
    if (phase === 'seed') {
      await seed(env, client, args);
    } else if (phase === 'run') {
      await run(env, client, args);
    } else if (phase === 'verify') {
      const outcome = await verify(env, client, args);
      printOutcome(outcome, `OUTREACH-RESPONSE-RECONCILIATION V1 live verify (${args.scenario})`);
    } else if (phase === 'repeat') {
      await repeat(env, client, args);
    } else if (phase === 'verify-idempotency') {
      const outcome = await verifyIdempotency(env, client, args);
      printOutcome(outcome, `OUTREACH-RESPONSE-RECONCILIATION V1 idempotency (${args.scenario})`);
    } else if (phase === 'cleanup') {
      await cleanup(env, client, args);
    } else if (phase === 'verify-cleanup') {
      await verifyCleanup(client);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[response-reconcile] ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  seed,
  run,
  repeat,
  verify,
  buildVerifyOutcome,
  verifyIdempotency,
  cleanup,
  verifyCleanup,
  rowsForNamespace,
  reconcileScoped,
  assertLiveableScenario,
  assertNamespacedLead,
  DEFAULT_SCENARIO,
  RESPONSE_TAB,
  RESPONSE_LEAD_INDEX,
  OUTREACH_TAB,
  OUTREACH_LEAD_INDEX,
};