'use strict';

function suppress(record, reason, now) {
  const ts = (now || new Date().toISOString());
  record.suppressed = true;
  record.suppression_reason = reason || 'other';
  record.suppressed_at = ts;
  record.research_status = 'suppressed';
  record.outreach_status = '';
  record.updated_at = ts;
  return record;
}

function isSuppressed(record) {
  return Boolean(record.suppressed === true || record.suppressed === 'TRUE' || record.suppressed === 'true');
}

function canReachOutreachReady(record) {
  return !isSuppressed(record);
}

module.exports = {
  suppress,
  isSuppressed,
  canReachOutreachReady,
};
