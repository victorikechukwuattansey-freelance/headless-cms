'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { OUTREACH_COLUMNS } = require('../src/reconcile');
const { rowToObject } = require('../src/schema');
const { reconcileExecution } = require('../src/execution-reconcile');
const {
  EXEC_RECON_NAMESPACE,
  EXEC_RECON_REGEX,
  loadExecutionReconFixtures,
} = require('../src/execution-recon-fixtures');
const { GoogleSheetsClient, GoogleSheetsError } = require('../src/google-sheets-client');

const OUTREACH_TAB = 'Outreach Log';

const DEFAULT_SCENARIO = 'TEST-EXEC-RECON-001';

const READ_ERROR_DOC = 'scenario simulates sheet read errors which cannot occur against a live spreadsheet; covered by unit tests (src/execution-reconcile.js)';

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
    else if (arg === '--cleanup') args.phases.push('cleanup');
    else if (arg === '--verify-final') args.phases.push('verify-final');
    else if (arg === '--all') args.phases = ['seed', 'run', 'verify', 'cleanup', 'verify-final'];
  }
  return args;
}

function usage() {
  return `
Usage: node scripts/run-execution-reconciliation-live.js [phases] [flags]

Phases (order fixed: seed -> run -> verify -> cleanup -> verify-final):
  --all                full SEED -> RUN -> VERIFY -> CLEANUP -> VERIFY-FINAL cycle
  --seed               seed TEST-EXEC-RECON-* Outreach Log rows
  --run                reconcile the scenario locally (read-only) and write a report artifact
  --verify             read the live Outreach Log, reconcile against execution evidence, validate metrics
  --cleanup            delete TEST-EXEC-RECON-* rows from the Outreach Log (namespace-guarded)
  --verify-final       confirm zero TEST-EXEC-RECON-* rows remain after cleanup

Flags:
  --execute            allow actual spreadsheet mutations (seeding/deletes). Default is
                      dry-run; NOTHING is written without --execute.
  --scenario=<id>      execution-reconcile fixture to validate (default ${DEFAULT_SCENARIO})
  --no-interactive     never prompt; fail fast when required env is missing
  --reports-dir=<dir>  evidence artifact directory (reads <dir>/*-execution.json, writes <dir>/<run_id>-execution-reconciliation.json)

Env (see .env.example):
  GOOGLE_SHEET_ID, GOOGLE_ACCESS_TOKEN, GOOGLE_SERVICE_ACCOUNT_JSON

Read-only contract:
  - This artifact NEVER writes queue/approval data, never sends, never invokes a
    provider, and repairs nothing.
  - Only TEST-EXEC-RECON-* Outreach Log rows are ever seeded or deleted.
  - Execution evidence comes from operator-supplied reports (or the local
    reports/*-execution.json artifacts), never from a live provider.
`;
}

function assertLiveableScenario(scenario) {
  if (scenario.read_errors && (scenario.read_errors.evidence || scenario.read_errors.outreach)) {
    throw new Error(`scenario ${scenario.id} cannot run live: ${READ_ERROR_DOC}`);
  }
}

function assertNamespacedRecon(leadId) {
  if (!EXEC_RECON_REGEX.test(String(leadId).trim())) {
    throw new Error(`Refusing to delete non-namespaced lead_id: ${leadId}`);
  }
}

function assertMatchTestName(name, what) {
  if (!EXEC_RECON_REGEX.test(String(name).trim())) {
    throw new Error(`Refusing to seed ${what}: ${name} is not in ${EXEC_RECON_NAMESPACE} namespace`);
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
    if (!EXEC_RECON_REGEX.test(leadId)) return;
    rows.push({ index, leadId, obj: rowToObject(row, columns) });
  });
  rows.sort((a, b) => a.index - b.index);
  return rows;
}

async function seed(env, client, args) {
  assertMatchTestName(args.scenario, 'scenario');
  const scenario = loadExecutionReconFixtures().find((f) => f.id === args.scenario);
  if (!scenario) {
    console.error(`[seed] unknown scenario ${args.scenario}`);
    process.exit(1);
  }
  assertLiveableScenario(scenario);

  const grid = await client.listRows(OUTREACH_TAB);
  const present = new Set(grid.map((r) => String(r[1] ?? '').trim()).filter(Boolean));
  const toAppend = scenario.outreachRows
    .filter((r) => !present.has(r.lead_id))
    .map((r) => OUTREACH_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  console.log(`[seed] scenario ${args.scenario}: Outreach rows=${scenario.outreachRows.length}, to append=${toAppend.length}`);
  if (!args.execute) {
    console.warn('[seed] DRY-RUN: pass --execute to actually write. Nothing written.');
    return;
  }
  if (toAppend.length) await client.appendRows(OUTREACH_TAB, toAppend);
  console.log('[seed] done (Outreach Log only; no other tab is ever touched)');
}

/** Deterministic engine run over a scenario's recorded evidence + seeded log rows. */
function reconcileScoped({ evidence, outreachRows, evidenceAvailable, readErrors, now }) {
  return reconcileExecution({
    executionReports: evidence,
    logRows: outreachRows,
    evidenceAvailable,
    readErrors,
    now,
  });
}

function loadEvidenceArtifacts(reportsDir) {
  if (!fs.existsSync(reportsDir)) return [];
  const files = fs.readdirSync(reportsDir).filter((f) => f.endsWith('-execution.json'));
  const artifacts = [];
  for (const file of files) {
    try {
      artifacts.push(JSON.parse(fs.readFileSync(path.join(reportsDir, file), 'utf8')));
    } catch (err) {
      console.warn(`[evidence] skipping unreadable artifact ${file}: ${err.message}`);
    }
  }
  return artifacts;
}

function scenarioEvidence(scenario, artifacts) {
  const scenarioRunIds = new Set((scenario.evidence || []).map((r) => String(r && r.run_id || '').trim()).filter(Boolean));
  if (scenarioRunIds.size === 0) return scenario.evidence || [];
  const matched = (artifacts || []).filter((a) => a && scenarioRunIds.has(String(a.run_id)));
  return matched.length ? matched : scenario.evidence || [];
}

async function writeReconArtifact(report, args) {
  fs.mkdirSync(args.reportsDir, { recursive: true });
  const target = path.join(args.reportsDir, `${report.run_id}-execution-reconciliation.json`);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[artifact] reconciliation report written: ${target}`);
  return target;
}

async function run(env, client, args) {
  const scenario = loadExecutionReconFixtures().find((f) => f.id === args.scenario);
  assertLiveableScenario(scenario);
  const report = reconcileScoped({
    evidence: scenario.evidence,
    outreachRows: scenario.outreachRows,
    evidenceAvailable: scenario.evidence_available,
    readErrors: scenario.read_errors,
    now: Date.parse('2026-09-11T09:00:00.000Z'),
  });
  await writeReconArtifact(report, args);
  console.log(`[run] status=${report.status} evidence_available=${report.evidence_available} matched=${report.summary.matched} unmatched_log=${report.summary.unmatched_log} exceptions=${report.summary.exception_count}`);
  return report;
}

async function buildVerifyOutcome({ outreachGrid, scenario, evidence, now }) {
  const lines = [];

  const clean = reconcileScoped({
    evidence: scenario.evidence,
    outreachRows: scenario.outreachRows,
    evidenceAvailable: scenario.evidence_available,
    readErrors: scenario.read_errors,
    now,
  });
  const expected = scenario.expected;

  const metricChecks = [
    ['status', clean.status, expected.status],
    ['execution_records', clean.summary.execution_records, expected.execution_records],
    ['log_records', clean.summary.log_records, expected.log_records],
    ['matched', clean.summary.matched, expected.matched],
    ['unmatched_execution', clean.summary.unmatched_execution, expected.unmatched_execution],
    ['unmatched_log', clean.summary.unmatched_log, expected.unmatched_log],
    ['duplicate_execution', clean.summary.duplicate_execution, expected.duplicate_execution],
    ['duplicate_log', clean.summary.duplicate_log, expected.duplicate_log],
    ['invalid_execution', clean.summary.invalid_execution, expected.invalid_execution],
    ['invalid_log', clean.summary.invalid_log, expected.invalid_log],
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

  const outreach = rowsForNamespace(outreachGrid, OUTREACH_COLUMNS, 1);
  const actualRun = reconcileScoped({
    evidence,
    outreachRows: outreach.map((r) => r.obj),
    evidenceAvailable: scenario.evidence_available,
    readErrors: {},
    now,
  });
  for (const [label, want] of metricChecks) {
    const actual = label === 'status' ? actualRun.status : actualRun.summary[label];
    const ok = deepEqualStrict(actual, want);
    lines.push({
      ok,
      label: `live-sheet ${label} = ${format(actual)} (expect ${format(want)})`,
      detail: ok ? 'live sheet reconciles identically' : 'live sheet does NOT match expectation',
      tag: 'AUTOMATED',
    });
  }

  const passed = lines.filter((l) => l.ok).length;
  return { lines, passed, total: lines.length, ok: passed === lines.length, report: clean, actual: actualRun };
}

function format(value) {
  return value === null ? 'null' : String(value);
}

function deepEqualStrict(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function verify(env, client, args) {
  const scenario = loadExecutionReconFixtures().find((f) => f.id === args.scenario);
  if (!scenario) throw new Error(`unknown scenario ${args.scenario}`);
  assertLiveableScenario(scenario);
  const artifacts = loadEvidenceArtifacts(args.reportsDir);
  const evidence = scenarioEvidence(scenario, artifacts);
  if (artifacts.length === 0) {
    console.warn('[verify] no execution evidence artifacts present; using the scenario\'s recorded evidence.');
  }
  const outcome = await buildVerifyOutcome({
    outreachGrid: await client.listRows(OUTREACH_TAB),
    scenario,
    evidence,
    now: Date.parse('2026-09-11T09:00:00.000Z'),
  });
  await writeReconArtifact(outcome.report, args);
  if (!outcome.ok) {
    const failed = outcome.lines.filter((l) => !l.ok).map((l) => l.label);
    console.error(`[verify] FAIL: checks off for scenario ${args.scenario}: ${failed.join(', ')}`);
  }
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
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1);
  for (const row of outreach) assertNamespacedRecon(row.leadId);
  const total = outreach.length;
  console.log(`[cleanup] TEST-EXEC-RECON rows found in Outreach Log: ${total}`);
  if (total === 0) {
    console.log('[cleanup] nothing to clean (idempotent no-op)');
    return true;
  }
  if (!args.execute) {
    console.warn('[cleanup] DRY-RUN: pass --execute to actually delete. Nothing deleted.');
    return false;
  }
  await client.deleteRows(OUTREACH_TAB, outreach.map((r) => r.index));

  const after = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1).length;
  if (after !== 0) {
    console.error(`[cleanup] FAIL: ${after} TEST-EXEC-RECON rows remain after delete.`);
    return false;
  }
  console.log('[cleanup] verified: zero TEST-EXEC-RECON rows remain in the Outreach Log');
  return true;
}

async function verifyFinal(client) {
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1);
  const total = outreach.length;
  const ok = total === 0;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} final isolation: ${total} TEST-EXEC-RECON rows remain`);
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
      await run(env, client, args);
    } else if (phase === 'verify') {
      const outcome = await verify(env, client, args);
      printOutcome(outcome, `OUTREACH-EXECUTION-RECONCILIATION V1 live verify (${args.scenario})`);
    } else if (phase === 'cleanup') {
      await cleanup(env, client, args);
    } else if (phase === 'verify-final') {
      await verifyFinal(client);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[execution-reconcile] ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  seed,
  run,
  verify,
  buildVerifyOutcome,
  cleanup,
  verifyFinal,
  rowsForNamespace,
  reconcileScoped,
  loadEvidenceArtifacts,
  scenarioEvidence,
  assertLiveableScenario,
};