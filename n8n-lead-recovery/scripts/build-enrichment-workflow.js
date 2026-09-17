'use strict';

/*
 * Lead Recovery Engine — Enrichment V1 workflow builder (Prompt H.6).
 *
 * Renders the Contact Enrichment V1 boundary into the shipped n8n workflow JSON.
 * The two provider nodes (Enrich Contact, Enrich Contact OSS Fallback) inject
 * the embedded mirrors from src/embedded-enrichment-contact.js and
 * src/embedded-enrichment-contact-oss.js byte-for-byte; every other code node's
 * jsCode is authored here (the single source of truth) and exported so the
 * workflow test asserts the shipped artifact matches this builder deterministically.
 *
 * Topology (16 nodes, Phase 6.6):
 *   Manual Trigger
 *     → Read Contact Enrichment Log
 *       → Read Approved Outreach
 *         → Prepare Enrichment Scope
 *           → Enrich Contact
 *             → Prepare OSS Fallback Scope
 *               → Enrich Contact OSS Fallback
 *                 → Consolidate Enrichment Results
 *                   → Has Enrichment Output?
 *                        main[0] → Split Enrichment Log Rows → Write Contact
 *                                   Enrichment Log   (leaf terminal)
 *                                   Split Contact Updates → Update Approved
 *                                   Outreach Contacts → Report Enrichment Run
 *                                   → Enrichment Complete   (terminal)
 *                        main[1] → No-Op End                (terminal)
 *
 * Every $('…') reference in a code node resolves only because the referenced
 * node is a transitive pairedItem ancestor (n8n pairs each item to one parent;
 * a sibling branch would throw pairedItemNoConnectionCodeNode — the exact
 * defect class that stalled Phase 6 and shaped the response-interpretation
 * chain). All referenced nodes above sit on the item's incoming path.
 *
 * Write surface: the workflow APPENDS to the Contact Enrichment Log cache and
 * UPDATES Approved Outreach on match key lead_id with ONLY the two enrichment-
 * owned columns (contact_blocked, contact_source_provider) plus the five
 * contact fields the handoff leaves empty (schema.js ownership contract). It is
 * readOnly:false by design but never writes beyond those two tabs.
 */

const fs = require('node:fs');
const path = require('node:path');

const { embeddedContactSource } = require('../src/embedded-enrichment-contact');
const { embeddedContactOssSource } = require('../src/embedded-enrichment-contact-oss');

const OUTPUT = path.join(__dirname, '..', 'Enrichment V1.json');

const WORKFLOW_NAME = 'Lead Recovery Engine — Enrichment V1';
const ARTIFACT = 'Enrichment V1';

const SPREADSHEET_ID = '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ';
const ENRICHMENT_LOG_SHEET = 'Contact Enrichment Log';
const APPROVED_SHEET = 'Approved Outreach';

/* The columns the update node writes to Approved Outreach (match on lead_id). */
const UPDATED_COLUMNS = [
  'lead_id',
  'email',
  'contact_name',
  'contact_title',
  'email_source',
  'email_verified',
  'contact_source_provider',
  'contact_blocked',
];

/* The 14 Contact Enrichment Log cache columns the append node writes. */
const ENRICHMENT_LOG_COLUMNS = [
  'enrichment_id',
  'enrichment_key',
  'lead_id',
  'provider',
  'query_input',
  'result_email',
  'result_contact_name',
  'result_contact_title',
  'result_verified',
  'credits_consumed',
  'enriched_at',
  'ttl_expires_at',
  'cache_hit_count',
  'notes',
];

/* ---------------------------------------------------------------- */
/* Workflow-local code node sources (single source of truth)          */
/* ---------------------------------------------------------------- */

const PREPARE_ENRICHMENT_SCOPE_CODE = `const items = $input.all();
const approvedItems = $('Read Approved Outreach').all();
const triggerItems = $('Manual Trigger').all();
const trigger = (triggerItems && triggerItems.length && triggerItems[0] && triggerItems[0].json) || {};

const inputRows = (items || []).map((item) => (item && item.json) || {}).filter((r) => r && typeof r === 'object');
const approvedRows = (approvedItems || []).map((item) => (item && item.json) || {}).filter((r) => r && typeof r === 'object');
const leads = inputRows.length > 0 ? inputRows : approvedRows;

if (leads.length === 0) {
  return [];
}

const seams = {
  now: trigger.now || trigger.run_timestamp || '',
  runId: trigger.runId || trigger.run_id || '',
  run_timestamp: trigger.run_timestamp || '',
  run_id: trigger.run_id || '',
  provider: trigger.provider || 'agentdata',
  agentdataResults: trigger.agentdataResults || {},
  agentdataFailures: trigger.agentdataFailures || {},
  hunterResults: trigger.hunterResults || {},
  hunterFailures: trigger.hunterFailures || {},
};

return leads.map((row, index) =>
  index === 0 ? { json: Object.assign({}, row, seams) } : { json: Object.assign({}, row) },
);
`;

const PREPARE_OSS_FALLBACK_SCOPE_CODE = `const items = $input.all();
const contactItems = $('Enrich Contact').all();
const approvedItems = $('Read Approved Outreach').all();
const triggerItems = $('Manual Trigger').all();
const trigger = (triggerItems && triggerItems.length && triggerItems[0] && triggerItems[0].json) || {};

const envelope = (contactItems && contactItems[0] && contactItems[0].json) || {};

if (envelope.fatal || !envelope.stats || envelope.stats.total === 0) {
  return [];
}

const approvedRows = (approvedItems || []).map((item) => (item && item.json) || {}).filter((r) => r && typeof r === 'object');

const enrichedIds = new Set();
for (const row of envelope.enriched || []) {
  const id = String(row.lead_id || '').trim();
  if (id && String(row.email || '').trim() !== '') enrichedIds.add(id);
}

const US_COUNTRIES = ['USA', 'US', 'UNITED STATES', 'UNITED STATES OF AMERICA'];

const ossLeads = [];
const seen = new Set();
for (const lead of approvedRows) {
  const id = String(lead.lead_id || '').trim();
  if (!id || seen.has(id)) continue;
  seen.add(id);
  if (String(lead.email || '').trim() !== '') continue;
  if (String(lead.website || '').trim() === '') continue;
  if (!US_COUNTRIES.includes(String(lead.country || '').trim().toUpperCase())) continue;
  if (enrichedIds.has(id)) continue;
  ossLeads.push(lead);
}

if (ossLeads.length === 0) {
  return [];
}

const seams = {
  now: trigger.now || trigger.run_timestamp || '',
  runId: trigger.runId || trigger.run_id || '',
  run_timestamp: trigger.run_timestamp || '',
  run_id: trigger.run_id || '',
  ossResults: trigger.ossResults || {},
};

return ossLeads.map((row, index) =>
  index === 0 ? { json: Object.assign({}, row, seams) } : { json: Object.assign({}, row) },
);
`;

const CONSOLIDATE_ENRICHMENT_RESULTS_CODE = `const contactItems = $('Enrich Contact').all();
const ossItems = $('Enrich Contact OSS Fallback').all();
const triggerItems = $('Manual Trigger').all();
const trigger = (triggerItems && triggerItems.length && triggerItems[0] && triggerItems[0].json) || {};

const contactEnvelope = (contactItems && contactItems[0] && contactItems[0].json) || {};
const ossEnvelope = (ossItems && ossItems[0] && ossItems[0].json) || {};

const UPDATED_FIELDS = [
  'email',
  'contact_name',
  'contact_title',
  'email_source',
  'email_verified',
  'contact_source_provider',
  'contact_blocked',
];

function hasContent(row) {
  for (const field of UPDATED_FIELDS) {
    if (String(row[field] || '').trim() !== '') return true;
  }
  return false;
}

function contentScore(update) {
  let n = 0;
  for (const field of UPDATED_FIELDS) {
    if (String(update[field] || '').trim() !== '') n += 1;
  }
  return n;
}

const contactUpdates = [];
const indexById = new Map();
for (const row of (contactEnvelope.enriched || []).concat(ossEnvelope.enriched || [])) {
  const id = String(row.lead_id || '').trim();
  if (!id) continue;
  const update = { lead_id: id };
  for (const field of UPDATED_FIELDS) {
    update[field] = row[field] === undefined || row[field] === null ? '' : String(row[field]);
  }
  if (!hasContent(update)) continue;
  const index = indexById.get(id);
  if (index === undefined) {
    indexById.set(id, contactUpdates.length);
    contactUpdates.push(update);
  } else if (contentScore(update) > contentScore(contactUpdates[index])) {
    contactUpdates[index] = update;
  }
}
contactUpdates.sort((a, b) => String(a.lead_id).localeCompare(String(b.lead_id)));

const logByKey = new Map();
for (const row of (contactEnvelope.log || []).concat(ossEnvelope.log || [])) {
  const key = String(row.enrichment_key || '').trim();
  if (!key || logByKey.has(key)) continue;
  logByKey.set(key, row);
}
const logRows = Array.from(logByKey.values()).sort((a, b) => {
  const byKey = String(a.enrichment_key || '').localeCompare(String(b.enrichment_key || ''));
  if (byKey !== 0) return byKey;
  const byAt = String(a.enriched_at || '').localeCompare(String(b.enriched_at || ''));
  if (byAt !== 0) return byAt;
  return String(a.lead_id || '').localeCompare(String(b.lead_id || ''));
});

function engineStats(envelope) {
  const s = (envelope && envelope.stats) || {};
  return {
    total: Number.isFinite(Number(s.total)) ? Number(s.total) : 0,
    enriched: Number.isFinite(Number(s.enriched)) ? Number(s.enriched) : 0,
    skipped: Number.isFinite(Number(s.skipped)) ? Number(s.skipped) : 0,
    failed: Number.isFinite(Number(s.failed)) ? Number(s.failed) : 0,
    credits_consumed: Number.isFinite(Number(s.credits_consumed)) ? Number(s.credits_consumed) : 0,
    cache_hits: Number.isFinite(Number(s.cache_hits)) ? Number(s.cache_hits) : 0,
  };
}

const result = {
  run_id: trigger.runId || trigger.run_id || '',
  run_timestamp: trigger.now || trigger.run_timestamp || '',
  contact_provider: contactEnvelope.provider || 'agentdata',
  contactUpdates,
  logRows,
  stats: {
    contact: engineStats(contactEnvelope),
    oss: engineStats(ossEnvelope),
  },
  _hasOutput: contactUpdates.length > 0 || logRows.length > 0,
};
if (contactEnvelope.fatal) result.fatal = contactEnvelope.fatal;

return [{ json: result }];
`;

const SPLIT_ENRICHMENT_LOG_ROWS_CODE = `const items = $input.all();
const consolidated = (items && items[0] && items[0].json) || {};
const logItems = $('Read Contact Enrichment Log').all();

const existingKeys = new Set();
for (const item of logItems || []) {
  const key = String((item && item.json && item.json.enrichment_key) || '').trim();
  if (key) existingKeys.add(key);
}

const logRows = (consolidated.logRows || []).filter((row) => {
  const key = String(row.enrichment_key || '').trim();
  return key !== '' && !existingKeys.has(key);
});

if (logRows.length === 0) {
  return [];
}

return logRows.map((row) => ({ json: row }));
`;

const SPLIT_CONTACT_UPDATES_CODE = `const items = $input.all();
const consolidated = (items && items[0] && items[0].json) || {};

const UPDATED_COLUMNS = [
  'lead_id',
  'email',
  'contact_name',
  'contact_title',
  'email_source',
  'email_verified',
  'contact_source_provider',
  'contact_blocked',
];

const updates = (consolidated.contactUpdates || []).filter((row) => row && typeof row === 'object');

if (updates.length === 0) {
  return [];
}

return updates.map((row) => {
  const json = {};
  for (const col of UPDATED_COLUMNS) {
    json[col] = row[col] === undefined || row[col] === null ? '' : String(row[col]);
  }
  return { json };
});
`;

const REPORT_ENRICHMENT_RUN_CODE = `const consolidatedItems = $('Consolidate Enrichment Results').all();
const consolidated = (consolidatedItems && consolidatedItems[0] && consolidatedItems[0].json) || {};
const stats = consolidated.stats || {};
const contactProvider = String(consolidated.contact_provider || 'agentdata');

function providerMetrics(engineStats) {
  return {
    total: (engineStats && engineStats.total) || 0,
    enriched: (engineStats && engineStats.enriched) || 0,
    skipped: (engineStats && engineStats.skipped) || 0,
    failed: (engineStats && engineStats.failed) || 0,
    credits_consumed: (engineStats && engineStats.credits_consumed) || 0,
    cache_hits: (engineStats && engineStats.cache_hits) || 0,
  };
}

const report = {
  run_id: consolidated.run_id || '',
  run_timestamp: consolidated.run_timestamp || '',
  provider_runs: {
    [contactProvider]: providerMetrics(stats.contact),
    oss: providerMetrics(stats.oss),
  },
  approved_updates: (consolidated.contactUpdates || []).length,
  enrichment_log_rows: (consolidated.logRows || []).length,
  _hasOutput: true,
};
if (consolidated.fatal) report.fatal = consolidated.fatal;

return [{ json: report }];
`;

const CODE_SOURCES = {
  'Prepare Enrichment Scope': PREPARE_ENRICHMENT_SCOPE_CODE,
  'Enrich Contact': embeddedContactSource,
  'Prepare OSS Fallback Scope': PREPARE_OSS_FALLBACK_SCOPE_CODE,
  'Enrich Contact OSS Fallback': embeddedContactOssSource,
  'Consolidate Enrichment Results': CONSOLIDATE_ENRICHMENT_RESULTS_CODE,
  'Split Enrichment Log Rows': SPLIT_ENRICHMENT_LOG_ROWS_CODE,
  'Split Contact Updates': SPLIT_CONTACT_UPDATES_CODE,
  'Report Enrichment Run': REPORT_ENRICHMENT_RUN_CODE,
};

const ALWAYS_OUTPUT_DATA = [
  'Prepare Enrichment Scope',
  'Enrich Contact',
  'Prepare OSS Fallback Scope',
  'Enrich Contact OSS Fallback',
  'Consolidate Enrichment Results',
  'Report Enrichment Run',
];

/* ---------------------------------------------------------------- */
/* Node factory                                                       */
/* ---------------------------------------------------------------- */

function spreadsheetRef() {
  return {
    __rl: true,
    value: SPREADSHEET_ID,
    mode: 'list',
    cachedResultName: 'Lead Recovery Engine Prospecting System',
    cachedResultUrl: '',
  };
}

function sheetRef(sheet) {
  return { mode: 'name', value: sheet };
}

function expressionTable(columns) {
  const value = {};
  for (const column of columns) value[column] = `={{ $json.${column} }}`;
  return value;
}

function schemaFor(columns) {
  return columns.map((column) => ({
    id: column,
    displayName: column,
    required: false,
    defaultMatch: false,
    display: true,
    type: 'string',
    canBeUsedToMatch: true,
  }));
}

function nodes() {
  return [
    {
      parameters: { event: 'workflow' },
      id: 'enrich-manual-trigger-0001',
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      typeVersion: 1,
      position: [0, 0],
    },
    {
      parameters: {
        documentId: spreadsheetRef(),
        operation: 'read',
        sheetName: sheetRef(ENRICHMENT_LOG_SHEET),
        filtersUI: { values: [] },
        options: { returnAllMatches: true },
      },
      id: 'enrich-read-log-0001',
      name: 'Read Contact Enrichment Log',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [260, 0],
    },
    {
      parameters: {
        documentId: spreadsheetRef(),
        operation: 'read',
        sheetName: sheetRef(APPROVED_SHEET),
        filtersUI: { values: [] },
        options: { returnAllMatches: true },
      },
      id: 'enrich-read-approved-0001',
      name: 'Read Approved Outreach',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [520, 0],
    },
    {
      parameters: { jsCode: PREPARE_ENRICHMENT_SCOPE_CODE },
      id: 'enrich-prepare-scope-0001',
      name: 'Prepare Enrichment Scope',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      alwaysOutputData: true,
      position: [780, 0],
    },
    {
      parameters: { jsCode: embeddedContactSource },
      id: 'enrich-contact-0001',
      name: 'Enrich Contact',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      alwaysOutputData: true,
      position: [1040, 0],
    },
    {
      parameters: { jsCode: PREPARE_OSS_FALLBACK_SCOPE_CODE },
      id: 'enrich-prepare-oss-0001',
      name: 'Prepare OSS Fallback Scope',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      alwaysOutputData: true,
      position: [1300, 0],
    },
    {
      parameters: { jsCode: embeddedContactOssSource },
      id: 'enrich-contact-oss-0001',
      name: 'Enrich Contact OSS Fallback',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      alwaysOutputData: true,
      position: [1560, 0],
    },
    {
      parameters: { jsCode: CONSOLIDATE_ENRICHMENT_RESULTS_CODE },
      id: 'enrich-consolidate-0001',
      name: 'Consolidate Enrichment Results',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      alwaysOutputData: true,
      position: [1820, 0],
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 1 },
          conditions: [
            {
              id: 'cond-enrichment-output',
              leftValue: '={{ $json._hasOutput }}',
              rightValue: true,
              operator: { type: 'boolean', operation: 'true', singleValue: true },
            },
          ],
          combinator: 'and',
        },
        options: {},
      },
      id: 'enrich-has-output-0001',
      name: 'Has Enrichment Output?',
      type: 'n8n-nodes-base.if',
      typeVersion: 2,
      position: [2080, 0],
    },
    {
      parameters: { jsCode: SPLIT_ENRICHMENT_LOG_ROWS_CODE },
      id: 'enrich-split-log-0001',
      name: 'Split Enrichment Log Rows',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2340, -160],
    },
    {
      parameters: {
        documentId: spreadsheetRef(),
        operation: 'append',
        sheetName: sheetRef(ENRICHMENT_LOG_SHEET),
        columns: {
          mappingMode: 'defineBelow',
          value: expressionTable(ENRICHMENT_LOG_COLUMNS),
        },
      },
      id: 'enrich-write-log-0001',
      name: 'Write Contact Enrichment Log',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [2600, -160],
    },
    {
      parameters: { jsCode: SPLIT_CONTACT_UPDATES_CODE },
      id: 'enrich-split-updates-0001',
      name: 'Split Contact Updates',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2340, 160],
    },
    {
      parameters: {
        documentId: spreadsheetRef(),
        operation: 'update',
        sheetName: sheetRef(APPROVED_SHEET),
        columns: {
          mappingMode: 'defineBelow',
          value: expressionTable(UPDATED_COLUMNS.filter((column) => column !== 'lead_id')),
          matchingColumns: ['lead_id'],
          schema: schemaFor(UPDATED_COLUMNS),
        },
        options: { cellFormat: 'USER_ENTERED' },
      },
      id: 'enrich-update-approved-0001',
      name: 'Update Approved Outreach Contacts',
      type: 'n8n-nodes-base.googleSheets',
      typeVersion: 4,
      position: [2600, 160],
    },
    {
      parameters: { jsCode: REPORT_ENRICHMENT_RUN_CODE },
      id: 'enrich-report-0001',
      name: 'Report Enrichment Run',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      alwaysOutputData: true,
      position: [2860, 160],
    },
    {
      parameters: {},
      id: 'enrich-complete-0001',
      name: 'Enrichment Complete',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [3120, 160],
    },
    {
      parameters: {},
      id: 'enrich-noop-0001',
      name: 'No-Op End',
      type: 'n8n-nodes-base.noOp',
      typeVersion: 1,
      position: [2340, 320],
    },
  ];
}

function connections() {
  const edge = (node, index) => ({ node, type: 'main', index });
  return {
    'Manual Trigger': { main: [[edge('Read Contact Enrichment Log', 0)]] },
    'Read Contact Enrichment Log': { main: [[edge('Read Approved Outreach', 0)]] },
    'Read Approved Outreach': { main: [[edge('Prepare Enrichment Scope', 0)]] },
    'Prepare Enrichment Scope': { main: [[edge('Enrich Contact', 0)]] },
    'Enrich Contact': { main: [[edge('Prepare OSS Fallback Scope', 0)]] },
    'Prepare OSS Fallback Scope': { main: [[edge('Enrich Contact OSS Fallback', 0)]] },
    'Enrich Contact OSS Fallback': { main: [[edge('Consolidate Enrichment Results', 0)]] },
    'Consolidate Enrichment Results': { main: [[edge('Has Enrichment Output?', 0)]] },
    'Has Enrichment Output?': {
      main: [
        [edge('Split Enrichment Log Rows', 0), edge('Split Contact Updates', 0)],
        [edge('No-Op End', 0)],
      ],
    },
    'Split Enrichment Log Rows': { main: [[edge('Write Contact Enrichment Log', 0)]] },
    'Split Contact Updates': { main: [[edge('Update Approved Outreach Contacts', 0)]] },
    'Update Approved Outreach Contacts': { main: [[edge('Report Enrichment Run', 0)]] },
    'Report Enrichment Run': { main: [[edge('Enrichment Complete', 0)]] },
  };
}

function enrichmentWorkflow() {
  return {
    name: WORKFLOW_NAME,
    active: false,
    nodes: nodes(),
    connections: connections(),
    meta: {
      artifact: ARTIFACT,
      spreadsheetId: SPREADSHEET_ID,
      readOnly: false,
      sheets: [ENRICHMENT_LOG_SHEET, APPROVED_SHEET],
      contactLog: `${ENRICHMENT_LOG_SHEET} tab (sheet-backed cache; reads + appends only; dedupe by enrichment_key)`,
      approvedWriteSurface:
        `update on ${APPROVED_SHEET} matching lead_id writing only the two enrichment-owned columns ` +
        '(contact_blocked, contact_source_provider) plus the five handoff-empty contact fields (schema.js ownership contract)',
      emptyRunBehavior:
        'Prepare nodes emit [] when the scope is empty; with alwaysOutputData a run with nothing to do reaches ' +
        'Consolidate with zero items and routes to No-Op End (no writes, no report)',
      fatalBehavior:
        'a fatal provider failure (AgentData/Hunter auth, missing provider) halts the contact engine, ' +
        'Prepare OSS Fallback Scope emits [], and the fatal-only run ' +
        'routes to No-Op End (Consolidate._hasOutput false)',
      generatedBy: 'scripts/build-enrichment-workflow.js',
    },
  };
}

function main() {
  const workflow = enrichmentWorkflow();
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, `${JSON.stringify(workflow, null, 2)}\n`);
  const codeNodes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
  const writes = workflow.nodes.filter((n) => n.type === 'n8n-nodes-base.googleSheets' && n.parameters.operation !== 'read').length;
  console.log(`Enrichment workflow written to ${OUTPUT}`);
  console.log(`Nodes: ${workflow.nodes.length} | code nodes: ${codeNodes.length} | sheet writes: ${writes}`);
}

if (require.main === module) {
  main();
}

module.exports = {
  enrichmentWorkflow,
  OUTPUT,
  WORKFLOW_NAME,
  ARTIFACT,
  SPREADSHEET_ID,
  ENRICHMENT_LOG_SHEET,
  APPROVED_SHEET,
  UPDATED_COLUMNS,
  ENRICHMENT_LOG_COLUMNS,
  ALWAYS_OUTPUT_DATA,
  CODE_SOURCES,
  PREPARE_ENRICHMENT_SCOPE_CODE,
  PREPARE_OSS_FALLBACK_SCOPE_CODE,
  CONSOLIDATE_ENRICHMENT_RESULTS_CODE,
  SPLIT_ENRICHMENT_LOG_ROWS_CODE,
  SPLIT_CONTACT_UPDATES_CODE,
  REPORT_ENRICHMENT_RUN_CODE,
};