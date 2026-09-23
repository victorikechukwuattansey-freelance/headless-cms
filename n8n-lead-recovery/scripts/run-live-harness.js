'use strict';

const fs = require('node:fs');
const path = require('node:path');

const {
  VERIFIED_COLUMNS,
  APPROVED_COLUMNS,
  FORMULA_COLUMN_SET,
} = require('../src/schema');
const { loadFixtures } = require('../src/fixtures');
const { buildReport } = require('../src/verify');
const { collectTestRows, assertNamespaced } = require('../src/cleanup');
const { GoogleSheetsClient, GoogleSheetsError } = require('../src/google-sheets-client');
const { buildFixtureWorkflow, FIXTURE_OUTPUT } = require('./build-fixture-workflow');

const VERIFIED_TAB = 'Verified Leads';
const APPROVED_TAB = 'Approved Outreach';
const OUTREACH_TAB = 'Outreach Log';
const APPROVED_LEAD_COL = APPROVED_COLUMNS.indexOf('lead_id');

function parseArgs(argv) {
  const args = { execute: false, plain: false, noInteractive: false, phases: [], fixtureSheetId: '' };
  for (const arg of argv) {
    if (arg === '--execute') args.execute = true;
    else if (arg === '--plain') args.plain = true;
    else if (arg === '--no-interactive') args.noInteractive = true;
    else if (arg.startsWith('--fixture-sheet-id=')) args.fixtureSheetId = arg.split('=')[1].trim();
    else if (arg === '--seed') args.phases.push('seed');
    else if (arg === '--run') args.phases.push('run');
    else if (arg === '--verify') args.phases.push('verify');
    else if (arg === '--cleanup') args.phases.push('cleanup');
    else if (arg === '--verify-final') args.phases.push('verify-final');
    else if (arg === '--all') args.phases = ['seed', 'run', 'verify', 'cleanup', 'verify-final'];
  }
  if (args.fixtureSheetId && args.plain === false) args.plain = false;
  return args;
}

function usage() {
  return `
Usage: node scripts/run-live-harness.js [phases] [flags]

Phases (order fixed: seed -> run -> verify -> cleanup -> verify-final):
  --all                full SEED -> RUN -> VERIFY -> CLEANUP -> VERIFY-FINAL cycle
  --seed               seed TEST-AOH-* fixtures into the target spreadsheet
  --run                attempt the n8n execution (needs creds) or print MANUAL steps
  --verify             read sheet state and print the 13-category report (pre-cleanup)
  --cleanup            delete TEST-AOH-* rows (namespace-guarded)
  --verify-final       print the acceptance report using the pre-cleanup snapshot + Cleanup=PASS

Flags:
  --execute            allow actual spreadsheet mutations (seeding/deletes). Default is dry-run.
  --plain              write formula-owned Q:U values during seeding (dedicated fixture sheet only)
  --fixture-sheet-id=<id>  target a dedicated fixture spreadsheet (overrides GOOGLE_SHEET_ID)
  --no-interactive     never prompt; REQUIRE n8n creds for --run, else fail (no fabricated PASS)

Env (see .env.example):
  GOOGLE_SHEET_ID, FIXTURE_SHEET_ID, GOOGLE_ACCESS_TOKEN,
  GOOGLE_SERVICE_ACCOUNT_JSON, N8N_BASE_URL, N8N_API_KEY, N8N_WORKFLOW_ID
`;
}

function clientForSpreadsheet(spreadsheetId) {
  return GoogleSheetsClient.fromEnv(Object.assign({}, process.env, { GOOGLE_SHEET_ID: spreadsheetId }));
}

async function seed(env, fixtures, client, args) {
  const inputColumns = args.plain ? VERIFIED_COLUMNS : VERIFIED_COLUMNS.filter((c) => !FORMULA_COLUMN_SET.has(c));
  if (args.plain) {
    console.log('[seed] plain mode: WRITING formula-owned Q:U values. Only valid against the dedicated fixture spreadsheet.');
  }

  const verifiedGrid = await client.listRows(VERIFIED_TAB);
  const existingIds = new Set(verifiedGrid.slice(1).map((r) => String(r[0] || '').trim()).filter(Boolean));
  const verifiedToAppend = fixtures.verifiedSeeds
    .filter((r) => !existingIds.has(r.lead_id))
    .map((r) => inputColumns.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  const approvedGrid = await client.listRows(APPROVED_TAB);
  const approvedIds = new Set(approvedGrid.slice(1).map((r) => String(r[APPROVED_LEAD_COL] || '').trim()).filter(Boolean));
  const approvedToAppend = fixtures.approvedPreseed
    .filter((r) => !approvedIds.has(r.lead_id))
    .map((r) => APPROVED_COLUMNS.map((c) => (r[c] === undefined || r[c] === null ? '' : String(r[c]))));

  console.log(`[seed] Verified Leads: ${verifiedToAppend.length} rows to seed (${fixtures.verifiedSeeds.length} fixtures)`);
  console.log(`[seed] Approved Outreach preseed: ${approvedToAppend.length} rows to insert`);

  if (!args.execute) {
    console.warn('[seed] DRY-RUN: pass --execute to actually write. Nothing written.');
    return;
  }
  if (verifiedToAppend.length) await client.appendRows(VERIFIED_TAB, verifiedToAppend);
  if (approvedToAppend.length) await client.appendRows(APPROVED_TAB, approvedToAppend);
  console.log('[seed] done');
}

async function runN8n(env, args) {
  const { N8N_BASE_URL, N8N_API_KEY, N8N_WORKFLOW_ID } = env;
  if (!N8N_BASE_URL || !N8N_API_KEY || !N8N_WORKFLOW_ID) return null;

  const spreadsheetId = args.fixtureSheetId || env.GOOGLE_SHEET_ID;
  let workflowPath = args.fixtureSheetId
    ? FIXTURE_OUTPUT
    : path.join(__dirname, '..', 'Approved Outreach Handoff V1.json');
  if (!fs.existsSync(workflowPath)) {
    const clone = buildFixtureWorkflow({ fixtureSpreadsheetId: spreadsheetId });
    fs.writeFileSync(workflowPath, `${JSON.stringify(clone, null, 2)}\n`);
    console.warn(`[run] generated fixture workflow at ${workflowPath}`);
  }
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
    console.warn('[run] NOTE: confirm in the n8n UI that the execution ran to completion and wrote Approved Outreach.');
    return json;
  } catch (err) {
    console.warn(`[run] n8n API attempt failed (${err.message}). Falling back to MANUAL execution.`);
    console.warn('[run] No LIVE pass is claimed unless the execution is confirmed.');
    return null;
  }
}

function manualRunPrompt() {
  console.log('[run] MANUAL step required:');
  console.log('  1. Open n8n and trigger "Approved Outreach Handoff V1" (production) or');
  console.log('     "Approved Outreach Handoff V1 - Fixture Run" (dedicated fixture sheet).');
  console.log('  2. Confirm the execution log shows rows appended to Approved Outreach.');
  console.log('  3. Press Enter to continue to VERIFY.');
}

async function run(env, args) {
  if (args.noInteractive) {
    const result = await runN8n(env, args);
    if (!result) {
      console.error('[run] FAIL: --no-interactive requires working N8N_BASE_URL/N8N_API_KEY/N8N_WORKFLOW_ID.');
      console.error('[run] No result claimed; aborting before VERIFY.');
      process.exit(3);
    }
    return 'LIVE-ATTEMPTED';
  }
  const result = await runN8n(env, args);
  if (result) return 'LIVE-ATTEMPTED';
  manualRunPrompt();
  return 'MANUAL';
}

function printReport(report) {
  const banner = [
    '='.repeat(24),
    'GOOGLE SHEETS VERIFICATION & FIXTURE HARNESS v0.1',
    '='.repeat(24),
  ];
  for (const line of banner) console.log(line);
  for (const line of report.lines) {
    const tag = line.tag && line.tag !== 'AUTOMATED' ? ` (${line.tag})` : '';
    console.log(`${line.ok ? '[PASS]' : '[FAIL]'} ${line.label}${tag}`);
    console.log(`       ${line.detail}`);
  }
  console.log('---');
  console.log(`RESULT: ${report.passed}/${report.total} PASS`);
}

async function readOutreachRows(client) {
  const grid = await client.listRows(OUTREACH_TAB);
  return grid.slice(1).map((r) => String(r[0] || '').trim()).filter(Boolean);
}

async function verify(env, client, cleanupOk) {
  const fixtures = loadFixtures();
  const approvedGrid = await client.listRows(APPROVED_TAB);
  const verifiedGrid = await client.listRows(VERIFIED_TAB);
  let outreachRows = [];
  let outreachAvailable = true;
  try {
    outreachRows = await readOutreachRows(client);
  } catch (err) {
    outreachAvailable = false;
    console.warn(`[verify] WARNING: could not read ${OUTREACH_TAB} (${err.message}). Isolation line marked MANUAL.`);
  }
  const tag = outreachAvailable ? 'AUTOMATED' : 'MANUAL';
  const report = buildReport({ fixtures, approvedGrid, verifiedGrid, outreachRows, cleanupOk, tag });
  if (!outreachAvailable) {
    const iso = report.lines.find((l) => l.label === 'Outreach Log isolation');
    iso.ok = false;
    iso.tag = 'MANUAL';
    report.passed = report.lines.filter((l) => l.ok).length;
    report.ok = report.passed === report.total;
  }
  printReport(report);
  return report;
}

async function cleanup(env, client, args) {
  const collected = {
    verified: collectTestRows(await client.listRows(VERIFIED_TAB)),
    approved: collectTestRows(await client.listRows(APPROVED_TAB), APPROVED_LEAD_COL),
  };
  for (const group of Object.values(collected)) {
    for (const row of group) assertNamespaced(row.lead_id);
  }
  const total = collected.verified.length + collected.approved.length;
  console.log(`[cleanup] TEST-AOH rows found: Verified=${collected.verified.length} Approved=${collected.approved.length}`);
  if (total === 0) {
    console.log('[cleanup] nothing to clean (idempotent no-op)');
    return true;
  }
  if (!args.execute) {
    console.warn('[cleanup] DRY-RUN: pass --execute to actually delete. Nothing deleted.');
    return false;
  }
  await client.deleteRows(VERIFIED_TAB, collected.verified.map((r) => r.index));
  await client.deleteRows(APPROVED_TAB, collected.approved.map((r) => r.index));

  const after = collectTestRows(await client.listRows(VERIFIED_TAB)).length
    + collectTestRows(await client.listRows(APPROVED_TAB), APPROVED_LEAD_COL).length;
  if (after !== 0) {
    console.error(`[cleanup] FAIL: ${after} TEST-AOH rows remain after delete.`);
    return false;
  }
  console.log('[cleanup] verified: zero TEST-AOH rows remain in Verified Leads and Approved Outreach');
  return true;
}

async function verifyFinal(client, snapshot) {
  const fixtures = loadFixtures();
  let outreachRows = [];
  let outreachAvailable = true;
  try {
    outreachRows = await readOutreachRows(client);
  } catch (err) {
    outreachAvailable = false;
    console.warn(`[verify-final] WARNING: could not read ${OUTREACH_TAB} (${err.message}). Isolation line marked MANUAL.`);
  }
  const tag = outreachAvailable ? 'AUTOMATED' : 'MANUAL';
  const report = buildReport({
    fixtures,
    approvedGrid: snapshot.approved,
    verifiedGrid: snapshot.verified,
    outreachRows,
    cleanupOk: true,
    tag,
  });
  if (!outreachAvailable) {
    const iso = report.lines.find((l) => l.label === 'Outreach Log isolation');
    iso.ok = false;
    iso.tag = 'MANUAL';
    report.passed = report.lines.filter((l) => l.ok).length;
    report.ok = report.passed === report.total;
  }
  printReport(report);
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.phases.length === 0) {
    console.log(usage());
    process.exit(1);
  }
  const env = process.env;
  const spreadsheetId = args.fixtureSheetId || env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    console.error('GOOGLE_SHEET_ID (or --fixture-sheet-id) is required. See .env.example.');
    process.exit(1);
  }
  const client = clientForSpreadsheet(spreadsheetId);
  const fixtures = loadFixtures();

  let cleanupOk = false;
  let snapshot = null;
  for (const phase of args.phases) {
    if (phase === 'seed') {
      await seed(env, fixtures, client, args);
    } else if (phase === 'run') {
      await run(env, args);
    } else if (phase === 'verify') {
      await verify(env, client, false);
    } else if (phase === 'cleanup') {
      snapshot = {
        approved: await client.listRows(APPROVED_TAB),
        verified: await client.listRows(VERIFIED_TAB),
      };
      cleanupOk = await cleanup(env, client, args);
    } else if (phase === 'verify-final') {
      if (!snapshot) snapshot = {
        approved: await client.listRows(APPROVED_TAB),
        verified: await client.listRows(VERIFIED_TAB),
      };
      await verifyFinal(client, snapshot);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(`[harness] ${err.message}`);
    process.exit(1);
  });
}

module.exports = { parseArgs, seed, run, verify, verifyFinal, cleanup, printReport };