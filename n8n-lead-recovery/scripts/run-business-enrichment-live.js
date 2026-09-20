'use strict';

/*
 * Business Enrichment V1 — engine-direct LIVE runner (Prompt H.9).
 *
 * Runs the SHIPPED business-enrichment engine (src/enrichment-business.js)
 * directly against the production spreadsheet's Verified Leads tab — no n8n
 * workflow, no fixtures. Business identity comes from a local Overture Places
 * parquet index built from fixtures/overture-austin.parquet (or any path via
 * --overture / OVERTURE_PARQUET_PATH).
 *
 * Engine interface audit (H.9 §1):
 *   enrichBusinessLeads({ leads = [], index = [], now, runId = '' })
 *     leads[]   Raw Leads rows (lead_id, business_name, city, state, country,
 *               website, phone + whatever columns the sheet has)
 *     index[]   Overture places as a LIST (not a Map): gers_id, primary_name,
 *               website, phone, city, state_code, country, operating_status,
 *               confidence
 *     returns   { enriched, unmatched, stats }
 *   The engine owns matching: phone > website > name+city+state (normalized
 *   exact / Levenshtein<=2), fill-empty-only enrichment (never clobbers), and
 *   stamps enrichment_business_status / _confidence / _gers_id / _last_run on
 *   EVERY processed lead (matched + unmatched). `now` is injected; runId is
 *   accepted for parity. Deterministic output regardless of map iteration
 *   order — the runner therefore builds a LIST and sorts it by gers_id
 *   ascending so identical inputs produce identical results.
 *
 * Pipeline (mirrors the shipped Enrichment V1 business-half intent):
 *   1. PREFLIGHT  — env/config validation + Verified Leads header contract
 *                   (28 columns A1:AB1 checked positionally; Y1=...Z1=..AA1=...
 *                   AB1=... must match; Q1..U1 are formula-owned and NEVER in
 *                   the write target) + Overture parquet readable probe. Fails
 *                   with the exact mismatch — the operator fixes the sheet,
 *                   never the code.
 *   2. READ       — Verified Leads grid (A–AB).
 *   3. FILTER     — eligible = enrichment_business_status (Y) empty AND at
 *                   least one match key (phone | website | name+city+state).
 *                   Exclusions: already_enriched | no_match_key |
 *                   out_of_scope (outside --lead-ids). --limit slices the
 *                   deterministic lead_id-ordered scope.
 *   4. BUILD INDEX — local parquet → engine index[] (one pass; id→gers_id,
 *                    names.primary→primary_name, websites[0]→website,
 *                    phones[0]→phone, addresses[1].locality→city,
 *                    addresses[1].region→state_code,
 *                    addresses[1].country→country, operating_status,
 *                    confidence; BigInt→Number; sorted by gers_id ascending).
 *   5. ENRICH     — enrichBusinessLeads({ leads: scope, index, now }).
 *   6. WRITE      — EXECUTE only. Single bounded range update of
 *                   'Verified Leads'!Y2:AB<last_row>. Rows in scope that
 *                   MATCHED get Y/Z/AA/AB; unmatched and non-scope rows are
 *                   LEFT AS-IS (preserved) — never A–X, never Q–U, nothing
 *                   cleared. Write scope is chosen with --scope=<test|prod>:
 *                   the default "test" is namespace-guarded (a matched lead is
 *                   only WRITTEN when its lead_id is TEST-ENRICH-LIVE-<tag>-...);
 *                   "production" (H.9.1) writes every matching lead but ONLY
 *                   when BIZ_ENRICH_ALLOW_PRODUCTION=1 is also present — two
 *                   independent acknowledgments. Everything not written is
 *                   reported as would-write and left untouched.
 *   7. REPORT     — reports/BIZ-ENRICH-LIVE-<run_id>.json, fully redacted (no
 *                   keys/tokens/PII beyond lead_id + match metadata).
 *
 * Default mode is DRY_RUN: read-only, nothing written without --execute.
 * Determinism: `now` is resolved once and injected; the engine never touches
 * process.env or wall-clock time. Offline tests inject deps (client,
 * readParquet, transport, now) so no test ever performs network or DuckDB I/O.
 *
 * Exit codes: 0 PASS, 1 FAIL, 3 NOT_CONFIGURED.
 */

const fs = require('node:fs');
const path = require('node:path');

const { VERIFIED_COLUMNS, VERIFIED_COLUMN_INDEX, rowToObject, normalize } = require('../src/schema');
const { enrichBusinessLeads, normalizePhone, normalizeDomain, normalizeName, normalizeState, levenshtein } = require('../src/enrichment-business');
const { GoogleSheetsClient, mintJwt, quotedRange, normalizeSpreadsheetId } = require('../src/google-sheets-client');

const VERIFIED_TAB = 'Verified Leads';

const DEFAULT_LIMIT = 5;
const DEFAULT_REPORTS_DIR = path.join(__dirname, '..', 'reports');
const DEFAULT_OVERTURE_PARQUET = path.join(__dirname, '..', 'fixtures', 'overture-austin.parquet');

const TEST_NAMESPACE_PREFIX = 'TEST-ENRICH-LIVE';
const TEST_NAMESPACE_REGEX = /^TEST-ENRICH-LIVE-[0-9a-f]{8,32}$/i;
const NAMESPACED_LEAD_REGEX = /^TEST-ENRICH-LIVE-[0-9a-f]{8,32}-/i;

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const EXCLUSION_REASONS = Object.freeze({
  ALREADY_ENRICHED: 'already_enriched',
  NO_MATCH_KEY: 'no_match_key',
  OUT_OF_SCOPE: 'out_of_scope',
});

/* Enrichment write surface on Verified Leads (24..27 = Y..AB). */
const BUSINESS_STATUS_COL = VERIFIED_COLUMN_INDEX.enrichment_business_status; // 24 (Y)
const CONFIDENCE_COL = VERIFIED_COLUMN_INDEX.enrichment_confidence;           // 25 (Z)
const GERS_ID_COL = VERIFIED_COLUMN_INDEX.enrichment_gers_id;                 // 26 (AA)
const LAST_RUN_COL = VERIFIED_COLUMN_INDEX.enrichment_last_run;               // 27 (AB)
const WRITE_COLS = [BUSINESS_STATUS_COL, CONFIDENCE_COL, GERS_ID_COL, LAST_RUN_COL];

const SENSITIVE_KEY_RE =
  /(access_?token|refresh_?token|api[_-]?key|secret|password|credential|authorization|private[_-]?key|result_email|contact_name|contact_title|notes|tel|email|phone|website|business_name)/i;
const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_-]{10,}/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{20,}/,
  /ya29\.[A-Za-z0-9_-]+/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /Bearer\s+[A-Za-z0-9._~+/=-]{6,}/i,
  /eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/,
];

function defaultRunToken(clock) {
  return String((clock || Date.now)().toString(16)).slice(0, 12);
}

function namespaceForArgs(args) {
  const explicit = String((args && args.namespace) || '').trim();
  if (explicit) return explicit;
  return `${TEST_NAMESPACE_PREFIX}-${defaultRunToken()}`;
}

const VALID_SCOPES = new Set(['test', 'production']);

function scopeForArgs(args) {
  const requested = String((args && args.scope) || '').trim() || 'test';
  if (!VALID_SCOPES.has(requested)) {
    throw new Error(`unknown --scope value "${requested}"; expected "test" or "production"`);
  }
  return requested;
}

function isNamespacedLead(leadId) {
  return NAMESPACED_LEAD_REGEX.test(String(leadId).trim());
}

function firstOf(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item !== undefined && item !== null && String(item).trim() !== '') return item;
    }
    return '';
  }
  return value === undefined || value === null ? '' : value;
}

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function addrAt(row, field) {
  const addresses = row && row.addresses;
  if (!Array.isArray(addresses) || addresses.length === 0) return '';
  const entry = addresses[1] || addresses[0] || {};
  return entry[field] === undefined || entry[field] === null ? '' : String(entry[field]);
}

function toIndexRow(row) {
  return {
    gers_id: String(row && row.id !== undefined && row.id !== null ? row.id : ''),
    primary_name: String(row && row.names && row.names.primary ? row.names.primary : ''),
    website: String(firstOf(row && row.websites) || ''),
    phone: String(firstOf(row && row.phones) || ''),
    city: addrAt(row, 'locality'),
    state_code: addrAt(row, 'region'),
    country: addrAt(row, 'country'),
    operating_status: String(row && row.operating_status ? row.operating_status : ''),
    confidence: toNumber(row && row.confidence),
  };
}

/* ------------------------------------------------------------------ */
/* Overture parquet read (DuckDB).                                     */
/* ------------------------------------------------------------------ */

async function loadDuckdb() {
  let duckdb;
  try {
    duckdb = require('@duckdb/node-api');
  } catch (err) {
    throw new Error('@duckdb/node-api is not installed; run `npm install @duckdb/node-api` first');
  }
  return duckdb;
}

async function duckdbReadRows(parquetPath, options = {}) {
  const duckdb = await loadDuckdb();
  const instance = await duckdb.DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  try {
    const select = [
      'id',
      'names.primary AS primary_name',
      'confidence',
      'phones',
      'websites',
      'addresses[1].region AS region',
      'addresses[1].locality AS locality',
      'addresses[1].country AS country',
      'operating_status',
    ];
    const limitClause = options.limit ? ` LIMIT ${Number(options.limit)}` : '';
    const sql = `SELECT ${select.join(', ')} FROM read_parquet('${String(parquetPath).replace(/'/g, "''")}')${limitClause}`;
    const reader = await connection.runAndReadAll(sql);
    return reader.getRowObjects();
  } finally {
    connection.closeSync();
  }
}

async function readParquetRows(parquetPath, deps = {}) {
  if (typeof deps.readParquet === 'function') {
    const rows = await deps.readParquet(parquetPath);
    return Array.isArray(rows) ? rows : [];
  }
  return duckdbReadRows(parquetPath);
}

async function probeParquet(parquetPath, deps = {}) {
  if (typeof deps.readParquet === 'function') {
    const rows = await deps.readParquet(parquetPath);
    return Array.isArray(rows) && rows.length > 0;
  }
  const rows = await duckdbReadRows(parquetPath, { limit: 1 });
  return Array.isArray(rows) && rows.length > 0;
}

async function buildIndex({ parquetPath, deps = {} }) {
  const rows = await readParquetRows(parquetPath, deps);
  const index = rows.map(toIndexRow);
  index.sort((a, b) => String(a.gers_id).localeCompare(String(b.gers_id)));
  return { index, count: rows.length };
}

const INDEX_SCHEMA_FIELDS = {
  gers_id: 'row.id',
  primary_name: 'row.names.primary',
  website: 'row.websites[0]',
  phone: 'row.phones[0]',
  city: 'row.addresses[1].locality',
  state_code: 'row.addresses[1].region',
  country: 'row.addresses[1].country',
  operating_status: 'row.operating_status',
  confidence: 'row.confidence → Number',
};

/* ------------------------------------------------------------------ */
/* Config (env-only, never code)                                       */
/* ------------------------------------------------------------------ */

function readConfig(env) {
  const googlesheetId = String(env.GOOGLE_SHEET_ID || '').trim();
  const accessToken = String(env.GOOGLE_ACCESS_TOKEN || '').trim();
  const serviceAccount = String(env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const overturePath = String(env.OVERTURE_PARQUET_PATH || '').trim() || DEFAULT_OVERTURE_PARQUET;

  const missing = [];
  if (!googlesheetId) missing.push('GOOGLE_SHEET_ID');
  if (!accessToken && !serviceAccount) missing.push('GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON');

  const status = missing.length === 0 ? 'CONFIGURED' : 'NOT_CONFIGURED';
  return {
    status,
    missing,
    googlesheetId,
    auth: {
      mode: accessToken ? 'token' : serviceAccount ? 'service-account' : 'none',
      ready: !!(accessToken || serviceAccount),
    },
    overturePath,
  };
}

function isConfigured(config) {
  return config && config.status === 'CONFIGURED';
}

/* ------------------------------------------------------------------ */
/* Sheets surface + single-range update                                */
/* ------------------------------------------------------------------ */

async function _tokenForAuth(config, env) {
  if (config.auth.mode === 'token') return String(env.GOOGLE_ACCESS_TOKEN || '');
  if (config.auth.mode === 'service-account') {
    const sa = JSON.parse(fs.readFileSync(env.GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8'));
    const assertion = mintJwt(sa);
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    if (!res.ok) throw new Error(`GOOGLE_SERVICE_ACCOUNT token exchange failed: ${res.status}`);
    const data = await res.json();
    if (!data.access_token) throw new Error('GOOGLE_SERVICE_ACCOUNT token exchange returned no access_token');
    return data.access_token;
  }
  throw new Error('No Google auth configured');
}

/*
 * updateRange(tabName, rangeSuffix, values) — a SINGLE bounded range write of
 * a 2-D values block (e.g. 'Y2:AB7') via values.update PUT. Live binds a
 * GoogleSheetsClient + auth; offline tests inject a transport and capture
 * every call (no network). This is the ONLY write primitive the runner uses.
 */
async function updateRange(client, config, env, rangeSuffix, values, transport, deps) {
  if (!values || values.length === 0) return { updated: 0 };
  const spreadsheetId = normalizeSpreadsheetId((client && client.spreadsheetId) || config.googlesheetId);
  const token = await _tokenForAuth(config, env);
  const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(quotedRange(VERIFIED_TAB, rangeSuffix))}?valueInputOption=USER_ENTERED`;
  const tokens = (deps && typeof deps.transport === 'function') || typeof transport === 'function'
    ? (deps && deps.transport) || transport
    : ((...a) => fetch(...a));
  const res = await tokens(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    throw new Error(`updateRange ${VERIFIED_TAB} ${rangeSuffix} failed: ${res.status}`);
  }
  return { updated: values.length };
}

function surfaceFor(client, config, env, transport, deps) {
  const sheetId = (client && client.spreadsheetId) || (config && config.googlesheetId) || '';
  return {
    spreadsheetId: sheetId,
    async listRows(tab) {
      return client.listRows(tab);
    },
    async updateRange(tab, rangeSuffix, values) {
      return updateRange(client, config, env, rangeSuffix, values, transport, deps);
    },
  };
}

async function clientFor(env, config, deps) {
  if (deps && deps.client) return surfaceFor(deps.client, config, env, deps.transport, deps);
  const client = new GoogleSheetsClient({
    spreadsheetId: config.googlesheetId,
    accessToken: env.GOOGLE_ACCESS_TOKEN || '',
    serviceAccount: env.GOOGLE_SERVICE_ACCOUNT_JSON
      ? JSON.parse(fs.readFileSync(env.GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8'))
      : null,
  });
  return surfaceFor(client, config, env, deps && deps.transport, deps);
}

/* ------------------------------------------------------------------ */
/* Column/header contracts                                             */
/* ------------------------------------------------------------------ */

function headerObject(row) {
  const out = [];
  for (let i = 0; i < (row || []).length; i += 1) out.push(String(row[i] || '').trim().toLowerCase());
  return out;
}

function columnLetter(index) {
  let n = Number(index);
  let letters = '';
  while (n >= 26) {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  }
  return String.fromCharCode(65 + n) + letters;
}

function positionalMismatches(grid, expectedColumns) {
  const header = grid && grid.length > 0 ? grid[0] : [];
  const mismatches = [];
  (expectedColumns || []).forEach((expected, index) => {
    const actual = String(header[index] || '').trim().toLowerCase();
    if (actual !== String(expected).trim().toLowerCase()) {
      mismatches.push({ letter: columnLetter(index), index, expected: String(expected), actual: actual || '(empty)' });
    }
  });
  return mismatches;
}

function mismatchDetail(expectedColumns, mismatches) {
  if (mismatches.length === 0) {
    return `${expectedColumns.length}/${expectedColumns.length} columns in expected positions`;
  }
  const shown = mismatches.slice(0, 5).map((m) => `${m.letter} is "${m.actual}", expected "${m.expected}"`).join('; ');
  return mismatches.length > 5 ? `${shown} (+${mismatches.length - 5} more)` : `${shown}`;
}

/* ------------------------------------------------------------------ */
/* Match-key classification (mirrors engine priority exactly)          */
/* ------------------------------------------------------------------ */

/*
 * Derives the match key type the ENGINE resolved for a matched lead, using the
 * exact normalizers the engine exports and the same priority order. This is
 * REPORT-ONLY: actual matching/dedup is still owned by the engine.
 */
function matchKeyFor(lead, index) {
  const leadPhone = normalizePhone(lead.phone);
  const leadWebsite = normalizeDomain(lead.website);
  const leadCity = normalize(lead.city).toLowerCase();
  const leadState = normalizeState(lead.state);
  const leadName = normalizeName(lead.business_name);

  /*
   * Mirrors the ENGINE's resolution exactly: phone (when lead phone exists) →
   * website (regardless of the lead phone — a non-matching phone falls
   * through) → name+city+state (exact, then Levenshtein <= 2).
   */
  if (leadPhone !== '') {
    const place = (index || []).find((c) => {
      const cand = normalizePhone(c.phone);
      return cand !== '' && cand === leadPhone;
    });
    if (place) return 'phone';
  }
  if (leadWebsite !== '') {
    const place = (index || []).find((c) => {
      const cand = normalizeDomain(c.website);
      return cand !== '' && cand === leadWebsite;
    });
    if (place) return 'website';
  }
  if (leadName !== '' && leadCity !== '' && leadState !== '') {
    const cityStateMatches = (index || []).filter(
      (place) => {
        const city = normalize(place.city).toLowerCase();
        const state = normalizeState(place.state_code);
        return city !== '' && city === leadCity && state !== '' && state === leadState;
      },
    );
    const exact = cityStateMatches.find((place) => normalizeName(place.primary_name) === leadName);
    if (exact) return 'name_exact';
    const fuzzy = cityStateMatches.find(
      (place) => normalizeName(place.primary_name) !== '' && levenshtein(normalizeName(place.primary_name), leadName) <= 2,
    );
    if (fuzzy) return 'name_fuzzy';
  }
  return 'no_match';
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

function leadHasMatchKey(lead) {
  if (normalize(lead.phone) !== '') return true;
  if (normalize(lead.website) !== '') return true;
  return normalize(lead.business_name) !== '' && normalize(lead.city) !== '' && normalize(lead.state) !== '';
}

function classifyLead(lead, options) {
  const opts = options || {};
  const leadId = normalize(lead.lead_id);
  if (opts.leadIds && !opts.leadIds.has(leadId)) {
    return { reason: EXCLUSION_REASONS.OUT_OF_SCOPE };
  }
  if (normalize(lead.enrichment_business_status) !== '') {
    return { reason: EXCLUSION_REASONS.ALREADY_ENRICHED };
  }
  if (!leadHasMatchKey(lead)) {
    return { reason: EXCLUSION_REASONS.NO_MATCH_KEY };
  }
  return { reason: null };
}

/* ------------------------------------------------------------------ */
/* Preflight                                                           */
/* ------------------------------------------------------------------ */

async function preflight(env, args = {}, deps = {}) {
  const config = readConfig(env);
  const ns = namespaceForArgs(args);
  const overture = String((args && args.overture) || config.overturePath || '');
  const checks = [];
  const reportsDir = (args && args.reportsDir) || DEFAULT_REPORTS_DIR;

  checks.push({ label: 'A config present', ok: isConfigured(config), detail: isConfigured(config) ? 'configured' : `missing: ${config.missing.join(', ')}` });

  if (config.auth.ready) {
    checks.push({ label: 'B sheet auth', ok: true, detail: `auth=${config.auth.mode}` });
  } else {
    checks.push({ label: 'B sheet auth', ok: false, detail: 'no Google Sheets auth configured' });
  }

  const client = (deps && deps.client) || null;

  if (client) {
    try {
      const grid = await client.listRows(VERIFIED_TAB);
      const mismatches = positionalMismatches(grid, VERIFIED_COLUMNS);
      if (grid.length > 0) {
        checks.push({
          label: 'C Verified Leads columns',
          ok: mismatches.length === 0,
          detail: mismatchDetail(VERIFIED_COLUMNS, mismatches),
        });
      } else {
        checks.push({ label: 'C Verified Leads columns', ok: false, detail: 'Verified Leads grid is empty' });
      }
    } catch (err) {
      checks.push({ label: 'C Verified Leads columns', ok: false, detail: err.message });
    }
  } else {
    checks.push({ label: 'C Verified Leads columns', ok: false, detail: (deps && deps.clientError) || 'no Sheets client available' });
  }

  if (overture) {
    const statMsg = fs.existsSync(overture) ? '' : ' (file does not exist)';
    try {
      const readable = await probeParquet(overture, deps);
      checks.push({
        label: 'D Overture parquet readable',
        ok: readable,
        detail: readable ? path.basename(overture) : `${path.basename(overture)} probe returned no rows${statMsg}`,
      });
    } catch (err) {
      checks.push({ label: 'D Overture parquet readable', ok: false, detail: err.message });
    }
  } else {
    checks.push({ label: 'D Overture parquet readable', ok: false, detail: 'no Overture parquet path configured' });
  }

  const nsOk = TEST_NAMESPACE_REGEX.test(ns) || (!TEST_NAMESPACE_REGEX.test(ns) && String(ns).startsWith(TEST_NAMESPACE_PREFIX) && String(ns).length > TEST_NAMESPACE_PREFIX.length);
  checks.push({
    label: 'E namespace well-formed',
    ok: true,
    detail: nsOk ? ns : `namespace "${ns}" does not start with ${TEST_NAMESPACE_PREFIX}; execute writes would be refused`,
    informational: !nsOk,
  });

  const hard = checks.filter((c) => !c.informational && !c.ok);
  const status = hard.length ? 'FAIL' : 'PASS';
  return { status, checks, config, ns, reportsDir, overture };
}

/* ------------------------------------------------------------------ */
/* Write range construction                                            */
/* ------------------------------------------------------------------ */

function cellValue(grid, dataRow, colIndex) {
  const row = grid[dataRow + 1];
  return row && row[colIndex] !== undefined && row[colIndex] !== null ? String(row[colIndex]) : '';
}

/*
 * Builds the Y2:AB<lastRow> value block for the scoped leads.
 * matchedById: lead_id → {y, z, aa, ab} (the stamped values).
 * namespacedOnly: when true (EXECUTE), only TEST-ENRICH-LIVE-<tag>- lead_ids
 * are changed; every other row is preserved verbatim. When false (DRY_RUN
 * reporting), matched rows are reported as would-write but the block is still
 * built so stats reflect exactly what an execute would do minus the namespace
 * guard.
 */
function buildWriteBlock({ grid, scopedRows, matchedById, namespacedOnly }) {
  const lastScopedIdx = scopedRows.reduce((max, lead) => {
    for (let i = 0; i < (grid.length - 1); i += 1) {
      if (String(grid[i + 1][0] || '') === String(lead.lead_id || '')) return Math.max(max, i);
    }
    return max;
  }, -1);
  if (lastScopedIdx < 0) return { rangeSuffix: '', values: [] };

  const lastRow = lastScopedIdx + 2; // header row 1 + data rows
  const values = [];
  for (let i = 0; i <= lastScopedIdx; i += 1) {
    const leadId = String(grid[i + 1][0] || '');
    const stamp = matchedById && matchedById[leadId];
    if (stamp && (!namespacedOnly || isNamespacedLead(leadId))) {
      values.push([stamp.y, stamp.z, stamp.aa, stamp.ab]);
    } else {
      values.push([
        cellValue(grid, i, BUSINESS_STATUS_COL),
        cellValue(grid, i, CONFIDENCE_COL),
        cellValue(grid, i, GERS_ID_COL),
        cellValue(grid, i, LAST_RUN_COL),
      ]);
    }
  }
  return { rangeSuffix: `Y2:AB${lastRow}`, values };
}

function countChangedCells(grid, values) {
  let changed = 0;
  for (let i = 0; i < values.length; i += 1) {
    const row = values[i];
    for (let c = 0; c < WRITE_COLS.length; c += 1) {
      const colIndex = WRITE_COLS[c];
      if (row[c] !== cellValue(grid, i, colIndex)) changed += 1;
    }
  }
  return changed;
}

/* ------------------------------------------------------------------ */
/* Run pipeline                                                        */
/* ------------------------------------------------------------------ */

function sortByLeadId(rows) {
  return (rows || []).slice().sort((a, b) => String(a.lead_id || '').localeCompare(String(b.lead_id || '')));
}

function runIdFor(ns, clock) {
  const stamp = (clock || Date.now)();
  const seconds = typeof stamp === 'number' ? stamp : stamp.getTime();
  return `BIZ-ENRICH-LIVE-${String(ns).replace(/^TEST-ENRICH-LIVE-/, '')}-${Math.round(seconds / 1000).toString(16)}`;
}

async function runBusinessEnrichment(env, args = {}, deps = {}) {
  const config = readConfig(env);
  const startedAt = new Date().toISOString();
  const outcomes = { stages: {}, failures: [] };
  const ns = namespaceForArgs(args);
  const runId = args.runId || runIdFor(ns);

  const requestedScope = scopeForArgs(args);
  const productionConfirmed = String((env && env.BIZ_ENRICH_ALLOW_PRODUCTION) || '').trim() === '1';

  /* REFUSED guard runs FIRST — before any client init, sheet read, or write —
     so a requested-but-unconfirmed production write never touches the network. */
  if (args.execute && requestedScope === 'production' && !productionConfirmed) {
    outcomes.stages.write = 'REFUSED';
    outcomes.failures.push('refusing production write: set BIZ_ENRICH_ALLOW_PRODUCTION=1 to confirm');
    const report = buildRunReport({
      args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, runId,
      overture: config.overturePath, indexCount: 0, stats: {}, perLeadOutcomes: [], exclusions: [],
      writeOutcome: { would_write: 0, wrote: 0 }, changedCells: 0,
    });
    writeRunReport(report.redacted, args);
    return { status: 'FAIL', stages: outcomes.stages, report: report.redacted };
  }

  let client = null;
  let clientError = '';
  if (deps.client) {
    client = await clientFor(env, config, deps);
  } else if (isConfigured(config)) {
    try {
      client = await clientFor(env, config, deps);
    } catch (err) {
      clientError = err.message;
    }
  }

  const pre = await preflight(env, args, { ...deps, client, clientError });
  outcomes.stages.preflight = pre.status;
  if (pre.status === 'FAIL') {
    const failing = (pre.checks || []).filter((c) => !c.informational && !c.ok);
    outcomes.failures.push(
      ...(failing.length
        ? failing.map((c) => `preflight failed: ${c.label}${c.detail ? ` (${c.detail})` : ''}`)
        : ['preflight failed'])
    );
    const report = buildRunReport({
      args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, preflight: pre,
      overture: pre.overture, indexCount: 0, stats: {}, perLeadOutcomes: [], exclusions: [], writeOutcome: { would_write: 0, wrote: 0 },
    });
    writeRunReport(report.redacted, args);
    return { status: 'FAIL', stages: outcomes.stages, report: report.redacted };
  }

  if (!isConfigured(config)) {
    outcomes.stages.preflight = 'NOT_CONFIGURED';
    const report = buildRunReport({
      args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, preflight: pre,
      overture: pre.overture, indexCount: 0, stats: {}, perLeadOutcomes: [], exclusions: [], writeOutcome: { would_write: 0, wrote: 0 },
    });
    writeRunReport(report.redacted, args);
    return { status: 'NOT_CONFIGURED', stages: outcomes.stages, report: report.redacted };
  }

  const now = String((deps && deps.now) || new Date().toISOString());

  let grid = [];
  try {
    grid = await client.listRows(VERIFIED_TAB);
  } catch (err) {
    outcomes.failures.push(`sheet read failed: ${err.message}`);
    const report = buildRunReport({
      args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, preflight: pre,
      overture: pre.overture, indexCount: 0, stats: {}, perLeadOutcomes: [], exclusions: [], writeOutcome: { would_write: 0, wrote: 0 },
    });
    writeRunReport(report.redacted, args);
    return { status: 'FAIL', stages: outcomes.stages, report: report.redacted };
  }
  outcomes.stages.read = 'PASS';

  const verifiedRows = grid.slice(1).map((row) => rowToObject(row, VERIFIED_COLUMNS));

  const leadIds = args.leadIds && args.leadIds.length
    ? new Set(args.leadIds.map((id) => String(id).trim()).filter(Boolean))
    : null;

  const classified = verifiedRows.map((lead) => ({
    lead,
    classification: classifyLead(lead, { leadIds }),
  }));

  const eligible = classified.filter((c) => !c.classification.reason);
  const exclusions = [];
  for (const c of classified) {
    if (c.classification.reason) exclusions.push({ lead_id: String(c.lead.lead_id || ''), reason: c.classification.reason });
  }

  let scope = sortByLeadId(eligible.map((c) => c.lead));
  const limit = Number((args && args.limit) === undefined ? DEFAULT_LIMIT : args.limit);
  if (Number.isFinite(limit) && limit > 0) scope = scope.slice(0, limit);

  outcomes.stages.filter = 'PASS';

  let index = [];
  let indexCount = 0;
  try {
    const built = await buildIndex({ parquetPath: pre.overture, deps });
    index = built.index;
    indexCount = built.count;
  } catch (err) {
    outcomes.failures.push(`parquet read failed: ${err.message}`);
    const report = buildRunReport({
      args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, preflight: pre,
      overture: pre.overture, indexCount: 0, stats: {}, perLeadOutcomes: [], exclusions: [], writeOutcome: { would_write: 0, wrote: 0 },
    });
    writeRunReport(report.redacted, args);
    return { status: 'FAIL', stages: outcomes.stages, report: report.redacted };
  }
  outcomes.stages.build_index = 'PASS';

  const enrichment = scope.length
    ? enrichBusinessLeads({ leads: scope, index, now, runId })
    : { enriched: [], unmatched: [], stats: { total: 0, matched: 0, unmatched: 0, filled_website: 0, filled_phone: 0, filled_operating_status: 0, closed_businesses_flagged: 0 } };
  outcomes.stages.enrich = 'PASS';

  const enrichedRows = sortByLeadId(enrichment.enriched);
  const unmatchedRows = sortByLeadId(enrichment.unmatched);

  const matchedById = {};
  for (const lead of enrichedRows) {
    matchedById[String(lead.lead_id || '')] = {
      y: normalize(lead.enrichment_business_status),
      z: lead.enrichment_confidence === undefined || lead.enrichment_confidence === null ? '' : String(lead.enrichment_confidence),
      aa: normalize(lead.enrichment_gers_id),
      ab: normalize(lead.enrichment_last_run),
    };
  }

  const perLeadOutcomes = scope.map((lead) => {
    const leadId = String(lead.lead_id || '');
    const stamp = matchedById[leadId];
    const matched = Boolean(stamp);
    return {
      lead_id: leadId,
      match_key_type: matched ? matchKeyFor(lead, index) : 'no_match',
      matched,
      y: matched ? stamp.y : '',
      z: matched ? stamp.z : '',
      aa: matched ? stamp.aa : '',
    };
  });

  /* Write block: DRY_RUN reports would-write (no namespace guard, all matched);
     EXECUTE writes according to scope — test scope is NAMESPACE-GUARDED (only
     TEST-ENRICH-LIVE-<tag> lead_ids change); production scope
     (--scope=production + BIZ_ENRICH_ALLOW_PRODUCTION=1) writes every matching
     lead in scope, preserving nothing outside scope. would_write / wrote /
     cells_changed are ALL cell counts: would_write = the cells a full
     (unguarded) write would change; wrote = the cells actually changed by this
     run; cells_changed follows the run's mode. */
  const dryBlock = buildWriteBlock({ grid, scopedRows: scope, matchedById, namespacedOnly: false });
  const execNamespacedOnly = args.execute ? requestedScope === 'test' : true;
  const execBlock = buildWriteBlock({ grid, scopedRows: scope, matchedById, namespacedOnly: execNamespacedOnly });
  const dryChanged = countChangedCells(grid, dryBlock.values);
  const execChanged = countChangedCells(grid, execBlock.values);

  const writeOutcome = { would_write: dryChanged, wrote: 0 };

  if (args.execute) {
    if (execBlock.values.length === 0) {
      outcomes.stages.write = 'NO_ELIGIBLE'; // nothing in scope to write
    } else if (execChanged === 0) {
      outcomes.stages.write = 'NO_ELIGIBLE'; // no lead changed; nothing materialized
    } else if (requestedScope === 'test' && !String(ns).startsWith(TEST_NAMESPACE_PREFIX + '-')) {
      outcomes.failures.push(`namespace ${ns} not in ${TEST_NAMESPACE_PREFIX}-<tag> form; refuse to execute`);
      outcomes.stages.write = 'FAIL';
    } else {
      try {
        await client.updateRange(VERIFIED_TAB, execBlock.rangeSuffix, execBlock.values);
        writeOutcome.wrote = execChanged;
        outcomes.stages.write = 'PASS';
      } catch (err) {
        outcomes.failures.push(`sheet write failed: ${err.message}`);
        outcomes.stages.write = 'FAIL';
      }
    }
  } else {
    outcomes.stages.write = 'DRY_RUN';
  }

  outcomes.stages.report = 'PASS';

  const stats = {
    total: verifiedRows.length,
    eligible: scope.length,
    excluded: exclusions.length,
    matched: enrichedRows.length,
    unmatched: unmatchedRows.length,
    index_rows: indexCount,
    would_write: writeOutcome.would_write,
    wrote: writeOutcome.wrote,
  };

  const report = buildRunReport({
    args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, preflight: pre,
    runId, overture: pre.overture, indexCount, stats, perLeadOutcomes, exclusions, writeOutcome,
    changedCells: args.execute ? execChanged : dryChanged,
  });
  writeRunReport(report.redacted, args);
  const status = overallStatusOf(outcomes.stages);
  return { status, stages: outcomes.stages, report: report.redacted };
}

function overallStatusOf(stages) {
  const sev = stages || {};
  if (sev.preflight === 'FAIL' || ['read', 'filter', 'build_index', 'enrich', 'write', 'report'].some((k) => sev[k] === 'FAIL' || sev[k] === 'REFUSED')) return 'FAIL';
  if (sev.preflight === 'NOT_CONFIGURED') return 'NOT_CONFIGURED';
  return 'PASS';
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? '<redacted>' : redact(value[key]);
    }
    return out;
  }
  if (typeof value === 'string') {
    let s = value;
    for (const re of SECRET_PATTERNS) s = s.replace(re, '<redacted>');
    return s;
  }
  return value;
}

function redactSecret(value) {
  return String(value).replace(/[A-Za-z0-9_-]{8,}/g, '<redacted>');
}

function buildRunReport({ args = {}, env = {}, outcomes = {}, startedAt, completedAt, ns, preflight: pre, runId, overture, indexCount, stats, perLeadOutcomes, exclusions, writeOutcome, changedCells }) {
  const config = readConfig(env || args.env || {});
  const namespace = ns || namespaceForArgs(args);
  const run_id = runId || runIdFor(namespace);
  const requested = scopeForArgs(args);
  const report = {
    artifact: 'Business Enrichment V1 — engine-direct live runner (H.9)',
    run_id,
    mode: args.execute ? 'EXECUTE' : 'DRY_RUN',
    requested_scope: requested,
    effective_scope: args.execute ? requested : 'dry_run',
    production_confirmed: String((env || args.env || {}).BIZ_ENRICH_ALLOW_PRODUCTION || '').trim() === '1',
    started_at: startedAt,
    completed_at: completedAt,
    namespace,
    sheet: {
      id: config.googlesheetId ? config.googlesheetId.replace(/(^.{6}).+(.{4}$)/, '$1…$2') : '',
      verified_tab: VERIFIED_TAB,
    },
    parquet: {
      basename: overture ? path.basename(String(overture)) : '',
      index_rows: Number.isFinite(indexCount) ? indexCount : 0,
    },
    preflight_status: outcomes.stages && outcomes.stages.preflight,
    preflight_detail: Array.isArray(pre && pre.checks)
      ? pre.checks.map((c) => ({
          name: c.label,
          ok: Boolean(c.ok),
          informational: Boolean(c.informational),
          detail: String(c.detail || ''),
        }))
      : [],
    stages: {
      preflight: (outcomes.stages && outcomes.stages.preflight) || 'SKIPPED',
      read: (outcomes.stages && outcomes.stages.read) || 'SKIPPED',
      filter: (outcomes.stages && outcomes.stages.filter) || 'SKIPPED',
      build_index: (outcomes.stages && outcomes.stages.build_index) || 'SKIPPED',
      enrich: (outcomes.stages && outcomes.stages.enrich) || 'SKIPPED',
      write: (outcomes.stages && outcomes.stages.write) || 'SKIPPED',
      report: (outcomes.stages && outcomes.stages.report) || 'SKIPPED',
    },
    stats: stats || {},
    per_lead_outcomes: perLeadOutcomes || [],
    exclusions: exclusions || [],
    would_write: writeOutcome ? writeOutcome.would_write : 0,
    wrote: writeOutcome ? writeOutcome.wrote : 0,
    cells_changed: changedCells || 0,
    failure_info: outcomes.failures || [],
  };
  return { redacted: redact(report), raw: report };
}

function writeRunReport(report, args) {
  const dir = (args && args.reportsDir) || DEFAULT_REPORTS_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${report.run_id}.json`);
  fs.writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[report] ${target}`);
  return target;
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = {
    execute: false,
    noInteractive: false,
    help: false,
    limit: DEFAULT_LIMIT,
    leadIds: [],
    overture: '',
    namespace: '',
    reportsDir: DEFAULT_REPORTS_DIR,
    scope: 'test',
  };
  for (const arg of argv || []) {
    if (arg === '--execute') args.execute = true;
    else if (arg === '--no-interactive') args.noInteractive = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--limit=')) {
      const n = Number(arg.split('=')[1].trim());
      args.limit = Number.isFinite(n) && n >= 0 ? n : DEFAULT_LIMIT;
    } else if (arg.startsWith('--lead-ids=')) {
      args.leadIds = arg.split('=')[1].split(',').map((id) => id.trim()).filter(Boolean);
    } else if (arg.startsWith('--overture=')) args.overture = arg.split('=')[1].trim();
    else if (arg.startsWith('--namespace=')) args.namespace = arg.split('=')[1].trim();
    else if (arg.startsWith('--scope=')) args.scope = arg.split('=')[1].trim();
    else if (arg.startsWith('--reports-dir=')) args.reportsDir = arg.split('=')[1].trim();
  }
  return args;
}

function usage() {
  return `
Usage: node scripts/run-business-enrichment-live.js [flags]

Run the SHIPPED business-enrichment engine (src/enrichment-business.js)
engine-direct against the Verified Leads tab + a local Overture parquet index.
Default mode is DRY_RUN: read-only, nothing written without --execute.

Flags:
  --execute              allow a single Y2:AB<last_row> write on Verified
                         Leads (enrichment_business_status / _confidence /
                         _gers_id / _last_run). Writes are NAMESPACE-GUARDED.
  --scope=<test|production>
                         write scope in --execute mode (default "test").
                         test: only lead_ids under TEST-ENRICH-LIVE-<tag>- are
                         ever changed — production leads are reported as
                         would-write and left untouched.
                         production: every matched lead in scope is written,
                         but only when BIZ_ENRICH_ALLOW_PRODUCTION=1 is present
                         in the environment (the run REFUSES otherwise). In
                         DRY_RUN mode --scope is reported but no write happens.
  --limit=<N>            max eligible leads to enrich (default ${DEFAULT_LIMIT})
  --lead-ids=<id>,<id>   restrict to these lead_ids (others => out_of_scope)
  --overture=<path>      Overture parquet path (default
                         ${DEFAULT_OVERTURE_PARQUET}; env OVERTURE_PARQUET_PATH)
  --namespace=<prefix>   test namespace (default TEST-ENRICH-LIVE-<hex tag>)
  --reports-dir=<dir>    report output directory (default ${DEFAULT_REPORTS_DIR})
  --no-interactive       never prompt
  --help                 this message

Env (see .env.example):
  GOOGLE_SHEET_ID, GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON,
  OVERTURE_PARQUET_PATH (optional; default ${DEFAULT_OVERTURE_PARQUET}),
  BIZ_ENRICH_ALLOW_PRODUCTION=1 (required to confirm --scope=production in
  --execute mode)

Exit codes: 0 PASS, 1 FAIL, 3 NOT_CONFIGURED.
`;
}

function exitCodeForStatus(status) {
  if (status === 'PASS') return 0;
  if (status === 'FAIL') return 1;
  if (status === 'NOT_CONFIGURED') return 3;
  return 2;
}

function printSummary(out) {
  const stages = out.stages || {};
  console.log('---');
  console.log(`RESULT: ${out.status}`);
  console.log(`stages: ${Object.entries(stages).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  const failures = (out.report && out.report.failure_info && out.report.failure_info.length) ? out.report.failure_info.slice() : [];
  for (const f of failures) console.log(`  failure: ${typeof f === 'string' ? f : JSON.stringify(f)}`);
}

async function run(env, args = {}, deps = {}) {
  const config = readConfig(env);
  if (!isConfigured(config)) {
    const startedAt = new Date().toISOString();
    const ns = namespaceForArgs(args);
    const report = buildRunReport({
      args, env, outcomes: { stages: { preflight: 'NOT_CONFIGURED' } }, startedAt, completedAt: new Date().toISOString(), ns,
      overture: config.overturePath, indexCount: 0, stats: {}, perLeadOutcomes: [], exclusions: [], writeOutcome: { would_write: 0, wrote: 0 },
    });
    writeRunReport(report.redacted, args);
    return { status: 'NOT_CONFIGURED', stages: { preflight: 'NOT_CONFIGURED' }, report: report.redacted };
  }
  return runBusinessEnrichment(env, args, deps);
}

async function main(argv, env) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }
  const out = await run(env || process.env, args);
  printSummary(out);
  return exitCodeForStatus(out.status);
}

if (require.main === module) {
  main(process.argv.slice(2), process.env)
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(`[business-enrichment-live] ${err.message}`);
      process.exit(1);
    });
}

const e = {
  // constants
  VERIFIED_TAB,
  DEFAULT_LIMIT,
  DEFAULT_REPORTS_DIR,
  DEFAULT_OVERTURE_PARQUET,
  TEST_NAMESPACE_PREFIX,
  TEST_NAMESPACE_REGEX,
  NAMESPACED_LEAD_REGEX,
  EXCLUSION_REASONS,
  VERIFIED_COLUMNS,
  WRITE_COLS,
  BUSINESS_STATUS_COL,
  CONFIDENCE_COL,
  GERS_ID_COL,
  LAST_RUN_COL,
  INDEX_SCHEMA_FIELDS,
  // helpers
  defaultRunToken,
  namespaceForArgs,
  VALID_SCOPES,
  scopeForArgs,
  isNamespacedLead,
  firstOf,
  toNumber,
  toIndexRow,
  readConfig,
  isConfigured,
  classifyLead,
  leadHasMatchKey,
  matchKeyFor,
  buildIndex,
  readParquetRows,
  probeParquet,
  buildWriteBlock,
  countChangedCells,
  cellValue,
  surfaceFor,
  clientFor,
  updateRange,
  _tokenForAuth,
  sortByLeadId,
  runIdFor,
  redact,
  redactSecret,
  buildRunReport,
  writeRunReport,
  overallStatusOf,
  // phases
  preflight,
  runBusinessEnrichment,
  run,
  // cli
  parseArgs,
  usage,
  exitCodeForStatus,
  main,
};
module.exports = e;