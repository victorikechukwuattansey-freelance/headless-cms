'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { matchAgainstKnown, matchResult } = require('../src/lib/dedupe');
const { ingestProspect } = require('../src/pipeline');

test('two sources with same domain -> one business (no duplicate)', async (t) => {
  const a = ingestProspect(
    { business_name: 'Lone Star HVAC', website: 'https://lonestar.example.com', city: 'Austin', state: 'TX' },
    []
  );
  const rec = a.value;
  const b = ingestProspect(
    { business_name: 'Lone Star Heating & Cooling', website: 'https://lonestar.example.com', city: 'Round Rock', state: 'TX' },
    [rec]
  );
  assert.equal(a.duplicate, false);
  assert.equal(b.duplicate, true);
  assert.equal(b.reason, 'domain');
});

test('same phone + same state -> duplicate (medium/high) and not merged silently', () => {
  const a = ingestProspect({ business_name: 'A Plumbing', phone: '2105550143', state: 'TX' }, []);
  const b = ingestProspect({ business_name: 'A Plumbing', phone: '210-555-0143', state: 'TX' }, [a.value]);
  assert.equal(matchAgainstKnown(b.value, [a.value]).duplicate, true);
  assert.equal(b.reason, 'phone');
});

test('same name + same state but different city -> ambiguous (low confidence) -> needs_review', () => {
  const a = ingestProspect({ business_name: 'Smith Roofing', city: 'Austin', state: 'TX' }, []);
  const b = ingestProspect({ business_name: 'Smith Roofing', city: 'Dallas', state: 'TX' }, [a.value], {
    matchPolicy: 'flag_review',
  });
  assert.equal(b.duplicate, true);
  assert.equal(b.ambiguous, true);
});

test('same name different state -> NOT a duplicate (must not merge on name alone)', () => {
  const a = ingestProspect({ business_name: 'Quick Fix IT', state: 'TX' }, []);
  const res = matchResult(a.value, { business_name: 'Quick Fix IT', state: 'CA' });
  assert.equal(res.isDuplicate, false);
  assert.equal(res.reason, 'same_name_different_state');
});

test('no match -> not duplicate', () => {
  const a = ingestProspect({ business_name: 'Alpha', city: 'Austin', state: 'TX' }, []);
  const res = matchResult(a.value, { business_name: 'Beta', city: 'Dallas', state: 'TX' });
  assert.equal(res.isDuplicate, false);
});
