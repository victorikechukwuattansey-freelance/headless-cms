'use strict';

const { isSuppressed } = require('./suppress');
const { CHANNELS } = require('../outreach-model');

const CHANNEL_SET = new Set(CHANNELS);

function hasContactMethod(record) {
  return Boolean(
    (record.phone && record.phone.trim()) ||
    (record.public_email && record.public_email.trim()) ||
    (record.contact_name && record.contact_name.trim())
  );
}

function complianceGate(record, opts) {
  if (isSuppressed(record)) {
    return { ok: false, error: 'suppressed', reason: record.suppression_reason || 'suppressed' };
  }
  if (record.opt_out === true || record.opt_out === 'TRUE' || record.opt_out === 'true') {
    return { ok: false, error: 'opt_out', reason: 'prospect has opted out' };
  }
  if (!hasContactMethod(record)) {
    return { ok: false, error: 'no_contact_method', reason: 'no phone, email, or contact name on record' };
  }
  if (opts && opts.channel && !CHANNEL_SET.has(opts.channel)) {
    return { ok: false, error: 'invalid_channel', reason: `channel '${opts.channel}' is not supported` };
  }
  return { ok: true };
}

module.exports = {
  complianceGate,
  hasContactMethod,
};
