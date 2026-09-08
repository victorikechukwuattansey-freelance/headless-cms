'use strict';

const { outreachTransition } = require('./lib/outreach-states');
const { isSuppressed } = require('./lib/suppress');

const QUALIFICATION_THRESHOLDS = {
  min_score: 70,
  min_attempts: 1,
};

function qualifies(record, opts) {
  if (isSuppressed(record)) {
    return { ok: false, error: 'suppressed' };
  }
  const thresholds = (opts && opts.thresholds) || QUALIFICATION_THRESHOLDS;
  const score = record.opportunity_score || 0;
  const attempts = record.outreach_attempts || 0;
  const hasReply = record.outreach_status === 'replied';
  const meetsScore = score >= thresholds.min_score;
  const meetsAttempts = attempts >= thresholds.min_attempts;
  if (!meetsScore && !hasReply) {
    return { ok: false, error: 'below_threshold', score, attempts };
  }
  return { ok: true, score, attempts, hasReply };
}

function qualifyProspect(record, opts) {
  const check = qualifies(record, opts);
  if (!check.ok) return check;
  const now = (opts && opts.now) || new Date().toISOString();
  try {
    outreachTransition(record, 'qualified', { now });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  record.qualified_for_demo = true;
  record.updated_at = now;
  return { ok: true, value: record };
}

function markDemo(record, opts) {
  if (isSuppressed(record)) return { ok: false, error: 'suppressed' };
  const now = (opts && opts.now) || new Date().toISOString();
  try {
    outreachTransition(record, 'demo', { now });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return { ok: true, value: record };
}

function markPilot(record, opts) {
  if (isSuppressed(record)) return { ok: false, error: 'suppressed' };
  const now = (opts && opts.now) || new Date().toISOString();
  try {
    outreachTransition(record, 'pilot', { now });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  return { ok: true, value: record };
}

function markWon(record, opts) {
  if (isSuppressed(record)) return { ok: false, error: 'suppressed' };
  const now = (opts && opts.now) || new Date().toISOString();
  try {
    outreachTransition(record, 'won', { now });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  record.client_status = 'client';
  record.updated_at = now;
  return { ok: true, value: record };
}

function markLost(record, reason, opts) {
  if (isSuppressed(record)) return { ok: false, error: 'suppressed' };
  const now = (opts && opts.now) || new Date().toISOString();
  try {
    outreachTransition(record, 'lost', { now });
  } catch (e) {
    return { ok: false, error: e.message };
  }
  record.research_notes = (record.research_notes ? record.research_notes + ' | ' : '') +
    `LOST:${reason || 'unspecified'}`;
  record.updated_at = now;
  return { ok: true, value: record };
}

module.exports = {
  qualifies,
  qualifyProspect,
  markDemo,
  markPilot,
  markWon,
  markLost,
  QUALIFICATION_THRESHOLDS,
};
