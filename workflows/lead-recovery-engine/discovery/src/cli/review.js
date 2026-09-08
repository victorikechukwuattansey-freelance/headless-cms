'use strict';

const path = require('path');
const { reviewAndPersist, researchAndPersist, researchBrief, listProspects, policyAndPersist, optoutAndPersist } = require('../review-ops');

const DEFAULT_STORE = path.join(__dirname, '..', '..', 'data', 'prospects.csv');

function parseArgs(argv) {
  let store = DEFAULT_STORE;
  const rest = [];
  const researchFlags = {};
  const researchOpts = {};
  for (const a of argv) {
    if (a.startsWith('--store=')) store = a.slice('--store='.length);
    else if (a.startsWith('--flag=')) researchFlags[a.slice('--flag='.length)] = true;
    else if (a.startsWith('--evidence=')) researchOpts.evidence = a.slice('--evidence='.length);
    else if (a.startsWith('--class=')) researchOpts.class = a.slice('--class='.length);
    else if (a.startsWith('--source=')) researchOpts.source = a.slice('--source='.length);
    else if (a.startsWith('--note=')) researchOpts.note = a.slice('--note='.length);
    else rest.push(a);
  }
  if (Object.keys(researchFlags).length) researchOpts.flags = researchFlags;
  return { store, args: rest, research: researchOpts };
}

function main() {
  const { store, args, research } = parseArgs(process.argv.slice(2));
  const cmd = args[0];

  switch (cmd) {
    case 'list':
      list(store, args[1]);
      break;
    case 'show':
      show(store, args[1]);
      break;
    case 'approve':
      mutate(store, args[1], 'approve');
      break;
    case 'suppress':
      mutate(store, args[1], 'suppress', args[2] || 'operator');
      break;
    case 'reject':
      mutate(store, args[1], 'reject', args[2] || 'other');
      break;
    case 'ready':
      mutate(store, args[1], 'ready');
      break;
    case 'research':
      researchCmd(store, args[1], research);
      break;
    case 'brief':
      brief(store, args[1]);
      break;
    case 'policy':
      policyCmd(store, args[1], args[2]);
      break;
    case 'optout':
      optoutCmd(store, args[1], args[2]);
      break;
    default:
      usage();
  }
}

function list(store, filter) {
  const rows = listProspects(store);
  for (const r of rows) {
    if (filter && r.research_status !== filter) continue;
    console.log(
      `${r.prospect_id}\t[${r.research_status}]\t${r.business_name}\t${r.city}, ${r.state}\tscore=${r.opportunity_score}`
    );
  }
}

function show(store, id) {
  if (!id) return usage();
  const r = listProspects(store).find((x) => x.prospect_id === id);
  if (!r) return console.log('NOT FOUND');
  for (const [k, v] of Object.entries(r)) console.log(`${k}=${v}`);
}

function brief(store, id) {
  if (!id) return usage();
  const res = researchBrief(store, id);
  if (!res.ok) return console.log('ERROR:', res.error);
  console.log(JSON.stringify(res.value, null, 2));
}

function mutate(store, id, op, reason) {
  if (!id) return usage();
  const res = reviewAndPersist(store, id, op, reason);
  if (!res.ok) return console.log('ERROR:', res.error);
  console.log('OK', id, '->', res.value.research_status);
}

// Operator-assisted research entry. Loads the canonical persisted prospect,
// appends one classified evidence item, re-runs the validated scorer on the
// selected flags, and persists atomically. Does NOT change research_status:
// scoring is independent of the review decision (research ≠ approval).
function researchCmd(store, id, opts) {
  if (!id) return usage();
  const res = researchAndPersist(store, id, opts);
  if (!res.ok) return console.log('ERROR:', res.error, res.detail || '');
  console.log(
    `OK ${id} research persisted | score=${res.value.opportunity_score} | status=${res.value.research_status} (unchanged by research) | evidence=${res.value.evidence_class}`
  );
}

// Set (or clear) the operator-granted contact policy on a prospect. Only an
// explicit 'permitted' policy allows onward outreach eligibility. Opted-out
// prospects can never be granted 'permitted'.
function policyCmd(store, id, policy) {
  if (!id || !policy) return usage();
  const res = policyAndPersist(store, id, policy);
  if (!res.ok) return console.log('ERROR:', res.error, res.detail || '');
  console.log(`OK ${id} contact_policy=${res.value.contact_policy}`);
}

// Record an explicit, durable opt-out: sets opt_out + reason + timestamp and
// activates suppression. Never reversible via `policy permitted`.
function optoutCmd(store, id, reason) {
  if (!id) return usage();
  const res = optoutAndPersist(store, id, reason);
  if (!res.ok) return console.log('ERROR:', res.error, res.detail || '');
  console.log(`OK ${id} opt_out=true | suppressed=${res.value.suppressed} | reason=${res.value.opt_out_reason}`);
}

function usage() {
  console.log(
    'usage: node cli/review.js [--store=<data/prospects.csv>] <list|list <status>|show <id>|approve <id>|suppress <id> <reason>|reject <id> <reason>|ready <id>|research <id> [--flag=<factor> --evidence=<text> --class=<OBSERVED|INFERRED|CLIENT_PROVIDED|VERIFIED|UNKNOWN> --source=<src> --note=<note>]|brief <id>|policy <id> <permitted|blocked|unknown>|optout <id> <reason>>'
  );
}

main();
