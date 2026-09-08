'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildProspect } = require('../src/pipeline');
const { outreachTransition } = require('../src/lib/outreach-states');
const { isSuppressed, suppress } = require('../src/lib/suppress');
const { complianceGate, hasContactMethod } = require('../src/lib/compliance');
const {
  queueProspect, prepareDraft, sendOutreach, recordResponse,
  getQueue, getActivitiesForProspect,
  loadActivityStore, saveActivityStore,
} = require('../src/outreach-queue');
const { qualifies, qualifyProspect, markDemo, markPilot, markWon, markLost } = require('../src/qualification');
const { newActivity, genOutreachId } = require('../src/outreach-model');

function makeRec(fields) {
  return buildProspect({ business_name: 'Test Co', city: 'Austin', state: 'TX', ...fields }).value;
}

function outreachReadyRec(fields) {
  const rec = makeRec(fields);
  // contact_policy is an operator-set field, not an ingest input — set it
  // directly on the record (buildProspect/sanitizeProspect drops it).
  rec.contact_policy = (fields && fields.contact_policy) || '';
  rec.research_status = 'outreach_ready';
  rec.outreach_status = 'not_ready';
  return rec;
}

// ─── OUT-08: queueProspect ────────────────────────────────────────
test('OUT-08: queueProspect moves not_ready to queued', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'permitted' });
  const res = queueProspect(rec);
  assert.equal(res.ok, true);
  assert.equal(rec.outreach_status, 'queued');
});

test('OUT-08b: queueProspect blocks suppressed prospect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  suppress(rec, 'operator');
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'suppressed');
});

test('OUT-08c: queueProspect blocks prospect already in a status', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  rec.outreach_status = 'contacted';
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.ok(res.error.includes('already_in_status'));
});

test('OUT-08d: queueProspect blocks prospect with no contact method', () => {
  const rec = outreachReadyRec({});
  rec.public_email = '';
  rec.phone = '';
  rec.contact_name = '';
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'no_contact_method');
});

test('OUT-08e: queueProspect blocks opt-out prospect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  rec.opt_out = true;
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'opt_out');
});

// ─── OUT-09: prepareDraft ─────────────────────────────────────────
test('OUT-09: prepareDraft creates draft activity with correct fields', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'permitted', prospect_id: 'p-001' });
  const res = prepareDraft(rec, [], { channel: 'email', operator: 'op-1', now: '2026-08-31T10:00:00.000Z' });
  assert.equal(res.ok, true);
  const act = res.activity;
  assert.ok(act.outreach_id.startsWith('out_'));
  assert.equal(act.prospect_id, 'p-001');
  assert.equal(act.channel, 'email');
  assert.equal(act.contact_method, 'info@test.com');
  assert.equal(act.status, 'draft');
  assert.equal(act.prepared_at, '2026-08-31T10:00:00.000Z');
});

test('OUT-09b: prepareDraft defaults to email channel', () => {
  const rec = outreachReadyRec({ phone: '5125550199', contact_policy: 'permitted', prospect_id: 'p-002' });
  const res = prepareDraft(rec, []);
  assert.equal(res.ok, true);
  assert.equal(res.activity.channel, 'email');
});

test('OUT-09c: prepareDraft blocks suppressed prospect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  suppress(rec, 'operator');
  const res = prepareDraft(rec, []);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'suppressed');
});

// ─── OUT-10: sendOutreach ─────────────────────────────────────────
test('OUT-10: sendOutreach transitions draft to sent, updates prospect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', prospect_id: 'p-003', contact_policy: 'permitted' });
  const act = newActivity();
  act.outreach_id = 'out_test_001';
  act.prospect_id = 'p-003';
  act.status = 'draft';
  const res = sendOutreach(rec, act, { now: '2026-08-31T12:00:00.000Z' });
  assert.equal(res.ok, true);
  assert.equal(act.status, 'sent');
  assert.equal(act.sent_at, '2026-08-31T12:00:00.000Z');
  assert.equal(rec.outreach_status, 'contacted');
  assert.equal(rec.outreach_attempts, 1);
  assert.equal(rec.last_outreach_at, '2026-08-31T12:00:00.000Z');
});

test('OUT-10b: sendOutreach blocks already-sent activity', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'permitted' });
  const act = newActivity();
  act.status = 'sent';
  const res = sendOutreach(rec, act);
  assert.equal(res.ok, false);
  assert.ok(res.error.includes('already_sent'));
});

test('OUT-10c: sendOutreach increments attempts on each send', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'permitted' });
  rec.outreach_attempts = 3;
  const act = newActivity();
  act.status = 'draft';
  sendOutreach(rec, act, { now: '2026-09-01T10:00:00.000Z' });
  assert.equal(rec.outreach_attempts, 4);
});

test('OUT-10d: sendOutreach blocks suppressed prospect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  suppress(rec, 'operator');
  const act = newActivity();
  act.status = 'draft';
  const res = sendOutreach(rec, act);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'suppressed');
});

// ─── OUT-11: recordResponse ───────────────────────────────────────
test('OUT-11: recordResponse sets response fields on activity', () => {
  const act = newActivity();
  act.outreach_id = 'out_resp_001';
  const res = recordResponse(act, 'interested', 'Wants to schedule a call', { now: '2026-08-31T14:00:00.000Z' });
  assert.equal(res.ok, true);
  assert.equal(act.response_type, 'interested');
  assert.equal(act.response_notes, 'Wants to schedule a call');
  assert.equal(act.response_at, '2026-08-31T14:00:00.000Z');
});

test('OUT-11b: recordResponse defaults to no_response', () => {
  const act = newActivity();
  recordResponse(act, '', '', { now: '2026-08-31T15:00:00.000Z' });
  assert.equal(act.response_type, 'no_response');
});

// ─── OUT-12: getQueue ─────────────────────────────────────────────
test('OUT-12: getQueue returns only queued/prepared/follow_up_due prospects', () => {
  const rows = [
    outreachReadyRec({ prospect_id: 'p-a' }),
    outreachReadyRec({ prospect_id: 'p-b' }),
    outreachReadyRec({ prospect_id: 'p-c' }),
  ];
  rows[0].outreach_status = 'queued';
  rows[1].outreach_status = 'contacted';
  rows[2].outreach_status = 'follow_up_due';
  const q = getQueue(rows);
  assert.equal(q.length, 2);
  assert.ok(q.find((r) => r.prospect_id === 'p-a'));
  assert.ok(q.find((r) => r.prospect_id === 'p-c'));
});

test('OUT-12b: getQueue excludes suppressed', () => {
  const rows = [
    outreachReadyRec({ prospect_id: 'p-s' }),
  ];
  rows[0].outreach_status = 'queued';
  suppress(rows[0], 'operator');
  const q = getQueue(rows);
  assert.equal(q.length, 0);
});

// ─── OUT-13: getActivitiesForProspect ─────────────────────────────
test('OUT-13: getActivitiesForProspect filters by prospect_id', () => {
  const activities = [
    { outreach_id: 'a1', prospect_id: 'p-1' },
    { outreach_id: 'a2', prospect_id: 'p-2' },
    { outreach_id: 'a3', prospect_id: 'p-1' },
  ];
  const result = getActivitiesForProspect(activities, 'p-1');
  assert.equal(result.length, 2);
  assert.ok(result.every((a) => a.prospect_id === 'p-1'));
});

// ─── OUT-14: qualification ────────────────────────────────────────
test('OUT-14: qualifies returns ok when score >= 70', () => {
  const rec = outreachReadyRec({});
  rec.opportunity_score = 75;
  const res = qualifies(rec);
  assert.equal(res.ok, true);
});

test('OUT-14b: qualifies returns ok when replied regardless of score', () => {
  const rec = outreachReadyRec({});
  rec.opportunity_score = 20;
  rec.outreach_status = 'replied';
  const res = qualifies(rec);
  assert.equal(res.ok, true);
  assert.equal(res.hasReply, true);
});

test('OUT-14c: qualifies returns error when low score and no reply', () => {
  const rec = outreachReadyRec({});
  rec.opportunity_score = 30;
  rec.outreach_status = 'contacted';
  const res = qualifies(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'below_threshold');
});

test('OUT-14d: qualifies blocks suppressed', () => {
  const rec = outreachReadyRec({});
  suppress(rec, 'operator');
  const res = qualifies(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'suppressed');
});

// ─── OUT-15: qualifyProspect + markDemo + markPilot + markWon + markLost
test('OUT-15: qualifyProspect transitions to qualified and sets qualified_for_demo', () => {
  const rec = outreachReadyRec({});
  rec.outreach_status = 'replied';
  rec.opportunity_score = 80;
  const res = qualifyProspect(rec);
  assert.equal(res.ok, true);
  assert.equal(rec.outreach_status, 'qualified');
  assert.equal(rec.qualified_for_demo, true);
});

test('OUT-15b: markDemo transitions to demo', () => {
  const rec = outreachReadyRec({});
  rec.outreach_status = 'qualified';
  const res = markDemo(rec);
  assert.equal(res.ok, true);
  assert.equal(rec.outreach_status, 'demo');
});

test('OUT-15c: markPilot transitions to pilot', () => {
  const rec = outreachReadyRec({});
  rec.outreach_status = 'demo';
  const res = markPilot(rec);
  assert.equal(res.ok, true);
  assert.equal(rec.outreach_status, 'pilot');
});

test('OUT-15d: markWon transitions to won and sets client_status', () => {
  const rec = outreachReadyRec({});
  rec.outreach_status = 'pilot';
  const res = markWon(rec);
  assert.equal(res.ok, true);
  assert.equal(rec.outreach_status, 'won');
  assert.equal(rec.client_status, 'client');
});

test('OUT-15e: markLost transitions to lost and appends reason', () => {
  const rec = outreachReadyRec({});
  rec.outreach_status = 'contacted';
  const res = markLost(rec, 'budget');
  assert.equal(res.ok, true);
  assert.equal(rec.outreach_status, 'lost');
  assert.ok(rec.research_notes.includes('LOST:budget'));
});

test('OUT-15f: qualifyProspect blocks suppressed', () => {
  const rec = outreachReadyRec({});
  rec.outreach_status = 'replied';
  suppress(rec, 'operator');
  const res = qualifyProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'suppressed');
});

test('OUT-15g: markDemo blocks suppressed', () => {
  const rec = outreachReadyRec({});
  rec.outreach_status = 'qualified';
  suppress(rec, 'operator');
  const res = markDemo(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'suppressed');
});

// ─── Activity store round-trip ─────────────────────────────────────
test('OUT-STORE: activity store round-trips', () => {
  const file = path.join(os.tmpdir(), `lre-activity-${Date.now()}.csv`);
  const act = newActivity();
  act.outreach_id = 'out_rt_001';
  act.prospect_id = 'p-rt-001';
  act.channel = 'email';
  act.status = 'draft';
  saveActivityStore(file, [act]);
  const loaded = loadActivityStore(file);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].outreach_id, 'out_rt_001');
  assert.equal(loaded[0].channel, 'email');
  fs.rmSync(file, { force: true });
});

// ─── Compliance gate ───────────────────────────────────────────────
test('COMPLIANCE: no contact method blocks outreach', () => {
  const rec = outreachReadyRec({});
  rec.public_email = '';
  rec.phone = '';
  rec.contact_name = '';
  assert.equal(complianceGate(rec).ok, false);
});

test('COMPLIANCE: opt_out blocks outreach', () => {
  const rec = outreachReadyRec({ public_email: 'a@b.com' });
  rec.opt_out = true;
  assert.equal(complianceGate(rec).ok, false);
});

test('COMPLIANCE: valid email passes gate', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  assert.equal(complianceGate(rec).ok, true);
});

test('COMPLIANCE: valid phone passes gate', () => {
  const rec = outreachReadyRec({ phone: '5125550199' });
  assert.equal(complianceGate(rec).ok, true);
});

test('COMPLIANCE: invalid channel blocked', () => {
  const rec = outreachReadyRec({ public_email: 'a@b.com' });
  const res = complianceGate(rec, { channel: 'fax' });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'invalid_channel');
});

test('COMPLIANCE: valid channel passes', () => {
  const rec = outreachReadyRec({ public_email: 'a@b.com' });
  assert.equal(complianceGate(rec, { channel: 'email' }).ok, true);
  assert.equal(complianceGate(rec, { channel: 'phone' }).ok, true);
  assert.equal(complianceGate(rec, { channel: 'linkedin_manual' }).ok, true);
  assert.equal(complianceGate(rec, { channel: 'website_contact' }).ok, true);
});

// ─── hasContactMethod ──────────────────────────────────────────────
test('hasContactMethod: returns true for email', () => {
  assert.equal(hasContactMethod({ public_email: 'a@b.com' }), true);
});

test('hasContactMethod: returns true for phone', () => {
  assert.equal(hasContactMethod({ phone: '5125550199' }), true);
});

test('hasContactMethod: returns true for contact_name', () => {
  assert.equal(hasContactMethod({ contact_name: 'John Doe' }), true);
});

test('hasContactMethod: returns false when all empty', () => {
  assert.equal(hasContactMethod({ public_email: '', phone: '', contact_name: '' }), false);
});
