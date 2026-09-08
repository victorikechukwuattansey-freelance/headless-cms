'use strict';

const path = require('path');
const { outreachTransition } = require('./lib/outreach-states');
const { isSuppressed } = require('./lib/suppress');
const { complianceGate } = require('./lib/compliance');
const { loadActivities, saveActivities, asActivityRecord } = require('./outreach-store');
const { genOutreachId, newActivity } = require('./outreach-model');

function queueProspect(record, opts) {
  if (isSuppressed(record)) {
    return { ok: false, error: 'suppressed' };
  }
  if (record.outreach_status && record.outreach_status !== 'not_ready' && record.outreach_status !== '') {
    return { ok: false, error: `already_in_status:${record.outreach_status}` };
  }
  const gate = complianceGate(record);
  if (!gate.ok) return gate;
  // Contact policy gate: unknown/'', blocked, opted_out all block.
  // Only explicit 'permitted' is allowed through.
  const policy = record.contact_policy === 'permitted' ? 'permitted' : 'unknown';
  if (policy !== 'permitted') {
    return { ok: false, error: 'contact_policy_not_permitted', reason: `contact policy is ${policy}, not permitted` };
  }
  const now = (opts && opts.now) || new Date().toISOString();
  record.outreach_status = 'queued';
  record.updated_at = now;
  record.outreach_attempts = (record.outreach_attempts || 0);
  return { ok: true, value: record };
}

function prepareDraft(record, activityRows, opts) {
  const gate = complianceGate(record);
  if (!gate.ok) return gate;
  // Contact policy gate: unknown/'', blocked, opted_out all block.
  // Only explicit 'permitted' is allowed through.
  const policy = record.contact_policy === 'permitted' ? 'permitted' : 'unknown';
  if (policy !== 'permitted') {
    return { ok: false, error: 'contact_policy_not_permitted', reason: `contact policy is ${policy}, not permitted` };
  }
  const now = (opts && opts.now) || new Date().toISOString();
  const channel = (opts && opts.channel) || 'email';
  const activity = newActivity();
  activity.outreach_id = genOutreachId(now);
  activity.prospect_id = record.prospect_id;
  activity.channel = channel;
  activity.contact_method = record.public_email || record.phone || record.contact_name || '';
  activity.prepared_at = now;
  activity.status = 'draft';
  activity.operator = (opts && opts.operator) || '';
  activity.message_reference = (opts && opts.messageRef) || '';
  activity.created_at = now;
  activity.updated_at = now;
  return { ok: true, value: record, activity };
}

function sendOutreach(record, activity, opts) {
  const gate = complianceGate(record);
  if (!gate.ok) return gate;
  // Contact policy gate: unknown/'', blocked, opted_out all block.
  // Only explicit 'permitted' is allowed through.
  const policy = record.contact_policy === 'permitted' ? 'permitted' : 'unknown';
  if (policy !== 'permitted') {
    return { ok: false, error: 'contact_policy_not_permitted', reason: `contact policy is ${policy}, not permitted` };
  }
  if (activity.status !== 'draft') {
    return { ok: false, error: `activity_already_sent:${activity.status}` };
  }
  const now = (opts && opts.now) || new Date().toISOString();
  activity.status = 'sent';
  activity.sent_at = now;
  activity.updated_at = now;
  record.outreach_status = 'contacted';
  record.outreach_attempts = (record.outreach_attempts || 0) + 1;
  record.last_outreach_at = now;
  record.updated_at = now;
  return { ok: true, value: record, activity };
}

function recordResponse(activity, responseType, notes, opts) {
  const now = (opts && opts.now) || new Date().toISOString();
  activity.response_at = now;
  activity.response_type = responseType || 'no_response';
  activity.response_notes = notes || '';
  activity.updated_at = now;
  return { ok: true, value: activity };
}

function getQueue(prospectRows, statusFilter) {
  const filter = statusFilter || ['queued', 'prepared', 'follow_up_due'];
  return prospectRows.filter((r) =>
    !isSuppressed(r) && filter.includes(r.outreach_status)
  );
}

function getActivitiesForProspect(activityRows, prospectId) {
  return activityRows.filter((a) => a.prospect_id === prospectId);
}

function loadActivityStore(filePath) {
  return loadActivities(filePath).map(asActivityRecord);
}

function saveActivityStore(filePath, rows) {
  return saveActivities(filePath, rows);
}

module.exports = {
  queueProspect,
  prepareDraft,
  sendOutreach,
  recordResponse,
  getQueue,
  getActivitiesForProspect,
  loadActivityStore,
  saveActivityStore,
};
