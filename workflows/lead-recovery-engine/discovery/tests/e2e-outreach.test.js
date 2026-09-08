'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { buildProspect, assessOpportunity, applySuppress } = require('../src/pipeline');
const { transition } = require('../src/lib/states');
const { isSuppressed, suppress } = require('../src/lib/suppress');
const { outreachTransition } = require('../src/lib/outreach-states');
const { buildOutreachBrief } = require('../src/outreach-brief');
const { PROSPECT_FIELDS } = require('../src/prospect-model');
const {
  queueProspect, prepareDraft, sendOutreach, recordResponse, getQueue,
} = require('../src/outreach-queue');
const { qualifies, qualifyProspect, markDemo, markPilot, markWon, markLost } = require('../src/qualification');
const { buildOutreachReport } = require('../src/reporting');
const { newActivity } = require('../src/outreach-model');

const PROD_DIR = path.join(__dirname, '..', '..', '..', 'production');
const PROTECTED_FILES = [
  '01 - Lead Intake.json',
  '02 - Booking Status.json',
  '03 - Manual Callback Log.json',
  '04 - Status Update.json',
  '05 - Follow-up Sweeper.json',
  '06 - Error Handler.json',
  '07 - Customer Response.json',
];

function sha1(p) { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); }
function prodHash(f) { return sha1(path.join(PROD_DIR, f)); }

function snapProductionHashes() {
  const h = {};
  for (const f of PROTECTED_FILES) h[f] = prodHash(f);
  return h;
}

function assertProductionUntouched(before) {
  for (const f of PROTECTED_FILES) {
    assert.equal(prodHash(f), before[f], `production file changed: ${f}`);
  }
}

function makeRec(fields) {
  const rec = buildProspect({ business_name: 'Test Co', city: 'Austin', state: 'TX', ...fields }).value;
  // contact_policy is an operator-set field, not an ingest input — set it
  // directly on the record (buildProspect/sanitizeProspect drops it).
  rec.contact_policy = (fields && fields.contact_policy) || '';
  return rec;
}

function progressThroughDiscovery(record, evidence) {
  transition(record, 'researching');
  transition(record, 'researched');
  assessOpportunity(record, {
    appointment_dependency: true, inbound_lead_dependency: true,
    service_ticket_value: true, service_area: true,
    manual_inquiry_handling: true, model_fit: true,
  }, evidence);
  record.research_notes = 'Research completed. Public website with inquiry form.';
  transition(record, 'needs_review');
  transition(record, 'approved');
  transition(record, 'outreach_ready');
  return record;
}

let prodSnap;
test('PRODUCTION HASH SNAP', () => { prodSnap = snapProductionHashes(); });

// ─── E2E-OUT-01: full lifecycle from outreach_ready → won ──────────
test('E2E-OUT-01: outreach_ready → queued → prepared → sent → replied → qualified → demo → won', () => {
  const rec = makeRec({
    business_name: 'Lone Star HVAC',
    public_email: 'info@lonestar-hvac.example.com',
    phone: '5125550187',
    industry: 'HVAC',
    city: 'Austin',
    state: 'TX',
    prospect_id: 'p-e2eout-01',
    contact_policy: 'permitted',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Public website with contact form.' });
  assert.equal(rec.research_status, 'outreach_ready');

  // Queue
  const qRes = queueProspect(rec);
  assert.equal(qRes.ok, true);
  assert.equal(rec.outreach_status, 'queued');

  // Prepare draft
  const dRes = prepareDraft(rec, [], { channel: 'email', operator: 'op-1', now: '2026-08-31T10:00:00.000Z' });
  assert.equal(dRes.ok, true);
  const act = dRes.activity;
  assert.equal(act.status, 'draft');

  // Send
  const sRes = sendOutreach(rec, act, { now: '2026-08-31T11:00:00.000Z' });
  assert.equal(sRes.ok, true);
  assert.equal(rec.outreach_status, 'contacted');
  assert.equal(rec.outreach_attempts, 1);
  assert.equal(act.status, 'sent');

  // Record reply
  recordResponse(act, 'interested', 'Wants to schedule a call', { now: '2026-08-31T14:00:00.000Z' });
  assert.equal(act.response_type, 'interested');

  // Qualify
  rec.outreach_status = 'replied';
  rec.opportunity_score = 80;
  const qQual = qualifyProspect(rec);
  assert.equal(qQual.ok, true);
  assert.equal(rec.outreach_status, 'qualified');
  assert.equal(rec.qualified_for_demo, true);

  // Demo
  const dDemo = markDemo(rec);
  assert.equal(dDemo.ok, true);
  assert.equal(rec.outreach_status, 'demo');

  // Won
  const dWon = markWon(rec);
  assert.equal(dWon.ok, true);
  assert.equal(rec.outreach_status, 'won');
  assert.equal(rec.client_status, 'client');
});

// ─── E2E-OUT-02: prospect goes lost after no reply ────────────────
test('E2E-OUT-02: outreach → contacted → follow_up → lost', () => {
  const rec = makeRec({
    business_name: 'No Reply Co',
    phone: '5125550199',
    prospect_id: 'p-e2eout-02',
    contact_policy: 'permitted',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Has public phone.' });

  queueProspect(rec);
  const act = newActivity();
  act.outreach_id = 'out_e2e02';
  act.prospect_id = 'p-e2eout-02';
  act.status = 'draft';
  act.channel = 'phone';
  sendOutreach(rec, act);
  assert.equal(rec.outreach_status, 'contacted');

  // Follow-up due
  outreachTransition(rec, 'follow_up_due', { now: '2026-09-01T10:00:00.000Z' });
  assert.equal(rec.outreach_status, 'follow_up_due');

  // Lost
  markLost(rec, 'no_response');
  assert.equal(rec.outreach_status, 'lost');
  assert.ok(rec.research_notes.includes('LOST:no_response'));
});

// ─── E2E-OUT-03: suppressed prospect blocks all outreach ───────────
test('E2E-OUT-03: suppressed prospect cannot be queued or contacted', () => {
  const rec = makeRec({
    business_name: 'Blocked Biz',
    public_email: 'blocked@test.com',
    prospect_id: 'p-e2eout-03',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Has website.' });
  applySuppress(rec, 'operator');
  assert.equal(isSuppressed(rec), true);

  const qRes = queueProspect(rec);
  assert.equal(qRes.ok, false);
  assert.equal(qRes.error, 'suppressed');

  const act = newActivity();
  act.status = 'draft';
  const sRes = sendOutreach(rec, act);
  assert.equal(sRes.ok, false);
  assert.equal(sRes.error, 'suppressed');
});

// ─── E2E-OUT-04: opt-out blocks outreach via compliance gate ───────
test('E2E-OUT-04: opt-out prospect blocks queue and send', () => {
  const rec = makeRec({
    business_name: 'Opt Out Co',
    public_email: 'opt@test.com',
    prospect_id: 'p-e2eout-04',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Has email.' });
  rec.opt_out = true;

  const qRes = queueProspect(rec);
  assert.equal(qRes.ok, false);
  assert.equal(qRes.error, 'opt_out');
});

// ─── E2E-OUT-05: no contact method blocks queue ────────────────────
test('E2E-OUT-05: prospect with no contact info cannot be queued', () => {
  const rec = makeRec({
    business_name: 'No Contact Co',
    prospect_id: 'p-e2eout-05',
  });
  rec.public_email = '';
  rec.phone = '';
  rec.contact_name = '';
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Has website.' });

  const qRes = queueProspect(rec);
  assert.equal(qRes.ok, false);
  assert.equal(qRes.error, 'no_contact_method');
});

// ─── E2E-OUT-06: qualification gates on score + reply ──────────────
test('E2E-OUT-06: low score without reply blocks qualification', () => {
  const rec = makeRec({
    business_name: 'Low Score Co',
    public_email: 'low@test.com',
    prospect_id: 'p-e2eout-06',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Minimal signal.' });
  rec.outreach_status = 'contacted';
  rec.opportunity_score = 25;
  const res = qualifies(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'below_threshold');
});

test('E2E-OUT-06b: reply allows qualification regardless of score', () => {
  const rec = makeRec({
    business_name: 'Replied Low Score',
    public_email: 'reply@test.com',
    prospect_id: 'p-e2eout-06b',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Some signal.' });
  rec.outreach_status = 'replied';
  rec.opportunity_score = 30;
  const res = qualifies(rec);
  assert.equal(res.ok, true);
  assert.equal(res.hasReply, true);
});

// ─── E2E-OUT-07: demo → pilot → won progression ────────────────────
test('E2E-OUT-07: demo → pilot → won progression', () => {
  const rec = makeRec({
    business_name: 'Full Funnel',
    public_email: 'funnel@test.com',
    prospect_id: 'p-e2eout-07',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Strong fit.' });
  rec.outreach_status = 'replied';
  rec.opportunity_score = 85;
  qualifyProspect(rec);
  assert.equal(rec.outreach_status, 'qualified');
  markDemo(rec);
  assert.equal(rec.outreach_status, 'demo');
  markPilot(rec);
  assert.equal(rec.outreach_status, 'pilot');
  markWon(rec);
  assert.equal(rec.outreach_status, 'won');
  assert.equal(rec.client_status, 'client');
});

// ─── E2E-OUT-08: suppressed prospect blocks demo/pilot/won ─────────
test('E2E-OUT-08: suppressed blocks demo, pilot, won', () => {
  const rec = makeRec({
    business_name: 'Suppressed Stage',
    public_email: 'supp@test.com',
    prospect_id: 'p-e2eout-08',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'Fit.' });
  rec.outreach_status = 'qualified';
  suppress(rec, 'operator');

  assert.equal(markDemo(rec).ok, false);
  assert.equal(markPilot(rec).ok, false);
  assert.equal(markWon(rec).ok, false);
});

// ─── E2E-OUT-09: LinkedIn channel is manual-only (no auto-send) ────
test('E2E-OUT-09: linkedin_manual channel is accepted but not auto-sent', () => {
  const rec = makeRec({
    business_name: 'LinkedIn Biz',
    contact_name: 'Jane Doe',
    prospect_id: 'p-e2eout-09',
    contact_policy: 'permitted',
  });
  progressThroughDiscovery(rec, { cls: 'OBSERVED', text: 'LinkedIn profile found.' });
  const qRes = queueProspect(rec);
  assert.equal(qRes.ok, true);
  const dRes = prepareDraft(rec, [], { channel: 'linkedin_manual' });
  assert.equal(dRes.ok, true);
  assert.equal(dRes.activity.channel, 'linkedin_manual');
  // No auto-send — operator must manually send
  assert.equal(dRes.activity.status, 'draft');
});

// ─── E2E-OUT-10: prospect/lead separation holds in outreach layer ──
test('E2E-OUT-10: outreach record cannot contain customer lead fields', () => {
  const rec = makeRec({ business_name: 'Separation Co' });
  const forbidden = ['idempotency_key', 'booking_id', 'booked_at', 'booked', 'booking_link_sent',
    'owner_notified', 'next_followup_at', 'last_customer_response_at'];
  for (const f of forbidden) {
    assert.ok(!(f in rec) || rec[f] === '' || rec[f] === null || rec[f] === 0 || rec[f] === false,
      `prospect must not expose customer field: ${f}`);
  }
});

// ─── E2E-OUT-11: production regression ─────────────────────────────
test('PRODUCTION: all seven files still valid JSON with expected names', () => {
  for (const f of PROTECTED_FILES) {
    const p = path.join(PROD_DIR, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(j.nodes && Array.isArray(j.nodes), `${f} must have nodes array`);
    assert.ok(typeof j.name === 'string' && j.name.length > 0, `${f} must have name`);
    assert.ok(typeof j.id === 'string' && j.id.length > 0, `${f} must have id`);
  }
});

test('PRODUCTION: no hashes changed during entire E2E test run', () => {
  assertProductionUntouched(prodSnap);
});

test('PRODUCTION: node counts unchanged', () => {
  const expected = [31, 22, 24, 29, 10, 4, 13];
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    const j = JSON.parse(fs.readFileSync(path.join(PROD_DIR, PROTECTED_FILES[i]), 'utf8'));
    assert.equal(j.nodes.length, expected[i], `${PROTECTED_FILES[i]} node count changed`);
  }
});

// ─── E2E-OUT-12: outreach code has no path to production/ ──────────
test('SEPARATION: outreach modules have no path to production workflows', () => {
  const srcFiles = [
    'outreach-queue.js', 'outreach-store.js', 'qualification.js', 'reporting.js',
    'outreach-model.js', 'lib/compliance.js', 'lib/outreach-states.js',
  ];
  for (const f of srcFiles) {
    const fp = path.join(__dirname, '..', 'src', f);
    if (fs.existsSync(fp)) {
      const src = fs.readFileSync(fp, 'utf8');
      assert.ok(!src.includes('01 - Lead Intake'), `${f} must not reference production 01`);
      assert.ok(!src.includes('Follow-up Sweeper'), `${f} must not reference production 05`);
    }
  }
});

// ─── E2E-OUT-13: outreach activity store has no path to production leads ──
test('SEPARATION: outreach store does not reference leads or business_config', () => {
  const fp = path.join(__dirname, '..', 'src', 'outreach-store.js');
  const src = fs.readFileSync(fp, 'utf8');
  assert.ok(!src.includes('leads'), 'outreach-store.js must not reference leads');
  assert.ok(!src.includes('business_config'), 'outreach-store.js must not reference business_config');
  assert.ok(!src.includes('bookings'), 'outreach-store.js must not reference bookings');
});

// ─── E2E-OUT-14: reporting produces valid summary ──────────────────
test('E2E-OUT-14: buildOutreachReport produces correct counts', () => {
  const prospects = [
    makeRec({ prospect_id: 'rpt-1' }),
    makeRec({ prospect_id: 'rpt-2' }),
    makeRec({ prospect_id: 'rpt-3' }),
  ];
  prospects[0].outreach_status = 'contacted';
  prospects[1].outreach_status = 'won';
  suppress(prospects[2], 'operator');

  const activities = [
    { outreach_id: 'a1', prospect_id: 'rpt-1', status: 'sent', channel: 'email', response_type: 'interested' },
    { outreach_id: 'a2', prospect_id: 'rpt-1', status: 'draft', channel: 'phone', response_type: '' },
  ];

  const report = buildOutreachReport(prospects, activities);
  assert.equal(report.total_prospects, 3);
  assert.equal(report.suppressed_prospects, 1);
  assert.equal(report.active_prospects, 2);
  assert.equal(report.activities.sent, 1);
  assert.equal(report.activities.replied, 1);
  assert.equal(report.outcomes.won, 1);
  assert.equal(report.channels.email.sent, 1);
  assert.equal(report.channels.email.replied, 1);
  assert.equal(report.channels.phone.sent, 0);
});
