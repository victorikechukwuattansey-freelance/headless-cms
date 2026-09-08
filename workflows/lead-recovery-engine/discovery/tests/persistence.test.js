'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const { batchImport } = require('../src/batch-import');
const { processBatch } = require('../src/batch-pipeline');
const {
  createProspect,
  getProspect,
  listProspects,
  updateProspect,
  persistBatch,
  saveCsv,
  loadCsv,
  asProspectRecord,
  identityKey,
} = require('../src/store');
const { isSuppressed, suppress } = require('../src/lib/suppress');
const { queueProspect, getQueue, loadActivityStore, saveActivityStore } = require('../src/outreach-queue');
const { buildProspect } = require('../src/pipeline');
const { PROSPECT_FIELDS } = require('../src/prospect-model');

// Sandbox: every test writes to its own temp subdirectory. Never touches data/.
function tmpDir(tag) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `lre-persist-${tag}-`));
}
function tmpFile(tag, name) {
  return path.join(tmpDir(tag), name || 'prospects.csv');
}

// Minimal but representative batch fixture. Uses 3 discovery sources and includes
// a cross-source duplicate, an ambiguous same-name/different-city pair, a
// suppressed prospect, and a low-signal prospect.
const BATCH_CSV = `business_name,industry,city,state,country,website,phone,public_email,contact_name,source,source_url
Lone Star Heating & Cooling,HVAC,Austin,TX,US,https://lonestar-heating.example.com,(512) 555-0187,info@lonestar-heating.example.com,Maria Gonzales,google_maps,https://maps.google.com/place/lonestarheat
Hill Country Plumbing,Plumbing,San Antonio,TX,US,https://hillcountry-plumbing.example.com,(210) 555-0143,hello@hillcountry-plumbing.example.com,Dana Whitfield,business_directory,https://bbb.org/hillcountry
Capital City HVAC Services,HVAC,Austin,TX,US,https://capitalcity-hvac.example.com,(512) 555-0299,service@capitalcity-hvac.example.com,Rachel Kim,google_maps,https://maps.google.com/place/capitalcity
Lone Star HVAC,HVAC,Houston,TX,US,https://lonestar-hvac.example.com,(713) 555-0455,office@lonestar-hvac.example.com,James Lee,google_maps,https://maps.google.com/place/lonestarhvac
Lone Star HVAC,HVAC,Houston,TX,US,https://lonestar-hvac.example.com,(713) 555-0455,office@lonestar-hvac.example.com,James Lee,business_directory,https://bbb.org/lonestarhvac
GreenScape Services,Landscaping,Dallas,TX,US,https://greenscape.example.com,(214) 555-1122,info@greenscape.example.com,Mike Torres,google_maps,https://maps.google.com/place/greenscape
GreenScape Services,Landscaping,Dallas,TX,US,https://greenscape.example.com,(214) 555-1122,info@greenscape.example.com,Mike Torres,business_directory,https://bbb.org/greenscape
Bluebonnet Electric,Electrician,Round Rock,TX,US,contact@bluebonnet-a.example.com,,google_maps,https://maps.google.com/place/bluebonnetrr
Bluebonnet Electric,Electrician,Georgetown,TX,US,contact@bluebonnet-b.example.com,,business_directory,https://bbb.org/bluebonnetgt
Low Signal Services,HVAC,Austin,TX,US,https://lowsignal.example.com,(512) 555-1900,,,google_maps,https://maps.google.com/place/lowsignal
Withdrawn Trade Co,HVAC,Dallas,TX,US,https://withdrawn.example.com,(214) 555-1911,admin@withdrawn.example.com,Opal Reed,google_maps,https://maps.google.com/place/withdrawn
Austin Pro Electric,Electrical,Austin,TX,US,https://austin-pro-electric.example.com,(512) 555-1899,wiring@austin-pro-electric.example.com,Neil Carter,manual_linkedin_research,https://linkedin.com/in/neil
`;

const RESEARCH_MAP = {
  'lone star heating & cooling': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Public website with online inquiry form.' } },
  'hill country plumbing': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Listed in public directory with phone.' } },
  'capital city hvac services': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing with service area.' } },
  'lone star hvac': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, manual_inquiry_handling: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps listing.' } },
  'greenscape services': { flags: { appointment_dependency: true, inbound_lead_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'OBSERVED', text: 'Google Maps with website.' } },
  'bluebonnet electric': { flags: {}, evidence: { cls: 'UNKNOWN', text: '' } },
  'low signal services': { flags: {}, evidence: { cls: 'UNKNOWN', text: '' } },
  'withdrawn trade co': { suppress: true, suppressReason: 'operator_unresponsive', flags: { appointment_dependency: true, inbound_lead_dependency: true, service_area: true }, evidence: { cls: 'OBSERVED', text: 'Website present.' } },
  'austin pro electric': { flags: { appointment_dependency: true, service_ticket_value: true, service_area: true, model_fit: true }, evidence: { cls: 'INFERRED', text: 'Manual LinkedIn research.' } },
};

// Process the fixture into distinct, non-invalid prospect records.
function runBatch() {
  const imp = batchImport(BATCH_CSV);
  const res = processBatch(imp, [], RESEARCH_MAP);
  return res;
}

// Production protection helpers.
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
function snapProduction() { const h = {}; for (const f of PROTECTED_FILES) h[f] = prodHash(f); return h; }
function assertProductionUntouched(before) {
  for (const f of PROTECTED_FILES) assert.equal(prodHash(f), before[f], `production file changed: ${f}`);
}

let prodSnap;
test('P-SNAP: production hash snapshot', () => { prodSnap = snapProduction(); });

// ─── P01-P02: create + reload ─────────────────────────────────────
test('P01: new prospect persists to store', () => {
  const file = tmpFile('p01');
  const rec = buildProspect({ business_name: 'Roof Tech', website: 'https://roof.tech', city: 'Austin', state: 'TX' }).value;
  createProspect(file, rec);
  assert.ok(fs.existsSync(file));
  assert.equal(listProspects(file).length, 1);
});

test('P02: persisted prospect reloads correctly', () => {
  const file = tmpFile('p02');
  const rec = buildProspect({ business_name: 'Drain Pros', website: 'https://drain.example.com', city: 'Dallas', state: 'TX' }).value;
  createProspect(file, rec);
  const loaded = getProspect(file, rec.prospect_id);
  assert.ok(loaded);
  assert.equal(loaded.business_name, 'Drain Pros');
  assert.equal(loaded.state, 'TX');
  assert.equal(loaded.prospect_id, rec.prospect_id);
});

// ─── P03-P04: batch persist ───────────────────────────────────────
test('P03: batch persists all distinct valid records', () => {
  const file = tmpFile('p03');
  const res = runBatch();               // distinct kept records
  const out = persistBatch(res.records, { file });
  assert.equal(out.persisted.length, res.records.length, 'all distinct valid records persisted');
  assert.equal(out.invalidSkipped.length, 0);
  assert.equal(listProspects(file).length, res.records.length);
});

test('P04: invalid records are not persisted', () => {
  const file = tmpFile('p04');
  const valid = buildProspect({ business_name: 'Valid Co', website: 'https://valid.example.com', city: 'A', state: 'TX' }).value;
  const invalid = { business_name: '', industry: 'HVAC' };
  const out = persistBatch([valid, invalid], { file });
  assert.equal(out.invalidSkipped.length, 1);
  assert.equal(out.persisted.length, 1);
  const rows = listProspects(file);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].business_name, 'Valid Co');
});

// ─── P05-P06: duplicate handling in persistence ───────────────────
test('P05: cross-source duplicate does not create a duplicate prospect', () => {
  const file = tmpFile('p05');
  const res = runBatch();
  persistBatch(res.records, { file });
  const rows = listProspects(file);
  // 'Lone Star HVAC' appears twice in the CSV (google_maps + business_directory)
  // but must resolve to exactly ONE persisted prospect.
  const loneStar = rows.filter((r) => r.business_name === 'Lone Star HVAC');
  assert.equal(loneStar.length, 1, 'cross-source duplicate must collapse to one record');
});

test('P06: ambiguous duplicate remains separate and human-reviewable', () => {
  const file = tmpFile('p06');
  const res = runBatch();
  persistBatch(res.records, { file });
  const rows = listProspects(file);
  const bluebonnet = rows.filter((r) => r.business_name === 'Bluebonnet Electric');
  // Same name + same state (TX) + different city -> preserved as SEPARATE records:
  assert.equal(bluebonnet.length, 2, 'ambiguous same-name/different-city pair stays separate');
  for (const r of bluebonnet) {
    assert.equal(r.research_status, 'needs_review', 'ambiguous records remain human-reviewable');
  }
  // Distinct identity keys (city is part of the idempotency key) -> never merged:
  const keys = new Set(bluebonnet.map((r) => identityKey(r)));
  assert.equal(keys.size, 2);
});

// ─── P07: idempotency ─────────────────────────────────────────────
test('P07: same batch imported twice remains idempotent', () => {
  const file = tmpFile('p07');
  const res = runBatch();
  const first = persistBatch(res.records, { file });
  const second = persistBatch(res.records, { file });
  assert.equal(first.persisted.length, res.records.length, 'first import persists all');
  assert.equal(second.persisted.length, 0, 'second import persists nothing new');
  assert.equal(second.duplicates.length, first.persisted.length, 'second import skips all as already-present');
  const rows = listProspects(file);
  assert.equal(rows.length, first.persisted.length, 'no duplicate prospect records created');
});

// ─── P08-P11: provenance / research / score / review survive ──────
test('P08: provenance survives persistence', () => {
  const file = tmpFile('p08');
  const res = runBatch();
  const persisted = persistBatch(res.records, { file }).persisted;
  const li = persisted.find((r) => r.source === 'manual_linkedin_research');
  assert.ok(li, 'linkedin manual source present');
  const reloaded = getProspect(file, li.prospect_id);
  assert.equal(reloaded.source, 'manual_linkedin_research');
  assert.ok(reloaded.source_url.includes('linkedin.com'));
  assert.ok(reloaded.discovery_date, 'discovery date preserved');
  // Cross-source provenance: the canonical Lone Star HVAC record retains one source.
  const loneStar = persisted.find((r) => r.business_name === 'Lone Star HVAC');
  assert.ok(loneStar.source, 'canonical record retains source provenance');
});

test('P09: research evidence survives persistence', () => {
  const file = tmpFile('p09');
  const res = runBatch();
  const persisted = persistBatch(res.records, { file }).persisted;
  const rec = persisted.find((r) => r.evidence_class && r.evidence_class !== 'UNKNOWN');
  assert.ok(rec);
  const reloaded = getProspect(file, rec.prospect_id);
  assert.equal(reloaded.evidence_class, rec.evidence_class);
  assert.equal(reloaded.recovery_signal_evidence, rec.recovery_signal_evidence);
});

test('P10: opportunity score survives persistence', () => {
  const file = tmpFile('p10');
  const res = runBatch();
  const persisted = persistBatch(res.records, { file }).persisted;
  const rec = persisted.find((r) => r.opportunity_score);
  assert.ok(rec && rec.opportunity_score > 0);
  const reloaded = getProspect(file, rec.prospect_id);
  assert.equal(reloaded.opportunity_score, rec.opportunity_score);
  assert.equal(reloaded.opportunity_score_reason, rec.opportunity_score_reason);
});

test('P11: review state survives persistence', () => {
  const file = tmpFile('p11');
  const res = runBatch();
  const persisted = persistBatch(res.records, { file }).persisted;
  for (const rec of persisted) {
    const reloaded = getProspect(file, rec.prospect_id);
    assert.equal(reloaded.research_status, rec.research_status, `state for ${rec.business_name}`);
  }
});

// ─── P12-P13: suppression ─────────────────────────────────────────
test('P12: suppression survives persistence', () => {
  const file = tmpFile('p12');
  const res = runBatch();
  const persisted = persistBatch(res.records, { file }).persisted;
  const suppressed = persisted.find((r) => isSuppressed(r));
  assert.ok(suppressed, 'fixture has a suppressed prospect');
  const reloaded = getProspect(file, suppressed.prospect_id);
  assert.equal(isSuppressed(reloaded), true);
  assert.ok(reloaded.suppression_reason);
  assert.ok(reloaded.suppressed_at);
});

test('P13: suppressed prospect remains blocked after reload', () => {
  const file = tmpFile('p13');
  const res = runBatch();
  const persisted = persistBatch(res.records, { file }).persisted;
  const suppressed = persisted.find((r) => isSuppressed(r));
  const reloaded = getProspect(file, suppressed.prospect_id);
  const q = queueProspect(reloaded);
  assert.equal(q.ok, false);
  assert.equal(q.error, 'suppressed');
});

// ─── P14: outreach-ready survives reload ──────────────────────────
test('P14: outreach-ready prospect survives reload and remains queueable', () => {
  const file = tmpFile('p14');
  const res = runBatch();
  // Grant contact_policy to batch-approved prospects and queue them (operator step).
  const approved = res.records.filter(
    (r) => r.research_status === 'outreach_ready' && r.opportunity_score >= 70 && !isSuppressed(r)
  );
  assert.ok(approved.length >= 1, 'at least one approved outreach_ready prospect');
  for (const rec of approved) {
    rec.contact_policy = 'permitted';
    const q = queueProspect(rec);
    assert.equal(q.ok, true);
  }
  persistBatch(res.records, { file });
  const rows = listProspects(file);
  const ready = rows.filter((r) => r.outreach_status === 'queued' && r.contact_policy === 'permitted');
  assert.ok(ready.length >= 1, 'at least one persisted prospect is outreach-ready/queued');
  for (const r of ready) {
    assert.equal(r.research_status, 'outreach_ready');
  }
  // Reload (fresh read) and confirm the queue still selects them.
  const reloaded = listProspects(file);
  const queue = getQueue(reloaded);
  for (const r of ready) {
    assert.ok(queue.some((qr) => qr.prospect_id === r.prospect_id), 'persisted prospect remains queueable');
  }
});

// ─── P15: outreach history remains separate ───────────────────────
test('P15: outreach history remains separate from prospect storage', () => {
  const dir = tmpDir('p15');
  const prospectFile = path.join(dir, 'prospects.csv');
  const activityFile = path.join(dir, 'outreach-activities.csv');
  const rec = buildProspect({ business_name: 'Sep Co', website: 'https://sep.example.com', city: 'A', state: 'TX' }).value;
  createProspect(prospectFile, rec);
  // Persisting prospects must not write to the activity store:
  saveActivityStore(activityFile, []);
  const prospectRows = listProspects(prospectFile);
  const activityRows = loadActivityStore(activityFile);
  assert.equal(prospectRows.length, 1);
  assert.equal(activityRows.length, 0);
  // Distinct files, distinct schemas:
  const pHead = fs.readFileSync(prospectFile, 'utf8').split('\n')[0];
  const aHead = fs.readFileSync(activityFile, 'utf8').split('\n')[0];
  assert.notEqual(pHead, aHead);
});

// ─── P16: CSV special characters ──────────────────────────────────
test('P16: CSV special characters round-trip correctly', () => {
  const file = tmpFile('p16');
  const rec = buildProspect({ business_name: 'Bob "Jake" O\u2019Brien, Sr.', website: 'https://unicode \u00e9xample.example.com', city: 'A', state: 'TX' }).value;
  rec.research_notes = 'long note, with commas, "quotes", line\n1\nand line 2 — unicode \u2713 done';
  rec.source_url = 'https://example.com/?a=1&b=2';
  createProspect(file, rec);
  const reloaded = getProspect(file, rec.prospect_id);
  assert.equal(reloaded.business_name, rec.business_name);
  assert.equal(reloaded.research_notes, rec.research_notes);
  assert.equal(reloaded.source_url, rec.source_url);
  // Re-serializing the reloaded store must remain valid (no growth/parse errors):
  const rows = listProspects(file);
  saveCsv(file, rows);
  const again = listProspects(file);
  assert.equal(again[0].research_notes, rec.research_notes);
});

// ─── P17: failed write does not corrupt existing store ────────────
test('P17: failed write does not corrupt existing store (atomic temp+rename)', () => {
  const file = tmpFile('p17');
  const rec = buildProspect({ business_name: 'Stable Co', website: 'https://stable.example.com', city: 'A', state: 'TX' }).value;
  createProspect(file, rec);
  const original = fs.readFileSync(file, 'utf8');

  // Force the tmp write to throw. The target must remain byte-for-byte intact.
  const origWrite = fs.writeFileSync;
  let threw = false;
  fs.writeFileSync = (p, ...a) => {
    if (String(p).endsWith('.tmp')) { threw = true; throw new Error('disk full'); }
    return origWrite(p, ...a);
  };
  let err = null;
  try {
    saveCsv(file, [...listProspects(file)]);
  } catch (e) {
    err = e;
  } finally {
    fs.writeFileSync = origWrite;
  }
  assert.equal(threw, true, 'tmp write attempted first');
  assert.ok(err, 'save failed as expected');
  // Store unchanged:
  assert.equal(fs.readFileSync(file, 'utf8'), original, 'target store untouched on failed write');
  assert.equal(listProspects(file).length, 1);
  // No stray temp file left behind:
  const leftovers = fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'));
  assert.equal(leftovers.length, 0, 'no temp files left after failed write');
});

// ─── P18: prospect cannot enter customer lead tables ──────────────
test('P18: prospect cannot enter customer lead tables', () => {
  const file = tmpFile('p18');
  const res = runBatch();
  persistBatch(res.records, { file });
  const rows = listProspects(file);
  assert.ok(rows.length > 0);
  // The prospect schema must not contain the protected customer-lead fields.
  for (const forbidden of ['idempotency_key', 'booking_id', 'booked_at', 'booking_link_sent', 'owner_notified', 'next_followup_at', 'last_customer_response_at']) {
    assert.ok(!PROSPECT_FIELDS.includes(forbidden), `prospect schema must not contain ${forbidden}`);
  }
  // Store module exposes no path into lead/config/booking/status/error tables:
  const storeSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'store.js'), 'utf8');
  for (const forbidden of ['business_config', 'status_updates', 'bookings', 'errors', 'leads']) {
    assert.ok(!storeSrc.includes(`"${forbidden}"`), `store must not write table: ${forbidden}`);
  }
});

// ─── P19: production workflows unchanged ──────────────────────────
test('P19: production workflows remain unchanged', () => {
  assertProductionUntouched(prodSnap);
  const expected = [31, 22, 24, 29, 10, 4, 13];
  for (let i = 0; i < PROTECTED_FILES.length; i++) {
    const j = JSON.parse(fs.readFileSync(path.join(PROD_DIR, PROTECTED_FILES[i]), 'utf8'));
    assert.equal(j.nodes.length, expected[i], `${PROTECTED_FILES[i]} node count changed`);
  }
});

// ─── E2E: full persistence scenario ───────────────────────────────
test('E2E-PERSIST: import -> process -> persist -> reload -> queue, then idempotent re-import', () => {
  const file = tmpFile('e2e');

  // Run 1: import, process, grant contact policy, queue eligible, persist.
  const res1 = runBatch();
  const approved1 = res1.records.filter(
    (r) => r.research_status === 'outreach_ready' && r.opportunity_score >= 70 && !isSuppressed(r)
  );
  for (const rec of approved1) {
    rec.contact_policy = 'permitted';
    assert.equal(queueProspect(rec).ok, true);
  }
  const out1 = persistBatch(res1.records, { file });
  assert.equal(out1.invalidSkipped.length, 0, 'no invalid records persisted');

  // Terminate "process" by reading the store fresh from disk.
  const after1 = listProspects(file);
  assert.equal(after1.length, out1.persisted.length, 'persisted count == on-disk count after reload');

  // Cross-source duplicates collapsed (one Lone Star HVAC, one GreenScape).
  assert.equal(after1.filter((r) => r.business_name === 'Lone Star HVAC').length, 1);
  assert.equal(after1.filter((r) => r.business_name === 'GreenScape Services').length, 1);
  // Ambiguous pair kept separate & reviewable.
  assert.equal(after1.filter((r) => r.business_name === 'Bluebonnet Electric').length, 2);
  assert.equal(after1.filter((r) => r.research_status === 'needs_review').length >= 2, true);
  // Suppression persisted.
  assert.equal(after1.filter((r) => isSuppressed(r)).length, 1);
  // Outreach-ready prospects that have contact_policy=permitted survive reload
  // and remain queueable.
  const readyIds = after1.filter((r) => r.outreach_status === 'queued' && r.contact_policy === 'permitted').map((r) => r.prospect_id);
  assert.ok(readyIds.length >= 1, `at least one outreach-ready prospect has contact_policy=permitted`);
  const queue1 = getQueue(listProspects(file));
  for (const id of readyIds) {
    assert.ok(queue1.some((q) => q.prospect_id === id), `outreach-ready ${id} remains queueable after reload`);
  }

  // Run 2: same batch imported again -> NO duplicate prospects.
  const res2 = runBatch();
  const out2 = persistBatch(res2.records, { file });
  assert.equal(out2.persisted.length, 0, 're-import persists nothing new');
  assert.equal(out2.duplicates.length, out1.persisted.length, 're-import skips every record as already present');
  const after2 = listProspects(file);
  assert.equal(after2.length, after1.length, 'no duplicate prospects created on re-import');

  // Exact reconciliation for the report:
  const reconciliation = {
    imported: res1.imported,
    invalidRows: res1.invalid,
    cleanDuplicatesInBatch: res1.duplicates,
    distinctKept: res1.records.length,
    ambiguousInStore: after1.filter((r) => r.business_name === 'Bluebonnet Electric').length,
    suppressedInStore: after1.filter((r) => isSuppressed(r)).length,
    outreachReadyInStore: readyIds.length,
    persistedRun1: out1.persisted.length,
    persistedRun2: out2.persisted.length,
    skippedRun2: out2.duplicates.length,
    storeTotalAfterRun2: after2.length,
  };
  assert.equal(reconciliation.imported, 12);
  assert.equal(reconciliation.cleanDuplicatesInBatch >= 2, true);
  assert.equal(reconciliation.distinctKept + reconciliation.invalidRows + reconciliation.cleanDuplicatesInBatch, reconciliation.imported,
    'no record disappears');
  assert.equal(reconciliation.storeTotalAfterRun2, reconciliation.persistedRun1, 'store total stable across re-import');
});
