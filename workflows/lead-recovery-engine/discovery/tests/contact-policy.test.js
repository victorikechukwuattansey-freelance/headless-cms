'use strict';

// PASS 7 — Contact Policy + Explicit Opt-Out Hardening.
// Verifies that UNKNOWN != PERMITTED: a prospect is NOT outreach-eligible until
// an operator explicitly grants `contact_policy: 'permitted'`. The low-level
// complianceGate() remains unchanged (ok=true does NOT equal "authorized"); the
// outreach-eligibility path (queueProspect/prepareDraft/sendOutreach) enforces
// the stricter gate. Opt-out is durable, activates suppression, and can never
// be reversed by `policy permitted`.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { batchImport } = require('../src/batch-import');
const { processBatch } = require('../src/batch-pipeline');
const { persistBatch, getProspect, listProspects, createProspect, updateProspect } = require('../src/store');
const {
  policyAndPersist,
  optoutAndPersist,
  normalizeContactPolicy,
  isOptedOut,
} = require('../src/review-ops');
const { isSuppressed } = require('../src/lib/suppress');
const { complianceGate } = require('../src/lib/compliance');
const { queueProspect, prepareDraft, sendOutreach, getQueue } = require('../src/outreach-queue');
const { buildProspect } = require('../src/pipeline');
const { PROSPECT_FIELDS } = require('../src/prospect-model');
const { newActivity } = require('../src/outreach-model');

function tmpDir(tag) { return fs.mkdtempSync(path.join(os.tmpdir(), `lre-cp-${tag}-`)); }
function tmpFile(tag, name) { return path.join(tmpDir(tag), name || 'prospects.csv'); }

function makeRec(fields) {
  const rec = buildProspect({ business_name: 'Test Co', city: 'Austin', state: 'TX', ...fields }).value;
  // contact_policy is an operator-set field, not an ingest input (sanitizer drops it).
  rec.contact_policy = (fields && fields.contact_policy) || '';
  return rec;
}

function outreachReadyRec(fields) {
  const rec = makeRec(fields);
  rec.research_status = 'outreach_ready';
  rec.outreach_status = 'not_ready';
  return rec;
}

const PROD_DIR = path.join(__dirname, '..', '..', '..', 'production');
const PROTECTED_FILES = [
  '01 - Lead Intake.json', '02 - Booking Status.json', '03 - Manual Callback Log.json',
  '04 - Status Update.json', '05 - Follow-up Sweeper.json', '06 - Error Handler.json',
  '07 - Customer Response.json',
];
function sha1(p) { return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex'); }
function prodHash(f) { return sha1(path.join(PROD_DIR, f)); }
function snapProd() { const h = {}; for (const f of PROTECTED_FILES) h[f] = prodHash(f); return h; }
function assertProdUntouched(b0) { for (const f of PROTECTED_FILES) assert.equal(prodHash(f), b0[f], `changed: ${f}`); }
let prodSnap;
test('CP0-SNAP: production hash snapshot', () => { prodSnap = snapProd(); });

// ─── CP01: UNKNOWN (empty default) blocks queueProspect ───────────
test('CP01: default empty contact_policy (UNKNOWN) blocks queueProspect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  assert.equal(rec.contact_policy, '', 'default contact_policy is empty');
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'contact_policy_not_permitted');
  assert.equal(rec.outreach_status, 'not_ready', 'queue status unchanged');
});

// ─── CP02: explicit 'unknown' blocks queueProspect ────────────────
test('CP02: explicit contact_policy=unknown blocks queueProspect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'unknown' });
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'contact_policy_not_permitted');
});

// ─── CP03: 'blocked' blocks queueProspect ─────────────────────────
test('CP03: contact_policy=blocked blocks queueProspect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'blocked' });
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'contact_policy_not_permitted');
});

// ─── CP04: 'permitted' allows queueProspect ───────────────────────
test('CP04: explicit contact_policy=permitted allows queueProspect', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'permitted' });
  const res = queueProspect(rec);
  assert.equal(res.ok, true);
  assert.equal(rec.outreach_status, 'queued');
});

// ─── CP05: complianceGate ok != authorized for outreach ───────────
test('CP05: complianceGate ok does NOT imply outreach-eligibility (UNKNOWN != PERMITTED)', () => {
  // A valid contact method passes the low-level compliance gate...
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  assert.equal(complianceGate(rec).ok, true, 'complianceGate passes valid contact');
  // ...but the outreach-eligibility path still blocks (unknown policy).
  const res = queueProspect(rec);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'contact_policy_not_permitted');
});

// ─── CP06: prepareDraft blocks unknown policy ─────────────────────
test('CP06: prepareDraft blocks unknown policy', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  const res = prepareDraft(rec, [], { channel: 'email' });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'contact_policy_not_permitted');
});

// ─── CP07: prepareDraft allows permitted policy ───────────────────
test('CP07: prepareDraft allows permitted policy', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'permitted' });
  const res = prepareDraft(rec, [], { channel: 'email' });
  assert.equal(res.ok, true);
  assert.equal(res.activity.status, 'draft');
});

// ─── CP08: sendOutreach blocks unknown policy ─────────────────────
test('CP08: sendOutreach blocks unknown policy', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com' });
  const act = newActivity();
  act.status = 'draft';
  const res = sendOutreach(rec, act);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'contact_policy_not_permitted');
});

// ─── CP09: sendOutreach allows permitted policy ───────────────────
test('CP09: sendOutreach allows permitted policy', () => {
  const rec = outreachReadyRec({ public_email: 'info@test.com', contact_policy: 'permitted' });
  const act = newActivity();
  act.status = 'draft';
  const res = sendOutreach(rec, act, { now: '2026-09-01T10:00:00.000Z' });
  assert.equal(res.ok, true);
  assert.equal(act.status, 'sent');
  assert.equal(rec.outreach_status, 'contacted');
});

// ─── CP10: policyAndPersist sets permitted ────────────────────────
test('CP10: policy command grants permitted and persists', () => {
  const file = tmpFile('cp10');
  const rec = makeRec({ business_name: 'Alpha Co', public_email: 'a@b.com' });
  rec.prospect_id = 'p-cp10';
  createProspect(file, rec);
  const res = policyAndPersist(file, 'p-cp10', 'permitted');
  assert.equal(res.ok, true);
  assert.equal(getProspect(file, 'p-cp10').contact_policy, 'permitted');
});

// ─── CP11: policyAndPersist sets blocked ──────────────────────────
test('CP11: policy command grants blocked and persists', () => {
  const file = tmpFile('cp11');
  const rec = makeRec({ business_name: 'Beta Co', public_email: 'b@b.com' });
  rec.prospect_id = 'p-cp11';
  createProspect(file, rec);
  const res = policyAndPersist(file, 'p-cp11', 'blocked');
  assert.equal(res.ok, true);
  assert.equal(getProspect(file, 'p-cp11').contact_policy, 'blocked');
});

// ─── CP12: policyAndPersist sets unknown ──────────────────────────
test('CP12: policy command sets unknown (and empty normalizes to unknown)', () => {
  const file = tmpFile('cp12');
  const rec = makeRec({ business_name: 'Gamma Co', public_email: 'g@b.com' });
  rec.prospect_id = 'p-cp12';
  createProspect(file, rec);
  assert.equal(policyAndPersist(file, 'p-cp12', 'unknown').ok, true);
  assert.equal(getProspect(file, 'p-cp12').contact_policy, 'unknown');
  assert.equal(policyAndPersist(file, 'p-cp12', '').ok, true);
  assert.equal(getProspect(file, 'p-cp12').contact_policy, 'unknown');
});

// ─── CP13: policyAndPersist rejects invalid policy ────────────────
test('CP13: invalid policy value is rejected (never silently coerced)', () => {
  const file = tmpFile('cp13');
  const rec = makeRec({ business_name: 'Delta Co', public_email: 'd@b.com' });
  rec.prospect_id = 'p-cp13';
  createProspect(file, rec);
  const res = policyAndPersist(file, 'p-cp13', 'maybe');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'invalid_policy:maybe');
  assert.equal(getProspect(file, 'p-cp13').contact_policy, '', 'original policy untouched');
  assert.equal(normalizeContactPolicy('maybe'), null);
  assert.equal(normalizeContactPolicy(''), 'unknown');
});

// ─── CP14: optout sets opt_out + suppression + reason + timestamp ─
test('CP14: optout activates opt_out and suppression with reason/timestamp', () => {
  const file = tmpFile('cp14');
  const rec = makeRec({ business_name: 'Epsilon Co', public_email: 'e@b.com' });
  rec.prospect_id = 'p-cp14';
  createProspect(file, rec);
  const res = optoutAndPersist(file, 'p-cp14', 'no more calls', '2026-09-01T12:00:00.000Z');
  assert.equal(res.ok, true);
  const r = getProspect(file, 'p-cp14');
  assert.equal(r.opt_out, true);
  assert.equal(isSuppressed(r), true);
  assert.equal(r.opt_out_reason, 'no more calls');
  assert.equal(r.opt_out_at, '2026-09-01T12:00:00.000Z');
  assert.equal(r.suppression_reason, 'opted_out:no more calls');
});

// ─── CP15: opt-out durable across reload ──────────────────────────
test('CP15: opt-out persists and survives a cold reload', () => {
  const file = tmpFile('cp15');
  const rec = makeRec({ business_name: 'Zeta Co', public_email: 'z@b.com' });
  rec.prospect_id = 'p-cp15';
  createProspect(file, rec);
  optoutAndPersist(file, 'p-cp15', 'do not contact');
  // Simulate process exit: fresh read from disk.
  const reloaded = getProspect(file, 'p-cp15');
  assert.equal(reloaded.opt_out, true);
  assert.equal(reloaded.opt_out_reason, 'do not contact');
  assert.ok(reloaded.opt_out_at);
  assert.equal(isSuppressed(reloaded), true);
  assert.equal(reloaded.research_status, 'suppressed');
});

// ─── CP16: policy permitted after opt-out FAILS ───────────────────
test('CP16: policy permitted can NEVER reverse an opt-out', () => {
  const file = tmpFile('cp16');
  const rec = makeRec({ business_name: 'Eta Co', public_email: 'h@b.com' });
  rec.prospect_id = 'p-cp16';
  createProspect(file, rec);
  optoutAndPersist(file, 'p-cp16', 'opted out');
  const res = policyAndPersist(file, 'p-cp16', 'permitted');
  assert.equal(res.ok, false, 'permitted policy must be refused on opted-out');
  assert.equal(res.error, 'opted_out');
  const r = getProspect(file, 'p-cp16');
  assert.equal(r.opt_out, true, 'opt-out never cleared');
  assert.equal(isSuppressed(r), true, 'suppression never cleared');
  assert.notEqual(r.contact_policy, 'permitted');
});

// ─── CP17: opted-out prospect remains blocked from queue ──────────
test('CP17: opted-out prospect is blocked from queue by suppression', () => {
  const file = tmpFile('cp17');
  const rec = makeRec({ business_name: 'Theta Co', public_email: 't@b.com' });
  rec.prospect_id = 'p-cp17';
  createProspect(file, rec);
  optoutAndPersist(file, 'p-cp17', 'stop');
  const r = getProspect(file, 'p-cp17');
  const q = queueProspect(r);
  assert.equal(q.ok, false);
  assert.equal(q.error, 'suppressed');
});

// ─── CP18: policy fields are canonical prospect fields ────────────
test('CP18: contact policy + opt-out fields are in the prospect schema and persist via the store', () => {
  assert.ok(PROSPECT_FIELDS.includes('contact_policy'));
  assert.ok(PROSPECT_FIELDS.includes('opt_out'));
  assert.ok(PROSPECT_FIELDS.includes('opt_out_reason'));
  assert.ok(PROSPECT_FIELDS.includes('opt_out_at'));
  // Round-trip through the CSV store.
  const file = tmpFile('cp18');
  const rec = makeRec({ business_name: 'Iota Co', public_email: 'i@b.com' });
  rec.prospect_id = 'p-cp18';
  createProspect(file, rec);
  const updated = getProspect(file, 'p-cp18');
  updated.contact_policy = 'permitted';
  updated.opt_out = true;
  updated.opt_out_reason = 'asked';
  updated.opt_out_at = '2026-09-01T09:00:00.000Z';
  updateProspect(file, updated);
  const reloaded = getProspect(file, 'p-cp18');
  assert.equal(reloaded.contact_policy, 'permitted');
  assert.equal(reloaded.opt_out, true);
  assert.equal(reloaded.opt_out_reason, 'asked');
  assert.equal(reloaded.opt_out_at, '2026-09-01T09:00:00.000Z');
});

// ─── CP19: no customer-lead boundary violation ────────────────────
test('CP19: policy/opt-out additions respect the PROSPECT boundary', () => {
  for (const forbidden of ['idempotency_key', 'booking_id', 'booked_at', 'booked',
    'booking_link_sent', 'owner_notified', 'next_followup_at', 'last_customer_response_at']) {
    assert.ok(!PROSPECT_FIELDS.includes(forbidden), `prospect schema must not contain ${forbidden}`);
  }
  // Helper reflects the new vocabulary.
  assert.equal(normalizeContactPolicy('permitted'), 'permitted');
  assert.equal(normalizeContactPolicy('BLOCKED'), 'blocked');
  assert.equal(isOptedOut({ opt_out: true }), true);
  assert.equal(isOptedOut({ opt_out: 'TRUE' }), true);
  assert.equal(isOptedOut({ opt_out: false }), false);
});

// ─── CP20: production workflows untouched ─────────────────────────
test('CP20: production workflows unchanged (hashes + node counts)', () => {
  assertProdUntouched(prodSnap);
  const expected = [31, 22, 24, 29, 10, 4, 13];
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    const j = JSON.parse(fs.readFileSync(path.join(PROD_DIR, PROTECTED_FILES[i]), 'utf8'));
    assert.equal(j.nodes.length, expected[i], `${PROTECTED_FILES[i]} node count changed`);
  }
});

// ─── E2E-CP-01: unknown blocks queue -> grant permitted -> queue -> reload ──
test('E2E-CP-01: UNKNOWN blocks queue, permitted unlocks it, all survives reload', () => {
  const file = tmpFile('e2e1');
  const rec = makeRec({ business_name: 'Repair Co', public_email: 'r@b.com' });
  rec.prospect_id = 'p-e2e1';
  createProspect(file, rec);
  assert.equal(getProspect(file, 'p-e2e1').contact_policy, '');
  assert.equal(queueProspect(getProspect(file, 'p-e2e1')).ok, false);
  policyAndPersist(file, 'p-e2e1', 'permitted');
  assert.equal(queueProspect(getProspect(file, 'p-e2e1')).ok, true);
  // Reload — permitted policy persists and is still queueable.
  const ready = getProspect(file, 'p-e2e1');
  ready.research_status = 'outreach_ready';
  assert.equal(queueProspect(ready).ok, true);
});

// ─── E2E-CP-02: permitted -> prepare -> send ──────────────────────
test('E2E-CP-02: permitted prospect can be prepared and sent', () => {
  const file = tmpFile('e2e2');
  const rec = outreachReadyRec({ public_email: 'r@b.com', prospect_id: 'p-e2e2', business_name: 'Send Co' });
  createProspect(file, rec);
  policyAndPersist(file, 'p-e2e2', 'permitted');
  const live = getProspect(file, 'p-e2e2');
  const d = prepareDraft(live, [], { channel: 'email', operator: 'op' });
  assert.equal(d.ok, true);
  const s = sendOutreach(live, d.activity, { now: '2026-09-01T10:00:00.000Z' });
  assert.equal(s.ok, true);
  assert.equal(live.outreach_status, 'contacted');
});

// ─── E2E-CP-03: opt-out blocks all outreach, durable ──────────────
test('E2E-CP-03: opt-out blocks prepare/send/queue and survives reload', () => {
  const file = tmpFile('e2e3');
  const rec = outreachReadyRec({ public_email: 'r@b.com', prospect_id: 'p-e2e3', business_name: 'Out Co' });
  createProspect(file, rec);
  optoutAndPersist(file, 'p-e2e3', 'unsubscribe');
  const reloaded = getProspect(file, 'p-e2e3');
  assert.equal(queueProspect(reloaded).ok, false);
  assert.equal(prepareDraft(reloaded, []).ok, false);
  const act = newActivity(); act.status = 'draft';
  assert.equal(sendOutreach(reloaded, act).ok, false);
  assert.equal(reloaded.opt_out, true);
  assert.equal(isSuppressed(reloaded), true);
});

// ─── E2E-CP-04: opt-out then policy permitted refused ─────────────
test('E2E-CP-04: opted-out prospect refuses a later permitted policy', () => {
  const file = tmpFile('e2e4');
  const rec = makeRec({ business_name: 'No Co', public_email: 'n@b.com' });
  rec.prospect_id = 'p-e2e4';
  createProspect(file, rec);
  optoutAndPersist(file, 'p-e2e4', 'no contact');
  const res = policyAndPersist(file, 'p-e2e4', 'permitted');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'opted_out');
});

// ─── E2E-CP-05: blocked policy keeps prospect out of queue ────────
test('E2E-CP-05: blocked policy keeps prospect out of queue', () => {
  const file = tmpFile('e2e5');
  const rec = makeRec({ business_name: 'Block Co', public_email: 'bl@b.com' });
  rec.prospect_id = 'p-e2e5';
  createProspect(file, rec);
  policyAndPersist(file, 'p-e2e5', 'blocked');
  const live = getProspect(file, 'p-e2e5');
  assert.equal(live.contact_policy, 'blocked');
  assert.equal(queueProspect(live).ok, false);
  assert.equal(queueProspect(live).error, 'contact_policy_not_permitted');
});

// ─── E2E-CP-06: batch import auto-queues nothing (UNKNOWN != PERMITTED) ──
test('E2E-CP-06: batch import auto-queues nothing without permitted policy', () => {
  const imp = batchImport('business_name,industry,city,state,country,website,phone,public_email\nImp Co,HVAC,Austin,TX,US,https://imp.example.com,(512) 555-0101,info@imp.example.com\n');
  const res = processBatch(imp, [], {
    'imp co': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Public website with inquiry form.' } },
  });
  assert.equal(res.outreachReady, 0, 'nothing auto-queues from a raw import');
  const impRec = res.records.find((r) => r.business_name === 'Imp Co');
  assert.ok(impRec, 'prospect processed');
  assert.equal(impRec.contact_policy, '', 'imported prospect has unknown policy');
  assert.notEqual(impRec.outreach_status, 'queued');
});

// ─── E2E-CP-07: full lifecycle unknown->permitted->queued->prepared->sent ──
test('E2E-CP-07: full outreach lifecycle requires explicitly granted permitted policy', () => {
  const file = tmpFile('e2e7');
  const rec = outreachReadyRec({ public_email: 'life@b.com', prospect_id: 'p-e2e7', business_name: 'Life Co' });
  createProspect(file, rec);
  // Blocked until granted.
  assert.equal(queueProspect(getProspect(file, 'p-e2e7')).ok, false);
  policyAndPersist(file, 'p-e2e7', 'permitted');
  const live = getProspect(file, 'p-e2e7');
  assert.equal(queueProspect(live).ok, true);
  assert.equal(live.outreach_status, 'queued');
  const d = prepareDraft(live, [], { channel: 'email' });
  assert.equal(d.ok, true);
  const s = sendOutreach(live, d.activity, { now: '2026-09-01T11:00:00.000Z' });
  assert.equal(s.ok, true);
  assert.equal(live.outreach_status, 'contacted');
});

// ─── E2E-CP-08: policy/opt-out survive process exit and restart ──
test('E2E-CP-08: policy + opt-out survive a full process exit/restart', () => {
  const file = tmpFile('e2e8');
  // PROCESS 1: create + grant policy + opt-out (simulating operator actions across sessions).
  const rec = makeRec({ business_name: 'Restart Co', public_email: 'rs@b.com' });
  rec.prospect_id = 'p-e2e8';
  createProspect(file, rec);
  policyAndPersist(file, 'p-e2e8', 'permitted');
  optoutAndPersist(file, 'p-e2e8', 'no more');
  // PROCESS 2: cold reload — everything durable.
  const r = getProspect(file, 'p-e2e8');
  assert.equal(r.contact_policy, 'permitted');
  assert.equal(r.opt_out, true);
  assert.equal(r.opt_out_reason, 'no more');
  assert.equal(isSuppressed(r), true);
  // The opted-out prospect remains blocked even though policy was previously permitted.
  assert.equal(queueProspect(r).ok, false);
  assert.equal(queueProspect(r).error, 'suppressed');
  // And it can never be switched back to permitted.
  assert.equal(policyAndPersist(file, 'p-e2e8', 'permitted').ok, false);
});
