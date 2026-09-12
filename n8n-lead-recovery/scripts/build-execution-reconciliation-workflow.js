'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { initEvidenceCode, reconcileCode } = require('../src/embedded-execution-reconcile');

const SPREADSHEET_ID = '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ';
const OUTPUT = path.join(__dirname, '..', 'Execution-Reconciliation V1.json');

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

/** Read-only reconciliation workflow: evidence (operator-supplied) + Outreach Log read. */
function executionReconciliationWorkflow() {
  const nodes = [
    { parameters: { event: '' }, id: 'exec-recon-manual-0000001', name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 160] },
    {
      parameters: { jsCode: initEvidenceCode },
      id: 'exec-recon-init-evidence-0001',
      name: 'Initialize Execution Evidence',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [260, -40],
    },
    readSheet('Read Outreach Log', 'Outreach Log', 'exec-recon-read-outreach-0001', [260, 300]),
    {
      parameters: { jsCode: reconcileCode },
      id: 'exec-recon-reconcile-0000001',
      name: 'Reconcile Execution Records',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [520, 160],
    },
    { parameters: {}, id: 'exec-recon-complete-0000001', name: 'Execution Reconciliation Complete', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [780, 160] },
  ];

  const connections = {
    'Manual Trigger': {
      main: [
        [{ node: 'Initialize Execution Evidence', type: 'main', index: 0 }],
        [{ node: 'Read Outreach Log', type: 'main', index: 0 }],
      ],
    },
    'Initialize Execution Evidence': { main: [[{ node: 'Reconcile Execution Records', type: 'main', index: 0 }]] },
    'Read Outreach Log': { main: [[{ node: 'Reconcile Execution Records', type: 'main', index: 0 }]] },
    'Reconcile Execution Records': { main: [[{ node: 'Execution Reconciliation Complete', type: 'main', index: 0 }]] },
  };

  return {
    name: 'Lead Recovery Engine — Execution Reconciliation V1',
    active: false,
    nodes,
    connections,
    meta: {
      artifact: 'Execution-Reconciliation V1',
      spreadsheetId: SPREADSHEET_ID,
      readOnly: true,
      evidence: 'operator-supplied execution reports via Initialize Execution Evidence',
      defaultEvidenceAvailable: true,
      generatedBy: 'scripts/build-execution-reconciliation-workflow.js',
    },
  };
}

function main() {
  const workflow = executionReconciliationWorkflow();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(workflow, null, 2)}\n`);
  const codeNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  console.log(`Execution Reconciliation workflow written to ${OUTPUT}`);
  console.log(`Nodes: ${workflow.nodes.length} | code nodes: ${codeNodes.length} | writes: 0`);
}

if (require.main === module) {
  main();
}

module.exports = { executionReconciliationWorkflow, OUTPUT, SPREADSHEET_ID };