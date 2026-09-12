'use strict';

/*
 * Response Interpretation V1 — workflow CONTRACT (Phase 3).
 *
 * Single source of truth for the n8n workflow boundary around the pure
 * interpretation engine. Phase 4 must render this contract into the shipped
 * workflow JSON via its builder; the contract-and-parity gate lives here so
 * the embedded mirror of Phase 4 can be verified against the same reference
 * this file defines.
 *
 * This module is NOT the embedded mirror and does NOT emit a workflow JSON.
 * It defines:
 *   - the exact 5-node topology, node types, names, and connection order;
 *   - the only Google Sheets read (Response Log) and the reconciliation-report
 *     read role (pure relay — never a sheet, never network, never fs);
 *   - the input/join contract: everything joins by response_id, reconciliation
 *     is authoritative evidence and is NEVER recomputed;
 *   - the failure semantics (healthy reads -> COMPLETED, read failure ->
 *     INCOMPLETE with nulled summary, never a fabricated zero);
 *   - the banned-surface rules for every node in the workflow;
 *   - the fixture-parity gate (`engineBehaviorFor` / `assertEngineEquivalence`)
 *     that any Phase 4 embedded implementation must reproduce byte-for-byte.
 *
 * Determinism: run metadata is injected (FIXED_NOW / FIXED_RUN_ID), the same
 * clock the Phase 2 corpus goldens were produced with.
 */

const { RUN_LABEL, digits14, interpretationIdFor, interpretResponses } = require('./response-interpretation');
const { reconcileResponses } = require('./response-reconcile');

const WORKFLOW_NAME = 'Lead Recovery Engine — Response Interpretation V1';
const ARTIFACT = 'Response-Interpretation V1';
const RESPONSE_LOG_SHEET = 'Response Log';
const JOIN_KEY = 'response_id';

/*
 * The single spreadsheet reference adopted by every frozen workflow in this
 * repository. It is the engine/fixture spreadsheet, never a production id and
 * never a secret — it is pinned here so Phase 4 renders exactly one reference.
 */
const SPREADSHEET_ID = '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ';

const EXPECTED_NODES = [
  'Manual Trigger',
  'Read Response Log',
  'Read Reconciliation Report',
  'Interpret Responses',
  'Response Interpretation Complete',
];

const NODE_TYPES = {
  'Manual Trigger': 'n8n-nodes-base.manualTrigger',
  'Read Response Log': 'n8n-nodes-base.googleSheets',
  'Read Reconciliation Report': 'n8n-nodes-base.code',
  'Interpret Responses': 'n8n-nodes-base.code',
  'Response Interpretation Complete': 'n8n-nodes-base.noOp',
};

/*
 * Empty successful reads must still reach the interpretation stage. Both code
 * nodes that consume the two reads set alwaysOutputData so a zero-item read is
 * a COMPLETED run with valid zero metrics, never a silently skipped branch.
 */
const ALWAYS_OUTPUT_DATA = ['Read Reconciliation Report', 'Interpret Responses'];

/*
 * The Manual Trigger carries optional read-failure metadata (same convention
 * as the frozen reconciliation workflow). Interpret reads these two keys; the
 * engine options `responseLogReadError` / `reconciliationReadError` map 1:1.
 */
const TRIGGER_ERROR_KEYS = ['response_log_read_error', 'reconciliation_read_error'];

const RECONCILIATION_SOURCE =
  'Response Reconciliation V1 report artifact (per-run JSON evidence; read-only; never recomputed)';

const BANNED_NODE_TYPES = [
  'n8n-nodes-base.emailSend',
  'n8n-nodes-base.twilio',
  'n8n-nodes-base.whatsapp',
  'n8n-nodes-base.slack',
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.scheduleTrigger',
  'n8n-nodes-base.hunter',
  'n8n-nodes-base.clearbit',
  '@n8n/n8n-nodes-langchain.chatOpenAI',
  'n8n-nodes-base.openAi',
];

/* Raw material that must never leave the workflow boundary. */
const SENSITIVE_KEYS = ['response_text', 'provider_message_id', 'sender', 'recipient'];

/* The same frozen clock the Phase 2 fixture goldens were produced with. */
const FIXED_NOW = new Date('2026-09-12T09:00:00.000Z').getTime();
const FIXED_RUN_ID = `${RUN_LABEL}-${digits14(String(FIXED_NOW))}`;

const TOPOLOGY = {
  manualFanout: ['Read Response Log', 'Read Reconciliation Report'],
  readFanIn: ['Interpret Responses', 'Interpret Responses'],
  exit: 'Response Interpretation Complete',
};

const META_REQUIREMENTS = {
  artifact: ARTIFACT,
  readOnly: true,
  sheets: [RESPONSE_LOG_SHEET],
  joinKey: JOIN_KEY,
};

function stripRuntime(value) {
  return JSON.parse(
    JSON.stringify(value, (key, val) => ['run_id', 'run_at', 'detected_at'].includes(key) ? undefined : val),
  );
}

/**
 * Canonical projection of the three workflow feed surfaces onto the engine
 * signature — exactly what the Phase 4 Interpret node must do:
 *   - responseItems   -> responseRows (full durable rows),
 *   - reportItems     -> reconciliationReport (authoritative evidence; the read
 *                        yields a single JSON document, healthy-empty allowed),
 *   - errorCarrier    -> responseLogReadError / reconciliationReadError.
 * Join happens exclusively by response_id inside the engine. Reconciliation is
 * consumed as a report and never recomputed.
 */
function projectWorkflowInputs({ errorCarrier = {}, responseItems = [], reportItems = [] } = {}) {
  const report = (reportItems || []).length > 0 ? reportItems[0].json : null;
  return {
    responseRows: (responseItems || []).map((item) => item && item.json),
    reconciliationReport: report || { status: 'COMPLETED', results: [] },
    responseLogReadError: errorCarrier.response_log_read_error || '',
    reconciliationReadError: errorCarrier.reconciliation_read_error || '',
    now: FIXED_NOW,
    runId: FIXED_RUN_ID,
  };
}

/**
 * Derives the frozen reconcile artifact a fixture's read would have produced,
 * then interprets. This is the parity BASELINE: the Phase 4 embedded node is
 * required to reproduce `engineBehaviorFor(fixture)` byte-for-byte.
 */
function engineBehaviorFor(fixture) {
  const report =
    fixture.upstreamIncomplete
      ? { status: 'INCOMPLETE', results: [] }
      : fixture.responseReadError || fixture.reconciliationReadError
        ? { status: 'COMPLETED', results: [] }
        : reconcileResponses({
            responseRows: fixture.reconcileResponseRows || [],
            outreachRows: fixture.reconcileOutreachRows || [],
            now: FIXED_NOW,
            runId: 'RESPRECON-FIXED',
          });
  return interpretResponses(
    projectWorkflowInputs({
      errorCarrier: {
        response_log_read_error: fixture.responseReadError || '',
        reconciliation_read_error: fixture.reconciliationReadError || '',
      },
      responseItems: (fixture.initialResponseRows || []).map((json) => ({ json })),
      reportItems: [{ json: report }],
    }),
  );
}

/**
 * The Phase 4 parity gate. Returns true only when the embedded node's output
 * for a fixture is engine-equivalent (equal up to run identity fields).
 */
function assertEngineEquivalence(actualReport, fixture) {
  const actual = stripRuntime(actualReport);
  const baseline = stripRuntime(engineBehaviorFor(fixture));
  return JSON.stringify(actual) === JSON.stringify(baseline);
}

/* ------------------------------------------------------------------ */
/* Reference topology (minimal structural placeholder — NO jsCode)     */
/* ------------------------------------------------------------------ */

/**
 * The canonical 5-node read-only topology, rendered with the exact node names,
 * ids, types, connections, meta, and positions Phase 4's builder must emit
 * (Phase 4 injects the embedded jsCode into the two code nodes). The
 * reconciliation report read is a code node because the repository has NO
 * file-read workflow precedent and n8n cannot read the runner-local artifact;
 * it is a read-only pure relay — never a sheet, never a write.
 */
function referenceWorkflow() {
  const manualTrigger = {
    parameters: { event: '' },
    id: 'resp-int-manual-0000001',
    name: 'Manual Trigger',
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [0, 160],
  };

  const readResponseLog = {
    parameters: {
      documentId: { __rl: true, value: SPREADSHEET_ID, mode: 'list' },
      operation: 'read',
      sheetName: { mode: 'name', value: RESPONSE_LOG_SHEET },
      filtersUI: { values: [] },
      options: { returnAllMatches: true },
    },
    id: 'resp-int-read-response-0001',
    name: 'Read Response Log',
    type: 'n8n-nodes-base.googleSheets',
    typeVersion: 4,
    position: [260, -40],
  };

  const readReconciliationReport = {
    parameters: {},
    id: 'resp-int-read-recon-0001',
    name: 'Read Reconciliation Report',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    alwaysOutputData: true,
    position: [260, 300],
  };

  const interpretResponsesNode = {
    parameters: {},
    id: 'resp-int-interpret-0000001',
    name: 'Interpret Responses',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    alwaysOutputData: true,
    position: [520, 160],
  };

  const complete = {
    parameters: {},
    id: 'resp-int-complete-0000001',
    name: 'Response Interpretation Complete',
    type: 'n8n-nodes-base.noOp',
    typeVersion: 1,
    position: [780, 160],
  };

  const connections = {
    'Manual Trigger': {
      main: [
        [{ node: 'Read Response Log', type: 'main', index: 0 }],
        [{ node: 'Read Reconciliation Report', type: 'main', index: 0 }],
      ],
    },
    'Read Response Log': { main: [[{ node: 'Interpret Responses', type: 'main', index: 0 }]] },
    'Read Reconciliation Report': { main: [[{ node: 'Interpret Responses', type: 'main', index: 0 }]] },
    'Interpret Responses': { main: [[{ node: 'Response Interpretation Complete', type: 'main', index: 0 }]] },
  };

  return {
    name: WORKFLOW_NAME,
    active: false,
    nodes: [manualTrigger, readResponseLog, readReconciliationReport, interpretResponsesNode, complete],
    connections,
    meta: {
      artifact: ARTIFACT,
      spreadsheetId: SPREADSHEET_ID,
      readOnly: true,
      sheets: [RESPONSE_LOG_SHEET],
      responseTextReadAuthority: 'OUTREACH-RESPONSE-INTERPRETATION-V1 (first artifact allowed to read response_text)',
      reconciliationReportSource: RECONCILIATION_SOURCE,
      joinKey: JOIN_KEY,
      readErrorsCarriedBy: `Manual Trigger (${TRIGGER_ERROR_KEYS.join(' / ')})`,
      emptyReadBehavior:
        'alwaysOutputData on Read Reconciliation Report and Interpret Responses — empty successful reads yield COMPLETED with valid zero metrics',
      generatedBy: 'scripts/build-response-interpretation-workflow.js',
    },
  };
}

function describeWorkflowContract() {
  return {
    name: WORKFLOW_NAME,
    artifact: ARTIFACT,
    expectedNodes: EXPECTED_NODES,
    nodeTypes: NODE_TYPES,
    alwaysOutputData: ALWAYS_OUTPUT_DATA,
    joinKey: JOIN_KEY,
    reconciliationSource: RECONCILIATION_SOURCE,
    triggerErrorKeys: TRIGGER_ERROR_KEYS,
    spreadsheetId: SPREADSHEET_ID,
    responseLogSheet: RESPONSE_LOG_SHEET,
    topology: TOPOLOGY,
    metaRequirements: META_REQUIREMENTS,
    bannedNodeTypes: BANNED_NODE_TYPES,
    sensitiveKeys: SENSITIVE_KEYS,
  };
}

/* ------------------------------------------------------------------ */
/* Banned-surface scanning                                            */
/* ------------------------------------------------------------------ */

const CLEAN_CODE_SCAN = [
  [/staticData/, 'staticData'],
  [/process\.env/, 'process.env'],
  [/\$env/, '$env'],
  [/require\s*\(/, 'require('],
  [/\bfetch\s*\(/, 'fetch('],
  [/eval\s*\(/, 'eval('],
  [/new Function/, 'new Function'],
  [/Math\.random/, 'Math.random'],
  [/crypto\.randomUUID/, 'crypto.randomUUID'],
  [/\brequire\b/, 'module require'],
  [/\bchild_process\b/, 'child_process'],
  [/\bfs\b/, 'fs'],
  [/https?:\/\//i, 'http(s) transport'],
];

function assertCleanSource(code) {
  for (const [pattern, label] of CLEAN_CODE_SCAN) {
    if (pattern.test(code)) {
      throw new Error(`code-node violation: banned pattern "${label}"`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Contract validator                                                 */
/* ------------------------------------------------------------------ */

function edgeTargets(connections, source) {
  const nodeConnections = connections && connections[source];
  const main = nodeConnections && nodeConnections.main;
  if (!Array.isArray(main)) return [];
  return main.map((branch) => (branch || []).map((edge) => edge && edge.node));
}

/**
 * Validates any workflow-shaped object against the Phase 3 contract. Throws on
 * the first (accumulated) violation. Used here against the reference topology
 * and by Phase 4 against the builder output and the shipped JSON.
 */
function assertWorkflowContract(wf) {
  const violations = [];

  if (!wf || typeof wf !== 'object') {
    throw new Error('workflow contract violation: workflow object required');
  }
  if (wf.active) violations.push('workflow must be shipped inactive');

  const nodes = Array.isArray(wf.nodes) ? wf.nodes : [];
  const names = nodes.map((n) => n && n.name);
  if (names.length !== EXPECTED_NODES.length) {
    violations.push(`exactly ${EXPECTED_NODES.length} nodes required (got ${names.length})`);
  }
  EXPECTED_NODES.forEach((expected, index) => {
    if (names[index] !== expected) {
      violations.push(`node ${index} must be "${expected}" in that order (got "${names[index]}")`);
    }
  });
  const nameSet = new Set(names);
  if (nameSet.size !== names.length) violations.push('node names must be unique');
  const idList = nodes.map((n) => n && n.id);
  if (new Set(idList).size !== idList.length) violations.push('node ids must be unique');
  if (idList.some((id) => !id)) violations.push('every node must carry an id');

  const types = nodes.map((n) => n && n.type);
  EXPECTED_NODES.forEach((name) => {
    const node = nodes[names.indexOf(name)];
    if (!node) return;
    if (node.type !== NODE_TYPES[name]) {
      violations.push(`"${name}" must be ${NODE_TYPES[name]} (got ${node.type})`);
    }
  });

  for (const banned of BANNED_NODE_TYPES) {
    if (types.includes(banned)) violations.push(`banned node type present: ${banned}`);
  }

  const sheetNodes = nodes.filter((n) => n && n.type === 'n8n-nodes-base.googleSheets');
  if (sheetNodes.length !== 1) {
    violations.push(`exactly one googleSheets read required (got ${sheetNodes.length})`);
  } else {
    const read = sheetNodes[0];
    const p = read.parameters || {};
    if (p.operation !== 'read') violations.push('Response Log read must use operation "read"');
    if (!p.sheetName || p.sheetName.value !== RESPONSE_LOG_SHEET) {
      violations.push('the only sheet read must target the Response Log tab');
    }
    if (!p.documentId || p.documentId.value !== SPREADSHEET_ID) {
      violations.push('sheet read must reference the pinned engine spreadsheet id');
    }
    if (p.filtersUI && p.filtersUI.values && p.filtersUI.values.length > 0) {
      violations.push('sheet read must be unfiltered');
    }
    if (p.options && p.options.returnAllMatches === false) {
      violations.push('sheet read must return all matches');
    }
  }
  for (const sheet of sheetNodes) {
    const op = sheet.parameters && sheet.parameters.operation;
    if (op && ['append', 'appendOrUpdate', 'update', 'upsert', 'delete'].includes(op)) {
      violations.push(`write operation forbidden in workflow: ${op}`);
    }
  }

  const reconNode = nodes[names.indexOf('Read Reconciliation Report')];
  if (reconNode) {
    if (reconNode.type === 'n8n-nodes-base.googleSheets') {
      violations.push('Read Reconciliation Report must never be a sheet read');
    }
    if (reconNode.alwaysOutputData !== true) {
      violations.push('Read Reconciliation Report must set alwaysOutputData');
    }
  }
  const interpretNode = nodes[names.indexOf('Interpret Responses')];
  if (interpretNode) {
    if (interpretNode.alwaysOutputData !== true) {
      violations.push('Interpret Responses must set alwaysOutputData');
    }
  }

  const trigger = nodes[names.indexOf('Manual Trigger')];
  if (trigger && trigger.type === 'n8n-nodes-base.manualTrigger' && !trigger.parameters) {
    violations.push('Manual Trigger must carry parameters');
  }

  const connections = wf.connections || {};
  for (const source of Object.keys(connections)) {
    if (!nameSet.has(source)) violations.push(`connection source not in workflow: ${source}`);
  }
  const fanout = edgeTargets(connections, 'Manual Trigger');
  if (JSON.stringify(fanout) !== JSON.stringify([[TOPOLOGY.manualFanout[0]], [TOPOLOGY.manualFanout[1]]])) {
    violations.push('Manual Trigger must fan out to exactly both read nodes and nothing else');
  }
  const readConns = edgeTargets(connections, 'Read Response Log');
  const reconConns = edgeTargets(connections, 'Read Reconciliation Report');
  const exitConns = edgeTargets(connections, 'Interpret Responses');
  if (JSON.stringify(readConns) !== JSON.stringify([['Interpret Responses']])) {
    violations.push('Read Response Log must feed only Interpret Responses');
  }
  if (JSON.stringify(reconConns) !== JSON.stringify([['Interpret Responses']])) {
    violations.push('Read Reconciliation Report must feed only Interpret Responses');
  }
  if (JSON.stringify(exitConns) !== JSON.stringify([[TOPOLOGY.exit]])) {
    violations.push('Interpret Responses must feed only the completion node');
  }
  const expectedConnectionSources = [
    'Manual Trigger',
    'Read Response Log',
    'Read Reconciliation Report',
    'Interpret Responses',
  ];
  const actualConnectionSources = Object.keys(connections).sort();
  if (JSON.stringify(actualConnectionSources) !== JSON.stringify(expectedConnectionSources.slice().sort())) {
    violations.push('connection key set must be exactly the four expected sources');
  }

  const meta = wf.meta || {};
  if (meta.readOnly !== true) violations.push('meta.readOnly must be true');
  if (meta.artifact !== ARTIFACT) violations.push('meta.artifact must be "Response-Interpretation V1"');
  if (JSON.stringify(meta.sheets || []) !== JSON.stringify([RESPONSE_LOG_SHEET])) {
    violations.push('meta.sheets must list only the Response Log tab');
  }
  if (!meta.readErrorsCarriedBy) violations.push('meta.readErrorsCarriedBy must document the trigger carrier');
  else {
    for (const key of TRIGGER_ERROR_KEYS) {
      if (!String(meta.readErrorsCarriedBy).includes(key)) violations.push(`meta.readErrorsCarriedBy must mention ${key}`);
    }
  }
  if (!String(meta.emptyReadBehavior || '').includes('alwaysOutputData')) {
    violations.push('meta.emptyReadBehavior must document alwaysOutputData');
  }
  if (meta.joinKey !== JOIN_KEY) violations.push(`meta.joinKey must be ${JOIN_KEY}`);

  for (const node of nodes) {
    const code = node && node.parameters && node.parameters.jsCode;
    if (typeof code === 'string' && code.length > 0) {
      assertCleanSource(code);
    }
  }

  const raw = JSON.stringify(wf);
  if (/Bearer\s+[A-Z0-9]{10,}/i.test(raw)) violations.push('bearer token material embedded');
  if (/Authorization/.test(raw)) violations.push('Authorization header embedded');
  if (raw.includes('credentials')) violations.push('credential blocks embedded');
  if (/\$\{?env\./i.test(raw)) violations.push('env interpolation embedded');
  if (/process\.env/.test(raw)) violations.push('process.env embedded');

  if (violations.length > 0) {
    throw new Error('workflow contract violation: ' + violations.join('; '));
  }
}

module.exports = {
  WORKFLOW_NAME,
  ARTIFACT,
  RESPONSE_LOG_SHEET,
  JOIN_KEY,
  SPREADSHEET_ID,
  EXPECTED_NODES,
  NODE_TYPES,
  ALWAYS_OUTPUT_DATA,
  TRIGGER_ERROR_KEYS,
  RECONCILIATION_SOURCE,
  BANNED_NODE_TYPES,
  SENSITIVE_KEYS,
  FIXED_NOW,
  FIXED_RUN_ID,
  TOPOLOGY,
  META_REQUIREMENTS,
  stripRuntime,
  projectWorkflowInputs,
  engineBehaviorFor,
  assertEngineEquivalence,
  referenceWorkflow,
  describeWorkflowContract,
  assertCleanSource,
  assertWorkflowContract,
  interpretationIdFor,
};