'use strict';

const OUTREACH_STATUSES = [
  'not_ready',
  'queued',
  'prepared',
  'contacted',
  'follow_up_due',
  'replied',
  'qualified',
  'demo',
  'pilot',
  'won',
  'lost',
  'suppressed',
];

const CHANNELS = ['email', 'phone', 'linkedin_manual', 'website_contact', 'other'];

const RESPONSE_TYPES = [
  'no_response',
  'interested',
  'not_interested',
  'question',
  'callback_requested',
  'qualified',
  'meeting_requested',
  'wrong_contact',
  'unsubscribe',
  'other',
];

const ACTIVITY_FIELDS = [
  'outreach_id',
  'prospect_id',
  'channel',
  'contact_method',
  'prepared_at',
  'sent_at',
  'operator',
  'message_reference',
  'status',
  'response_at',
  'response_type',
  'response_notes',
  'created_at',
  'updated_at',
];

function newActivity() {
  const now = new Date().toISOString();
  return {
    outreach_id: null,
    prospect_id: null,
    channel: '',
    contact_method: '',
    prepared_at: '',
    sent_at: '',
    operator: '',
    message_reference: '',
    status: 'draft',
    response_at: '',
    response_type: '',
    response_notes: '',
    created_at: now,
    updated_at: now,
  };
}

function genOutreachId(now) {
  const ts = now || Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `out_${ts}_${rand}`;
}

module.exports = {
  OUTREACH_STATUSES,
  CHANNELS,
  RESPONSE_TYPES,
  ACTIVITY_FIELDS,
  newActivity,
  genOutreachId,
};
