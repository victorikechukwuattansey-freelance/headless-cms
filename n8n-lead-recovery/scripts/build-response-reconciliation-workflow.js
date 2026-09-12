'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { reconcileCode } = require('../src/embedded-response-reconcile');

const SPREADSHEET_ID = '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ';
const OUTPUT = path.join(__dirname, '..', 'Response-Reconciliation V1.json');

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

/**
 * Read-only response reconciliation workflow. Exactly FIVE nodes — no
 * initialization node:
 *   Manual Trigger → Read Response Log
 *                 → Read Outreach Log
 *   Read Response Log → Reconcile Responses
 *   Read Outreach Log  → Reconcile Responses
 *   Reconcile Responses → Response Reconciliation Complete
 *
 * The Manual Trigger carries optional operator metadata
 * (response_log_read_error / outreach_log_read_error) so a failed read is
 * reported honestly as INCOMPLETE. The Reconcile node sets
 * alwaysOutputData so it always executes — even when both reads return zero
 * rows — yielding COMPLETED with valid zero metrics rather than a silently
 * skipped run.
 */
function responseReconciliationWorkflow() {
  const nodes = [
    { parameters: { event: '' }, id: 'resp-recon-manual-0000001', name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 160] },
    readSheet('Read Response Log', 'Response Log', 'resp-recon-read-response-0001', [260, -40]),
    readSheet('Read Outreach Log', 'Outreach Log', 'resp-recon-read-outreach-0001', [260, 300]),
    {
      parameters: { jsCode: reconcileCode },
      id: 'resp-recon-reconcile-0000001',
      name: 'Reconcile Responses',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      alwaysOutputData: true,
      position: [520, 160],
    },
    { parameters: {}, id: 'resp-recon-complete-0000001', name: 'Response Reconciliation Complete', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [780, 160] },
  ];

  const connections = {
    'Manual Trigger': {
      main: [
        [{ node: 'Read Response Log', type: 'main', index: 0 }],
        [{ node: 'Read Outreach Log', type: 'main', index: 0 }],
      ],
    },
    'Read Response Log': { main: [[{ node: 'Reconcile Responses', type: 'main', index: 0 }]] },
    'Read Outreach Log': { main: [[{ node: 'Reconcile Responses', type: 'main', index: 0 }]] },
    'Reconcile Responses': { main: [[{ node: 'Response Reconciliation Complete', type: 'main', index: 0 }]] },
  };

  return {
    name: 'Lead Recovery Engine — Response Reconciliation V1',
    active: false,
    nodes,
    connections,
    meta: {
      artifact: 'Response-Reconciliation V1',
      spreadsheetId: SPREADSHEET_ID,
      readOnly: true,
      sheets: ['Response Log', 'Outreach Log'],
      capturesReportedBy: 'OUTREACH-RESPONSE-CAPTURE-V1',
      readErrorsCarriedBy: 'Manual Trigger (response_log_read_error / outreach_log_read_error)',
      emptyReadBehavior: 'alwaysOutputData on Reconcile Responses — empty successful reads yield COMPLETED with valid zero metrics',
      generatedBy: 'scripts/build-response-reconciliation-workflow.js',
    },
  };
}

function main() {
  const workflow = responseReconciliationWorkflow();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(workflow, null, 2)}\n`);
  const codeNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  console.log(`Response Reconciliation workflow written to ${OUTPUT}`);
  console.log(`Nodes: ${workflow.nodes.length} | code nodes: ${codeNodes.length} | writes: 0`);
}

if (require.main === module) {
  main();
}

module.exports = { responseReconciliationWorkflow, OUTPUT, SPREADSHEET_ID };