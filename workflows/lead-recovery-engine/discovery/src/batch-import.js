'use strict';

const { newProspect } = require('./prospect-model');
const { normalizeDomain, normalizePhone, normalizeEmail } = require('./lib/normalize');
const { parseCsvRow } = require('./store');

function parseCsvBatch(csvText) {
  const lines = csvText.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length === 0) return [];
  const header = parseCsvRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]);
    const rec = {};
    header.forEach((h, idx) => { rec[h] = cells[idx] != null ? cells[idx] : ''; });
    rows.push(rec);
  }
  return rows;
}

function validateImportRecord(row, index) {
  const errors = [];
  if (!row.business_name || !row.business_name.trim()) {
    errors.push('missing_business_name');
  }
  if (row.website && row.website.trim()) {
    const w = row.website.trim();
    if (/^(javascript:|data:|file:)/i.test(w)) {
      errors.push('malformed_website');
    }
  }
  if (row.phone && row.phone.trim()) {
    const d = row.phone.replace(/\D/g, '');
    if (d.length > 0 && d.length !== 10 && d.length !== 11) {
      errors.push('malformed_phone');
    }
  }
  if (row.state && row.state.trim()) {
    const s = row.state.trim();
    if (s.length !== 2) {
      errors.push('malformed_state');
    }
  }
  const validSources = ['google_maps', 'business_directory', 'company_website', 'manual_linkedin_research', 'operator_entered'];
  if (row.source && row.source.trim()) {
    if (!validSources.includes(row.source.trim().toLowerCase())) {
      errors.push('invalid_source');
    }
  }
  return errors;
}

function normalizeImportRecord(row) {
  const rec = newProspect();
  rec.prospect_id = row.prospect_id || rec.prospect_id;
  rec.business_name = (row.business_name || '').trim();
  rec.website = (row.website || '').trim();
  rec.domain = normalizeDomain(row.website || '');
  rec.industry = (row.industry || '').trim();
  rec.city = (row.city || '').trim();
  rec.state = (row.state || '').trim().toUpperCase();
  rec.country = (row.country || 'US').trim().toUpperCase();
  rec.phone = normalizePhone(row.phone || '');
  rec.public_email = normalizeEmail(row.public_email || '');
  rec.contact_name = (row.contact_name || '').trim();
  rec.source = (row.source || 'operator_entered').trim().toLowerCase();
  rec.source_url = (row.source_url || '').trim();
  rec.research_status = 'discovered';
  return rec;
}

function batchImport(csvText) {
  const raw = parseCsvBatch(csvText);
  const valid = [];
  const invalid = [];
  for (let i = 0; i < raw.length; i++) {
    const errors = validateImportRecord(raw[i], i);
    if (errors.length > 0) {
      invalid.push({ index: i, record: raw[i], errors });
    } else {
      valid.push(normalizeImportRecord(raw[i]));
    }
  }
  return { valid, invalid, total: raw.length };
}

module.exports = {
  parseCsvBatch,
  validateImportRecord,
  normalizeImportRecord,
  batchImport,
};
