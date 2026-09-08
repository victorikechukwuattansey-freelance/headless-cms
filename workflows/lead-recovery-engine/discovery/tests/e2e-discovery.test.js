'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  buildProspect,
  ingestProspect,
  assessOpportunity,
  applySuppress,
} = require('../src/pipeline');
const { transition } = require('../src/lib/states');
const { isSuppressed } = require('../src/lib/suppress');
const { buildOutreachBrief } = require('../src/outreach-brief');
const { PROSPECT_FIELDS } = require('../src/prospect-model');

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
  return buildProspect({ business_name: 'Test Co', city: 'Austin', state: 'TX', ...fields }).value;
}

function fullPipeline(input, opts) {
  const built = buildProspect(input, opts);
  if (!built.ok) return built;
  return built;
}

function progressThroughResearch(record, evidence, opts) {
  transition(record, 'researching');
  transition(record, 'researched');
  assessOpportunity(record,
    { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true,
      service_area: true, manual_inquiry_handling: true, model_fit: true },
    evidence);
  record.research_notes = 'Manual research completed. Public website with inquiry form.';
  if (opts && opts.to === 'needs_review') {
    transition(record, 'needs_review');
  } else if (opts && opts.to === 'approved') {
    transition(record, 'needs_review');
    transition(record, 'approved');
  }
  return record;
}

let prodSnap;

test('PRODUCTION HASH SNAP', () => { prodSnap = snapProductionHashes(); });

// ─── 3. SOURCE PROVENANCE ──────────────────────────────────────────

test('PROVENANCE: google_maps source preserved through normalization', () => {
  const rec = makeRec({ source: 'google_maps', source_url: 'https://maps.google.com/place/123' });
  assert.equal(rec.source, 'google_maps');
  assert.equal(rec.source_url, 'https://maps.google.com/place/123');
  assert.ok(rec.discovery_date);
});

test('PROVENANCE: business_directory preserved', () => {
  const rec = makeRec({ source: 'business_directory', source_url: 'https://bbb.org/tx/austin' });
  assert.equal(rec.source, 'business_directory');
  assert.equal(rec.source_url, 'https://bbb.org/tx/austin');
});

test('PROVENANCE: company_website preserved', () => {
  const rec = makeRec({ source: 'company_website', source_url: 'https://hvac.example.com' });
  assert.equal(rec.source, 'company_website');
});

test('PROVENANCE: manual_linkedin_research preserved', () => {
  const rec = makeRec({ source: 'manual_linkedin_research', source_url: 'https://linkedin.com/in/operator-research' });
  assert.equal(rec.source, 'manual_linkedin_research');
});

test('PROVENANCE: operator_entered preserved', () => {
  const rec = makeRec({ source: 'operator_entered' });
  assert.equal(rec.source, 'operator_entered');
});

test('PROVENANCE: unknown source normalizes to operator_entered', () => {
  const rec = makeRec({ source: 'scraping_tool' });
  assert.equal(rec.source, 'operator_entered');
});

test('PROVENANCE: provenance survives deduplication (source data not lost)', () => {
  const a = buildProspect({ business_name: 'Same Biz', source: 'google_maps', source_url: 'https://maps.google.com/1' }).value;
  const b = ingestProspect(
    { business_name: 'Same Biz', website: 'https://samebiz.example.com', source: 'business_directory', source_url: 'https://bbb.org/1' },
    [a]
  );
  assert.equal(b.value.source, 'business_directory');
  assert.equal(b.value.source_url, 'https://bbb.org/1');
});

// ─── 4. NORMALIZATION ──────────────────────────────────────────────

test('NORMALIZE: equivalent domain representations produce identical result', () => {
  const { normalizeDomain } = require('../src/lib/normalize');
  assert.equal(normalizeDomain('https://www.Example.com/'), 'example.com');
  assert.equal(normalizeDomain('http://Example.com'), 'example.com');
  assert.equal(normalizeDomain('Example.com'), 'example.com');
  assert.equal(normalizeDomain('www.Example.com'), 'example.com');
});

test('NORMALIZE: phone normalization is consistent', () => {
  const { normalizePhone } = require('../src/lib/normalize');
  assert.equal(normalizePhone('(512) 555-0187'), '5125550187');
  assert.equal(normalizePhone('512-555-0187'), '5125550187');
  assert.equal(normalizePhone('5125550187'), '5125550187');
  assert.equal(normalizePhone('+1 512 555 0187'), '5125550187');
});

test('NORMALIZE: name normalization does not collapse distinct businesses', () => {
  const { normalizeName } = require('../src/lib/normalize');
  const a = normalizeName('Lone Star HVAC');
  const b = normalizeName('Lone Star Plumbing');
  assert.notEqual(a, b, 'HVAC vs Plumbing must differ');
});

// ─── 5. DEDUPLICATION ──────────────────────────────────────────────

test('DEDUP: exact domain match → HIGH confidence', () => {
  const a = buildProspect({ business_name: 'Biz A', website: 'https://same.example.com' }).value;
  const b = ingestProspect({ business_name: 'Biz B', website: 'https://same.example.com' }, [a]);
  assert.equal(b.duplicate, true);
  assert.equal(b.reason, 'domain');
});

test('DEDUP: normalized phone match → HIGH confidence', () => {
  const a = buildProspect({ business_name: 'Phone Co', phone: '5125550199', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'Phone Co Inc', phone: '(512) 555-0199', state: 'TX' }, [a]);
  assert.equal(b.duplicate, true);
  assert.equal(b.reason, 'phone');
});

test('DEDUP: name + city + state → MEDIUM confidence', () => {
  const a = buildProspect({ business_name: 'XYZ Roofing', city: 'Dallas', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'XYZ Roofing', city: 'Dallas', state: 'TX' }, [a]);
  assert.equal(b.duplicate, true);
  assert.equal(b.reason, 'business_name_plus_location');
  assert.notEqual(b.ambiguous, true, 'must not be ambiguous');
});

test('DEDUP: name + same state + same city → not ambiguous (MEDIUM)', () => {
  const a = buildProspect({ business_name: 'Same City Biz', city: 'Austin', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'Same City Biz', city: 'Austin', state: 'TX' }, [a]);
  assert.equal(b.duplicate, true);
  assert.equal(b.reason, 'business_name_plus_location');
  assert.notEqual(b.ambiguous, true, 'must not be ambiguous');
});

test('DEDUP: name + same state + DIFFERENT city → LOW confidence, AMBIGUOUS, HUMAN_REVIEW', () => {
  const a = buildProspect({ business_name: 'Smith Roofing', city: 'Austin', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'Smith Roofing', city: 'Dallas', state: 'TX' }, [a]);
  assert.equal(b.duplicate, true, 'should be flagged as duplicate');
  assert.equal(b.ambiguous, true, 'should be ambiguous');
  assert.equal(b.reason, 'business_name_plus_state');
  assert.equal(b.value.research_status, 'needs_review', 'must route to human review');
});

test('DEDUP: same name different state → NOT duplicate (different businesses)', () => {
  const a = buildProspect({ business_name: 'Quick Fix IT', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'Quick Fix IT', state: 'CA' }, [a]);
  assert.equal(b.duplicate, false);
});

test('DEDUP: clearly unrelated businesses with similar names → no merge', () => {
  const a = buildProspect({ business_name: 'ABC Plumbing', city: 'Austin', state: 'TX' }).value;
  const b = buildProspect({ business_name: 'ABC Electrical', city: 'Austin', state: 'TX' }).value;
  const { matchResult } = require('../src/lib/dedupe');
  const res = matchResult(a, b);
  assert.equal(res.isDuplicate, false, 'plumbing vs electrical must not match');
});

test('DEDUP: duplicate discovery from different sources → one business', () => {
  const a = ingestProspect(
    { business_name: 'Lone Star HVAC', website: 'https://lonestar.example.com', source: 'google_maps', source_url: 'https://maps.google.com/1' },
    []
  );
  assert.equal(a.duplicate, false);

  const b = ingestProspect(
    { business_name: 'Lone Star Heating & Cooling', website: 'https://lonestar.example.com', source: 'business_directory', source_url: 'https://bbb.org/1' },
    [a.value]
  );
  assert.equal(b.duplicate, true);
  assert.equal(b.reason, 'domain');
});

test('DEDUP: missing domain and phone → name+location match only', () => {
  const a = buildProspect({ business_name: 'No Contact Co', city: 'Austin', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'No Contact Co', city: 'Austin', state: 'TX' }, [a]);
  assert.equal(b.duplicate, true);
  assert.equal(b.reason, 'business_name_plus_location');
});

test('DEDUP: ambiguous records never silently merge', () => {
  const a = buildProspect({ business_name: 'Similar Name', city: 'Austin', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'Similar Name', city: 'Houston', state: 'TX' }, [a]);
  assert.equal(b.ambiguous, true);
  assert.equal(b.value.research_status, 'needs_review');
  assert.notEqual(b.value.prospect_id, a.prospect_id, 'must be separate records');
});

// ─── 6. EVIDENCE CLASSIFICATION ────────────────────────────────────

test('EVIDENCE: OBSERVED and VERIFIED are distinct classes', () => {
  const { classify } = require('../src/lib/evidence');
  const obs = classify({ cls: 'OBSERVED' });
  const ver = classify({ cls: 'VERIFIED' });
  assert.equal(obs.cls, 'OBSERVED');
  assert.equal(ver.cls, 'VERIFIED');
  assert.notEqual(obs.cls, ver.cls);
});

test('EVIDENCE: INFERRED does not equal VERIFIED', () => {
  const { classify } = require('../src/lib/evidence');
  const inf = classify({ cls: 'INFERRED' });
  const ver = classify({ cls: 'VERIFIED' });
  assert.equal(inf.cls, 'INFERRED');
  assert.notEqual(inf.cls, ver.cls);
});

test('EVIDENCE: score=0 when CLIENT_PROVIDED/VERIFIED lead-volume present (cannot prospect-score private data)', () => {
  const rec = makeRec({});
  const res = assessOpportunity(rec, { inbound_lead_dependency: true }, { cls: 'CLIENT_PROVIDED', text: 'Client claims 500 abandoned leads.' });
  assert.equal(res.score, 0, 'client-provided lead volume must not inflate prospecting score');
  assert.ok(res.reason.includes('CLIENT-PROVIDED'));
});

test('EVIDENCE: no unsupported claim generated for OBSERVED evidence', () => {
  const { isAllowedClaim } = require('../src/lib/evidence');
  assert.equal(isAllowedClaim('OBSERVED', 'lead_volume'), false);
  assert.equal(isAllowedClaim('OBSERVED', 'revenue'), false);
});

test('EVIDENCE: score reason must be an inference, not a factual claim of abandoned leads', () => {
  const rec = makeRec({});
  const res = assessOpportunity(rec, { inbound_lead_dependency: true }, { cls: 'OBSERVED', text: 'Website has inquiry form.' });
  assert.ok(!res.reason.includes('500'), 'must not fabricate lead count');
  assert.ok(res.reason.includes('inference') || res.reason.includes('Prospecting signal'),
    'reason must identify itself as inference/prospecting, not verified fact');
});

test('EVIDENCE: UNKNOWN class returns valid=false for unknown', () => {
  const { classify } = require('../src/lib/evidence');
  assert.equal(classify({ cls: 'INVALID' }).cls, 'UNKNOWN');
  assert.equal(classify({ cls: 'INVALID' }).valid, false);
});

// ─── 7. OPPORTUNITY SCORING ────────────────────────────────────────

test('SCORING: HIGH FIT — many strong signals', () => {
  const rec = makeRec({});
  const res = assessOpportunity(rec, {
    appointment_dependency: true,
    inbound_lead_dependency: true,
    service_ticket_value: true,
    business_scale: true,
    service_area: true,
    manual_inquiry_handling: true,
    followup_operational_difficulty: true,
    model_fit: true,
  }, { cls: 'OBSERVED', text: 'Public website with online inquiry form.' });
  assert.ok(res.score >= 80, `high fit score should be >= 80, got ${res.score}`);
  assert.equal(res.strength, 'strong');
  assert.ok(typeof res.reason === 'string' && res.reason.length > 20);
  assert.ok(res.factors.length >= 6);
});

test('SCORING: MEDIUM FIT — some signals', () => {
  const rec = makeRec({});
  const res = assessOpportunity(rec, {
    appointment_dependency: true,
    inbound_lead_dependency: true,
    service_area: true,
  }, { cls: 'OBSERVED' });
  assert.ok(res.score >= 40 && res.score < 70, `medium fit score should be 40-69, got ${res.score}`);
  assert.ok(res.strength === 'medium' || res.strength === 'strong');
});

test('SCORING: LOW FIT — minimal signals', () => {
  const rec = makeRec({});
  const res = assessOpportunity(rec, {
    service_area: true,
  }, { cls: 'OBSERVED' });
  assert.ok(res.score > 0 && res.score < 30, `low fit score should be < 30, got ${res.score}`);
  assert.equal(res.strength, 'weak');
});

test('SCORING: INSUFFICIENT DATA — no signals', () => {
  const rec = makeRec({});
  const res = assessOpportunity(rec, {}, { cls: 'UNKNOWN' });
  assert.equal(res.score, 0, 'no signals = score 0');
  assert.ok(res.reason.includes('Insufficient'));
});

test('SCORING: score is deterministic (same inputs → same output)', () => {
  const flags = { appointment_dependency: true, inbound_lead_dependency: true, service_area: true };
  const rec1 = makeRec({});
  const rec2 = makeRec({});
  const r1 = assessOpportunity(rec1, flags, { cls: 'OBSERVED' });
  const r2 = assessOpportunity(rec2, flags, { cls: 'OBSERVED' });
  assert.equal(r1.score, r2.score, 'same inputs must produce same score');
  assert.equal(r1.strength, r2.strength);
});

test('SCORING: score does not authorize outreach', () => {
  const rec = makeRec({});
  assessOpportunity(rec, {
    appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true,
    business_scale: true, service_area: true, manual_inquiry_handling: true,
    followup_operational_difficulty: true, model_fit: true,
  }, { cls: 'OBSERVED' });
  assert.notEqual(rec.research_status, 'outreach_ready', 'score must not auto-promote to outreach_ready');
  assert.equal(rec.outreach_status, '', 'outreach_status must remain empty');
});

// ─── 8. HUMAN REVIEW ──────────────────────────────────────────────

test('REVIEW: prospect enters needs_review from ambiguous dedup', () => {
  const a = buildProspect({ business_name: 'Review Me', city: 'Austin', state: 'TX' }).value;
  const b = ingestProspect({ business_name: 'Review Me', city: 'Dallas', state: 'TX' }, [a]);
  assert.equal(b.value.research_status, 'needs_review');
});

test('REVIEW: operator can approve', () => {
  const q = [
    makeRec({ business_name: 'Approve Me', prospect_id: 'p-approve-1' }),
  ];
  q[0].research_status = 'needs_review';
  const { reviewApproval } = require('../src/queue');
  const res = reviewApproval(q, 'p-approve-1');
  assert.equal(res.ok, true);
  assert.equal(q[0].research_status, 'approved');
});

test('REVIEW: operator can reject', () => {
  const q = [
    makeRec({ business_name: 'Reject Me', prospect_id: 'p-reject-1' }),
  ];
  q[0].research_status = 'needs_review';
  const { reviewRejected } = require('../src/queue');
  const res = reviewRejected(q, 'p-reject-1', 'poor_fit');
  assert.equal(res.ok, true);
  assert.ok(q[0].rejected);
  assert.ok(q[0].research_notes.includes('REJECTED:poor_fit'));
});

test('REVIEW: all rejection reasons are valid', () => {
  const reasons = ['poor_fit', 'insufficient_evidence', 'duplicate', 'wrong_business', 'wrong_geography', 'wrong_vertical', 'no_contact_path', 'suppressed', 'other'];
  const q = [
    makeRec({ business_name: 'Reject All', prospect_id: 'p-reject-all' }),
  ];
  q[0].research_status = 'needs_review';
  const { reviewRejected } = require('../src/queue');
  for (const r of reasons) {
    reviewRejected(q, 'p-reject-all', r);
    assert.ok(q[0].research_notes.includes(`REJECTED:${r}`), `reason ${r} should be recorded`);
  }
});

test('REVIEW: rejected prospect cannot become outreach_ready', () => {
  const q = [
    makeRec({ business_name: 'No Reach', prospect_id: 'p-noreach-1' }),
  ];
  q[0].research_status = 'needs_review';
  q[0].rejected = true;
  assert.throws(() => transition(q[0], 'outreach_ready'), /invalid_transition/);
});

// ─── 9. SUPPRESSION ───────────────────────────────────────────────

test('SUPPRESS: suppressed=true prevents outreach_ready', () => {
  const rec = makeRec({ business_name: 'Suppressed Biz' });
  applySuppress(rec, 'operator_suppressed');
  assert.equal(isSuppressed(rec), true);
  assert.equal(rec.research_status, 'suppressed');
  assert.throws(() => transition(rec, 'outreach_ready'), /suppressed/);
});

test('SUPPRESS: suppression before research blocks outreach', () => {
  const rec = makeRec({ business_name: 'Early Suppressed' });
  applySuppress(rec, 'poor_fit');
  assert.equal(isSuppressed(rec), true);
  assert.throws(() => transition(rec, 'researching'), /suppressed/);
});

test('SUPPRESS: suppression after research blocks outreach', () => {
  const rec = makeRec({ business_name: 'Late Suppressed' });
  transition(rec, 'researching');
  transition(rec, 'researched');
  applySuppress(rec, 'wrong_geography');
  assert.equal(isSuppressed(rec), true);
  assert.throws(() => transition(rec, 'approved'), /suppressed/);
});

test('SUPPRESS: suppression cannot be bypassed by changing other fields', () => {
  const rec = makeRec({ business_name: 'Bypass Test' });
  applySuppress(rec, 'operator');
  rec.city = 'NewCity';
  rec.state = 'NY';
  rec.research_status = 'suppressed';
  assert.equal(isSuppressed(rec), true);
  assert.throws(() => transition(rec, 'outreach_ready'), /suppressed/);
});

test('SUPPRESS: suppression is terminal (cannot exit)', () => {
  const rec = makeRec({ business_name: 'Terminal' });
  applySuppress(rec, 'other');
  assert.throws(() => transition(rec, 'approved'), /suppressed_is_terminal/);
  assert.throws(() => transition(rec, 'researching'), /suppressed_is_terminal/);
});

// ─── 10. OUTREACH-READY STATE ─────────────────────────────────────

test('OUTREACH_READY: only reachable after approved', () => {
  const rec = makeRec({ business_name: 'Ready Path' });
  transition(rec, 'researching');
  transition(rec, 'researched');
  transition(rec, 'needs_review');
  transition(rec, 'approved');
  transition(rec, 'outreach_ready');
  assert.equal(rec.research_status, 'outreach_ready');
});

test('OUTREACH_READY: means human may contact, NOT auto-send', () => {
  const rec = makeRec({ business_name: 'Ready Only' });
  transition(rec, 'researching');
  transition(rec, 'researched');
  transition(rec, 'needs_review');
  transition(rec, 'approved');
  transition(rec, 'outreach_ready');
  assert.equal(rec.outreach_status, '', 'outreach_status must be empty — no auto-send authorized');
  assert.equal(rec.outreach_attempts, 0, 'no outreach attempts recorded');
  assert.equal(rec.last_outreach_at, '', 'no outreach timestamp recorded');
});

test('OUTREACH_READY: queue function handles multi-step approval', () => {
  const q = [
    makeRec({ business_name: 'Queue Ready', prospect_id: 'p-qready-1' }),
  ];
  const { reachOutreachReady } = require('../src/queue');
  const res = reachOutreachReady(q, 'p-qready-1');
  assert.equal(res.ok, true);
  assert.equal(q[0].research_status, 'outreach_ready');
});

// ─── 11. PROSPECT / LEAD SEPARATION ────────────────────────────────

test('SEPARATION: prospect schema has no customer-lead fields', () => {
  const forbidden = ['idempotency_key', 'booking_id', 'booked_at', 'booked', 'booking_link_sent',
    'owner_notified', 'next_followup_at', 'last_contact_at', 'last_customer_response_at'];
  for (const f of forbidden) {
    assert.ok(!PROSPECT_FIELDS.includes(f), `PROSPECT_FIELDS must not contain '${f}'`);
  }
});

test('SEPARATION: prospect store code has no path to leads table', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8');
  assert.ok(!src.includes('leads'), 'store.js must not reference leads');
  assert.ok(!src.includes('business_config'), 'store.js must not reference business_config');
  assert.ok(!src.includes('bookings'), 'store.js must not reference bookings');
  assert.ok(!src.includes('errors'), 'store.js must not reference errors');
  assert.ok(!src.includes('status_updates'), 'store.js must not reference status_updates');
});

test('SEPARATION: pipeline code has no path to production/ or lead schemas', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'pipeline.js'), 'utf8');
  assert.ok(!src.includes('production'), 'pipeline.js must not reference production/');
});

test('SEPARATION: n8n workflow file does not reference production workflow paths', () => {
  const n8nPath = path.join(__dirname, '..', 'n8n', 'discovery-Discovery-Prospecting.json');
  if (fs.existsSync(n8nPath)) {
    const src = fs.readFileSync(n8nPath, 'utf8');
    assert.ok(!src.includes('01 - Lead Intake'), 'n8n workflow must not reference production 01');
    assert.ok(!src.includes('Follow-up Sweeper'), 'n8n workflow must not reference production 05');
  }
});

// ─── 12. OUTREACH BRIEF ───────────────────────────────────────────

test('BRIEF: approved prospect generates a complete brief', () => {
  const rec = makeRec({ business_name: 'Brief Biz', industry: 'HVAC', city: 'Austin', state: 'TX',
    recovery_signal: 'Appointment-driven service with online inquiry form',
    recovery_signal_evidence: 'Public website has contact form for service requests.',
    research_notes: 'Local business with active service area.',
  });
  transition(rec, 'researching');
  transition(rec, 'researched');
  transition(rec, 'needs_review');
  transition(rec, 'approved');
  const brief = buildOutreachBrief(rec);
  assert.equal(brief.ok, true);
  const b = brief.brief;
  assert.equal(b.business, 'Brief Biz');
  assert.equal(b.industry, 'HVAC');
  assert.equal(b.location, 'Austin, TX');
  assert.ok(b.why_they_may_fit.length > 0);
  assert.ok(b.observed_evidence.length > 0);
  assert.ok(b.recovery_hypothesis.includes('hypothesis'));
  assert.ok(b.recovery_hypothesis.includes('no claim'));
  assert.ok(b.personalization_points.length > 0);
  assert.ok(b.offer_angle.length > 0);
  assert.ok(b.call_to_action.length > 0);
  assert.ok(b.compliance_notes.length > 0);
});

test('BRIEF: suppressed prospect cannot generate a brief', () => {
  const rec = makeRec({ business_name: 'No Brief' });
  applySuppress(rec, 'operator');
  const brief = buildOutreachBrief(rec);
  assert.equal(brief.ok, false);
  assert.equal(brief.error, 'suppressed_prospect_no_brief');
});

test('BRIEF: brief does not invent lead counts', () => {
  const rec = makeRec({ business_name: 'No Invention' });
  transition(rec, 'researching');
  transition(rec, 'researched');
  transition(rec, 'needs_review');
  transition(rec, 'approved');
  const brief = buildOutreachBrief(rec);
  assert.ok(!brief.brief.recovery_hypothesis.includes('500'));
  assert.ok(!brief.brief.recovery_hypothesis.includes('$'));
  assert.ok(!brief.brief.observed_evidence.includes('verified'));
});

test('BRIEF: compliance notes mention documented contact policy', () => {
  const rec = makeRec({ business_name: 'Compliance Biz' });
  transition(rec, 'researching');
  transition(rec, 'researched');
  transition(rec, 'needs_review');
  transition(rec, 'approved');
  const brief = buildOutreachBrief(rec);
  assert.ok(brief.brief.compliance_notes.includes('contact policy'));
});

// ─── 13. FAILURE PATHS ────────────────────────────────────────────

test('FAILURE: malformed prospect (null) returns error', () => {
  assert.equal(buildProspect(null).ok, false);
  assert.equal(buildProspect(null).error, 'not_an_object');
});

test('FAILURE: missing business_name rejected', () => {
  const res = buildProspect({ website: 'https://noname.example.com' });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'missing_business_name');
});

test('FAILURE: invalid phone normalizes to empty', () => {
  const rec = makeRec({ phone: '12' });
  assert.equal(rec.phone, '');
});

test('FAILURE: invalid URL (malformed) normalizes domain to non-matching string', () => {
  const { normalizeDomain } = require('../src/lib/normalize');
  const result = normalizeDomain('not a valid url');
  assert.equal(typeof result, 'string');
  assert.notEqual(result, 'https://not a valid url', 'scheme is stripped/absent');
  const rec = buildProspect({ business_name: 'Bad URL Co', website: 'not a valid url' }).value;
  assert.equal(rec.domain, result, 'prospect stores the normalized string');
});

test('FAILURE: duplicate source record is flagged', () => {
  const a = ingestProspect({ business_name: 'Dup Fail', website: 'https://dup.example.com' }, []);
  const b = ingestProspect({ business_name: 'Dup Fail', website: 'https://dup.example.com' }, [a.value]);
  assert.equal(b.duplicate, true);
});

test('FAILURE: ambiguous duplicate resolves to needs_review', () => {
  const a = ingestProspect({ business_name: 'Ambig Fail', city: 'Austin', state: 'TX' }, []);
  const b = ingestProspect({ business_name: 'Ambig Fail', city: 'Houston', state: 'TX' }, [a.value]);
  assert.equal(b.ambiguous, true);
  assert.equal(b.value.research_status, 'needs_review');
});

test('FAILURE: insufficient evidence gives score=0 with explainable reason', () => {
  const rec = makeRec({});
  const res = assessOpportunity(rec, {}, { cls: 'UNKNOWN' });
  assert.equal(res.score, 0);
  assert.ok(res.reason.includes('Insufficient'));
});

test('FAILURE: suppressed prospect cannot transition (any field change does not bypass)', () => {
  const rec = makeRec({});
  applySuppress(rec, 'operator');
  rec.opportunity_score = 99;
  rec.evidence_class = 'VERIFIED';
  assert.equal(isSuppressed(rec), true);
  assert.throws(() => transition(rec, 'outreach_ready'), /suppressed/);
});

test('FAILURE: rejected prospect cannot become outreach_ready', () => {
  const q = [
    makeRec({ business_name: 'Reject Fail', prospect_id: 'p-rfail-1' }),
  ];
  q[0].research_status = 'needs_review';
  q[0].rejected = true;
  assert.throws(() => transition(q[0], 'outreach_ready'), /invalid_transition/);
});

// ─── 14. E2E SCENARIOS ────────────────────────────────────────────

test('E2E-01: Google Maps → normalized → researched → scored → approved → outreach_ready', () => {
  const built = buildProspect({
    business_name: 'Lone Star HVAC & Cooling',
    website: 'https://lonestar-hvac.example.com',
    industry: 'HVAC',
    city: 'Austin',
    state: 'TX',
    phone: '(512) 555-0187',
    public_email: 'info@lonestar-hvac.example.com',
    source: 'google_maps',
    source_url: 'https://maps.google.com/place/lonestar',
  });
  assert.equal(built.ok, true);
  const rec = built.value;
  assert.equal(rec.source, 'google_maps');
  assert.equal(rec.domain, 'lonestar-hvac.example.com');
  assert.equal(rec.phone, '5125550187');
  transition(rec, 'researching');
  transition(rec, 'researched');
  assessOpportunity(rec, {
    appointment_dependency: true, inbound_lead_dependency: true,
    service_ticket_value: true, service_area: true,
    manual_inquiry_handling: true, model_fit: true,
  }, { cls: 'OBSERVED', text: 'Public website with online inquiry form.' });
  rec.research_notes = 'HVAC business with active online presence and service area in Austin metro.';
  assert.ok(rec.opportunity_score >= 60);
  assert.equal(rec.evidence_class, 'OBSERVED');
  transition(rec, 'needs_review');
  transition(rec, 'approved');
  transition(rec, 'outreach_ready');
  assert.equal(rec.research_status, 'outreach_ready');
  assert.equal(rec.source, 'google_maps');
  assert.equal(rec.source_url, 'https://maps.google.com/place/lonestar');
  assert.ok(rec.created_at);
});

test('E2E-02: same business from directory → deduplicated, provenance retained', () => {
  const primary = buildProspect({
    business_name: 'Lone Star HVAC & Cooling',
    website: 'https://lonestar-hvac.example.com',
    source: 'google_maps',
    source_url: 'https://maps.google.com/place/lonestar',
  }).value;
  const deduped = ingestProspect({
    business_name: 'Lone Star HVAC & Cooling LLC',
    website: 'https://lonestar-hvac.example.com',
    source: 'business_directory',
    source_url: 'https://bbb.org/lonestar',
  }, [primary]);
  assert.equal(deduped.duplicate, true);
  assert.equal(deduped.reason, 'domain');
  assert.equal(deduped.value.source, 'business_directory');
  assert.equal(deduped.value.source_url, 'https://bbb.org/lonestar');
  assert.equal(deduped.value.domain, 'lonestar-hvac.example.com');
});

test('E2E-03: same name + same state + different city → ambiguous → human review, no merge', () => {
  const a = buildProspect({ business_name: 'Smith Roofing', city: 'Austin', state: 'TX', source: 'google_maps' }).value;
  const b = ingestProspect({ business_name: 'Smith Roofing', city: 'Dallas', state: 'TX', source: 'business_directory' }, [a]);
  assert.equal(b.duplicate, true);
  assert.equal(b.ambiguous, true);
  assert.equal(b.value.research_status, 'needs_review');
  assert.notEqual(b.value.prospect_id, a.prospect_id, 'must remain two separate records');
  assert.equal(b.value.source, 'business_directory', 'new record retains its own provenance');
});

test('E2E-04: insufficient evidence → needs_review, not outreach_ready', () => {
  const rec = makeRec({ business_name: 'Low Evidence Co' });
  transition(rec, 'researching');
  transition(rec, 'researched');
  assessOpportunity(rec, {}, { cls: 'UNKNOWN' });
  rec.research_notes = 'Insufficient data to score.';
  transition(rec, 'needs_review');
  assert.equal(rec.research_status, 'needs_review');
  assert.equal(rec.opportunity_score, 0);
  assert.throws(() => transition(rec, 'outreach_ready'), /invalid_transition/, 'must not jump to outreach_ready from needs_review');
});

test('E2E-05: suppressed prospect → blocked from outreach_ready', () => {
  const rec = makeRec({ business_name: 'Blocked Biz' });
  transition(rec, 'researching');
  transition(rec, 'researched');
  assessOpportunity(rec, { appointment_dependency: true, inbound_lead_dependency: true },
    { cls: 'OBSERVED', text: 'Has website.' });
  applySuppress(rec, 'wrong_geography');
  assert.equal(isSuppressed(rec), true);
  assert.equal(rec.research_status, 'suppressed');
  assert.throws(() => transition(rec, 'needs_review'), /suppressed_is_terminal/);
  assert.throws(() => transition(rec, 'outreach_ready'), /suppressed_is_terminal/);
});

test('E2E-06: rejected prospect → remains rejected, cannot reach outreach_ready', () => {
  const q = [
    makeRec({ business_name: 'Rejected Biz', prospect_id: 'p-e2e-06' }),
  ];
  q[0].research_status = 'needs_review';
  const { reviewRejected } = require('../src/queue');
  reviewRejected(q, 'p-e2e-06', 'wrong_vertical');
  assert.equal(q[0].research_notes.includes('REJECTED:wrong_vertical'), true);
  assert.ok(q[0].rejected);
  assert.throws(() => transition(q[0], 'outreach_ready'), /invalid_transition/);
});

test('E2E-07: valid prospect → outreach brief generated, no message sent', () => {
  const rec = makeRec({ business_name: 'Brief Co', industry: 'Plumbing', city: 'San Antonio', state: 'TX',
    recovery_signal: 'Appointment-dependent service with manual inquiry handling',
    recovery_signal_evidence: 'Public phone number and web contact form visible on Google Maps listing.',
    research_notes: 'Operator research confirmed active service area and inbound channels.',
  });
  transition(rec, 'researching');
  transition(rec, 'researched');
  assessOpportunity(rec, { appointment_dependency: true, inbound_lead_dependency: true, service_area: true, manual_inquiry_handling: true },
    { cls: 'OBSERVED', text: 'Google Maps listing with web form.' });
  transition(rec, 'needs_review');
  transition(rec, 'approved');
  transition(rec, 'outreach_ready');
  const brief = buildOutreachBrief(rec);
  assert.equal(brief.ok, true);
  assert.equal(brief.brief.business, 'Brief Co');
  assert.equal(brief.brief.location, 'San Antonio, TX');
  assert.ok(brief.brief.recovery_hypothesis.includes('hypothesis'));
  assert.ok(!brief.brief.recovery_hypothesis.includes('verified'));
  assert.ok(brief.brief.compliance_notes.includes('Not auto-sent'));
});

test('E2E-08: prospect record cannot enter customer leads table accidentally', () => {
  const rec = makeRec({ business_name: 'Separation Test' });
  assert.ok(!rec.idempotency_key, 'must not have idempotency_key');
  assert.ok(!rec.booking_id, 'must not have booking_id');
  assert.ok(!rec.booked_at, 'must not have booked_at');
  assert.ok(!rec.next_followup_at, 'must not have next_followup_at');
  assert.ok(!rec.owner_notified, 'must not have owner_notified');
  assert.equal(rec.research_status, 'discovered', 'has discovery state, not lead lifecycle');
  assert.equal(typeof rec.source, 'string', 'has source provenance — leads do not');
  assert.equal(typeof rec.opportunity_score, 'object', 'has score — leads do not');
  const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8');
  assert.ok(!storeSrc.includes('leads'), 'store.js has no reference to leads table');
  assert.ok(!storeSrc.includes('business_config'), 'store.js has no reference to business_config');
});

// ─── 15. PRODUCTION REGRESSION ─────────────────────────────────────

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
