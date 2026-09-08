'use strict';

const fs = require('fs');
const path = require('path');
const { batchImport } = require('./batch-import');
const { processBatch } = require('./batch-pipeline');
const { persistBatch } = require('./store');

// argument parsing: node batch-run.js <csv> [research.json] [store.csv]
// optional named flags override positionals: --research=<file> --store=<file>
function parseArgs(argv) {
  const out = { csv: null, research: null, store: null, positionals: [] };
  for (const a of argv) {
    if (a.startsWith('--research=')) out.research = a.slice('--research='.length);
    else if (a.startsWith('--store=')) out.store = a.slice('--store='.length);
    else if (a === '--research' || a === '--store') { /* value follows as next positional */ }
    else out.positionals.push(a);
  }
  out.csv = out.positionals[0] || null;
  if (out.research === null) out.research = out.positionals[1] || null;
  if (out.store === null) out.store = out.positionals[2] || null;
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.csv) {
  console.error('usage: node batch-run.js <prospects.csv> [research.json] [store.csv]');
  process.exit(1);
}
const csvText = fs.readFileSync(args.csv, 'utf8');
let research = {};
if (args.research && fs.existsSync(args.research)) {
  research = JSON.parse(fs.readFileSync(args.research, 'utf8'));
}
const storeFile = args.store || path.join(__dirname, '..', 'data', 'prospects.csv');

const imp = batchImport(csvText);
const res = processBatch(imp, [], research);

console.log('=== IMPORT ===');
console.log(`Total:     ${res.imported}`);
console.log(`Valid:     ${res.valid}`);
console.log(`Invalid:   ${res.invalid}`);
for (const inv of res.invalidRecords) {
  console.log(`  Row ${inv.index + 1}: ${inv.record.business_name || '(no name)'} -> ${inv.errors.join(', ')}`);
}
console.log('');
console.log('=== PIPELINE ===');
console.log(`Duplicates:       ${res.duplicates}`);
console.log(`Ambiguous:        ${res.ambiguous}`);
console.log(`Needs research:   ${res.needsResearch}`);
console.log(`Rejected (score): ${res.rejected}`);
console.log(`Suppressed:       ${res.suppressed}`);
console.log(`Approved:         ${res.approved}`);
console.log(`Outreach ready:   ${res.outreachReady}`);
console.log('');
console.log('=== PERSISTENCE ===');
const persisted = persistBatch(res.records, { file: storeFile });
console.log(`Persisted (new):  ${persisted.persisted.length}`);
console.log(`Already present:  ${persisted.duplicates.length} (idempotent skip — no overwrite)`);
console.log(`Invalid skipped:  ${persisted.invalidSkipped.length}`);
console.log(`Store total:      ${persisted.total} records -> ${storeFile}`);
console.log('');
console.log('=== OUTREACH BRIEFS (operator review only; nothing sent) ===');
for (const b of res.outreachBriefs) {
  console.log(`  - ${b.business} (${b.location})`);
}
console.log('');
console.log('Records persist across process exits. Re-run the same CSV to verify idempotency.');
console.log('Review persisted prospects with: node cli/review.js list');
console.log('No messages were sent. Operator review required.');
