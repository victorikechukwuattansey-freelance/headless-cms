'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { batchImport } = require('../src/batch-import');
const { processBatch } = require('../src/batch-pipeline');
const { persistBatch, getProspect, listProspects, identityKey } = require('../src/store');
const { reviewAndPersist, reviewBrief, loadProspect } = require('../src/review-ops');
const { isSuppressed } = require('../src/lib/suppress');
const { queueProspect, getQueue } = require('../src/outreach-queue');
const { PROSPECT_FIELDS } = require('../src/prospect-model');

function tmpDir(tag) { return fs.mkdtempSync(path.join(os.tmpdir(), `lre-review-${tag}-`)); }
function tmpFile(tag, name) { return path.join(tmpDir(tag), name || 'prospects.csv'); }

// Compact realistic batch with six prospects. All are imported with NO research
// map so every record lands in `needs_review` (insufficient research) at
// persistence time. The review commands then drive each prospect through its
// operator decision — this isolates review-persistence behavior.
const BATCH_CSV = `business_name,industry,city,state,country,website,phone,public_email,contact_name,source,source_url
Alpha HVAC,HVAC,Austin,TX,US,https://alpha.example.com,(512) 555-0100,info@alpha.example.com,Ann Alpha,google_maps,https://maps.google.com/place/alpha
Beta Plumbing,Plumbing,Houston,TX,US,https://beta.example.com,(713) 555-0200,hello@beta.example.com,Bob Beta,business_directory,https://bbb.org/beta
Gamma Electric,Electrical,Dallas,TX,US,https://gamma.example.com,(214) 555-0300,service@gamma.example.com,Cara Gamma,google_maps,https://maps.google.com/place/gamma
Delta Roofing,Roofing,San Antonio,TX,US,https://delta.example.com,(210) 555-0400,jobs@delta.example.com,Dan Delta,business_directory,https://bbb.org/delta
Echo Landscaping,Landscaping,Austin,TX,US,https://echo.example.com,(512) 555-0500,info@echo.example.com,Eve Echo,google_maps,https://maps.google.com/place/echo
Low Signal Co,HVAC,Dallas,TX,US,https://low.example.com,(214) 555-0600,,,google_maps,https://maps.google.com/place/low
`;

// Empty research map: no scores, no suppression intent. All records persist as
// `needs_review`, letting the operator drive every decision.
const RESEARCH_MAP = {};

// Import + process + persist to disk. Returns { file, res, rows }.
function setupStore(tag) {
  const file = tmpFile(tag);
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });
  return { file, res, rows: listProspects(file) };
}

function byName(rows, name) { return rows.find((r) => r.business_name === name); }

// Production protection helpers.
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
test('R0-SNAP: production hash snapshot', () => { prodSnap = snapProd(); });

// ─── R01: load persisted prospect ─────────────────────────────────
test('R01: load persisted prospect into review', () => {
  const { file, rows } = setupStore('r01');
  const a = byName(rows, 'Alpha HVAC');
  assert.ok(a && a.prospect_id);
  const loaded = loadProspect(file, a.prospect_id);
  assert.equal(loaded.prospect_id, a.prospect_id);
  assert.equal(loaded.business_name, 'Alpha HVAC');
});
test('R01b: load returns null for unknown id (not_found surfaced by reviewAndPersist)', () => {
  const { file } = setupStore('r01b');
  const res = reviewAndPersist(file, 'pros_nope', 'approve');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'not_found');
});

// ─── R02: approve persists ────────────────────────────────────────
test('R02: approve persists and survives reload', () => {
  const { file, rows } = setupStore('r02');
  const a = byName(rows, 'Alpha HVAC');
  const res = reviewAndPersist(file, a.prospect_id, 'approve');
  assert.equal(res.ok, true);
  assert.equal(res.value.research_status, 'approved');
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.research_status, 'approved', 'approval survives reload');
});

// ─── R03: reject persists ─────────────────────────────────────────
test('R03: reject persists and survives reload', () => {
  const { file, rows } = setupStore('r03');
  const b = byName(rows, 'Beta Plumbing');
  const res = reviewAndPersist(file, b.prospect_id, 'reject', 'poor_fit');
  assert.equal(res.ok, true);
  const reloaded = getProspect(file, b.prospect_id);
  assert.ok(reloaded.research_notes.includes('REJECTED:poor_fit'), 'reason persisted');
  assert.notEqual(reloaded.research_status, 'approved');
  assert.notEqual(reloaded.research_status, 'outreach_ready');
});

// ─── R04: suppress persists ───────────────────────────────────────
test('R04: suppress persists and survives reload', () => {
  const { file, rows } = setupStore('r04');
  const c = byName(rows, 'Gamma Electric');
  const res = reviewAndPersist(file, c.prospect_id, 'suppress', 'no_contact');
  assert.equal(res.ok, true);
  const reloaded = getProspect(file, c.prospect_id);
  assert.equal(isSuppressed(reloaded), true, 'suppression survives reload');
  assert.equal(reloaded.suppression_reason, 'no_contact');
  assert.ok(reloaded.suppressed_at, 'suppression timestamp set');
});

// ─── R05: ready persists ──────────────────────────────────────────
test('R05: ready persists outreach_ready and survives reload', () => {
  const { file, rows } = setupStore('r05');
  const e = byName(rows, 'Echo Landscaping');
  const res = reviewAndPersist(file, e.prospect_id, 'ready');
  assert.equal(res.ok, true);
  const reloaded = getProspect(file, e.prospect_id);
  assert.equal(reloaded.research_status, 'outreach_ready', 'ready survives reload');
});

// ─── R06: invalid transitions rejected ────────────────────────────
test('R06: invalid transitions are rejected, not applied', () => {
  const { file, rows } = setupStore('r06');
  const c = byName(rows, 'Gamma Electric');
  // Suppress first, then try to ready -> blocked.
  reviewAndPersist(file, c.prospect_id, 'suppress', 'no_contact');
  const readyRes = reviewAndPersist(file, c.prospect_id, 'ready');
  assert.equal(readyRes.ok, false);
  assert.equal(readyRes.error, 'suppressed');
  // Unknown op and missing id are rejected.
  assert.equal(reviewAndPersist(file, c.prospect_id, 'frobnicate').ok, false);
  assert.equal(reviewAndPersist(file, undefined, 'approve').ok, false);
  // The record was NOT transitioned to outreach_ready by the failed ready call.
  const still = getProspect(file, c.prospect_id);
  assert.equal(still.research_status, 'suppressed');
});

// ─── R07: suppressed remains blocked after reload ─────────────────
test('R07: suppressed prospect remains blocked from outreach after reload', () => {
  const { file, rows } = setupStore('r07');
  const c = byName(rows, 'Gamma Electric');
  reviewAndPersist(file, c.prospect_id, 'suppress', 'no_contact');
  const reloaded = getProspect(file, c.prospect_id);
  assert.equal(queueProspect(reloaded).ok, false);
  assert.equal(queueProspect(reloaded).error, 'suppressed');
  const q = reviewAndPersist(file, c.prospect_id, 'ready');
  assert.equal(q.ok, false);
});

// ─── R08: rejected remains rejected after reload ──────────────────
test('R08: rejected prospect remains rejected after reload', () => {
  const { file, rows } = setupStore('r08');
  const low = byName(rows, 'Low Signal Co');
  // Reject a prospect that is currently needs_review (insufficient research).
  const res = reviewAndPersist(file, low.prospect_id, 'reject', 'insufficient_evidence');
  assert.equal(res.ok, true);
  const reloaded = getProspect(file, low.prospect_id);
  assert.ok(reloaded.research_notes.includes('REJECTED:insufficient_evidence'));
  assert.equal(reloaded.outreach_status, '');
  assert.notEqual(reloaded.research_status, 'outreach_ready');
});

// ─── R09: approved remains approved after reload ──────────────────
test('R09: approved prospect remains approved after reload', () => {
  const { file, rows } = setupStore('r09');
  const d = byName(rows, 'Delta Roofing');
  const res = reviewAndPersist(file, d.prospect_id, 'approve');
  assert.equal(res.ok, true);
  const reloaded = getProspect(file, d.prospect_id);
  assert.equal(reloaded.research_status, 'approved');
});

// ─── R10: multiple decisions persist independently ────────────────
test('R10: multiple review decisions persist independently', () => {
  const { file, rows } = setupStore('r10');
  const A = byName(rows, 'Alpha HVAC');
  const B = byName(rows, 'Beta Plumbing');
  const C = byName(rows, 'Gamma Electric');
  const D = byName(rows, 'Delta Roofing');
  const E = byName(rows, 'Echo Landscaping');

  assert.equal(reviewAndPersist(file, A.prospect_id, 'approve').ok, true);           // A -> approved
  assert.equal(reviewAndPersist(file, B.prospect_id, 'reject', 'poor_fit').ok, true); // B -> reject
  assert.equal(reviewAndPersist(file, C.prospect_id, 'suppress', 'no_contact').ok, true); // C -> suppress
  // D left as-is (needs research / review) — no mutation.
  assert.equal(reviewAndPersist(file, E.prospect_id, 'ready').ok, true);              // E -> outreach_ready

  const reloaded = listProspects(file);
  assert.equal(byName(reloaded, 'Alpha HVAC').research_status, 'approved');
  assert.ok(byName(reloaded, 'Beta Plumbing').research_notes.includes('REJECTED:poor_fit'));
  assert.equal(isSuppressed(byName(reloaded, 'Gamma Electric')), true);
  assert.equal(byName(reloaded, 'Echo Landscaping').research_status, 'outreach_ready');
  // D unchanged (still needs_review from insufficient research).
  assert.equal(byName(reloaded, 'Delta Roofing').research_status, 'needs_review');
});

// ─── R11: review reason persists ──────────────────────────────────
test('R11: review reason persists for reject and suppress', () => {
  const { file, rows } = setupStore('r11');
  const b = byName(rows, 'Beta Plumbing');
  reviewAndPersist(file, b.prospect_id, 'reject', 'wrong_geography');
  const reloadedB = getProspect(file, b.prospect_id);
  assert.ok(reloadedB.research_notes.includes('REJECTED:wrong_geography'));

  const c = byName(rows, 'Gamma Electric');
  reviewAndPersist(file, c.prospect_id, 'suppress', 'opted_out');
  const reloadedC = getProspect(file, c.prospect_id);
  assert.equal(reloadedC.suppression_reason, 'opted_out');
});

// ─── R12: updated timestamp persists ──────────────────────────────
test('R12: updated timestamp persists after review action', () => {
  const { file, rows } = setupStore('r12');
  const a = byName(rows, 'Alpha HVAC');
  const fixedNow = '2026-09-01T00:00:00.000Z';
  const res = reviewAndPersist(file, a.prospect_id, 'approve', '', fixedNow);
  assert.equal(res.ok, true);
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.updated_at, fixedNow, 'audit timestamp persisted');
});

// ─── R13: failed write preserves existing store ───────────────────
test('R13: failed write preserves existing store and does not report success', () => {
  const { file, rows } = setupStore('r13');
  const a = byName(rows, 'Alpha HVAC');
  const before = fs.readFileSync(file, 'utf8');

  const orig = fs.writeFileSync;
  let tmpAttempted = false;
  fs.writeFileSync = (p, ...args) => {
    if (String(p).endsWith('.tmp')) { tmpAttempted = true; throw new Error('disk full'); }
    return orig(p, ...args);
  };
  let res;
  try {
    res = reviewAndPersist(file, a.prospect_id, 'approve');
  } finally {
    fs.writeFileSync = orig;
  }
  assert.equal(tmpAttempted, true);
  assert.equal(res.ok, false, 'must not report success when write fails');
  assert.equal(res.error, 'persist_failed');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'store byte-for-byte intact');
  // The prospect's prior valid state survives reload (unchanged).
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.research_status, 'needs_review', 'prior state preserved');
  const leftovers = fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'));
  assert.equal(leftovers.length, 0, 'no partial temp file remains');
});

// ─── R14: review does not create customer-lead records ────────────
test('R14: review does not create customer-lead records', () => {
  const { file, rows } = setupStore('r14');
  const a = byName(rows, 'Alpha HVAC');
  const beforeCount = listProspects(file).length;
  reviewAndPersist(file, a.prospect_id, 'ready');
  const after = listProspects(file);
  assert.equal(after.length, beforeCount, 'review never adds records');
  for (const r of after) {
    for (const forbidden of ['idempotency_key', 'booking_id', 'booked_at', 'booking_link_sent', 'owner_notified', 'last_customer_response_at']) {
      assert.ok(!PROSPECT_FIELDS.includes(forbidden), `prospect schema must not contain ${forbidden}`);
    }
  }
});

// ─── R15: review does not modify production workflows ─────────────
test('R15: review does not modify production workflows', () => {
  assertProdUntouched(prodSnap);
  const expected = [31, 22, 24, 29, 10, 4, 13];
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    const j = JSON.parse(fs.readFileSync(path.join(PROD_DIR, PROTECTED_FILES[i]), 'utf8'));
    assert.equal(j.nodes.length, expected[i], `${PROTECTED_FILES[i]} node count changed`);
  }
});

// ─── E2E: operator continuity across process boundaries ───────────
test('E2E-REVIEW: import -> persist -> review -> persist -> reload -> verify decisions survive', () => {
  const file = tmpFile('e2e');

  // PROCESS 1: import, process, persist (fresh disk store).
  const imp1 = batchImport(BATCH_CSV);
  const res1 = processBatch(imp1, [], RESEARCH_MAP);
  const out1 = persistBatch(res1.records, { file });

  // Simulate process exit: reload the store fresh from disk.
  let rows = listProspects(file);
  const A = byName(rows, 'Alpha HVAC');
  const B = byName(rows, 'Beta Plumbing');
  const C = byName(rows, 'Gamma Electric');
  const D = byName(rows, 'Delta Roofing');
  const E = byName(rows, 'Echo Landscaping');
  const Low = byName(rows, 'Low Signal Co');

  // PROCESS 2: review commands, each persisting atomically through the canonical store.
  assert.equal(reviewAndPersist(file, A.prospect_id, 'approve').ok, true);
  assert.equal(reviewAndPersist(file, B.prospect_id, 'reject', 'poor_fit').ok, true);
  assert.equal(reviewAndPersist(file, C.prospect_id, 'suppress', 'no_contact').ok, true);
  // D -> explicitly outreach-ready (human review of an approved-fit prospect).
  assert.equal(reviewAndPersist(file, D.prospect_id, 'ready').ok, true);
  // E left at needs_research; Low Signal left at needs_review.

  // Simulate exit again; PROCESS 3 reloads from disk.
  const reloaded = listProspects(file);

  // Every decision survived process termination:
  assert.equal(byName(reloaded, 'Alpha HVAC').research_status, 'approved');
  assert.ok(byName(reloaded, 'Beta Plumbing').research_notes.includes('REJECTED:poor_fit'));
  assert.equal(byName(reloaded, 'Beta Plumbing').outreach_status, '');
  assert.equal(isSuppressed(byName(reloaded, 'Gamma Electric')), true);
  assert.equal(byName(reloaded, 'Delta Roofing').research_status, 'outreach_ready');
  assert.equal(byName(reloaded, 'Echo Landscaping').research_status, 'needs_review');
  assert.equal(byName(reloaded, 'Low Signal Co').research_status, 'needs_review');

  // Outreach eligibility after reload:
  const approved = byName(reloaded, 'Alpha HVAC');   // approved, not yet queued
  const readyRec = byName(reloaded, 'Delta Roofing'); // outreach_ready
  const suppressed = byName(reloaded, 'Gamma Electric');

  // Approved (research_status=approved) is NOT auto-queued; outreach_ready is queueable.
  assert.equal(approved.outreach_status, '');
  assert.equal(readyRec.outreach_status, ''); // ready sets research_status; queueing is separate
  // Suppressed is permanently blocked:
  assert.equal(queueProspect(suppressed).ok, false);
  assert.equal(queueProspect(suppressed).error, 'suppressed');
  // No duplicate prospect records were created by any review step:
  assert.equal(reloaded.length, out1.persisted.length);
  const keys = new Set(reloaded.map(identityKey));
  assert.equal(keys.size, reloaded.length, 'all persisted prospects are distinct by identity');
});
