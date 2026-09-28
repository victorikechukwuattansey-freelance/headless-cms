/**
 * The production contract, loaded from the live workflow JSON.
 *
 * This module is the ONLY place that reads the 7 workflow files. Nothing in the
 * measurement layer may hard-code a rule that the engine implements in a Code
 * node; it must be read from here, or asserted to match here by a test.
 *
 * Nothing here mutates anything. Reading the engine's definition is not a change
 * to the engine.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Root of the 7-workflow production engine (System A). */
export const ENGINE_ROOT = path.resolve(HERE, '..', '..');

/**
 * Canonical workflow order. Filenames are the on-disk names, not the historical
 * names in validate-workflows.ps1 / README / IMPLEMENTATION_REPORT (all stale).
 */
export const WORKFLOW_FILES = [
  { id: '01', key: 'lead-intake', file: '01 - Lead Intake.json', name: 'Lead Intake', trigger: 'webhook', path: '/lead-intake' },
  { id: '02', key: 'booking-status', file: '02 - Booking Status.json', name: 'Booking Status', trigger: 'webhook', path: '/booking-status' },
  { id: '03', key: 'manual-callback', file: '03 - Manual Callback Log.json', name: 'Manual Callback Log', trigger: 'webhook', path: '/manual-callback' },
  { id: '04', key: 'status-update', file: '04 - Status Update.json', name: 'Manual Status Update', trigger: 'webhook', path: '/status-update' },
  { id: '05', key: 'followup-sweeper', file: '05 - Follow-up Sweeper.json', name: 'Follow-up Sweeper', trigger: 'scheduleTrigger', path: null },
  { id: '06', key: 'error-handler', file: '06 - Error Handler.json', name: 'Error Handler', trigger: 'errorTrigger', path: null },
  { id: '07', key: 'customer-response', file: '07 - Customer Response.json', name: 'Customer Response', trigger: 'webhook', path: '/customer-response-07' }
];

const cache = new Map();

export function loadWorkflow(file) {
  if (cache.has(file)) return cache.get(file);
  const full = path.join(ENGINE_ROOT, file);
  const raw = fs.readFileSync(full, 'utf8');
  const wf = JSON.parse(raw);
  wf.__file = file;
  wf.__raw = raw;
  cache.set(file, wf);
  return wf;
}

export function loadAll() {
  return WORKFLOW_FILES.map((w) => {
    const wf = loadWorkflow(w.file);
    return { ...w, wf };
  });
}

export function nodeByName(wf, name) {
  return wf.nodes.find((n) => n.name === name) || null;
}

export function codeNodes(wf) {
  return wf.nodes.filter((n) => n.type === 'n8n-nodes-base.code');
}

export function codeSource(wf, nodeName) {
  const n = nodeByName(wf, nodeName);
  if (!n) throw new Error(`Code node not found: ${nodeName} in ${wf.__file}`);
  if (n.type !== 'n8n-nodes-base.code') throw new Error(`Not a code node: ${nodeName}`);
  return n.parameters.jsCode;
}

/** The n8n workflow id that workflows 01-05 and 07 route errors to. */
export function errorWorkflowId() {
  const wf = loadWorkflow('06 - Error Handler.json');
  return wf.id;
}

/* ------------------------------------------------------------------ *
 * Rules extracted from the engine source, not from documentation.
 * Each is proven against the live Code-node text by
 * tests/workflow-contract.test.js.
 * ------------------------------------------------------------------ */

const WF01 = '01 - Lead Intake.json';
const WF02 = '02 - Booking Status.json';
const WF03 = '03 - Manual Callback Log.json';
const WF04 = '04 - Status Update.json';
const WF05 = '05 - Follow-up Sweeper.json';
const WF07 = '07 - Customer Response.json';

export function lifecycleRules() {
  // WF04 "Resolve Lead, Config & Validate Status" owns the canonical whitelist.
  const wf04 = loadWorkflow(WF04);
  const src = codeSource(wf04, 'Resolve Lead, Config & Validate Status');
  const allowed = (src.match(/const ALLOWED = \[([^\]]+)\]/) || [])[1] || '';
  const statuses = allowed
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);

  const terminalMatch = src.match(/_terminal: \[([^\]]+)\]/);
  const terminal = (terminalMatch ? terminalMatch[1] : '')
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);

  // WF05 "Select Follow-up Candidates" is the sole follow-up eligibility filter.
  const wf05 = loadWorkflow(WF05);
  const sel = codeSource(wf05, 'Select Follow-up Candidates');
  const excludedStatuses = (sel.match(/\[([^\]]+)\]\.indexOf\(status\) !== -1\) continue;/) || [])[1] || '';
  const sweeperExcluded = excludedStatuses
    .split(',')
    .map((s) => s.trim().replace(/^'|'$/g, ''))
    .filter(Boolean);

  // WF05 "Advance Follow-up State" is the only writer of no_response.
  const adv = codeSource(wf05, 'Advance Follow-up State');
  const noResponseBySweeper = /status: reachedMax\s*\?\s*'([a-z_]+)'/.test(adv);

  return {
    statuses,
    terminal,
    sweeperExcludedStatuses: sweeperExcluded,
    noResponseAssignedBySweeper: noResponseBySweeper,
    initialStatus: 'new'
  };
}

/** Which tabs each workflow writes. Read from the googleSheets nodes. */
export function writeMatrix() {
  const rows = [];
  for (const w of loadAll()) {
    for (const n of w.wf.nodes) {
      if (n.type !== 'n8n-nodes-base.googleSheets') continue;
      const op = (n.parameters.operation || 'read').toString();
      if (op === 'read') continue;
      const sheetName = readSheetName(n);
      rows.push({
        workflowId: w.id,
        workflowName: n.wf?.name || w.name,
        node: n.name,
        operation: op,
        tab: sheetName,
        nodeTypeVersion: n.typeVersion
      });
    }
  }
  return rows;
}

/** Resolve a googleSheets node's sheetName resource locator to a tab name. */
export function readSheetName(node) {
  const s = node.parameters.sheetName;
  if (!s) return '(unknown)';
  if (typeof s === 'string') return s;
  if (s.mode === 'name') return s.value;
  if (s.cachedResultName) return s.cachedResultName;
  // No cached name was saved. `value` is then either a numeric sheet gid or a
  // literal tab name typed into the locator, e.g. { value: "errors" }.
  return /^\d+$/.test(String(s.value)) ? `gid:${s.value}` : String(s.value);
}

/** Column sets each append/update node writes, read from the node parameters. */
export function columnWrites() {
  const out = [];
  for (const w of loadAll()) {
    for (const n of w.wf.nodes) {
      if (n.type !== 'n8n-nodes-base.googleSheets') continue;
      const op = (n.parameters.operation || 'read').toString();
      if (op === 'read') continue;
      const p = n.parameters;
      let cols = [];
      let matchOn = null;
      if (p.fieldsUi && Array.isArray(p.fieldsUi.values)) {
        cols = p.fieldsUi.values.map((v) => v.column);
      } else if (p.fieldsUi && Array.isArray(p.fieldsUi.fieldValues)) {
        cols = p.fieldsUi.fieldValues.map((v) => v.fieldId);
      } else if (p.columns && p.columns.value) {
        cols = Object.keys(p.columns.value);
      }
      if (p.columnToMatchOn) matchOn = p.columnToMatchOn;
      out.push({
        workflowId: w.id,
        node: n.name,
        operation: op,
        tab: readSheetName(n),
        columns: cols,
        matchOn
      });
    }
  }
  return out;
}

/** Response codes each workflow can emit. Read from respondToWebhook nodes. */
export function responseContract() {
  const out = [];
  for (const w of loadAll()) {
    for (const n of w.wf.nodes) {
      if (n.type !== 'n8n-nodes-base.respondToWebhook') continue;
      let code = 200;
      if (n.parameters.options && n.parameters.options.responseCode) {
        code = n.parameters.options.responseCode;
      }
      out.push({ workflowId: w.id, node: n.name, code, body: n.parameters.responseBody });
    }
  }
  return out;
}

export { WF01, WF02, WF03, WF04, WF05, WF07 };
