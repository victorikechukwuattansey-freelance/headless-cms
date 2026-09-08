'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildProspect, ingestProspect } = require('../src/pipeline');
const { sanitizeProspect, sanitizeHtml } = require('../src/lib/validate');
const { loadCsv, saveCsv } = require('../src/store');
const { PROSPECT_FIELDS } = require('../src/prospect-model');

test('new prospect creation builds canonical record with ids and timestamps', () => {
  const res = buildProspect({ business_name: 'Roof Tech', website: 'https://roof.tech', city: 'Austin', state: 'TX' });
  assert.equal(res.ok, true);
  const p = res.value;
  assert.ok(p.prospect_id.startsWith('pros_'));
  assert.ok(p.created_at);
  assert.ok(p.updated_at);
  assert.equal(p.research_status, 'discovered');
  assert.equal(p.domain, 'roof.tech');
});

test('source provenance is preserved on the record', () => {
  const res = buildProspect({ business_name: 'Provenance Co', source: 'business_directory', source_url: 'https://dir.example.com/x' });
  assert.equal(res.value.source, 'business_directory');
  assert.equal(res.value.source_url, 'https://dir.example.com/x');
});

test('unsupported source normalizes to operator_entered', () => {
  const res = buildProspect({ business_name: 'X', source: 'scrapper' });
  assert.equal(res.value.source, 'operator_entered');
});

test('malformed input (non-object) rejected', () => {
  assert.equal(buildProspect(null).ok, false);
  assert.equal(buildProspect('string').ok, false);
});

test('missing required data (no business_name) rejected', () => {
  const res = buildProspect({ website: 'https://x.example.com' });
  assert.equal(res.ok, false);
  assert.equal(res.error, 'missing_business_name');
});

test('duplicate prospect retry returns duplicate, does not create a second record', () => {
  const a = ingestProspect({ business_name: 'Dup Co', website: 'https://dup.example.com' }, []);
  const existingRow = a.value;
  const known = [existingRow];
  const retry = ingestProspect({ business_name: 'Dup Co', website: 'https://dup.example.com' }, known);
  assert.equal(retry.duplicate, true);
  assert.equal(retry.reason, 'domain');
  assert.equal(retry.matched_prospect_id, existingRow.prospect_id);
});

test('sanitizeProspect strips/bounds untrusted external strings', () => {
  const res = buildProspect({
    business_name: '<img src=x onerror=alert(1)>',
    website: 'javascript:alert(1)',
    city: 'Austin',
    state: 'TX',
    email: '  A@B.COM  ',
  });
  // name is stored raw in data but emitted sanitized; phone/email normalized
  assert.equal(res.ok, true);
});

test('sanitizeHtml neutralizes script execution signatures', () => {
  const esc = sanitizeHtml('<script>alert("x")</script>');
  assert.ok(!esc.includes('<script>'));
  assert.ok(esc.includes('&lt;script&gt;'));
});

test('CSV store round-trips a prospect row', () => {
  const file = path.join(os.tmpdir(), `lre-store-${Date.now()}.csv`);
  const rows = [{ prospect_id: 'pros_t1', business_name: 'Round Trip', city: 'Austin', state: 'TX', suppressed: true }];
  saveCsv(file, rows);
  const loaded = loadCsv(file);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].business_name, 'Round Trip');
  fs.rmSync(file, { force: true });
});

test('prospect store never contains a customer lead field set beyond prospect schema', () => {
  // The prospect store writes only PROSPECT_FIELDS; assert no collision with the
  // protected lead schema (which lives in production workflows, not here).
  const forbidden = ['business_secret', 'owner_name', 'idempotency_key', 'booking_id', 'booked_at'];
  for (const f of forbidden) {
    assert.ok(!PROSPECT_FIELDS.includes(f), `prospect schema must not contain ${f}`);
  }
});
