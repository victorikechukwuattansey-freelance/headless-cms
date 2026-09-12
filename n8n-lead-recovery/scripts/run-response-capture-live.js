'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { RESPONSE_COLUMNS, captureFromEvents } = require('../src/response-capture');
const { rowToObject } = require('../src/schema');
const {
  RESP_NAMESPACE,
  RESP_REGEX,
  loadResponseCaptureFixtures,
} = require('../src/response-capture-fixtures');
const { GoogleSheetsClient } = require('../src/google-sheets-client');

const RESPONSE_TAB = 'Response Log';
const RESPONSE_LEAD_INDEX = 2;
const RESPONSE_KEY_INDEX = 1;

const DEFAULT_SCENARIO = 'TEST-RESP-001';

/**
 * Scenarios that persist UNMATCHED durable rows cannot be cleaned by the
 * TEST-RESP lead_id namespace (their lead_id is intentionally empty). They are
 * covered by engine/fixture tests only; a live run must never leave an
 * unroutable durable row behind.
 */
function assertLiveableScenario(scenario) {
  if (scenario.mode === 'REAL' && scenario.expected.unmatched > 0) {
    throw new Error(`scenario ${scenario.id} cannot run live: it persists UNMATCHED durable rows with an empty lead_id that the TEST-RESP namespace cannot clean`);
  }
}

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
    else if (arg === '--ingest') args.phases.push('ingest');
    else if (arg === '--verify') args.phases.push('verify');
    else if (arg === '--repeat') args.phases.push('repeat');
    else if (arg === '--verify-idempotency') args.phases.push('verify-idempotency');
    else if (arg === '--cleanup') args.phases.push('cleanup');
    else if (arg === '--verify-cleanup') args.phases.push('verify-cleanup');
    else if (arg === '--all' || arg === '--full-cycle') {
      args.phases = ['seed', 'ingest', 'verify', 'repeat', 'verify-idempotency', 'cleanup', 'verify-cleanup'];
    }
  }
  return args;
}

function usage() {
  return `
Usage: node scripts/run-response-capture-live.js [phases] [flags]

Phases (order fixed: seed -> ingest -> verify -> repeat -> verify-idempotency -> cleanup -> verify-cleanup):
  --all / --full-cycle  full cycle through every phase
  --seed                seed the scenario's pre-existing Response Log rows (initialResponseRows)
  --ingest              run the deterministic capture engine over the scenario and write a report artifact
  --verify              read the live Response Log, compare idempotency keys and engine metrics against the scenario
  --repeat              simulate re-ingestion of the same events; assert zero newly staged rows
  --verify-idempotency  assert the live Response Log holds exactly the expected key set with no duplicates
  --cleanup             delete TEST-RESP-* rows from the Response Log (namespace-guarded)
  --verify-cleanup      confirm zero TEST-RESP-* rows remain after cleanup

Flags:
  --execute             allow actual spreadsheet mutations (seeding/deletes). Default is
                        dry-run; NOTHING is written without --execute.
  --scenario=<id>       response-capture fixture to validate (default ${DEFAULT_SCENARIO})
  --no-interactive      never prompt; fail fast when required env is missing
  --reports-dir=<dir>   evidence artifact directory (writes <dir>/<run_id>-response-capture.json)

Env (see .env.example):
  GOOGLE_SHEET_ID, GOOGLE_ACCESS_TOKEN, GOOGLE_SERVICE_ACCOUNT_JSON

Read-only contract:
  - This artifact NEVER sends, never replies, never schedules follow-ups, and never
    calls a provider. The Response Log is the only touched surface.
  - Only TEST-RESP-* Response Log rows are ever seeded or deleted.
  - This runner validates the capture ENGINE against a configured spreadsheet; it is
    not an inbound-provider integration.
`;
}

function assertNamespacedLead(leadId) {
  if (!RESP_REGEX.test(String(leadId).trim())) {
    throw new Error(`Refusing to delete non-namespaced lead_id: ${leadId}`);
  }
}

function assertNamespacedScenario(scenarioId) {
  if (!RESP_REGEX.test(String(scenarioId).trim())) {
    throw new Error(`Refusing to run scenario: ${scenarioId} is not in ${RESP_NAMESPACE} namespace`);
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
    if (!RESP_REGEX.test(leadId)) return;
    rows.push({ index, leadId, obj: rowToObject(row, columns) });
  });
  rows.sort((a, b) => a.index - b.index);
  return rows;
}

function keySet(rows) {
  return new Set(rows.map((row) => String(row && row.idempotency_key).trim()).filter(Boolean));
}

const FIXED_NOW = Date.parse('2026-09-11T09:00:00.000Z');

function captureScoped({ events, responseRows, identityLookup, mode, now = FIXED_NOW }) {
  return captureFromEvents({ events, responseRows, identityLookup, mode, now });
}

async function writeCaptureArtifact(report, args) {
  fs.mkdirSync(args.reportsDir, { recursive: true });
  const target = path.join(args.reportsDir, `${report.run_id}-response-capture.json`);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[artifact] response capture report written: ${target}`);
  return target;
}

async function seed(env, client, args) {
  assertNamespacedScenario(args.scenario);
  const scenario = loadResponseCaptureFixtures().find((f) => f.id === args.scenario);
  if (!scenario) {
    console.error(`[seed] unknown scenario ${args.scenario}`);
    process.exit(1);
  }
  assertLiveableScenario(scenario);

  const grid = await client.listRows(RESPONSE_TAB);
  const present = keySet(grid.slice(isHeader(grid[0], RESPONSE_COLUMNS) ? 1 : 0).map((r) => rowToObject(r, RESPONSE_COLUMNS)));
  const toAppend = scenario.initialResponseRows
    .filter((r) => !present.has(String(r.idempotency_key).trim()))
    .map((r) => RESPONSE_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  console.log(`[seed] scenario ${args.scenario}: initial rows=${scenario.initialResponseRows.length}, to append=${toAppend.length}`);
  if (!args.execute) {
    console.warn('[seed] DRY-RUN: pass --execute to actually write. Nothing written.');
    return;
  }
  if (toAppend.length) await client.appendRows(RESPONSE_TAB, toAppend);
  console.log('[seed] done (Response Log only; no other tab is ever touched)');
}

async function ingest(env, client, args) {
  const scenario = loadResponseCaptureFixtures().find((f) => f.id === args.scenario);
  assertLiveableScenario(scenario);
  const report = captureScoped({
    events: scenario.events,
    responseRows: scenario.initialResponseRows,
    identityLookup: scenario.identity_lookup,
    mode: scenario.mode,
  });
  await writeCaptureArtifact(report, args);
  console.log(`[ingest] run_id=${report.run_id} status=${report.status} mode=${report.mode} staged=${report.summary.staged} persisted=${report.summary.persisted} exceptions=${report.summary.exception_count}`);
  return report;
}

/** Re-ingestion of the same events: pass the previously staged rows to the engine. */
async function repeat(env, client, args) {
  const scenario = loadResponseCaptureFixtures().find((f) => f.id === args.scenario);
  assertLiveableScenario(scenario);
  const first = captureScoped({
    events: scenario.events,
    responseRows: scenario.initialResponseRows,
    identityLookup: scenario.identity_lookup,
    mode: scenario.mode,
  });
  const second = captureScoped({
    events: scenario.events,
    responseRows: scenario.initialResponseRows.concat(first.response_rows),
    identityLookup: scenario.identity_lookup,
    mode: scenario.mode,
  });
  const shouldBeZero = scenario.mode === 'REAL' ? first.summary.persisted : 0;
  if (second.summary.persisted !== 0) {
    console.error(`[repeat] FAIL: second ingestion persisted ${second.summary.persisted} rows; expected 0`);
  }
  if (second.summary.duplicate !== shouldBeZero && !(first.summary.staged === 0 && second.summary.staged === 0)) {
    // A scenario that staged nothing has nothing to duplicate; pass silently.
  }
  console.log(`[repeat] first staged=${first.summary.staged} persisted=${first.summary.persisted}; re-ingest staged=${second.summary.staged} persisted=${second.summary.persisted} duplicate=${second.summary.duplicate}`);
  return second;
}

function format(value) {
  return value === null ? 'null' : String(value);
}

function deepEqualStrict(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function buildVerifyOutcome({ responseGrid, scenario, now = FIXED_NOW }) {
  const lines = [];

  const clean = captureScoped({
    events: scenario.events,
    responseRows: scenario.initialResponseRows,
    identityLookup: scenario.identity_lookup,
    mode: scenario.mode,
    now,
  });
  const expected = scenario.expected;

  const metricChecks = [
    ['status', clean.status, expected.status],
    ['mode', clean.mode, expected.mode],
    ['captured', clean.summary.captured, expected.captured],
    ['unmatched', clean.summary.unmatched, expected.unmatched],
    ['invalid', clean.summary.invalid, expected.invalid],
    ['duplicate', clean.summary.duplicate, expected.duplicate],
    ['staged', clean.summary.staged, expected.staged],
    ['persisted', clean.summary.persisted, expected.persisted],
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

  for (const category of expected.exception_categories || []) {
    const present = clean.exceptions.some((e) => e.category === category);
    lines.push({
      ok: present,
      label: `exception ${category} present (expect ${JSON.stringify(expected.exception_categories)})`,
      detail: present ? 'exception emitted' : 'exception missing',
      tag: 'AUTOMATED',
    });
  }

  const liveRows = rowsForNamespace(responseGrid, RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX);
  const liveKeys = keySet(liveRows.map((r) => r.obj));
  const expectedKeys = new Set();
  for (const row of scenario.initialResponseRows) {
    const k = String(row.idempotency_key).trim();
    if (k) expectedKeys.add(k);
  }
  if (scenario.mode === 'REAL') {
    for (const row of clean.response_rows) expectedKeys.add(String(row.idempotency_key).trim());
  }

  const keyEquality =
    liveKeys.size === expectedKeys.size && [...liveKeys].every((k) => expectedKeys.has(k)) && [...expectedKeys].every((k) => liveKeys.has(k));
  lines.push({
    ok: keyEquality,
    label: `live idempotency key set matches scenario (${liveKeys.size} vs expect ${expectedKeys.size})`,
    detail: keyEquality ? 'live Response Log matches the scenario key set' : 'live Response Log key set diverges',
    tag: 'AUTOMATED',
  });

  const duplicates = liveRows.length - new Set([...liveRows.map((r) => r.obj.idempotency_key)]).size;
  lines.push({
    ok: duplicates === 0,
    label: `no duplicate idempotency keys in live Response Log (found ${duplicates})`,
    detail: duplicates === 0 ? 'keys unique' : 'duplicate keys present',
    tag: 'AUTOMATED',
  });

  const passed = lines.filter((l) => l.ok).length;
  return { lines, passed, total: lines.length, ok: passed === lines.length, report: clean, liveRows };
}

async function verify(env, client, args) {
  const scenario = loadResponseCaptureFixtures().find((f) => f.id === args.scenario);
  if (!scenario) throw new Error(`unknown scenario ${args.scenario}`);
  assertLiveableScenario(scenario);
  const outcome = await buildVerifyOutcome({
    responseGrid: await client.listRows(RESPONSE_TAB),
    scenario,
  });
  await writeCaptureArtifact(outcome.report, args);
  if (!outcome.ok) {
    const failed = outcome.lines.filter((l) => !l.ok).map((l) => l.label);
    console.error(`[verify] FAIL: checks off for scenario ${args.scenario}: ${failed.join(', ')}`);
  }
  return outcome;
}

async function verifyIdempotency(env, client, args) {
  const scenario = loadResponseCaptureFixtures().find((f) => f.id === args.scenario);
  if (!scenario) throw new Error(`unknown scenario ${args.scenario}`);
  assertLiveableScenario(scenario);
  const grid = await client.listRows(RESPONSE_TAB);
  const outcome = await buildVerifyOutcome({ responseGrid: grid, scenario });
  const re = captureScoped({
    events: scenario.events,
    responseRows: rowsForNamespace(grid, RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX).map((r) => r.obj),
    identityLookup: scenario.identity_lookup,
    mode: scenario.mode,
  });
  const expectedStages = scenario.mode === 'REAL' ? scenario.expected.staged : 0;
  const ok = re.summary.staged === 0 && re.summary.persisted === 0;
  const line = {
    ok,
    label: `re-ingestion over live rows stages nothing (staged=${re.summary.staged}; expected ${expectedStages} suppressed as duplicates)`,
    detail: ok ? 'idempotent against the live Response Log' : 're-ingestion would stage additional rows',
    tag: 'AUTOMATED',
  };
  outcome.lines.push(line);
  outcome.total += 1;
  if (ok) outcome.passed += 1;
  outcome.ok = outcome.passed === outcome.total;
  console.log(`[verify-idempotency] ${ok ? 'PASS' : 'FAIL'} staged=${re.summary.staged} persisted=${re.summary.persisted}`);
  return outcome;
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
  const response = rowsForNamespace(await client.listRows(RESPONSE_TAB), RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX);
  for (const row of response) assertNamespacedLead(row.leadId);
  const total = response.length;
  console.log(`[cleanup] TEST-RESP rows found in Response Log: ${total}`);
  if (total === 0) {
    console.log('[cleanup] nothing to clean (idempotent no-op)');
    return true;
  }
  if (!args.execute) {
    console.warn('[cleanup] DRY-RUN: pass --execute to actually delete. Nothing deleted.');
    return false;
  }
  await client.deleteRows(RESPONSE_TAB, response.map((r) => r.index));

  const after = rowsForNamespace(await client.listRows(RESPONSE_TAB), RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX).length;
  if (after !== 0) {
    console.error(`[cleanup] FAIL: ${after} TEST-RESP rows remain after delete.`);
    return false;
  }
  console.log('[cleanup] verified: zero TEST-RESP rows remain in the Response Log');
  return true;
}

async function verifyCleanup(client) {
  const response = rowsForNamespace(await client.listRows(RESPONSE_TAB), RESPONSE_COLUMNS, RESPONSE_LEAD_INDEX);
  const total = response.length;
  const ok = total === 0;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} final isolation: ${total} TEST-RESP rows remain`);
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
    } else if (phase === 'ingest') {
      await ingest(env, client, args);
    } else if (phase === 'verify') {
      const outcome = await verify(env, client, args);
      printOutcome(outcome, `OUTREACH-RESPONSE-CAPTURE V1 live verify (${args.scenario})`);
    } else if (phase === 'repeat') {
      await repeat(env, client, args);
    } else if (phase === 'verify-idempotency') {
      const outcome = await verifyIdempotency(env, client, args);
      printOutcome(outcome, `OUTREACH-RESPONSE-CAPTURE V1 idempotency (${args.scenario})`);
    } else if (phase === 'cleanup') {
      await cleanup(env, client, args);
    } else if (phase === 'verify-cleanup') {
      await verifyCleanup(client);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[response-capture] ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  seed,
  ingest,
  repeat,
  verify,
  buildVerifyOutcome,
  verifyIdempotency,
  cleanup,
  verifyCleanup,
  rowsForNamespace,
  captureScoped,
  keySet,
  assertLiveableScenario,
  assertNamespacedLead,
  DEFAULT_SCENARIO,
  RESPONSE_TAB,
  RESPONSE_LEAD_INDEX,
};