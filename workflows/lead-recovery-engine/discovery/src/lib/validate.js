'use strict';

const { SOURCE_TYPES } = require('../prospect-model');

const SOURCE_SET = new Set(SOURCE_TYPES);

function cleanString(value, maxLen, fallback) {
  if (value == null) return fallback || '';
  const s = String(value).trim();
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

function isUsState(value) {
  return /^[A-Za-z]{2}$/.test(String(value || '')) && String(value).toUpperCase() !== 'US';
}

function sanitizeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeSource(value) {
  const s = String(value || '').trim().toLowerCase();
  if (SOURCE_SET.has(s)) return s;
  return 'operator_entered';
}

function normalizeEvidenceClass(value) {
  const allowed = ['OBSERVED', 'INFERRED', 'CLIENT_PROVIDED', 'VERIFIED', 'UNKNOWN'];
  const upper = String(value || '').toUpperCase();
  return allowed.includes(upper) ? upper : 'UNKNOWN';
}

function sanitizeProspect(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'not_an_object' };
  }
  const out = {};
  out.prospect_id = cleanString(input.prospect_id, 80);
  out.business_name = cleanString(input.business_name, 200);
  out.website = cleanString(input.website, 300);
  out.industry = cleanString(input.industry, 120);
  out.city = cleanString(input.city, 120);
  out.state = cleanString(input.state, 3);
  out.country = cleanString(input.country, 3, 'US');
  out.phone = cleanString(input.phone, 40);
  out.public_email = cleanString(input.public_email, 200);
  out.contact_name = cleanString(input.contact_name, 200);
  out.source = normalizeSource(input.source);
  out.source_url = cleanString(input.source_url, 500);
  out.recovery_signal = cleanString(input.recovery_signal, 500);
  out.recovery_signal_strength = cleanString(input.recovery_signal_strength, 20);
  out.recovery_signal_evidence = cleanString(input.recovery_signal_evidence, 1000);
  out.evidence_class = normalizeEvidenceClass(input.evidence_class);
  out.research_notes = cleanString(input.research_notes, 2000);
  return { ok: true, value: out };
}

module.exports = {
  cleanString,
  isUsState,
  sanitizeHtml,
  normalizeSource,
  normalizeEvidenceClass,
  sanitizeProspect,
  SOURCE_SET,
};
