'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROD_WORKFLOW = path.join(__dirname, '..', 'Approved Outreach Handoff V1.json');
const FIXTURE_OUTPUT = path.join(__dirname, '..', 'fixtures', 'Approved Outreach Handoff V1 - Fixture.json');

function buildFixtureWorkflow({ fixtureSpreadsheetId, sourcePath = PROD_WORKFLOW }) {
  if (!fixtureSpreadsheetId || typeof fixtureSpreadsheetId !== 'string') {
    throw new Error('fixtureSpreadsheetId is required');
  }
  const workflow = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const clone = JSON.parse(JSON.stringify(workflow));

  let swapped = 0;
  for (const node of clone.nodes || []) {
    if (node.type === 'n8n-nodes-base.googleSheets' && node.parameters && node.parameters.documentId) {
      node.parameters.documentId = {
        __rl: true,
        value: fixtureSpreadsheetId,
        mode: 'list',
        cachedResultName: 'Fixture Approved Outreach Spreadsheet',
        cachedResultUrl: '',
      };
      swapped += 1;
    }
  }
  if (swapped === 0) {
    throw new Error('No googleSheets documentId nodes found; refusing to emit a fixture workflow');
  }

  clone.name = `${String(workflow.name || 'Approved Outreach Handoff').replace(/ V1$/, '')} V1 - Fixture Run`;
  clone.active = false;
  clone.meta = Object.assign({}, clone.meta, {
    fixture: true,
    fixtureSpreadsheetId,
    sourceWorkflowName: workflow.name,
    generatedBy: 'build-fixture-workflow.js',
  });
  return clone;
}

function main() {
  const args = process.argv.slice(2);
  const sheetArg = args.find((a) => a.startsWith('--sheet-id='));
  const outArg = args.find((a) => a.startsWith('--out='));
  if (!sheetArg) {
    console.error('Usage: node scripts/build-fixture-workflow.js --sheet-id=<FIXTURE_SHEET_ID> [--out=<path>]');
    console.error('  --sheet-id  Google Sheets spreadsheet id for the dedicated fixture spreadsheet');
    console.error('  --out       output workflow JSON path (defaults to fixtures/Approved Outreach Handoff V1 - Fixture.json)');
    process.exit(2);
  }
  const fixtureSpreadsheetId = sheetArg.split('=')[1].trim();
  const outPath = outArg ? outArg.split('=')[1] : FIXTURE_OUTPUT;
  const clone = buildFixtureWorkflow({ fixtureSpreadsheetId });
  fs.writeFileSync(outPath, `${JSON.stringify(clone, null, 2)}\n`);
  console.log(`Fixture workflow written to ${outPath}`);
  console.log(`Nodes with documentId swapped: ${clone.nodes.filter((n) => n.type === 'n8n-nodes-base.googleSheets').length}`);
  console.log('Workflow name: ' + clone.name);
}

if (require.main === module) {
  main();
}

module.exports = { buildFixtureWorkflow, PROD_WORKFLOW, FIXTURE_OUTPUT };