'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { PROSPECT_FIELDS, newProspect } = require('./prospect-model');
const { normalizeDomain, normalizePhone, normalizeName } = require('./lib/normalize');

function parseCsvRow(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

// Parse the full CSV text into an array of cell-arrays. Unlike parsing one
// physical line at a time, this tokenizer respects quoted fields that contain
// embedded commas, quotes, and NEWLINES, so multi-line research notes survive a
// round-trip. Preserves blank cells and quoted newlines within a field.
function parseCsvText(text) {
  const records = [];
  let record = [];
  let cur = '';
  let inQ = false;
  const s = text.replace(/\r\n/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else {
        cur += ch; // includes '\n' embedded inside a quoted field
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      record.push(cur); cur = '';
    } else if (ch === '\n') {
      record.push(cur); cur = '';
      records.push(record); record = [];
    } else {
      cur += ch;
    }
  }
  record.push(cur);
  records.push(record);
  // Drop trailing all-empty records (e.g. final newline).
  while (records.length && records[records.length - 1].every((c) => c.trim() === '')) {
    records.pop();
  }
  return records;
}

function encodeCsvCell(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function loadCsv(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseCsvText(raw);
  if (parsed.length === 0) return [];
  const header = parsed[0].map((c) => c.trim());
  const rows = [];
  for (let i = 1; i < parsed.length; i++) {
    const cells = parsed[i];
    const rec = {};
    header.forEach((h, idx) => { rec[h] = cells[idx] != null ? cells[idx].trim() : ''; });
    rows.push(rec);
  }
  return rows;
}

function saveCsv(filePath, rows) {
  const header = PROSPECT_FIELDS;
  const lines = [header.map(encodeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(header.map((h) => encodeCsvCell(r[h] != null ? r[h] : '')).join(','));
  }
  const content = lines.join('\n') + '\n';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  // Atomic replace: write to a temp file in the same directory, then rename over
  // the target. A failed write therefore never leaves a partially-corrupted store.
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.prospects.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, filePath);
}

function asProspectRecord(row) {
  const rec = newProspect();
  for (const f of PROSPECT_FIELDS) {
    if (row[f] != null && row[f] !== '') {
      if (f === 'suppressed' || f === 'opt_out' || f === 'qualified_for_demo' || f === 'ambiguous') {
        rec[f] = String(row[f]) === 'TRUE' || String(row[f]) === 'true' ? true : false;
      } else if (f === 'opportunity_score' || f === 'outreach_attempts') {
        rec[f] = Number(row[f]) || 0;
      } else {
        rec[f] = String(row[f]);
      }
    }
  }
  return rec;
}

// Deterministic persisted-identity key. Used ONLY as an idempotency detector for
// "did I already persist a record for this exact import identity" — it is not a
// replacement for the fuzzy dedupe logic in lib/dedupe.js (which decides whether
// two differently-sourced records describe the same business).
function identityKey(record) {
  const name = normalizeName(record.business_name || '');
  const state = String(record.state || '').trim().toUpperCase();
  const city = String(record.city || '').trim().toLowerCase();
  const domain = normalizeDomain(record.website || record.domain || '');
  const phone = normalizePhone(record.phone || '');
  return [name, state, city, domain, phone].filter((p) => p !== '').join('|');
}

function loadProspects(filePath) {
  return loadCsv(filePath).map(asProspectRecord);
}

function listProspects(filePath) {
  return loadProspects(filePath);
}

function getProspect(filePath, id) {
  return loadProspects(filePath).find((r) => r.prospect_id === id) || null;
}

function findByIdentity(filePath, record) {
  const key = identityKey(record);
  if (!key) return null;
  return loadProspects(filePath).find((r) => identityKey(r) === key) || null;
}

function createProspect(filePath, record) {
  const rows = loadProspects(filePath);
  rows.push(record);
  saveCsv(filePath, rows);
  return record;
}

function updateProspect(filePath, record) {
  const rows = loadProspects(filePath);
  const idx = rows.findIndex((r) => r.prospect_id === record.prospect_id);
  if (idx === -1) return null;
  rows[idx] = record;
  saveCsv(filePath, rows);
  return record;
}

// Persist a batch of processed prospect records idempotently.
//   records - the distinct, non-invalid prospect records produced by processBatch
//   opts.file - output CSV path (default data/prospects.csv)
// Returns reconciled counts. Never silently overwrites an existing prospect.
// Idempotency: a record whose normalized identity already exists in the store is
// counted as skipped (duplicate on re-import) and is NOT written again.
function persistBatch(records, opts) {
  const filePath = (opts && opts.file) || path.join(__dirname, '..', 'data', 'prospects.csv');
  const existingRows = loadProspects(filePath);
  const existingByKey = new Map();
  for (const r of existingRows) {
    const k = identityKey(r);
    if (k) existingByKey.set(k, r);
  }

  const persisted = [];
  const duplicates = [];
  const invalidSkipped = [];
  const written = existingRows.slice();

  for (const rec of records || []) {
    if (!rec || !rec.business_name || !String(rec.business_name).trim()) {
      invalidSkipped.push(rec);
      continue;
    }
    const key = identityKey(rec);
    if (key && existingByKey.has(key)) {
      duplicates.push({ record: rec, matched: existingByKey.get(key), matched_id: existingByKey.get(key).prospect_id });
      continue;
    }
    // Force an id if the batch layer did not assign one, then register.
    if (!rec.prospect_id) rec.prospect_id = genProspectId();
    if (key) existingByKey.set(key, rec);
    written.push(rec);
    persisted.push(rec);
  }

  saveCsv(filePath, written);
  return { persisted, duplicates, invalidSkipped, total: written.length };
}

function genProspectId(now) {
  const ts = now || Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `pros_${ts}_${rand}`;
}

module.exports = {
  loadCsv,
  saveCsv,
  asProspectRecord,
  parseCsvRow,
  encodeCsvCell,
  PROSPECT_FIELDS,
  identityKey,
  loadProspects,
  listProspects,
  getProspect,
  findByIdentity,
  createProspect,
  updateProspect,
  persistBatch,
};
