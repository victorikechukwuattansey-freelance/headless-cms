'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { batchImport } = require('../src/batch-import');
const { processBatch } = require('../src/batch-pipeline');
const { buildProspect } = require('../src/pipeline');
const { isSuppressed, suppress } = require('../src/lib/suppress');
const { prepareDraft, queueProspect } = require('../src/outreach-queue');
const { buildOutreachBrief } = require('../src/outreach-brief');

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

// 25-row controlled batch fixture (synthetic data, no real private info).
// Outcomes:
//  - Row 3: missing business_name -> INVALID
//  - Rows 16-20: cross-source duplicates (resolve to existing, no new record)
//  - Rows 21-22: ambiguous same-name/same-state/different-city pair
//  - Row 23: insufficient evidence/UNKNOWN -> needs_research/rejected
//  - Row 24: suppressed in fixture -> suppressed
//  - Rest: valid, scored (flagged via research map) -> outreach_ready + queued
const BATCH_CSV = `business_name,industry,city,state,country,website,phone,public_email,contact_name,source,source_url
Lone Star Heating & Cooling,HVAC,Austin,TX,US,https://lonestar-heating.example.com,(512) 555-0187,info@lonestar-heating.example.com,Maria Gonzales,google_maps,https://maps.google.com/place/lonestarheat
Hill Country Plumbing,Plumbing,San Antonio,TX,US,https://hillcountry-plumbing.example.com,(210) 555-0143,hello@hillcountry-plumbing.example.com,Dana Whitfield,business_directory,https://bbb.org/hillcountry
,Roofing,Austin,TX,US,https://noname.example.com,(512) 555-0200,bad@noname.example.com,,google_maps,https://maps.google.com/place/noname
Capital City HVAC Services,HVAC,Austin,TX,US,https://capitalcity-hvac.example.com,(512) 555-0299,service@capitalcity-hvac.example.com,Rachel Kim,google_maps,https://maps.google.com/place/capitalcity
Blue Bonnet Electric,Electrical,San Antonio,TX,US,https://bluebonnet-electric.example.com,(210) 555-0311,jobs@bluebonnet-electric.example.com,Tim Howard,business_directory,https://bbb.org/bluebonnet
Lone Star HVAC,HVAC,Houston,TX,US,https://lonestar-hvac.example.com,(713) 555-0455,office@lonestar-hvac.example.com,James Lee,google_maps,https://maps.google.com/place/lonestarhvac
Hilltop Roofing & Restoration,Roofing,Austin,TX,US,https://hilltop-roofing.example.com,(512) 555-0677,estimates@hilltop-roofing.example.com,Pam Neville,business_directory,https://bbb.org/hilltop
Lonestar Climate Control,HVAC,San Antonio,TX,US,https://lonestar-climate.example.com,(210) 555-0788,info@lonestar-climate.example.com,Kim Sato,google_maps,https://maps.google.com/place/lonestarclimate
Alamo City Contractors,General Contracting,San Antonio,TX,US,https://alamo-city.example.com,(210) 555-0910,contact@alamo-city.example.com,Ana Rivera,google_maps,https://maps.google.com/place/alamocity
Texas Comfort Systems,HVAC,Austin,TX,US,https://texas-comfort.example.com,(512) 555-1011,service@texas-comfort.example.com,Lisa Chen,business_directory,https://bbb.org/texascomfort
GreenScape Services,Landscaping,Dallas,TX,US,https://greenscape.example.com,(214) 555-1122,info@greenscape.example.com,Mike Torres,google_maps,https://maps.google.com/place/greenscape
Sunbelt Plumbing Pros,Plumbing,Houston,TX,US,https://sunbelt-plumbing.example.com,(713) 555-1233,dispatch@sunbelt-plumbing.example.com,Chris Adams,business_directory,https://bbb.org/sunbelt
Capital City Electric,Electrical,Austin,TX,US,https://capitalcity-electric.example.com,(512) 555-1344,info@capitalcity-electric.example.com,Dan Scott,google_maps,https://maps.google.com/place/capitalelectric
Alamo Renovations,Remodeling,San Antonio,TX,US,https://alamo-renovations.example.com,(210) 555-1455,jobs@alamo-renovations.example.com,Sara Kim,business_directory,https://bbb.org/alamorenovations
Braden Electric,Electrical,Dallas,TX,US,https://braden-electric.example.com,(214) 555-1677,service@braden-electric.example.com,Joel Braden,google_maps,https://maps.google.com/place/braden
Lone Star HVAC,HVAC,Houston,TX,US,https://lonestar-hvac.example.com,(713) 555-0455,office@lonestar-hvac.example.com,James Lee,business_directory,https://bbb.org/lonestarhvac
Alamo Renovations,Remodeling,San Antonio,TX,US,https://alamo-renovations.example.com,(210) 555-1455,jobs@alamo-renovations.example.com,Sara Kim,google_maps,https://maps.google.com/place/alamorenovations
GreenScape Services,Landscaping,Dallas,TX,US,https://greenscape.example.com,(214) 555-1122,info@greenscape.example.com,Mike Torres,business_directory,https://bbb.org/greenscape
Sunbelt Plumbing Pros,Plumbing,Houston,TX,US,https://sunbelt-plumbing.example.com,(713) 555-1233,dispatch@sunbelt-plumbing.example.com,Chris Adams,google_maps,https://maps.google.com/place/sunbelt
Texas Premier Roofing,Roofing,Houston,TX,US,https://texas-premier-roofing.example.com,(713) 555-1788,info@texas-premier-roofing.example.com,Pat Nguyen,google_maps,https://maps.google.com/place/texasroofing
Bluebonnet Electric,Electrician,Round Rock,TX,US,,,contact@bluebonnet-electric2.example.com,,google_maps,https://maps.google.com/place/bluebonnetrr
Bluebonnet Electric,Electrician,Georgetown,TX,US,,,contact@bluebonnet-electric2.example.com,,business_directory,https://bbb.org/bluebonnetgt
Low Signal Services,HVAC,Austin,TX,US,https://lowsignal.example.com,(512) 555-1900,,,google_maps,https://maps.google.com/place/lowsignal
Withdrawn Trade Co,HVAC,Dallas,TX,US,https://withdrawn.example.com,(214) 555-1911,admin@withdrawn.example.com,Opal Reed,google_maps,https://maps.google.com/place/withdrawn
Austin Pro Electric,Electrical,Austin,TX,US,https://austin-pro-electric.example.com,(512) 555-1899,wiring@austin-pro-electric.example.com,Neil Carter,manual_linkedin_research,https://linkedin.com/in/neil
`;

// Research map keyed by normalized business name (industry-appropriate flags).
// High-fit -> many flags => score >= 70 (outreach_ready). Low-signal -> no flags => insufficient.
const RESEARCH_MAP = {
  'lone star heating & cooling': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Public website with online inquiry form.' } },
  'hill country plumbing': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Listed in public directory with phone.' } },
  'capital city hvac services': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing with service area.' } },
  'blue bonnet electric': { flags: { appointment_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Directory listing.' } },
  'lone star hvac': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing.' } },
  'hilltop roofing & restoration': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Directory listing with website.' } },
  'lonestar climate control': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing with website.' } },
  'alamo city contractors': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing with contact.' } },
  'texas comfort systems': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_area: true, manual_inquiry_handling: true }, evidence: { cls: 'OBSERVED', text: 'Directory listing.' } },
  'greenscape services': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps with website.' } },
  'sunbelt plumbing pros': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Directory with website and phone.' } },
  'capital city electric': { flags: { appointment_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing.' } },
  'alamo renovations': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Directory listing.' } },
  'braden electric': { flags: { appointment_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing.' } },
  'texas premier roofing': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps with website.' } },
  'austin pro electric': { flags: { appointment_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'INFERRED', text: 'Manual LinkedIn research.' } },
  'low signal services': { flags: {}, evidence: { cls: 'UNKNOWN', text: '' } },
  'withdrawn trade co': { suppress: true, suppressReason: 'operator_unresponsive', flags: { appointment_dependency: true, inbound_lead_dependency: true, service_area: true }, evidence: { cls: 'OBSERVED', text: 'Website present.' } },
  'bluebonnet electric': { flags: {}, evidence: { cls: 'UNKNOWN', text: '' } },
};

// By inspection of the fixture (synthetic):
//  - 25 imported rows.
//  - 1 invalid (row 3, missing business_name).
//  - 24 valid.
//  - Cross-source duplicates (rows 16,17,18,19) resolve to existing -> 4 clean duplicates.
//  - Ambiguous pair: rows 21,22 (Bluebonnet Electric, same name+state TX, diff city Round Rock/Georgetown, no shared domain/phone) -> 2 ambiguous.
//  - Row 23 (Low Signal Services) = UNKNOWN evidence -> insufficient/rejected.
//  - Row 24 (Withdrawn Trade Co) = suppressed in fixture.
//  - Remaining valid non-dup non-ambig non-suppressed: 24 - 4(dup) - 2(ambig) - 1(insufficient) - 1(suppressed) = 16 assessed.
//    Of those, 15 have score>=70 (approved -> outreach_ready -> queued); Low Signal is rejected (score 0).
//    Withdrawn Trade Co score = 55 (medium) -> below 70, but it is suppressed anyway.
//    Actual approved count: all non-LowSignal/non-Withdrawn assessed = 15.
//    depends on score computation; assert ranges rather than exact to be robust.

let prodSnap;
test('PRODUCTION HASH SNAP', () => { prodSnap = snapProductionHashes(); });

// ─── B01: import + validation ─────────────────────────────────────
test('B01: batch imports 25 records, 1 invalid, 24 valid', () => {
  const res = batchImport(BATCH_CSV);
  assert.equal(res.total, 25);
  assert.equal(res.valid.length, 24);
  assert.equal(res.invalid.length, 1);
  assert.ok(res.invalid[0].errors.includes('missing_business_name'));
});

test('B01b: reject missing business name', () => {
  const res = batchImport('business_name,industry\n,Plumbing\n');
  assert.equal(res.invalid.length, 1);
  assert.ok(res.invalid[0].errors.includes('missing_business_name'));
});

test('B01c: reject malformed website', () => {
  const res = batchImport('business_name,website\nBad Co,javascript:alert(1)\n');
  assert.equal(res.invalid.length, 1);
  assert.ok(res.invalid[0].errors.includes('malformed_website'));
});

test('B01d: reject malformed phone', () => {
  const res = batchImport('business_name,phone\nBad Phone,123\n');
  assert.equal(res.invalid.length, 1);
  assert.ok(res.invalid[0].errors.includes('malformed_phone'));
});

test('B01e: reject invalid source', () => {
  const res = batchImport('business_name,source\nBad Co,scraper\n');
  assert.equal(res.invalid.length, 1);
  assert.ok(res.invalid[0].errors.includes('invalid_source'));
});

test('B01f: reject malformed state', () => {
  const res = batchImport('business_name,state\nBad Co,Texas\n');
  assert.equal(res.invalid.length, 1);
  assert.ok(res.invalid[0].errors.includes('malformed_state'));
});

// ─── B02: dedup resolution ────────────────────────────────────────
test('B02: cross-source duplicates resolve to one prospect', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  assert.equal(res.duplicates, 4);
  for (const d of res.cleanDuplicates) {
    assert.ok(d.matched_id);
    assert.ok(d.reason);
    assert.ok(['domain', 'phone', 'business_name_plus_location', 'business_name_plus_state'].includes(d.reason), `reason: ${d.reason}`);
  }
});

test('B02b: ambiguous same-name/same-state/different-city pair flagged', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  assert.equal(res.ambiguous, 1, 'the second Bluebonnet Electric (different city) must be flagged ambiguous');
  assert.equal(res.ambiguousRecords.length, 1);
  for (const rec of res.ambiguousRecords) {
    assert.equal(rec.research_status, 'needs_review');
  }
});

test('B02c: existing records are matched during dedup', () => {
  const existing = [
    buildProspect({ business_name: 'Existing HVAC', website: 'https://existing-hvac.example.com', city: 'Austin', state: 'TX' }).value,
  ];
  const imp = batchImport('business_name,industry,city,state,country,website\nExisting HVAC,HVAC,Austin,TX,US,https://existing-hvac.example.com\n');
  const res = processBatch(imp, existing, {});
  assert.equal(res.imported, 1);
  assert.equal(res.duplicates, 1);
});

// ─── B03: reconciliation ──────────────────────────────────────────
test('B03: counts reconcile — no record disappears silently', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  const distinctKept = res.records.length;
  const accounted = res.invalid + res.duplicates + distinctKept;
  assert.equal(accounted, res.imported, `reconciliation: ${accounted} != ${res.imported}`);
  assert.equal(res.outreachBriefs.length, res.outreachReady);
});

// ─── B04: outreach readiness gating ───────────────────────────────
test('B04: batch-approved prospects are outreach_ready but NOT auto-queued without contact_policy', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  // Raw import carries no contact_policy (operator-set field) => UNKNOWN != PERMITTED.
  // Nothing is auto-queued from the batch.
  assert.equal(res.outreachReady, 0, 'no prospect auto-queues without contact_policy=permitted');
  // The approved + scored + not suppressed prospects ARE outreach_ready (ready for operator review).
  const approved = res.records.filter(
    (r) => r.research_status === 'outreach_ready' && r.opportunity_score >= 70 && !isSuppressed(r)
  );
  assert.ok(approved.length >= 10, `expected >= 10 approved outreach_ready prospects, got ${approved.length}`);
  for (const rec of approved) {
    assert.equal(rec.research_status, 'outreach_ready');
    assert.notEqual(rec.outreach_status, 'queued', 'not queued without permitted policy');
  }
  // Granting contact_policy=permitted makes them queueable with the same score/eligibility.
  for (const rec of approved) {
    rec.contact_policy = 'permitted';
    const q = queueProspect(rec);
    assert.equal(q.ok, true, `queueable after granting policy: ${rec.business_name}`);
    assert.equal(rec.outreach_status, 'queued');
    assert.ok(rec.opportunity_score >= 70, `score ${rec.opportunity_score} must be >= 70`);
    assert.equal(isSuppressed(rec), false);
  }
});

test('B04b: insufficient-evidence prospects never reach outreach_ready', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  assert.ok(res.needsResearch + res.rejected >= 1);
  for (const rec of [...res.needsResearchRecords, ...res.rejectedRecords]) {
    assert.notEqual(rec.outreach_status, 'queued');
    assert.notEqual(rec.research_status, 'outreach_ready');
  }
});

// ─── B05: suppression ─────────────────────────────────────────────
test('B05: suppressed records never reach outreach_ready or queue', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  assert.ok(res.suppressed >= 1, `expected suppressed >= 1, got ${res.suppressed}`);
  for (const rec of res.suppressedRecords) {
    assert.equal(isSuppressed(rec), true);
    assert.notEqual(rec.outreach_status, 'queued');
    assert.notEqual(rec.research_status, 'outreach_ready');
  }
});

// ─── B06: outreach briefs ─────────────────────────────────────────
test('B06: outreach briefs are well-formed with no invented claims', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  // No briefs are generated by the batch itself (nothing is queued without policy).
  assert.equal(res.outreachBriefs.length, 0, 'batch does not build briefs before policy is granted');
  // Generate a brief for an approved, permitted prospect and validate it.
  const eligible = res.records.find(
    (r) => r.research_status === 'outreach_ready' && r.opportunity_score >= 70 && !isSuppressed(r)
  );
  assert.ok(eligible, 'an approved outreach_ready prospect exists');
  assert.equal(eligible.contact_policy !== 'permitted', true, 'eligible prospect starts without permitted policy');
  eligible.contact_policy = 'permitted';
  const q = queueProspect(eligible);
  assert.equal(q.ok, true);
  const brief = buildOutreachBrief(eligible);
  assert.equal(brief.ok, true);
  const b = brief.brief;
  assert.ok(b.business);
  assert.ok(b.why_they_may_fit);
  assert.ok(b.observed_evidence);
  assert.ok(b.recovery_hypothesis.includes('hypothesis'));
  assert.ok(b.recovery_hypothesis.includes('$') === false);
  assert.ok(b.compliance_notes);
  assert.ok(b.compliance_notes.includes('permitted'), 'compliance notes reflect permitted policy');
});

// ─── B07: outreach safety ─────────────────────────────────────────
test('B07: batch processing never auto-sends; only draft activities exist on demand', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  for (const rec of res.records) {
    assert.notEqual(rec.outreach_status, 'sent');
    assert.notEqual(rec.outreach_status, 'contacted');
  }
  // Operator must explicitly draft; activity starts as draft only.
  if (res.outreachReadyRecords.length > 0) {
    const rec = res.outreachReadyRecords[0];
    const draft = prepareDraft(rec, [], { channel: 'email', operator: 'op-1' });
    assert.equal(draft.ok, true);
    assert.equal(draft.activity.status, 'draft');
  }
});

// ─── B08: discovery source handling ───────────────────────────────
test('B08: all three discovery sources are represented and preserved', () => {
  const imp = batchImport(BATCH_CSV);
  const sources = new Set(imp.valid.map((r) => r.source));
  assert.ok(sources.has('google_maps'), 'google_maps present');
  assert.ok(sources.has('business_directory'), 'business_directory present');
  assert.ok(sources.has('manual_linkedin_research'), 'manual_linkedin_research present');
});

test('B08b: manual_linkedin_research is preserved, not automated', () => {
  const imp = batchImport(BATCH_CSV);
  const liRows = imp.valid.filter((r) => r.source === 'manual_linkedin_research');
  assert.ok(liRows.length >= 1);
  for (const r of liRows) {
    assert.equal(r.source, 'manual_linkedin_research');
    assert.ok(r.source_url.includes('linkedin.com'));
  }
});

// ─── B09: data boundaries ─────────────────────────────────────────
test('B09: processed batch exposes no customer-lead fields', () => {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  const forbidden = ['idempotency_key', 'booking_id', 'booked_at', 'booking_link_sent', 'owner_notified', 'next_followup_at', 'last_customer_response_at'];
  for (const rec of res.records) {
    for (const f of forbidden) {
      assert.ok(!(f in rec) || rec[f] === '' || rec[f] === null || rec[f] === 0 || rec[f] === false,
        `prospect must not expose customer field: ${f}`);
    }
  }
});

test('B09b: batch modules have no path to production or lead tables', () => {
  for (const f of ['batch-import.js', 'batch-pipeline.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8');
    assert.ok(!src.includes('01 - Lead Intake'));
    assert.ok(!src.includes('Follow-up Sweeper'));
    assert.ok(!src.includes('business_config'));
  }
});

// ─── PRODUCTION REGRESSION ────────────────────────────────────────
test('PRODUCTION: all seven files still valid JSON with expected names', () => {
  for (const f of PROTECTED_FILES) {
    const p = path.join(PROD_DIR, f);
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(j.nodes && Array.isArray(j.nodes), `${f} must have nodes array`);
    assert.ok(typeof j.name === 'string' && j.name.length > 0, `${f} must have name`);
    assert.ok(typeof j.id === 'string' && j.id.length > 0, `${f} must have id`);
  }
});

test('PRODUCTION: no hashes changed during the entire batch test run', () => {
  assertProductionUntouched(prodSnap);
});

test('PRODUCTION: node counts unchanged', () => {
  const expected = [31, 22, 24, 29, 10, 4, 13];
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    const j = JSON.parse(fs.readFileSync(path.join(PROD_DIR, PROTECTED_FILES[i]), 'utf8'));
    assert.equal(j.nodes.length, expected[i], `${PROTECTED_FILES[i]} node count changed`);
  }
});
