'use strict';

const { isSuppressed } = require('./suppress');

const OUTREACH_TRANSITIONS = {
  not_ready: ['queued', 'suppressed'],
  queued: ['prepared', 'suppressed'],
  prepared: ['contacted', 'suppressed'],
  contacted: ['replied', 'follow_up_due', 'qualified', 'suppressed', 'lost'],
  follow_up_due: ['contacted', 'suppressed', 'lost'],
  replied: ['qualified', 'demo', 'suppressed', 'lost'],
  qualified: ['demo', 'suppressed', 'lost'],
  demo: ['pilot', 'won', 'lost', 'suppressed'],
  pilot: ['won', 'lost', 'suppressed'],
  won: ['suppressed'],
  lost: ['suppressed'],
  suppressed: [],
};

const OUTREACH_STATUS_SET = new Set([
  'not_ready', 'queued', 'prepared', 'contacted', 'follow_up_due',
  'replied', 'qualified', 'demo', 'pilot', 'won', 'lost', 'suppressed',
]);

function canOutreachTransition(from, to) {
  const allowed = OUTREACH_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

function outreachTransition(record, to, opts) {
  const from = record.outreach_status;
  if (!OUTREACH_STATUS_SET.has(to)) {
    throw new Error(`invalid_outreach_status:${to}`);
  }
  if (isSuppressed(record) && from !== 'suppressed') {
    throw new Error('suppressed_prospect_cannot_transition');
  }
  if (from === 'suppressed' && to !== 'suppressed') {
    throw new Error('suppressed_is_terminal');
  }
  if (!canOutreachTransition(from, to)) {
    throw new Error(`invalid_outreach_transition:${from}->${to}`);
  }
  record.outreach_status = to;
  record.updated_at = (opts && opts.now) || new Date().toISOString();
  return record;
}

module.exports = {
  OUTREACH_TRANSITIONS,
  OUTREACH_STATUSES: OUTREACH_STATUS_SET,
  canOutreachTransition,
  outreachTransition,
};
