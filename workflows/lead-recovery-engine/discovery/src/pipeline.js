'use strict';

const { newProspect } = require('./prospect-model');
const { sanitizeProspect } = require('./lib/validate');
const { normalizeDomain, normalizePhone, normalizeEmail } = require('./lib/normalize');
const { matchAgainstKnown } = require('./lib/dedupe');
const { score } = require('./lib/score');
const { classify } = require('./lib/evidence');
const { suppress } = require('./lib/suppress');

function genId(prefix, now) {
  const ts = now || Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}_${rand}`;
}

function buildProspect(input, opts) {
  const sanitized = sanitizeProspect(input);
  if (!sanitized.ok) {
    return { ok: false, error: sanitized.error };
  }
  const v = sanitized.value;
  if (!v.business_name) {
    return { ok: false, error: 'missing_business_name' };
  }

  const rec = newProspect();
  const now = opts && opts.now ? opts.now : new Date().toISOString();
  Object.assign(rec, v);
  rec.prospect_id = v.prospect_id || genId('pros', now);
  rec.domain = normalizeDomain(v.website || v.domain);
  rec.phone = normalizePhone(v.phone);
  rec.public_email = normalizeEmail(v.public_email);
  rec.created_at = now;
  rec.updated_at = now;
  return { ok: true, value: rec };
}

function ingestProspect(record, known, opts) {
  const build = buildProspect(record, opts);
  if (!build.ok) return build;

  const rec = build.value;
  const match = matchAgainstKnown(rec, known);

  if (match.duplicate) {
    if (match.ambiguous) {
      rec.research_status = 'needs_review';
      return {
        ok: true,
        value: rec,
        duplicate: true,
        ambiguous: true,
        matched_prospect_id: match.existing.prospect_id,
        reason: match.reason,
      };
    }
    if (match.existing) {
      if (opts && opts.matchPolicy === 'return_existing') {
        return { ok: true, value: match.existing, duplicate: true, matched: true, reason: match.reason };
      }
      return {
        ok: true,
        value: rec,
        duplicate: true,
        matched_prospect_id: match.existing.prospect_id,
        reason: match.reason,
      };
    }
  }

  rec.research_status = 'discovered';
  return { ok: true, value: rec, duplicate: false };
}

function assessOpportunity(record, flags, evidence, opts) {
  const ev = classify(evidence);
  const result = score(record, flags, evidence);
  record.opportunity_score = result.score;
  record.opportunity_score_reason = result.reason;
  record.recovery_signal_strength = result.strength;
  record.evidence_class = ev.cls;
  record.recovery_signal_evidence = (evidence && evidence.text) || '';
  if (opts && opts.status) record.research_status = opts.status;
  return { ok: true, value: record, ...result };
}

function applySuppress(record, reason, opts) {
  return suppress(record, reason, opts && opts.now);
}

module.exports = {
  genId,
  buildProspect,
  ingestProspect,
  assessOpportunity,
  applySuppress,
};
