'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { initCaptureCode, captureCode, prepareWriteCode } = require('../src/embedded-response-capture');

const SPREADSHEET_ID = '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ';
const OUTPUT = path.join(__dirname, '..', 'Response-Capture V1.json');

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

const appendSheet = (nodeName, sheetName, id, pos) => ({
  parameters: {
    documentId: { __rl: true, value: SPREADSHEET_ID, mode: 'list' },
    operation: 'append',
    sheetName: { mode: 'name', value: sheetName },
    columns: { mappingMode: 'autoMapInputData' },
    options: {},
  },
  id,
  name: nodeName,
  type: 'n8n-nodes-base.googleSheets',
  typeVersion: 4,
  position: pos,
});

/**
 * Response Capture V1 — inbound response ingestion boundary.
 * Single-item capture node emits the report; the DRY_RUN? IF gate routes
 * DRY_RUN to a no-op through to completion and REAL to the single durable
 * write surface (Response Log append).
 */
function responseCaptureWorkflow() {
  const nodes = [
    { parameters: { event: '' }, id: 'resp-capture-manual-0000001', name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 160] },
    {
      parameters: { jsCode: initCaptureCode },
      id: 'resp-capture-init-0000001',
      name: 'Initialize Response Capture',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [260, -40],
    },
    readSheet('Read Response Log', 'Response Log', 'resp-capture-read-log-0001', [260, 300]),
    {
      parameters: { jsCode: captureCode },
      id: 'resp-capture-capture-000001',
      name: 'Capture Inbound Responses',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [520, 160],
    },
    {
      parameters: {
        conditions: {
          combinator: 'and',
          options: {},
          conditions: [
            {
              id: 'resp-capture-if-cond-0001',
              leftValue: '={{ $json.mode }}',
              rightValue: 'DRY_RUN',
              operator: { type: 'string', operation: 'equals' },
            },
          ],
        },
        options: {},
      },
      id: 'resp-capture-if-mode-00001',
      name: 'DRY_RUN?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [760, 160],
    },
    { parameters: {}, id: 'resp-capture-build-000001', name: 'Build Capture Result', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [1000, 40] },
    {
      parameters: { jsCode: prepareWriteCode },
      id: 'resp-capture-prepare-00001',
      name: 'Prepare Response Log Write',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1000, 280],
    },
    appendSheet('Write Response Log', 'Response Log', 'resp-capture-write-00001', [1240, 280]),
    { parameters: {}, id: 'resp-capture-complete-0001', name: 'Response Capture Complete', type: 'n8n-nodes-base.noOp', typeVersion: 1, position: [1480, 160] },
  ];

  const connections = {
    'Manual Trigger': {
      main: [
        [{ node: 'Initialize Response Capture', type: 'main', index: 0 }],
        [{ node: 'Read Response Log', type: 'main', index: 0 }],
      ],
    },
    'Initialize Response Capture': { main: [[{ node: 'Capture Inbound Responses', type: 'main', index: 0 }]] },
    'Read Response Log': { main: [[{ node: 'Capture Inbound Responses', type: 'main', index: 0 }]] },
    'Capture Inbound Responses': { main: [[{ node: 'DRY_RUN?', type: 'main', index: 0 }]] },
    'DRY_RUN?': {
      main: [
        [{ node: 'Build Capture Result', type: 'main', index: 0 }],
        [{ node: 'Prepare Response Log Write', type: 'main', index: 0 }],
      ],
    },
    'Build Capture Result': { main: [[{ node: 'Response Capture Complete', type: 'main', index: 0 }]] },
    'Prepare Response Log Write': { main: [[{ node: 'Write Response Log', type: 'main', index: 0 }]] },
    'Write Response Log': { main: [[{ node: 'Response Capture Complete', type: 'main', index: 0 }]] },
  };

  return {
    name: 'Lead Recovery Engine — Outreach Response Capture V1',
    active: false,
    nodes,
    connections,
    meta: {
      artifact: 'Response-Capture V1',
      spreadsheetId: SPREADSHEET_ID,
      defaultMode: 'DRY_RUN',
      defaultReadError: 'operator-supplied response_log_read_error via Initialize Response Capture when the Response Log cannot be read',
      generatedBy: 'scripts/build-response-capture-workflow.js',
    },
  };
}

function main() {
  const workflow = responseCaptureWorkflow();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(workflow, null, 2)}\n`);
  const codeNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  const sheetNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.googleSheets');
  const writeNodes = sheetNodes.filter((n) => n.parameters.operation === 'append');
  console.log(`Response Capture workflow written to ${OUTPUT}`);
  console.log(`Nodes: ${workflow.nodes.length} | code nodes: ${codeNodes.length} | sheet reads: ${sheetNodes.length - writeNodes.length} | append writes (REAL only): ${writeNodes.length}`);
}

if (require.main === module) {
  main();
}

module.exports = { responseCaptureWorkflow, OUTPUT, SPREADSHEET_ID };