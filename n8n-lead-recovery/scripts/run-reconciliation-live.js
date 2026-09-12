'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { APPROVED_COLUMNS, rowToObject } = require('../src/schema');
const { OUTREACH_COLUMNS, reconcileFromSheets } = require('../src/reconcile');
const {
  RECON_NAMESPACE,
  RECON_REGEX,
  loadReconFixtures,
} = require('../src/recon-fixtures');
const { assertNamespaced } = require('../src/cleanup');
const { GoogleSheetsClient, GoogleSheetsError } = require('../src/google-sheets-client');

const APPROVED_TAB = 'Approved Outreach';
const OUTREACH_TAB = 'Outreach Log';

const DEFAULT_SCENARIO = 'TEST-RECON-010';

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
Usage: node scripts/run-reconciliation-live.js [phases] [flags]

Phases (order fixed: seed -> run -> verify -> cleanup -> verify-final):
  --all                full SEED -> RUN -> VERIFY -> CLEANUP -> VERIFY-FINAL cycle
  --seed               seed TEST-RECON-* fixtures (Approved Outreach + Outreach Log)
  --run                attempt the n8n execution (needs creds) or print MANUAL steps
  --verify             read both tabs, reconcile TEST-RECON-* rows, write report artifact
  --cleanup            delete TEST-RECON-* rows (namespace-guarded) from both tabs
  --verify-final       confirm zero TEST-RECON-* rows remain after cleanup

Flags:
  --execute            allow actual spreadsheet mutations (seeding/deletes). Default is dry-run.
  --scenario=<id>      reconcile scenario fixture to validate (default ${DEFAULT_SCENARIO})
  --no-interactive     never prompt; REQUIRE n8n creds for --run, else fail (no fabricated PASS)

Env (see .env.example):
  GOOGLE_SHEET_ID, GOOGLE_ACCESS_TOKEN, GOOGLE_SERVICE_ACCOUNT_JSON,
  N8N_BASE_URL, N8N_API_KEY, N8N_WORKFLOW_ID
`;
}

function assertNamespacedOutreach(leadId) {
  if (!RECON_REGEX.test(String(leadId).trim())) {
    throw new Error(`Refusing to delete non-namespaced lead_id: ${leadId}`);
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
    if (!RECON_REGEX.test(leadId)) return;
    rows.push({ index, leadId, obj: rowToObject(row, columns) });
  });
  rows.sort((a, b) => a.index - b.index);
  return rows;
}

async function seed(env, client, args) {
  assertMatchTestName(args.scenario, 'scenario');
  const fixtures = loadReconFixtures();
  const scenario = fixtures.find((f) => f.id === args.scenario);
  if (!scenario) {
    console.error(`[seed] unknown scenario ${args.scenario}`);
    process.exit(1);
  }

  const approvedGrid = await client.listRows(APPROVED_TAB);
  const approvedIds = new Set(approvedGrid.map((r) => String(r[0] ?? '').trim()).filter(Boolean));
  const approvedToAppend = scenario.approvedRows
    .filter((r) => !approvedIds.has(r.lead_id))
    .map((r) => APPROVED_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  const outreachGrid = await client.listRows(OUTREACH_TAB);
  const outreachKeys = new Set(outreachGrid.map((r) => String(r[0] ?? '').trim()).filter(Boolean));
  const outreachToAppend = scenario.outreachRows
    .filter((r) => !outreachKeys.has(r.outreach_id))
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

function assertMatchTestName(name, what) {
  if (!RECON_REGEX.test(String(name).trim())) {
    throw new Error(`Refusing to seed ${what}: ${name} is not in ${RECON_NAMESPACE} namespace`);
  }
}

async function runN8n(env, args) {
  const { N8N_BASE_URL, N8N_API_KEY, N8N_WORKFLOW_ID } = env;
  if (!N8N_BASE_URL || !N8N_API_KEY || !N8N_WORKFLOW_ID) return null;
  const workflowPath = path.join(__dirname, '..', 'Run-Reconciliation-and-Reporting V1.json');
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
    console.warn('[run] NOTE: confirm in the n8n UI that Reconcile Records produced the two-item report output.');
    return json;
  } catch (err) {
    console.warn(`[run] n8n API attempt failed (${err.message}). Falling back to MANUAL execution.`);
    console.warn('[run] No LIVE pass is claimed unless the execution is confirmed.');
    return null;
  }
}

function manualRunPrompt() {
  console.log('[run] MANUAL step required:');
  console.log('  1. Open n8n and trigger "Run Reconciliation and Reporting V1".');
  console.log('  2. Confirm the Reconcile Records output items on the Reconciliation Complete End node.');
  console.log('  3. Press Enter to continue to VERIFY.');
}

async function run(env, args) {
  const result = await runN8n(env, args);
  if (result) return 'LIVE-ATTEMPTED';
  if (args.noInteractive) {
    console.error('[run] FAIL: --no-interactive requires working N8N_BASE_URL/N8N_API_KEY/N8N_WORKFLOW_ID.');
    console.error('[run] No result claimed; aborting before VERIFY.');
    process.exit(3);
  }
  manualRunPrompt();
  return 'MANUAL';
}

function reconcileScoped({ approvedRows, outreachRows }) {
  const approved = approvedRows.map((r) => r.obj);
  const outreach = outreachRows.map((r) => r.obj);
  return reconcileFromSheets({
    approvedRows: approved,
    outreachRows: outreach,
    now: new Date().toISOString(),
  });
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

async function writeReportArtifact(report, args) {
  fs.mkdirSync(args.reportsDir, { recursive: true });
  const target = path.join(args.reportsDir, `${report.report.run_id}-reconciliation.json`);
  fs.writeFileSync(target, `${JSON.stringify(report.report, null, 2)}\n`);
  console.log(`[verify] report artifact written: ${target}`);
  return target;
}

async function verify(env, client, args) {
  const scenario = loadReconFixtures().find((f) => f.id === args.scenario);
  const outcome = buildVerifyOutcome({
    approvedGrid: await client.listRows(APPROVED_TAB),
    outreachGrid: await client.listRows(OUTREACH_TAB),
    scenario,
  });
  writeReportArtifact({ report: outcome.report }, args);
  if (!outcome.ok) {
    const failed = outcome.lines.filter((l) => !l.ok).map((l) => l.label);
    console.error(`[verify] FAIL: metrics off for scenario ${args.scenario}: ${failed.join(', ')}`);
  }
  return outcome;
}

function buildVerifyOutcome({ approvedGrid, outreachGrid, scenario }) {
  const approved = rowsForNamespace(approvedGrid, APPROVED_COLUMNS, 0);
  const outreach = rowsForNamespace(outreachGrid, OUTREACH_COLUMNS, 1);
  const result = reconcileScoped({ approvedRows: approved, outreachRows: outreach });
  const expected = (scenario && scenario.expected) || {};
  const r = result.report;
  const lines = [];

  const checks = [
    ['status', r.status, expected.status],
    ['approved_total', r.approved_total, expected.approved_total],
    ['approved_with_outreach', r.approved_with_outreach, expected.approved_with_outreach],
    ['approved_no_outreach', r.approved_no_outreach, expected.approved_no_outreach],
    ['coverage_rate', r.coverage_rate, expected.coverage_rate],
    ['outreach_total', r.outreach_total, expected.outreach_total],
    ['orphan_outreach', r.orphan_outreach, expected.orphan_outreach],
    ['malformed_approvals', r.malformed_approvals, expected.malformed_approvals],
    ['malformed_outreach', r.malformed_outreach, expected.malformed_outreach],
    ['status_mismatches', r.status_mismatches, expected.status_mismatches],
    ['exception_count', r.exception_count, expected.exception_count],
  ];
  for (const [label, actual, want] of checks) {
    const ok = deepEqualStrict(actual, want);
    lines.push({
      ok,
      label: `${label} = ${format(actual)} (expect ${format(want)})`,
      detail: ok ? 'matches scenario' : 'does NOT match scenario',
      tag: 'AUTOMATED',
    });
  }
  const passed = lines.filter((l) => l.ok).length;
  return { lines, passed, total: lines.length, ok: passed === lines.length, report: r };
}

function format(value) {
  return value === null ? 'null' : String(value);
}

function deepEqualStrict(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

async function cleanup(env, client, args) {
  const approved = rowsForNamespace(await client.listRows(APPROVED_TAB), APPROVED_COLUMNS, 0);
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1);
  for (const row of [...approved, ...outreach]) assertNamespacedOutreach(row.leadId);
  const total = approved.length + outreach.length;
  console.log(`[cleanup] TEST-RECON rows found: Approved=${approved.length} Outreach=${outreach.length}`);
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
    console.error(`[cleanup] FAIL: ${after} TEST-RECON rows remain after delete.`);
    return false;
  }
  console.log('[cleanup] verified: zero TEST-RECON rows remain in Approved Outreach and Outreach Log');
  return true;
}

async function verifyFinal(client) {
  const approved = rowsForNamespace(await client.listRows(APPROVED_TAB), APPROVED_COLUMNS, 0);
  const outreach = rowsForNamespace(await client.listRows(OUTREACH_TAB), OUTREACH_COLUMNS, 1);
  const total = approved.length + outreach.length;
  const ok = total === 0;
  console.log(`${ok ? '[PASS]' : '[FAIL]'} final isolation: ${total} TEST-RECON rows remain`);
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
      await run(env, args);
    } else if (phase === 'verify') {
      const outcome = await verify(env, client, args);
      printOutcome(outcome, 'RUN-RECONCILIATION-AND-REPORTING V1 live verify');
    } else if (phase === 'cleanup') {
      await cleanup(env, client, args);
    } else if (phase === 'verify-final') {
      await verifyFinal(client);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[reconciliation] ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  parseArgs,
  seed,
  run,
  verify,
  cleanup,
  verifyFinal,
  rowsForNamespace,
  reconcileScoped,
  buildVerifyOutcome,
};