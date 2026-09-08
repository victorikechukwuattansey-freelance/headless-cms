'use strict';

const { RESEARCH_STATUSES } = require('../prospect-model');
const { isSuppressed } = require('./suppress');

const VALID = new Set(RESEARCH_STATUSES);

const TRANSITIONS = {
  discovered: ['researching', 'needs_review', 'suppressed'],
  researching: ['researched', 'needs_review', 'suppressed'],
  researched: ['needs_review', 'approved', 'suppressed'],
  needs_review: ['approved', 'suppressed'],
  approved: ['outreach_ready', 'suppressed'],
  outreach_ready: ['contacted', 'replied', 'qualified', 'suppressed', 'needs_review'],
  contacted: ['replied', 'qualified', 'outreach_ready', 'suppressed'],
  replied: ['qualified', 'outreach_ready', 'suppressed'],
  qualified: ['client', 'outreach_ready', 'suppressed'],
  client: ['suppressed'],
  suppressed: [],
};

function canTransition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function transition(record, to, opts) {
  const from = record.research_status;
  if (!VALID.has(to)) {
    throw new Error(`invalid_status:${to}`);
  }
  if (isSuppressed(record) && from !== 'suppressed') {
    throw new Error('suppressed_prospect_cannot_transition');
  }
  if (from === 'suppressed' && to !== 'suppressed') {
    throw new Error('suppressed_is_terminal');
  }
  if (!canTransition(from, to)) {
    throw new Error(`invalid_transition:${from}->${to}`);
  }
  record.research_status = to;
  if (opts && opts.notes != null) record.research_notes = opts.notes;
  record.updated_at = (opts && opts.now) || new Date().toISOString();
  return record;
}

module.exports = {
  RESEARCH_STATUSES,
  canTransition,
  transition,
  TRANSITIONS,
};
