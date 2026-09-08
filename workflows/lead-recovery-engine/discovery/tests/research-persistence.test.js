'use strict';

// PASS 6 — Operator-Assisted Research Entry + Re-Scoring.
// Verifies the `research <id>` path end to end: load canonical persisted
// prospect → append one classified evidence item → re-run the EXISTING validated
// scorer → persist atomically → reload → continue review. Research never approves
// a prospect, never makes it outreach-ready, never removes suppression.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { batchImport } = require('../src/batch-import');
const { processBatch } = require('../src/batch-pipeline');
const { persistBatch, getProspect, listProspects, identityKey } = require('../src/store');
const { reviewAndPersist, researchAndPersist, researchBrief, loadProspect, reviewBrief } = require('../src/review-ops');
const { isSuppressed } = require('../src/lib/suppress');
const { queueProspect, getQueue } = require('../src/outreach-queue');
const { PROSPECT_FIELDS, EVIDENCE_CLASSES } = require('../src/prospect-model');
const { FACTORS, score } = require('../src/lib/score');

function tmpDir(tag) { return fs.mkdtempSync(path.join(os.tmpdir(), `lre-research-${tag}-`)); }
function tmpFile(tag, name) { return path.join(tmpDir(tag), name || 'prospects.csv'); }

const BATCH_CSV = `business_name,industry,city,state,country,website,phone,public_email,contact_name,source,source_url
Alpha HVAC,HVAC,Austin,TX,US,https://alpha.example.com,(512) 555-0100,info@alpha.example.com,Ann Alpha,google_maps,https://maps.google.com/place/alpha
Beta Plumbing,Plumbing,Houston,TX,US,https://beta.example.com,(713) 555-0200,hello@beta.example.com,Bob Beta,business_directory,https://bbb.org/beta
Gamma Electric,Electrical,Dallas,TX,US,https://gamma.example.com,(214) 555-0300,service@gamma.example.com,Cara Gamma,google_maps,https://maps.google.com/place/gamma
Delta Roofing,Roofing,San Antonio,TX,US,https://delta.example.com,(210) 555-0400,jobs@delta.example.com,Dan Delta,business_directory,https://bbb.org/delta
Echo Landscaping,Landscaping,Austin,TX,US,https://echo.example.com,(512) 555-0500,info@echo.example.com,Eve Echo,google_maps,https://maps.google.com/place/echo
Low Signal Co,HVAC,Dallas,TX,US,https://low.example.com,(214) 555-0600,,,google_maps,https://maps.google.com/place/low
`;

// Empty research map → all records persist as `needs_review` (score 0, UNKNOWN
// evidence), so research is what drives the score up, isolating this pass.
const RESEARCH_MAP = {};

function setupStore(tag) {
  const file = tmpFile(tag);
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });
  return { file, res, rows: listProspects(file) };
}
function byName(rows, name) { return rows.find((r) => r.business_name === name); }
function evItems(rec) {
  try { return JSON.parse(rec.research_evidence || '[]'); } catch (_) { return []; }
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
test('RS0-SNAP: production hash snapshot', () => { prodSnap = snapProd(); });

// A realistic scored flag set (all from the ORIGINAL FACTORS vocabulary).
const FLAGS = {
  appointment_dependency: true,
  inbound_lead_dependency: true,
  service_ticket_value: true,
  service_area: true,
  manual_inquiry_handling: true,
  model_fit: true,
};

// ─── RS01: research loads canonical persisted prospect ────────────
test('RS01: research command loads canonical persisted prospect', () => {
  const { file, rows } = setupStore('rs01');
  const a = byName(rows, 'Alpha HVAC');
  assert.ok(a && a.prospect_id);
  assert.equal(loadProspect(file, a.prospect_id).business_name, 'Alpha HVAC');

  const res = researchAndPersist(file, 'pros_nope', { flags: {}, evidence: { text: 'x', class: 'OBSERVED' } });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'not_found');
  assert.equal(researchAndPersist(file, undefined, {}).ok, false);
});

// ─── RS02: operator research entry persists ───────────────────────
test('RS02: operator research entry persists and survives reload', () => {
  const { file, rows } = setupStore('rs02');
  const a = byName(rows, 'Alpha HVAC');
  const res = researchAndPersist(file, a.prospect_id, {
    flags: FLAGS,
    evidence: { text: 'Website contains an online request form.', class: 'OBSERVED', source: 'company_website' },
  });
  assert.equal(res.ok, true);
  const reloaded = getProspect(file, a.prospect_id);
  const items = evItems(reloaded);
  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'Website contains an online request form.');
  assert.equal(items[0].class, 'OBSERVED');
  assert.equal(items[0].source, 'company_website');
});

// ─── RS03: evidence classification persists ───────────────────────
test('RS03: research evidence classification persists', () => {
  const { file, rows } = setupStore('rs03');
  const e = byName(rows, 'Echo Landscaping');
  researchAndPersist(file, e.prospect_id, {
    flags: { service_area: true },
    evidence: { text: 'Service area is suburban.', class: 'INFERRED', source: 'operator_entered' },
  });
  const reloaded = getProspect(file, e.prospect_id);
  assert.equal(evItems(reloaded)[0].class, 'INFERRED', 'INFERRED stays INFERRED after reload');
  assert.equal(reloaded.evidence_class, 'INFERRED');
});

// ─── RS04: source/source URL persist ──────────────────────────────
test('RS04: research source and source URL persist', () => {
  const { file, rows } = setupStore('rs04');
  const a = byName(rows, 'Alpha HVAC');
  researchAndPersist(file, a.prospect_id, {
    flags: { service_area: true },
    evidence: { text: 'Listing captured from maps.', class: 'OBSERVED', source: 'google_maps' },
  });
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(evItems(reloaded)[0].source, 'google_maps');
  // operator_entered is the default when none is given.
  const b = byName(rows, 'Beta Plumbing');
  researchAndPersist(file, b.prospect_id, { flags: {}, evidence: { text: 'note', class: 'UNKNOWN' } });
  assert.equal(evItems(getProspect(file, b.prospect_id))[0].source, 'operator_entered');
});

// ─── RS05: research timestamp persists ────────────────────────────
test('RS05: research timestamp persists', () => {
  const { file, rows } = setupStore('rs05');
  const a = byName(rows, 'Alpha HVAC');
  const fixed = '2026-09-02T08:00:00.000Z';
  researchAndPersist(file, a.prospect_id, {
    flags: { service_area: true },
    evidence: { text: 'x', class: 'OBSERVED' },
    note: '',
  }, fixed);
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(evItems(reloaded)[0].at, fixed);
  assert.equal(reloaded.updated_at, fixed);
});

// ─── RS06: existing scorer runs after research ────────────────────
test('RS06: existing scorer runs after research (correct factor weights used)', () => {
  const { file, rows } = setupStore('rs06');
  const a = byName(rows, 'Alpha HVAC');
  const res = researchAndPersist(file, a.prospect_id, {
    flags: FLAGS,
    evidence: { text: 'Website has an online request form.', class: 'OBSERVED' },
  });
  assert.equal(res.ok, true);
  const expected = score(a, FLAGS, { cls: 'OBSERVED', text: 'Website has an online request form.' });
  assert.equal(res.value.opportunity_score, expected.score, 'score is produced by the exact validated scorer');
  assert.equal(res.value.opportunity_score, 90, '6 flags -> 20+20+15+10+10+15 = 90');
});

// ─── RS07: updated score persists ─────────────────────────────────
test('RS07: updated score persists and survives reload', () => {
  const { file, rows } = setupStore('rs07');
  const a = byName(rows, 'Alpha HVAC');
  assert.equal(getProspect(file, a.prospect_id).opportunity_score, 0); // before research
  researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.opportunity_score, 90, 'score updated and persisted');
});

// ─── RS08: updated score explanation persists ─────────────────────
test('RS08: updated score explanation persists', () => {
  const { file, rows } = setupStore('rs08');
  const a = byName(rows, 'Alpha HVAC');
  researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  const reloaded = getProspect(file, a.prospect_id);
  assert.ok(reloaded.opportunity_score_reason.length > 0, 'explanation persisted');
  assert.ok(reloaded.opportunity_score_reason.includes('Prospecting signal:'), 'reason is the validated scorer explanation');
  assert.ok(reloaded.opportunity_score_reason.length > 20);
});

// ─── RS09: research does not automatically approve ────────────────
test('RS09: research does not automatically approve', () => {
  const { file, rows } = setupStore('rs09');
  const a = byName(rows, 'Alpha HVAC');
  const res = researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  assert.equal(res.ok, true);
  assert.equal(res.value.opportunity_score, 90, 'score improved');
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.research_status, 'needs_review', 'high score does NOT auto-approve');
  assert.notEqual(reloaded.research_status, 'approved');
});

// ─── RS10: research does not automatically set outreach_ready ─────
test('RS10: research does not automatically set outreach_ready', () => {
  const { file, rows } = setupStore('rs10');
  const a = byName(rows, 'Alpha HVAC');
  researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.research_status, 'needs_review');
  assert.notEqual(reloaded.research_status, 'outreach_ready');
  assert.equal(reloaded.outreach_status, '', 'not queued by research');
});

// ─── RS11: suppression survives research ──────────────────────────
test('RS11: suppression survives research (fields intact, never removed)', () => {
  const { file, rows } = setupStore('rs11');
  const g = byName(rows, 'Gamma Electric');
  reviewAndPersist(file, g.prospect_id, 'suppress', 'opted_out');
  const suppressed = getProspect(file, g.prospect_id);
  assert.equal(isSuppressed(suppressed), true);
  const savedReason = suppressed.suppression_reason;
  const savedAt = suppressed.suppressed_at;

  const res = researchAndPersist(file, g.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  assert.equal(res.ok, true, 'research allowed on suppressed prospect as metadata update');
  const reloaded = getProspect(file, g.prospect_id);
  assert.equal(isSuppressed(reloaded), true, 'suppression survives research');
  assert.equal(reloaded.suppression_reason, savedReason, 'reason never cleared');
  assert.equal(reloaded.suppressed_at, savedAt, 'timestamp never cleared');
  assert.equal(reloaded.research_status, 'suppressed', 'research never un-suppresses');
});

// ─── RS12: suppressed prospect remains blocked ────────────────────
test('RS12: suppressed prospect remains blocked from outreach after research', () => {
  const { file, rows } = setupStore('rs12');
  const g = byName(rows, 'Gamma Electric');
  reviewAndPersist(file, g.prospect_id, 'suppress', 'opted_out');
  researchAndPersist(file, g.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  const reloaded = getProspect(file, g.prospect_id);
  const q = queueProspect(reloaded);
  assert.equal(q.ok, false);
  assert.equal(q.error, 'suppressed');
});

// ─── RS13: research survives process restart ──────────────────────
test('RS13: research survives process restart (reload after persist)', () => {
  const file = tmpFile('rs13');
  // PROCESS 1: import + persist.
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });
  const a = byName(listProspects(file), 'Alpha HVAC');

  // PROCESS 2 (fresh in-memory nothing shared): enter research.
  researchAndPersist(file, a.prospect_id, {
    flags: FLAGS,
    evidence: { text: 'Website contains an online request form.', class: 'OBSERVED', source: 'company_website' },
    note: 'Confirmed public inquiry channel.',
  });

  // PROCESS 3: cold reload — research and score survive.
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.opportunity_score, 90);
  assert.equal(evItems(reloaded)[0].text, 'Website contains an online request form.');
  assert.equal(evItems(reloaded)[0].class, 'OBSERVED');
  assert.ok(reloaded.research_notes.includes('OPERATOR:Confirmed public inquiry channel.'));
});

// ─── RS14: multiple evidence classifications remain distinct ──────
test('RS14: multiple evidence classifications remain distinct (never collapsed/upgraded)', () => {
  const { file, rows } = setupStore('rs14');
  const a = byName(rows, 'Alpha HVAC');
  researchAndPersist(file, a.prospect_id, {
    flags: { service_area: true },
    evidence: { text: 'Website contains an online request form.', class: 'OBSERVED', source: 'company_website' },
  });
  researchAndPersist(file, a.prospect_id, {
    flags: { inbound_lead_dependency: true },
    evidence: { text: 'Business likely receives inbound service inquiries.', class: 'INFERRED' },
  });
  researchAndPersist(file, a.prospect_id, {
    flags: {},
    evidence: { text: 'Actual abandoned-lead count.', class: 'UNKNOWN' },
  });
  const reloaded = getProspect(file, a.prospect_id);
  const items = evItems(reloaded);
  assert.deepEqual(items.map((i) => i.class), ['OBSERVED', 'INFERRED', 'UNKNOWN']);
  // INFERRED was NOT upgraded to a stronger class.
  assert.equal(items[1].class, 'INFERRED');
  // Texts remain distinct per item.
  assert.equal(items[0].text, 'Website contains an online request form.');
  assert.equal(items[1].text, 'Business likely receives inbound service inquiries.');
  assert.equal(items[2].text, 'Actual abandoned-lead count.');
});

// ─── RS15: existing review commands work after research ───────────
test('RS15: existing review commands work after research', () => {
  const { file, rows } = setupStore('rs15');
  const a = byName(rows, 'Alpha HVAC');
  researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  assert.equal(getProspect(file, a.prospect_id).research_status, 'needs_review');
  // Operator separately decides: approve, then ready.
  assert.equal(reviewAndPersist(file, a.prospect_id, 'approve').ok, true);
  const approved = getProspect(file, a.prospect_id);
  assert.equal(approved.research_status, 'approved');
  assert.equal(approved.opportunity_score, 90, 'score carried into review');
  assert.equal(reviewAndPersist(file, a.prospect_id, 'ready').ok, true);
  assert.equal(getProspect(file, a.prospect_id).research_status, 'outreach_ready');
  // list still works.
  const listed = listProspects(file);
  assert.equal(listed.length, 6);
});

// ─── RS16: outreach brief reflects updated research ───────────────
test('RS16: outreach brief reflects updated research (evidence + score, observed vs inferred distinct)', () => {
  const { file, rows } = setupStore('rs16');
  const a = byName(rows, 'Alpha HVAC');
  researchAndPersist(file, a.prospect_id, {
    flags: FLAGS,
    evidence: { text: 'Website contains an online request form.', class: 'OBSERVED', source: 'company_website' },
  });
  researchAndPersist(file, a.prospect_id, {
    flags: {},
    evidence: { text: 'Business likely receives inbound service inquiries.', class: 'INFERRED' },
  });
  reviewAndPersist(file, a.prospect_id, 'approve');

  const b = researchBrief(file, a.prospect_id);
  assert.equal(b.ok, true);
  // Brief now reflects the updated evidence + score + explanation (read-side
  // enrichment; the validated brief content is preserved).
  assert.equal(b.value.opportunity_score, 90);
  assert.ok(b.value.opportunity_score_reason.length > 0);
  assert.ok(b.value.observed_evidence.includes('Website contains an online request form.'));
  const items = b.value.evidence_items.map((i) => `${i.class}:${i.text}`);
  assert.equal(items[0], 'OBSERVED:Website contains an online request form.');
  assert.equal(items[1], 'INFERRED:Business likely receives inbound service inquiries.');
  // Protected brief still carries the observed-vs-inference framing.
  assert.ok(b.value.recovery_hypothesis.includes('hypothesis based on observed signals'));
  assert.ok(b.value.recovery_hypothesis.includes('no claim is made'));
  // The validated builder alone (without enrichment) is unchanged for a suppressed prospect.
  const g = byName(rows, 'Gamma Electric');
  reviewAndPersist(file, g.prospect_id, 'suppress', 'no_contact');
  assert.equal(reviewBrief(file, g.prospect_id).ok, false, 'validated brief still refuses suppressed');
});

// ─── RS17: failed persistence preserves store ─────────────────────
test('RS17: failed persistence preserves store and does not report success', () => {
  const { file, rows } = setupStore('rs17');
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
    res = researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  } finally {
    fs.writeFileSync = orig;
  }
  assert.equal(tmpAttempted, true);
  assert.equal(res.ok, false, 'must not report success when write fails');
  assert.equal(res.error, 'persist_failed');
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'store byte-for-byte intact');
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.opportunity_score, 0, 'no partial research persisted');
  assert.equal(evItems(reloaded).length, 0);
  const leftovers = fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'));
  assert.equal(leftovers.length, 0, 'no partial temp file remains');
});

// ─── RS18: no prospect/customer-lead boundary violation ───────────
test('RS18: research does not create customer-lead records or schema fields', () => {
  const { file, rows } = setupStore('rs18');
  const a = byName(rows, 'Alpha HVAC');
  const beforeCount = listProspects(file).length;
  researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  const after = listProspects(file);
  assert.equal(after.length, beforeCount, 'research never adds records');
  for (const forbidden of ['idempotency_key', 'booking_id', 'booked_at', 'booking_link_sent', 'owner_notified', 'last_customer_response_at']) {
    assert.ok(!PROSPECT_FIELDS.includes(forbidden), `prospect schema must not contain ${forbidden}`);
  }
  // research_evidence is a canonical PROSPECT field, not a customer-lead field.
  assert.ok(PROSPECT_FIELDS.includes('research_evidence'));
});

// ─── RS19: no production workflow modification ────────────────────
test('RS19: research does not modify production workflows', () => {
  assertProdUntouched(prodSnap);
  const expected = [31, 22, 24, 29, 10, 4, 13];
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    const j = JSON.parse(fs.readFileSync(path.join(PROD_DIR, PROTECTED_FILES[i]), 'utf8'));
    assert.equal(j.nodes.length, expected[i], `${PROTECTED_FILES[i]} node count changed`);
  }
});

// ─── RS20: existing 252 tests remain passing ──────────────────────
// RS20 is enforced by running the WHOLE suite; this test asserts the research
// additions did not expand the prospect schema into the customer-lead domain and
// that EVIDENCE_CLASSES keep the exact repository vocabulary (no silent upgrade
// path exists).
test('RS20: research additions keep the prospect schema within its boundary and evidence vocabulary exact', () => {
  assert.deepEqual(EVIDENCE_CLASSES, ['OBSERVED', 'INFERRED', 'CLIENT_PROVIDED', 'VERIFIED', 'UNKNOWN']);
  // Every score factor key is real and validated.
  const keys = new Set(FACTORS.map((f) => f.key));
  assert.ok(keys.has('appointment_dependency'));
  assert.ok(keys.has('model_fit'));
});

// ─── E2E-RESEARCH-01: needs_review → research(observed+inferred) → re-score → persist → reload ──
test('E2E-RESEARCH-01: needs_review -> research -> re-score -> persist -> reload -> verify', () => {
  const file = tmpFile('e2e1');
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });

  const a = byName(listProspects(file), 'Alpha HVAC');
  assert.equal(a.research_status, 'needs_review');
  assert.equal(a.opportunity_score, 0);

  // PROCESS 2: operator researches (observed + inferred evidence).
  researchAndPersist(file, a.prospect_id, {
    flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, model_fit: true },
    evidence: { text: 'Website contains an online request form.', class: 'OBSERVED', source: 'company_website' },
  });
  researchAndPersist(file, a.prospect_id, {
    flags: { service_area: true },
    evidence: { text: 'Service area suggests recurring appointments.', class: 'INFERRED' },
  });

  // PROCESS 3: cold reload — verify research + score persisted; status still needs_review.
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.opportunity_score, 80); // 20+20+15+15+10 = 80 (service_area weight = 10)
  assert.deepEqual(evItems(reloaded).map((i) => i.class), ['OBSERVED', 'INFERRED']);
  assert.equal(reloaded.research_status, 'needs_review');
  assert.notEqual(reloaded.research_status, 'approved');
});

// ─── E2E-RESEARCH-02: research → score improves → operator approves → outreach_ready → reload ──
test('E2E-RESEARCH-02: research -> approve -> outreach_ready -> reload -> verify', () => {
  const file = tmpFile('e2e2');
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });
  const a = byName(listProspects(file), 'Alpha HVAC');

  researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 'Website request form.', class: 'OBSERVED' } });
  assert.equal(getProspect(file, a.prospect_id).opportunity_score, 90);

  // Operator independently reviews after research.
  assert.equal(reviewAndPersist(file, a.prospect_id, 'approve').ok, true);
  assert.equal(reviewAndPersist(file, a.prospect_id, 'ready').ok, true);

  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.research_status, 'outreach_ready');
  assert.equal(reloaded.opportunity_score, 90);
  assert.equal(evItems(reloaded).length, 1);
});

// ─── E2E-RESEARCH-03: research → score improves → operator does NOT approve → stays needs_review ──
test('E2E-RESEARCH-03: research improves score but operator does not approve -> stays needs_review', () => {
  const file = tmpFile('e2e3');
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });
  const a = byName(listProspects(file), 'Alpha HVAC');

  researchAndPersist(file, a.prospect_id, { flags: FLAGS, evidence: { text: 'Website request form.', class: 'OBSERVED' } });
  // No approve/ready follows. Reload (new process).
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.opportunity_score, 90);
  assert.equal(reloaded.research_status, 'needs_review');
  assert.equal(reloaded.outreach_status, '');
  assert.equal(reloaded.outreach_attempts, 0);
});

// ─── E2E-RESEARCH-04: suppressed → research → persist → reload → stays suppressed → outreach blocked ──
test('E2E-RESEARCH-04: suppressed prospect stays suppressed and blocked after research', () => {
  const file = tmpFile('e2e4');
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });
  const g = byName(listProspects(file), 'Gamma Electric');
  reviewAndPersist(file, g.prospect_id, 'suppress', 'opted_out');

  // Research may update metadata but never removes suppression.
  const r = researchAndPersist(file, g.prospect_id, { flags: FLAGS, evidence: { text: 't', class: 'OBSERVED' } });
  assert.equal(r.ok, true);

  const reloaded = getProspect(file, g.prospect_id);
  assert.equal(isSuppressed(reloaded), true);
  assert.equal(reloaded.suppression_reason, 'opted_out');
  assert.equal(reloaded.research_status, 'suppressed');
  assert.equal(queueProspect(reloaded).ok, false);
  assert.equal(queueProspect(reloaded).error, 'suppressed');
  // brief refuses suppressed even with updated research.
  assert.equal(researchBrief(file, g.prospect_id).ok, false);
});

// ─── E2E-RESEARCH-05: research → process exits → process restarts → research available ──
test('E2E-RESEARCH-05: research survives full process exit and restart', () => {
  const file = tmpFile('e2e5');
  // PROCESS 1: import + persist.
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  persistBatch(res.records, { file });
  const a = byName(listProspects(file), 'Alpha HVAC');

  // PROCESS 2: research (as if a separate invocation, fresh read each time).
  const f1 = researchAndPersist(file, a.prospect_id, {
    flags: { appointment_dependency: true, inbound_lead_dependency: true, model_fit: true },
    evidence: { text: 'Website contains an online request form.', class: 'OBSERVED', source: 'company_website' },
  });
  assert.equal(f1.ok, true);

  // PROCESS 3: cold reload — everything available.
  const reloaded = getProspect(file, a.prospect_id);
  assert.equal(reloaded.opportunity_score, 55); // 20+20+15 = 55
  assert.equal(evItems(reloaded)[0].text, 'Website contains an online request form.');
  assert.equal(evItems(reloaded)[0].class, 'OBSERVED');
  assert.equal(evItems(reloaded)[0].source, 'company_website');
  assert.equal(reloaded.research_status, 'needs_review');
  // And the operator can continue review in the new process.
  assert.equal(reviewAndPersist(file, a.prospect_id, 'approve').ok, true);
  assert.equal(getProspect(file, a.prospect_id).research_status, 'approved');
});
