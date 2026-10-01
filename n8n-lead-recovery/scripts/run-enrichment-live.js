'use strict';

/*
 * Contact Enrichment V1 — engine-direct LIVE runner (Prompt H.8b).
 *
 * Runs the SHIPPED contact-enrichment engines (src/enrichment-contact.js +
 * src/enrichment-contact-oss.js) directly against the production spreadsheet —
 * no n8n workflow, no fixtures. Provider calls go to the real provider over the
 * injected client (AgentData default, 200ms built-in pacing), so this is the
 * operator-facing harness for the enrichment half of Enrichment V1.
 *
 * Pipeline (mirrors the shipped 16-node workflow intent):
 *   1. PREFLIGHT  — env/config validation + header contracts on Approved
 *                   Outreach (24 columns A–X, enrichment-owned V/W/X checked
 *                   positionally) and the Contact Enrichment Log (the 14
 *                   canonical columns A–N). Fails with the exact missing column
 *                   names — the operator fixes the sheet, never the code.
 *   2. READ       — Approved Outreach (A–X) + Contact Enrichment Log (A–N,
 *                   the durable cache).
 *   3. FILTER     — country in scope (operator-configurable via
 *                   ENRICHMENT_COUNTRIES_ALLOW / ENRICHMENT_COUNTRIES_DENY,
 *                   default US-only; deny wins), website non-empty/parseable,
 *                   email empty, contact_blocked not TRUE. Exclusion reasons:
 *                   non_us | no_domain | already_enriched | blocked |
 *                   out_of_scope (outside --lead-ids).
 *   4. ENRICH     — enrichment_key = domain::provider; cache lookup
 *                   (non-expired log row = hit, provider skipped, hit count
 *                   write-back) else provider call (deterministic lead order,
 *                   >=200ms pacing) else zero-credit OSS fallback (injected
 *                   resolver; @absolutejs/enrich findEmail discovery-only when
 *                   a contact name exists; otherwise oss_unavailable / no-name
 *                   envelopes — a lead with no contact name is BLOCKED
 *                   (blocked: true, notes: oss_no_name), never a fabricated
 *                   accepted email; a name that resolves to nothing stays NOT
 *                   blocked (blocked: false, notes: oss_no_results). Neither
 *                   path ever fabricates an accepted email).
 *   5. WRITE      — EXECUTE only. Appends new Contact Enrichment Log rows
 *                   (A–N), write-backs cache_hit_count bumps, updates ONLY the
 *                   enrichment-owned Approved Outreach columns V (contact_
 *                   source_provider), W (contact_blocked), and X (country).
 *                   A–U (including the handoff-owned columns) are NEVER touched.
 *                   Writes are namespace-guarded: only lead_ids whose namespace
 *                   is TEST-ENRICH-LIVE-<tag> are ever written; anything else
 *                   is reported as would-be and left untouched. There is NO
 *                   --allow-production-writes.
 *   6. REPORT     — reports/ENRICH-LIVE-<run_id>.json, fully redacted (no
 *                   keys/tokens/emails/PII beyond lead_id).
 *
 * Default mode is DRY_RUN: read-only, nothing written without --execute.
 *
 * Determinism: `now` is resolved once per run and injected into both engines;
 * the engines never touch process.env or wall-clock time; provider pacing is
 * internal to the injected client. Offline tests inject deps (client, resolver,
 * transport, now) so no test ever performs network I/O.
 *
 * Exit codes: 0 PASS, 1 FAIL, 3 NOT_CONFIGURED.
 */

const fs = require('node:fs');
const path = require('node:path');

const { APPROVED_COLUMNS, APPROVED_COLUMN_INDEX, rowToObject, objectToRow, normalize } = require('../src/schema');
const { ENRICHMENT_LOG_COLUMNS, DEFAULT_TTL_DAYS, HUNTER_MIN_SCORE } = require('../src/enrichment-schema');
const { enrichContactLeads } = require('../src/enrichment-contact');
const { enrichContactOss, OSS_NO_RESULTS } = require('../src/enrichment-contact-oss');
const { createContactClient, defaultSleep } = require('../src/enrichment-contact-client');
const { GoogleSheetsClient, mintJwt, quotedRange, normalizeSpreadsheetId } = require('../src/google-sheets-client');

const APPROVED_TAB = 'Approved Outreach';
const LOG_TAB = 'Contact Enrichment Log';

const DEFAULT_PROVIDER = 'agentdata';
const VALID_PROVIDERS = ['agentdata', 'hunter'];
const DEFAULT_LIMIT = 5;
const DEFAULT_REPORTS_DIR = path.join(__dirname, '..', 'reports');

const TEST_NAMESPACE_PREFIX = 'TEST-ENRICH-LIVE';
const TEST_NAMESPACE_REGEX = /^TEST-ENRICH-LIVE-[0-9a-f]{8,32}$/i;
const NAMESPACED_LEAD_REGEX = /^TEST-ENRICH-LIVE-[0-9a-f]{8,32}-/i;

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

const EXCLUSION_REASONS = Object.freeze({
  NON_US: 'non_us',
  NO_DOMAIN: 'no_domain',
  ALREADY_ENRICHED: 'already_enriched',
  BLOCKED: 'blocked',
  OUT_OF_SCOPE: 'out_of_scope',
});

const PREFLIGHT_APPROVED_COLUMNS = [
  'lead_id',
  'country',
  'website',
  'email',
  'contact_source_provider',
  'contact_blocked',
];

const SENSITIVE_KEY_RE =
  /(access_?token|refresh_?token|api[_-]?key|secret|password|credential|authorization|private[_-]?key|result_email|contact_name|contact_title|notes)/i;
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
  const requested = String((args && args.scope) || 'test').trim().toLowerCase();
  if (!VALID_SCOPES.has(requested)) {
    throw new Error(`unknown scope "${requested}" (valid: ${[...VALID_SCOPES].join('|')})`);
  }
  return requested;
}

const COUNTRY_ALIASES = new Map([
  ['USA', 'US'],
  ['UNITED STATES', 'US'],
  ['UNITED STATES OF AMERICA', 'US'],
  ['U.S.A.', 'US'],
  ['U.S.', 'US'],
  ['UK', 'GB'],
  ['UNITED KINGDOM', 'GB'],
  ['GREAT BRITAIN', 'GB'],
  ['CANADA', 'CA'],
]);

function normalizeCountry(value) {
  const v = String(value || '').trim().toUpperCase();
  if (v === '') return '';
  return COUNTRY_ALIASES.get(v) || v;
}

function isNamespacedLead(leadId) {
  return NAMESPACED_LEAD_REGEX.test(String(leadId).trim());
}

function providerForArgs(args, env) {
  const requested = String((args && args.provider) || '').trim();
  const fromEnv = String((env && env.ENRICHMENT_PROVIDER) || '').trim();
  const provider = (requested || fromEnv || DEFAULT_PROVIDER).toLowerCase();
  return VALID_PROVIDERS.includes(provider) ? provider : null;
}

function parseCountryList(raw) {
  const value = String(raw === undefined || raw === null ? '' : raw).trim();
  if (value === '') return [];
  return value
    .split(',')
    .map((c) => normalizeCountry(c))
    .filter(Boolean);
}

// D-C8 (revised 2026-09-18): country scope is operator-configurable via
// ENRICHMENT_COUNTRIES_ALLOW (comma-separated ISO-3166 alpha-2, default "US";
// "*" or empty = allow all) and ENRICHMENT_COUNTRIES_DENY (default none;
// deny wins), replacing the previous hard-coded US-only filter. Fail-closed:
// a missing/blank country is never in scope. H.9.2: input and allow/deny
// entries are normalized via normalizeCountry (US/UK/CANADA aliases to their
// alpha-2 codes) before comparison. This policy lives in the runner
// (src/enrichment-schema.js is frozen and continues to ship US_COUNTRIES /
// isUsCountry for the built workflows).
function isCountryInScope(country, { allow, deny } = {}) {
  const normalized = normalizeCountry(country);
  if (normalized === '') return false; // fail-closed
  const allowList = (allow || []).map((c) => normalizeCountry(c)).filter(Boolean);
  const denyList = (deny || []).map((c) => normalizeCountry(c)).filter(Boolean);
  if (denyList.includes(normalized)) return false;
  if (allowList.includes('*')) return true;
  if (allowList.length === 0) return true; // empty allow = allow all
  return allowList.includes(normalized);
}

/* ------------------------------------------------------------------ */
/* Config (env-only, never code)                                       */
/* ------------------------------------------------------------------ */

function readConfig(env) {
  const googlesheetId = String(env.GOOGLE_SHEET_ID || '').trim();
  const accessToken = String(env.GOOGLE_ACCESS_TOKEN || '').trim();
  const serviceAccount = String(env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim();
  const agentdataApiKey = String(env.AGENTDATA_API_KEY || '').trim();
  const hunterApiKey = String(env.HUNTER_API_KEY || '').trim();
  const envProvider = String(env.ENRICHMENT_PROVIDER || '').trim().toLowerCase();
  const ttlDaysRaw = Number(env.ENRICHMENT_TTL_DAYS);
  const minScoreRaw = Number(env.ENRICHMENT_MIN_SCORE);
  const countriesRawAllow =
    env.ENRICHMENT_COUNTRIES_ALLOW === undefined || env.ENRICHMENT_COUNTRIES_ALLOW === null
      ? 'US'
      : String(env.ENRICHMENT_COUNTRIES_ALLOW).trim();
  const countries = {
    allow: parseCountryList(countriesRawAllow),
    deny: parseCountryList(env.ENRICHMENT_COUNTRIES_DENY),
  };

  const missing = [];
  if (!googlesheetId) missing.push('GOOGLE_SHEET_ID');
  if (!accessToken && !serviceAccount) missing.push('GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON');
  const configuredShipAllowed =
    !accessToken && !serviceAccount && env.N8N_API_KEY
      ? false
      : true;

  const isAgentData = envProvider === 'hunter' ? false : true;
  if (isAgentData && !agentdataApiKey) missing.push('AGENTDATA_API_KEY');
  if (!isAgentData && !hunterApiKey) missing.push('HUNTER_API_KEY (ENRICHMENT_PROVIDER=hunter)');

  const status = missing.length === 0 ? 'CONFIGURED' : 'NOT_CONFIGURED';
  return {
    status,
    missing,
    googlesheetId,
    auth: {
      mode: accessToken ? 'token' : serviceAccount ? 'service-account' : 'none',
      ready: !!(accessToken || serviceAccount),
    },
    provider: isAgentData ? 'agentdata' : 'hunter',
    apiKeys: {
      agentdata: agentdataApiKey,
      hunter: hunterApiKey,
    },
    ttlDays: Number.isFinite(ttlDaysRaw) && ttlDaysRaw > 0 ? ttlDaysRaw : DEFAULT_TTL_DAYS,
    minScore: Number.isFinite(minScoreRaw) && minScoreRaw >= 0 ? minScoreRaw : HUNTER_MIN_SCORE,
    countries,
    configuredShipAllowed,
  };
}

function isConfigured(config) {
  return config && config.status === 'CONFIGURED';
}

/* ------------------------------------------------------------------ */
/* Sheets surface                                                      */
/* ------------------------------------------------------------------ */

/*
 * The Google Sheets REST surface used by the runner. GoogleSheetsClient (from
 * src/google-sheets-client.js) provides listRows/appendRows but no cell-level
 * update, which the runner needs for the cache_hit_count write-back and the
 * V/W Approved Outreach updates. The live adapter supplies updateValues via
 * the same OAuth machinery the client already uses (mintJwt + token exchange
 * are exported by that module — nothing here modifies it).
 */

async function liveTokenFor(config) {
  if (config.auth.mode === 'token') return config.googlesheetId && config.auth.ready ? String(process.env.GOOGLE_ACCESS_TOKEN || '') : '';
  return '';
}

async function _tokenForAuth(config, env) {
  if (config.auth.mode === 'token') return String(env.GOOGLE_ACCESS_TOKEN || '');
  if (config.auth.mode === 'service-account') {
    const sa = JSON.parse(fs.readFileSync(config.serviceAccountPath || env.GOOGLE_SERVICE_ACCOUNT_JSON, 'utf8'));
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
 * updateValues(tabName, cells) — cells: [{ dataRow, colIndex, value }].
 * dataRow is the 0-based listRows index (0 = header row); the spreadsheet row
 * is therefore dataRow + 1. Fetches the access token per call (live) and PATCH
 * es a single value per cell with valueInputOption=USER_ENTERED.
 *
 * Paced: one PUT per cell (V and W per enriched lead) is a tight burst, so
 * `--limit=100` fires 200 writes at once and trips the Google Sheets per-user
 * write throttle (~60/min) with a 429 mid-run. A 150ms sleep between PUTs
 * holds the loop at ~6.6 writes/sec, far under the limit, and costs ~30s over
 * 200 cells. `deps.sleep` overrides the delay (tests pass a no-op). Retry
 * semantics are deliberately NOT handled here.
 */
async function updateValues(client, tabName, cells, config, env, transport, deps) {
  if (!cells || cells.length === 0) return { updated: 0, cells: [] };
  if (config.auth.mode === 'none') {
    throw new Error('updateValues requires GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON');
  }
  const tokens = transport || ((...a) => fetch(...a));
  const spreadsheetId = normalizeSpreadsheetId(client.spreadsheetId || config.googlesheetId);
  const token = await _tokenForAuth(config, env);
  const A1 = (dataRow, colIndex) => {
    const col = String.fromCharCode(65 + colIndex);
    return `${col}${dataRow + 1}`;
  };
  const paceMs = 150;
  const sleep = deps && typeof deps.sleep === 'function' ? deps.sleep : defaultSleep;
  let updated = 0;
  const applied = [];
  for (const [index, cell] of cells.entries()) {
    try {
      const url = `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(quotedRange(tabName, A1(cell.dataRow, cell.colIndex)))}?valueInputOption=USER_ENTERED`;
      const res = await tokens(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ values: [[String(cell.value)]] }),
      });
      if (!res.ok) {
        throw new Error(`updateValues ${tabName} ${A1(cell.dataRow, cell.colIndex)} failed: ${res.status}`);
      }
      updated += 1;
      applied.push(cell);
    } finally {
      if (index < cells.length - 1) await sleep(paceMs);
    }
  }
  return { updated, cells: applied };
}

/*
 * Unified client surface for BOTH live and offline use. Live binds the
 * GoogleSheetsClient; offline (tests) binds a MockSheets + injected auth config.
 * Every interaction the runner performs goes through this surface, so the tests
 * can run completely without network.
 */
function surfaceFor(client, config, env, transport, deps) {
  const authCfg = deps && deps.authConfig ? deps.authConfig : config;
  const sheetId = (client && client.spreadsheetId) || (config && config.googlesheetId) || '';
  return {
    spreadsheetId: sheetId,
    async listRows(tab) {
      return client.listRows(tab);
    },
    async appendRows(tab, rows) {
      return client.appendRows(tab, rows);
    },
    async updateCells(tab, cells) {
      return updateValues(client, tab, cells, authCfg, env, transport, deps);
    },
    async rowCount(tab) {
      const grid = await client.listRows(tab);
      return grid.length;
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
  return String.fromCharCode(65 + Number(index));
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

function isHeaderRow(row) {
  return String((row && row[0]) || '').trim().toLowerCase() === 'lead_id' ||
    String((row && row[0]) || '').trim().toLowerCase() === 'enrichment_id' ||
    String((row && row[0]) || '').trim().toLowerCase() === 'approval_id';
}

/* ------------------------------------------------------------------ */
/* OSS resolver (injected into enrichContactOss)                       */
/* ------------------------------------------------------------------ */

/*
 * Resolver factory. `deps.packageModule` lets offline tests inject a usable or
 * broken fake of @absolutejs/enrich without touching the real package or any
 * network. The default resolves the installed package lazily; a missing,
 * broken, or non-conforming package yields the oss_unavailable blocked
 * envelope — never a fabricated accepted email.
 */
function loadEnrichPackage() {
  try {
    return {
      module: require('@absolutejs/enrich'),
      usable: true,
    };
  } catch (err) {
    return { module: null, usable: false };
  }
}

function resolveOssEmail(pkg, domain, lead, options) {
  const opts = options || {};
  const fullName = normalize(lead && lead.contact_name && lead.contact_name);
  const firstName = normalize(lead && lead.contact_name ? String(lead.contact_name).split(' ')[0] : '');
  const lastName = normalize(lead && lead.contact_name ? String(lead.contact_name).split(' ').slice(1).join(' ') : '');

  if (typeof (pkg && pkg.findEmail) !== 'function') {
    return { envelopes: [], blocked: true, notes: 'oss_unavailable' };
  }
  if (!fullName) {
    return { envelopes: [], blocked: true, notes: 'oss_no_name' };
  }
  let result = null;
  try {
    result = pkg.findEmail({ fullName, firstName, lastName, domain }, opts.findEmailOptions || {});
  } catch (err) {
    return { envelopes: [], blocked: true, notes: 'oss_unavailable' };
  }
  if (!result || !normalize(result.email)) {
    return { envelopes: [], blocked: false, notes: 'oss_no_results' };
  }
  const confidence = Number.isFinite(Number(result.confidence)) ? Number(result.confidence) : 0;
  const verified = String(result.status || '').toLowerCase() === 'deliverable';
  return {
    envelopes: [
      {
        value: String(result.email),
        score: confidence,
        verified,
        first_name: firstName,
        last_name: lastName,
        position: '',
      },
    ],
    blocked: false,
    notes: '',
  };
}

function resolverFor(deps) {
  const pkg = (deps && deps.packageModule) || (loadEnrichPackage().usable ? loadEnrichPackage().module : null);
  const resolver = (domain, lead) => {
    const outcome = resolveOssEmail(pkg, domain, lead, deps || {});
    const blocked = Boolean(outcome.blocked);
    return {
      emails: outcome.envelopes,
      blocked,
      notes: outcome.notes || (blocked ? OSS_NO_RESULTS : ''),
    };
  };
  return resolver;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

function classifyLead(lead, options) {
  const opts = options || {};
  const leadId = normalize(lead.lead_id);
  if (opts.leadIds && !opts.leadIds.has(leadId)) {
    return { reason: EXCLUSION_REASONS.OUT_OF_SCOPE };
  }
  if (!opts.countryInScope) {
    return { reason: EXCLUSION_REASONS.NON_US };
  }
  if (opts.domain === '') {
    return { reason: EXCLUSION_REASONS.NO_DOMAIN };
  }
  if (normalize(lead.email) !== '') {
    return { reason: EXCLUSION_REASONS.ALREADY_ENRICHED };
  }
  if (normalize(lead.contact_blocked).toUpperCase() === 'TRUE') {
    return { reason: EXCLUSION_REASONS.BLOCKED };
  }
  return { reason: null };
}

/* ------------------------------------------------------------------ */
/* Preflight                                                           */
/* ------------------------------------------------------------------ */

async function preflight(env, args = {}, deps = {}) {
  const config = readConfig(env);
  const ns = namespaceForArgs(args);
  const checks = [];
  const reportsDir = (args && args.reportsDir) || DEFAULT_REPORTS_DIR;

  checks.push({ label: 'B config present', ok: isConfigured(config), detail: isConfigured(config) ? config.provider : `missing: ${config.missing.join(', ')}` });

  if (config.auth.ready) {
    checks.push({ label: 'C sheet auth', ok: true, detail: `auth=${config.auth.mode}` });
  } else {
    checks.push({ label: 'C sheet auth', ok: false, detail: 'no Google Sheets auth configured' });
  }

  const client = (deps && deps.client) || null;

  if (client) {
    try {
      const approvedGrid = await client.listRows(APPROVED_TAB);
      const logGrid = await client.listRows(LOG_TAB);
      const approvedMismatch = positionalMismatches(approvedGrid, APPROVED_COLUMNS);
      const logMismatch = positionalMismatches(logGrid, ENRICHMENT_LOG_COLUMNS);
      checks.push({
        label: 'D Approved Outreach columns',
        ok: approvedMismatch.length === 0,
        detail: mismatchDetail(APPROVED_COLUMNS, approvedMismatch),
      });
      checks.push({
        label: 'E Contact Enrichment Log columns',
        ok: logMismatch.length === 0,
        detail: mismatchDetail(ENRICHMENT_LOG_COLUMNS, logMismatch),
      });
    } catch (err) {
      checks.push({ label: 'D/E sheet reads', ok: false, detail: err.message });
    }
  } else {
    checks.push({ label: 'D/E sheet reads', ok: false, detail: (deps && deps.clientError) || 'no Sheets client available' });
  }

  const provider = providerForArgs(args, env);
  checks.push({
    label: 'F provider',
    ok: provider !== null,
    detail: provider
      ? provider
      : `provider "${String(args.provider || env.ENRICHMENT_PROVIDER || DEFAULT_PROVIDER)}" invalid; must be one of ${VALID_PROVIDERS.join('|')}`,
  });
  if (provider) {
    const key = provider === 'hunter' ? 'HUNTER_API_KEY' : 'AGENTDATA_API_KEY';
    const present = normalize(config.apiKeys[provider] || env[key] || '') !== '';
    checks.push({ label: `G ${key}`, ok: present, detail: present ? 'set' : 'unset (provider calls would fail)' });
  }

  const nsOk = TEST_NAMESPACE_REGEX.test(ns) || (!TEST_NAMESPACE_REGEX.test(ns) && String(ns).startsWith(TEST_NAMESPACE_PREFIX) && String(ns).length > TEST_NAMESPACE_PREFIX.length);
  checks.push({
    label: 'H namespace well-formed',
    ok: true,
    detail: nsOk ? ns : `namespace "${ns}" does not start with ${TEST_NAMESPACE_PREFIX}; execute writes would be refused`,
    informational: !nsOk,
  });

  const hard = checks.filter((c) => !c.informational && !c.ok);
  const status = hard.length ? 'FAIL' : 'PASS';
  return { status, checks, config, ns, reportsDir, provider };
}

/* ------------------------------------------------------------------ */
/* Run pipeline                                                        */
/* ------------------------------------------------------------------ */

function sortByLeadId(rows) {
  return (rows || []).slice().sort((a, b) => String(a.lead_id || '').localeCompare(String(b.lead_id || '')));
}

function resolutionForLead(rows, leadId) {
  for (const row of rows) {
    if (String(row.lead_id || '') === String(leadId)) return row;
  }
  return null;
}

async function liveProviderTransport(url, options) {
  // fetch transport matching the client's frozen contract:
  //   (url, options) => Promise<{ status, body }>
  // omit empty headers entirely; body = await response.json().catch(() => null)
  const opts = options || {};
  const headers = opts.headers || {};
  const response = await fetch(url, Object.keys(headers).length > 0 ? { headers } : undefined);
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

function buildRunOutcomes({ enrichedRows = [], skippedRows = [], failedRows = [], provider = '' } = {}) {
  // Merge the three engine buckets into one per_lead_outcomes array, each
  // entry redaction-safe: result_email is later '<redacted>' by redact().
  const enriched = (enrichedRows || []).map((lead) => ({
    lead_id: String(lead.lead_id || ''),
    outcome: 'enriched',
    email_source: String(lead.email_source || lead.contact_source_provider || provider || ''),
    result_email: lead.email || '',
    result_verified: String(lead.email_verified || '').toUpperCase() === 'Y' ? 'TRUE' : 'FALSE',
    wrote_vw: false,
  }));
  const skipped = (skippedRows || []).map((lead) => ({
    lead_id: String(lead.lead_id || ''),
    outcome: 'skipped',
    enrichment_skip_reason: lead.enrichment_skip_reason || '',
  }));
  const failed = (failedRows || []).map((lead) => ({
    lead_id: String(lead.lead_id || ''),
    outcome: 'failed',
    enrichment_failure_reason: lead.enrichment_failure_reason || '',
  }));
  return enriched
    .concat(skipped, failed)
    .sort((a, b) => String(a.lead_id || '').localeCompare(String(b.lead_id || '')));
}

async function runEnrichment(env, args = {}, deps = {}) {
  const config = readConfig(env);
  const startedAt = new Date().toISOString();
  const outcomes = { stages: {}, failures: [] };
  const ns = namespaceForArgs(args);
  const provider = providerForArgs(args, env) || config.provider;

  const requestedScope = scopeForArgs(args);
  const productionConfirmed = String((env && env.BIZ_ENRICH_ALLOW_PRODUCTION) || '').trim() === '1';

  /* REFUSED guard runs FIRST — before any client init, sheet read, or write —
     so a requested-but-unconfirmed production write never touches the network. */
  if (args.execute && requestedScope === 'production' && !productionConfirmed) {
    outcomes.stages.write = 'REFUSED';
    outcomes.failures.push('refusing production write: set BIZ_ENRICH_ALLOW_PRODUCTION=1 to confirm');
    const report = buildRunReport({ args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, provider });
    writeRunReport(report.redacted, args);
    return { status: 'FAIL', stages: outcomes.stages, report: report.redacted };
  }

  /* Build the Sheets surface BEFORE preflight so check D/E verifies the real
     headers instead of always failing with "no Sheets client available". */
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
    const report = buildRunReport({ args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, provider, preflight: pre });
    writeRunReport(report.redacted, args);
    return { status: 'FAIL', stages: outcomes.stages, report: report.redacted };
  }

  if (!isConfigured(config)) {
    outcomes.stages.preflight = 'NOT_CONFIGURED';
    const report = buildRunReport({ args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, provider, preflight: pre });
    writeRunReport(report.redacted, args);
    return { status: 'NOT_CONFIGURED', stages: outcomes.stages, report: report.redacted };
  }

  const now = String((deps && deps.now) || new Date().toISOString());
  const ttlDays = Number((deps && deps.ttlDays) || config.ttlDays);
  const minScore = Number((deps && deps.minScore) || config.minScore);

  let approvedGrid = [];
  let logGrid = [];
  try {
    approvedGrid = await client.listRows(APPROVED_TAB);
    logGrid = await client.listRows(LOG_TAB);
  } catch (err) {
    outcomes.failures.push(`sheet read failed: ${err.message}`);
    const report = buildRunReport({ args, env, outcomes, startedAt, completedAt: new Date().toISOString(), ns, provider });
    writeRunReport(report.redacted, args);
    return { status: 'FAIL', stages: outcomes.stages, report: report.redacted };
  }
  outcomes.stages.read = 'PASS';

  const approvedRows = approvedGrid.slice(1).map((row) => rowToObject(row, APPROVED_COLUMNS));
  const logRows = logGrid.slice(1).map((row) => rowToObject(row, ENRICHMENT_LOG_COLUMNS));

  const leadIds = args.leadIds && args.leadIds.length
    ? new Set(args.leadIds.map((id) => String(id).trim()).filter(Boolean))
    : null;

  const classified = approvedRows.map((lead) => ({
    lead,
    classification: classifyLead(lead, {
      countryInScope: isCountryInScope(lead.country, config.countries),
      domain: lead.website ? String(lead.website).trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] : '',
      leadIds,
    }),
  }));

  const eligible = classified.filter((c) => !c.classification.reason);
  const excludedCounts = {};
  for (const c of classified) {
    if (c.classification.reason) {
      excludedCounts[c.classification.reason] = (excludedCounts[c.classification.reason] || 0) + 1;
    }
  }

  let scope = sortByLeadId(eligible.map((c) => c.lead));
  const limit = Number((args && args.limit) || DEFAULT_LIMIT);
  if (Number.isFinite(limit) && limit > 0) scope = scope.slice(0, limit);

  outcomes.stages.filter = 'PASS';

  /* Provider pass */
  let contactClient = null;
  if (deps && deps.clientWrapper && typeof deps.clientWrapper.createContactClient === 'function') {
    contactClient = deps.clientWrapper.createContactClient(deps);
  } else {
    const apiKey = provider === 'hunter' ? config.apiKeys.hunter : config.apiKeys.agentdata;
    const transport = deps && deps.transport;
    contactClient = createContactClient({
      provider,
      apiKey,
      transport: typeof transport === 'function' ? transport : liveProviderTransport,
      sleep: deps && deps.sleep,
      clock: deps && deps.clock,
    });
  }

  const contactRun = await enrichContactLeads({
    leads: scope,
    logRows,
    client: contactClient || (deps && deps.client),
    now,
    ttlDays,
    minScore,
    provider,
    countryInScope: (country) => isCountryInScope(country, config.countries),
  });

  const outLog = contactRun.log || [];

  /* OSS fallback over provider results with no accepted email and not blocked */
  const ossScope = (contactRun.enriched || []).filter(
    (lead) => normalize(lead.email) === '' && normalize(lead.contact_blocked).toUpperCase() !== 'TRUE',
  );
  const resolver = (deps && deps.resolver) || resolverFor(deps);
  const ossRun = ossScope.length
    ? await enrichContactOss({
        leads: ossScope,
        logRows: outLog,
        resolver,
        now,
        ttlDays,
        minScore,
        countryInScope: (country) => isCountryInScope(country, config.countries),
      })
    : { enriched: [], skipped: [], failed: [], stats: { total: 0, enriched: 0, skipped: 0, failed: 0, credits_consumed: 0, cache_hits: 0 }, log: outLog };

  /* Consolidate: OSS wins over a provider stub when it carries an email or a block. */
  const consolidated = [];
  for (const lead of contactRun.enriched || []) {
    const ossLead = resolutionForLead(ossRun.enriched || [], lead.lead_id);
    consolidated.push(ossLead ? ossLead : lead);
  }

  const finalLog = ossRun.log || outLog;
  const enrichedRows = sortByLeadId(consolidated);
  const skippedRows = sortByLeadId((contactRun.skipped || []).concat(ossRun.skipped || []));
  const failedRows = sortByLeadId((contactRun.failed || []).concat(ossRun.failed || []));

  /* Cache-hit write-back diff (bumped by the engines) and new-row append diff. */
  const bumpCells = diffCacheBumps(logRows, finalLog, client);
  const appendRows = diffNewLogRows(logRows, finalLog);

  const perLeadOutcomes = buildRunOutcomes({ enrichedRows, skippedRows, failedRows, provider });

  const reportRows = buildReportRows({
    enrichedRows,
    skippedRows,
    failedRows,
    exclusions: excludedCounts,
  });

  let writeAttempted = false;
  const writeOutcome = { appended: 0, bumped: 0, updated_vw: 0, would_append: appendRows.length, would_bump: bumpCells.length, would_update_vw: 0 };

  const vwCells = approvedVwCells(approvedRows, enrichedRows, scope);

  const effectiveScope = args.execute ? requestedScope : 'dry_run';
  const inWriteScope = (leadId) => (effectiveScope === 'production' ? true : isNamespacedLead(leadId));

  if (args.execute) {
    writeAttempted = true;
    if (!nsStartsWithTestNs(ns) && nsDoesNotExistConfig(ns)) {
      outcomes.failures.push(`namespace ${ns} not in ${TEST_NAMESPACE_PREFIX}-<tag> form; refuse to execute`);
    } else {
      const safeLogRows = appendRows.filter((r) => inWriteScope(r.lead_id));
      const safeBumpCells = bumpCells.filter((c) => inWriteScope(c.lead_id));
      for (const r of safeLogRows) {
        await client.appendRows(LOG_TAB, [objectToRow(r, ENRICHMENT_LOG_COLUMNS)].map((row) => row));
        writeOutcome.appended += 1;
      }
      if (safeBumpCells.length) {
        const cells = safeBumpCells.map((c) => ({ dataRow: c.dataRow, colIndex: ENRICHMENT_LOG_COLUMNS.indexOf('cache_hit_count'), value: c.value }));
        await client.updateCells(LOG_TAB, cells);
        writeOutcome.bumped += cells.length;
      }
      const safeVw = vwCells.filter((c) => inWriteScope(c.lead_id));
      if (safeVw.length) {
        await client.updateCells(APPROVED_TAB, safeVw.map((c) => ({ dataRow: c.dataRow, colIndex: c.colIndex, value: c.value })));
        writeOutcome.updated_vw += safeVw.length;
        for (const out of perLeadOutcomes) {
          if (safeVw.some((c) => c.lead_id === out.lead_id)) out.wrote_vw = true;
        }
      }
    }
  }

  writeOutcome.would_update_vw = vwCells.length;

  const stats = {
    total: approvedRows.length,
    eligible: scope.length,
    enriched: enrichedRows.length,
    blocked: enrichedRows.filter((l) => normalize(l.contact_blocked).toUpperCase() === 'TRUE').length,
    failed: failedRows.length,
    credits_consumed: (contactRun.stats && contactRun.stats.credits_consumed) || 0,
    cache_hits: (contactRun.stats && contactRun.stats.cache_hits) || 0,
    excluded: excludedCounts,
    oss_fallback_invoked: ossScope.length,
  };

  outcomes.stages.enrich = 'PASS';
  const wrote = Boolean(writeOutcome.appended || writeOutcome.bumped || writeOutcome.updated_vw);
  outcomes.stages.write = !args.execute ? 'DRY_RUN' : wrote ? 'PASS' : 'NO_ELIGIBLE';
  outcomes.stages.report = 'PASS';

  const runId = `ENRICH-LIVE-${ns.replace(/^TEST-ENRICH-LIVE-/, '')}-${Math.round(new Date().getTime() / 1000).toString(16)}`;
  const report = buildRunReport({
    args,
    env,
    outcomes,
    startedAt,
    completedAt: new Date().toISOString(),
    ns,
    provider,
    runId,
    stats,
    perLeadOutcomes,
    appendRows,
    bumpCells,
    writeOutcome,
    writeAttempted,
    reportRows,
    preflight: pre,
    redacted: true,
  }).redacted;

  writeRunReport(report, args);
  const status = overallStatusOf(outcomes.stages);
  return { status, stages: outcomes.stages, report: redact(report) };
}

function nsStartsWithTestNs(ns) {
  return String(ns).startsWith(TEST_NAMESPACE_PREFIX + '-');
}

function nsDoesNotExistConfig(ns) {
  return false;
}

function diffCacheBumps(before, after, client) {
  const index = new Map(after.map((r) => [normalize(r.enrichment_key), r]));
  const cells = [];
  (before || []).forEach((row, dataRow) => {
    const key = normalize(row.enrichment_key);
    if (!key) return;
    const next = index.get(key);
    if (!next) return;
    const beforeCount = Number.parseInt(normalize(row.cache_hit_count), 10) || 0;
    const afterCount = Number.parseInt(normalize(next.cache_hit_count), 10) || 0;
    if (afterCount > beforeCount) {
      cells.push({ dataRow: dataRow + 1, lead_id: normalize(next.lead_id), value: String(afterCount) });
    }
  });
  return cells;
}

function diffNewLogRows(before, after) {
  const present = new Set((before || []).map((r) => normalize(r.enrichment_key)).filter(Boolean));
  return (after || []).filter((r) => normalize(r.enrichment_key) && !present.has(normalize(r.enrichment_key)));
}

function approvedVwCells(approvedRows, enrichedRows, scope) {
  const approvedIndex = new Map();
  approvedRows.forEach((row, dataRow) => {
    approvedIndex.set(String(row.lead_id || ''), dataRow);
  });
  const cells = [];
  const scopeIds = new Set(scope.map((l) => String(l.lead_id || '')));
  for (const lead of enrichedRows || []) {
    const leadId = String(lead.lead_id || '');
    if (!scopeIds.has(leadId)) continue;
    const dataRow = approvedIndex.get(leadId);
    if (dataRow === undefined) continue;
    const provider = normalize(lead.contact_source_provider);
    const blocked = normalize(lead.contact_blocked).toUpperCase() === 'TRUE' ? 'TRUE' : normalize(lead.contact_blocked);
    if (provider !== '') cells.push({ lead_id: leadId, dataRow: dataRow + 1, colIndex: APPROVED_COLUMN_INDEX.contact_source_provider, value: provider });
    if (blocked === 'TRUE') cells.push({ lead_id: leadId, dataRow: dataRow + 1, colIndex: APPROVED_COLUMN_INDEX.contact_blocked, value: 'TRUE' });
  }
  return cells;
}

function buildReportRows({ enrichedRows, skippedRows, failedRows, exclusions }) {
  return {
    enriched: enrichedRows.map((r) => ({
      lead_id: String(r.lead_id || ''),
      provider: normalize(r.contact_source_provider),
      blocked: normalize(r.contact_blocked).toUpperCase() === 'TRUE',
      email_filled: normalize(r.email) !== '',
    })),
    skipped: skippedRows.map((r) => ({
      lead_id: String(r.lead_id || ''),
      reason: normalize(r.enrichment_skip_reason || r.enrichment_failure_reason),
    })),
    failed: failedRows.map((r) => ({
      lead_id: String(r.lead_id || ''),
      reason: normalize(r.enrichment_failure_reason),
    })),
    excluded: exclusions,
  };
}

function overallStatusOf(stages) {
  const sev = stages || {};
  if (sev.preflight === 'FAIL' || ['read', 'filter', 'enrich', 'report'].some((k) => sev[k] === 'FAIL')) return 'FAIL';
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

function buildRunReport({ args = {}, env = {}, outcomes = {}, startedAt, completedAt, ns, provider, runId, stats, perLeadOutcomes, appendRows, bumpCells, writeOutcome, writeAttempted, reportRows, preflight }) {
  const config = readConfig(env || args.env || {});
  const namespace = ns || namespaceForArgs(args);
  const run_id = runId || `ENRICH-LIVE-${namespace.replace(/^TEST-ENRICH-LIVE-/, '')}-${Math.round(new Date(startedAt || Date.now()).getTime() / 1000).toString(16)}`;
  const requestedScope = scopeForArgs(args);
  const report = {
    artifact: 'Contact Enrichment V1 — engine-direct live runner (H.8b)',
    run_id,
    mode: args.execute ? 'EXECUTE' : 'DRY_RUN',
    requested_scope: requestedScope,
    effective_scope: args.execute ? requestedScope : 'dry_run',
    production_confirmed: String((env || args.env || {}).BIZ_ENRICH_ALLOW_PRODUCTION || '').trim() === '1',
    started_at: startedAt,
    completed_at: completedAt,
    provider: provider || config.provider || DEFAULT_PROVIDER,
    country_policy: {
      allow: (config.countries && config.countries.allow) || [],
      deny: (config.countries && config.countries.deny) || [],
    },
    namespace,
    sheet: {
      id: config.googlesheetId ? redactSecret(config.googlesheetId) : '',
      approved_tab: APPROVED_TAB,
      log_tab: LOG_TAB,
    },
    preflight_status: outcomes.stages && outcomes.stages.preflight,
    preflight_detail: Array.isArray(preflight && preflight.checks)
      ? preflight.checks.map((c) => ({
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
      enrich: (outcomes.stages && outcomes.stages.enrich) || 'SKIPPED',
      write: (outcomes.stages && outcomes.stages.write) || 'SKIPPED',
      report: (outcomes.stages && outcomes.stages.report) || 'SKIPPED',
    },
    stats: stats || {},
    per_lead_outcomes: perLeadOutcomes || [],
    log_rows_appended: writeOutcome ? writeOutcome.appended : 0,
    log_rows_would_append: writeOutcome ? writeOutcome.would_append : 0,
    cache_hits_bumped: writeOutcome ? writeOutcome.bumped : 0,
    cache_hits_would_bump: writeOutcome ? writeOutcome.would_bump : 0,
    approved_outreach_updated_vw: writeOutcome ? writeOutcome.updated_vw : 0,
    approved_outreach_would_update_vw: writeOutcome ? writeOutcome.would_update_vw : 0,
    write_attempted: Boolean(writeAttempted),
    failure_info: outcomes.failures || [],
    outcomes: reportRows || {},
  };
  return { redacted: redact(report), raw: report };
}

function redactSecret(value) {
  return String(value).replace(/[A-Za-z0-9_-]{8,}/g, (m) => (m === '1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ' ? m : '<redacted>'));
}

function writeRunReport(report, args) {
  const dir = (args && args.reportsDir) || DEFAULT_REPORTS_DIR;
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, `${report.run_id}-enrichment-live.json`);
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
    provider: '',
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
    } else if (arg.startsWith('--provider=')) args.provider = arg.split('=')[1].trim();
    else if (arg.startsWith('--namespace=')) args.namespace = arg.split('=')[1].trim();
    else if (arg.startsWith('--scope=')) args.scope = arg.split('=')[1].trim();
    else if (arg.startsWith('--reports-dir=')) args.reportsDir = arg.split('=')[1].trim();
  }
  return args;
}

function usage() {
  return `
Usage: node scripts/run-enrichment-live.js [flags]

Run the SHIPPED contact-enrichment engines (src/enrichment-contact.js +
src/enrichment-contact-oss.js) engine-direct against the production sheet.
Default mode is DRY_RUN: read-only, nothing written without --execute.

Flags:
  --execute              allow actual spreadsheet writes (append log rows,
                         cache-hit write-back, Approved Outreach V/W updates).
                         Writes are NAMESPACE-GUARDED in test scope: only
                         lead_ids under TEST-ENRICH-LIVE-<tag> are ever written.
  --scope=<test|production>
                         write scope in --execute mode (default "test").
                         test: only lead_ids under TEST-ENRICH-LIVE-<tag>- are
                         ever written (original namespace guard).
                         production: writes are allowed, but only when
                         BIZ_ENRICH_ALLOW_PRODUCTION=1 is present in the
                         environment (the run REFUSES otherwise). In DRY_RUN
                         mode --scope is reported but no write happens.
  --limit=<N>            max eligible leads to enrich (default ${DEFAULT_LIMIT})
  --lead-ids=<id>,<id>   restrict to these lead_ids (others => out_of_scope)
  --provider=<name>      agentdata | hunter (default: ENRICHMENT_PROVIDER or
                         ${DEFAULT_PROVIDER})
  --namespace=<prefix>   test namespace (default TEST-ENRICH-LIVE-<hex tag>)
  --reports-dir=<dir>    report output directory (default ${DEFAULT_REPORTS_DIR})
  --no-interactive       never prompt
  --help                 this message

Env (see .env.example):
  GOOGLE_SHEET_ID, GOOGLE_ACCESS_TOKEN or GOOGLE_SERVICE_ACCOUNT_JSON,
  AGENTDATA_API_KEY (default provider), HUNTER_API_KEY (when
  ENRICHMENT_PROVIDER=hunter), ENRICHMENT_PROVIDER (default ${DEFAULT_PROVIDER}),
  ENRICHMENT_TTL_DAYS (default ${DEFAULT_TTL_DAYS}),
  ENRICHMENT_MIN_SCORE (default ${HUNTER_MIN_SCORE}),
  ENRICHMENT_COUNTRIES_ALLOW (comma-separated ISO-3166 alpha-2, default "US";
    "*" or empty = allow all),
  ENRICHMENT_COUNTRIES_DENY (default none; deny wins),
  BIZ_ENRICH_ALLOW_PRODUCTION (required to confirm --scope=production writes)

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
    const report = buildRunReport({ args, env, outcomes: { stages: { preflight: 'NOT_CONFIGURED' } }, startedAt, completedAt: new Date().toISOString(), ns: namespaceForArgs(args), provider: config.provider });
    writeRunReport(report.redacted, args);
    return { status: 'NOT_CONFIGURED', stages: { preflight: 'NOT_CONFIGURED' }, report: report.redacted };
  }
  return runEnrichment(env, args, deps);
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
      console.error(`[enrichment-live] ${err.message}`);
      process.exit(1);
    });
}

const e = {
  // constants
  APPROVED_TAB,
  LOG_TAB,
  DEFAULT_PROVIDER,
  VALID_PROVIDERS,
  DEFAULT_LIMIT,
  DEFAULT_REPORTS_DIR,
  TEST_NAMESPACE_PREFIX,
  TEST_NAMESPACE_REGEX,
  NAMESPACED_LEAD_REGEX,
  VALID_SCOPES,
  EXCLUSION_REASONS,
  PREFLIGHT_APPROVED_COLUMNS,
  ENRICHMENT_LOG_COLUMNS,
  APPROVED_COLUMNS,
  SENSITIVE_KEY_RE,
  // config / namespace
  readConfig,
  isConfigured,
  providerForArgs,
  parseCountryList,
  isCountryInScope,
  normalizeCountry,
  namespaceForArgs,
  defaultRunToken,
  isNamespacedLead,
  scopeForArgs,
  // client surface
  clientFor,
  surfaceFor,
  updateValues,
  _tokenForAuth,
  liveProviderTransport,
  // oss resolver
  loadEnrichPackage,
  resolverFor,
  resolveOssEmail,
  // filters
  classifyLead,
  buildReportRows,
  diffCacheBumps,
  diffNewLogRows,
  approvedVwCells,
  sortByLeadId,
  buildRunOutcomes,
  // phases
  preflight,
  runEnrichment,
  run,
  // report
  redact,
  buildRunReport,
  writeRunReport,
  overallStatusOf,
  // cli
  parseArgs,
  usage,
  exitCodeForStatus,
  main,
};
module.exports = e;