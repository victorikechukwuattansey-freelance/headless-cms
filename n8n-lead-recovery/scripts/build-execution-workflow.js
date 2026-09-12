'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { initModeCode, executeCode, prepareLogCode } = require('../src/embedded-execution');

const SPREADSHEET_ID = '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ';
const OUTPUT = path.join(__dirname, '..', 'Outreach-Execution-and-Delivery V1.json');

const readSheet = (nodeName, sheetName, id, pos) => ({
  parameters: {
    documentId: { __rl: true, value: SPREADSHEET_ID, mode: 'list' },
    operation: 'read',
    sheetName: { mode: 'name', value: sheetName },
    filtersUI: { values: [] },
    options: { returnAllMatches: true },
  },
  id,
  name: nodeName,
  type: 'n8n-nodes-base.googleSheets',
  typeVersion: 4,
  position: pos,
});

const appendSheet = (nodeName, sheetName, pos) => ({
  parameters: {
    documentId: { __rl: true, value: SPREADSHEET_ID, mode: 'list' },
    operation: 'append',
    sheetName: { mode: 'name', value: sheetName },
    columns: { mappingMode: 'autoMapInputData' },
    options: {},
  },
  id: 'exec-write-outreach-00001',
  name: nodeName,
  type: 'n8n-nodes-base.googleSheets',
  typeVersion: 4,
  position: pos,
});

/** Two-item output envelope from Execute Ready Queue: [report, logRows]. */
function executionWorkflow() {
  const nodes = [
    { parameters: { event: '' }, id: 'exec-manual-0000000001', name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 160] },
    {
      parameters: { jsCode: initModeCode },
      id: 'exec-init-mode-00001',
      name: 'Initialize Execution Mode',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [260, -40],
    },
    readSheet('Read Approved Outreach', 'Approved Outreach', 'exec-read-approved-0001', [260, 120]),
    readSheet('Read Outreach Log', 'Outreach Log', 'exec-read-outreach-0001', [260, 300]),
    {
      parameters: { jsCode: executeCode },
      id: 'exec-execute-000000001',
      name: 'Execute Ready Queue',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [500, 160],
    },
    {
      parameters: { jsCode: prepareLogCode },
      id: 'exec-prepare-log-00001',
      name: 'Prepare Outreach Log Write',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [740, 260],
    },
    appendSheet('Write Outreach Log', 'Outreach Log', [980, 300]),
    { parameters: {}, id: 'exec-complete-00000001', name: 'Execution Complete', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [1220, 160] },
  ];

  const connections = {
    'Manual Trigger': {
      main: [
        [{ node: 'Initialize Execution Mode', type: 'main', index: 0 }],
        [{ node: 'Read Approved Outreach', type: 'main', index: 0 }],
        [{ node: 'Read Outreach Log', type: 'main', index: 0 }],
      ],
    },
    'Initialize Execution Mode': { main: [[{ node: 'Execute Ready Queue', type: 'main', index: 0 }]] },
    'Read Approved Outreach': { main: [[{ node: 'Execute Ready Queue', type: 'main', index: 0 }]] },
    'Read Outreach Log': { main: [[{ node: 'Execute Ready Queue', type: 'main', index: 0 }]] },
    'Execute Ready Queue': {
      main: [
        [
          { node: 'Prepare Outreach Log Write', type: 'main', index: 0 },
          { node: 'Execution Complete', type: 'main', index: 0 },
        ],
      ],
    },
    'Prepare Outreach Log Write': { main: [[{ node: 'Write Outreach Log', type: 'main', index: 0 }]] },
    'Write Outreach Log': { main: [[{ node: 'Execution Complete', type: 'main', index: 0 }]] },
  };

  return {
    name: 'Lead Recovery Engine — Outreach Execution & Delivery V1',
    active: false,
    nodes,
    connections,
    meta: {
      artifact: 'Outreach-Execution-and-Delivery V1',
      spreadsheetId: SPREADSHEET_ID,
      defaultMode: 'DRY_RUN',
      defaultProvider: 'NOT_CONFIGURED',
      generatedBy: 'scripts/build-execution-workflow.js',
    },
  };
}

function main() {
  const workflow = executionWorkflow();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(workflow, null, 2)}\n`);
  const codeNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  console.log(`Execution workflow written to ${OUTPUT}`);
  console.log(`Nodes: ${workflow.nodes.length} | code nodes: ${codeNodes.length}`);
}

if (require.main === module) {
  main();
}

module.exports = { executionWorkflow, OUTPUT, SPREADSHEET_ID };