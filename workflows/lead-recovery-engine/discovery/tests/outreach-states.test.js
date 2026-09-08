'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { OUTREACH_STATUSES, canOutreachTransition, outreachTransition } = require('../src/lib/outreach-states');

function makeRec(status) {
  return {
    prospect_id: 'p-test-1',
    business_name: 'Test Co',
    outreach_status: status || 'not_ready',
    suppressed: false,
    updated_at: '2026-01-01T00:00:00.000Z',
  };
}

// ─── OUT-01: all 12 statuses exist ─────────────────────────────────
test('OUT-01: all 12 outreach statuses are defined', () => {
  const expected = [
    'not_ready', 'queued', 'prepared', 'contacted', 'follow_up_due',
    'replied', 'qualified', 'demo', 'pilot', 'won', 'lost', 'suppressed',
  ];
  assert.equal(OUTREACH_STATUSES.size, 12);
  for (const s of expected) {
    assert.ok(OUTREACH_STATUSES.has(s), `missing status: ${s}`);
  }
});

// ─── OUT-02: valid transitions only ────────────────────────────────
test('OUT-02: not_ready can transition to queued', () => {
  assert.equal(canOutreachTransition('not_ready', 'queued'), true);
});

test('OUT-02b: not_ready can transition to suppressed', () => {
  assert.equal(canOutreachTransition('not_ready', 'suppressed'), true);
});

test('OUT-02c: not_ready cannot transition to contacted directly', () => {
  assert.equal(canOutreachTransition('not_ready', 'contacted'), false);
});

test('OUT-02d: queued can transition to prepared', () => {
  assert.equal(canOutreachTransition('queued', 'prepared'), true);
});

test('OUT-02e: prepared can transition to contacted', () => {
  assert.equal(canOutreachTransition('prepared', 'contacted'), true);
});

test('OUT-02f: contacted can transition to replied', () => {
  assert.equal(canOutreachTransition('contacted', 'replied'), true);
});

test('OUT-02g: contacted can transition to follow_up_due', () => {
  assert.equal(canOutreachTransition('contacted', 'follow_up_due'), true);
});

test('OUT-02h: followed_up can transition back to contacted', () => {
  assert.equal(canOutreachTransition('follow_up_due', 'contacted'), true);
});

test('OUT-02i: replied can transition to qualified', () => {
  assert.equal(canOutreachTransition('replied', 'qualified'), true);
});

test('OUT-02j: replied can transition to demo', () => {
  assert.equal(canOutreachTransition('replied', 'demo'), true);
});

test('OUT-02k: qualified can transition to demo', () => {
  assert.equal(canOutreachTransition('qualified', 'demo'), true);
});

test('OUT-02l: demo can transition to pilot', () => {
  assert.equal(canOutreachTransition('demo', 'pilot'), true);
});

test('OUT-02m: demo can transition to won', () => {
  assert.equal(canOutreachTransition('demo', 'won'), true);
});

test('OUT-02n: pilot can transition to won', () => {
  assert.equal(canOutreachTransition('pilot', 'won'), true);
});

test('OUT-02o: won cannot transition to any non-suppressed state', () => {
  for (const s of ['not_ready', 'queued', 'prepared', 'contacted', 'replied', 'qualified', 'demo', 'pilot', 'lost']) {
    assert.equal(canOutreachTransition('won', s), false, `won should not transition to ${s}`);
  }
});

test('OUT-02p: lost cannot transition to any non-suppressed state', () => {
  for (const s of ['not_ready', 'queued', 'prepared', 'contacted', 'replied', 'qualified', 'demo', 'pilot', 'won']) {
    assert.equal(canOutreachTransition('lost', s), false, `lost should not transition to ${s}`);
  }
});

// ─── OUT-03: suppressed is terminal ────────────────────────────────
test('OUT-03: suppressed cannot transition to any state', () => {
  for (const s of OUTREACH_STATUSES) {
    if (s === 'suppressed') continue;
    assert.equal(canOutreachTransition('suppressed', s), false, `suppressed should not transition to ${s}`);
  }
});

test('OUT-03b: outreachTransition throws on suppressed terminal exit', () => {
  const rec = makeRec('suppressed');
  assert.throws(() => outreachTransition(rec, 'queued'), /suppressed_is_terminal/);
});

// ─── OUT-04: outreachTransition mutates record ─────────────────────
test('OUT-04: outreachTransition sets outreach_status and updated_at', () => {
  const rec = makeRec('not_ready');
  outreachTransition(rec, 'queued', { now: '2026-08-31T12:00:00.000Z' });
  assert.equal(rec.outreach_status, 'queued');
  assert.equal(rec.updated_at, '2026-08-31T12:00:00.000Z');
});

// ─── OUT-05: invalid transition throws ─────────────────────────────
test('OUT-05: invalid transition throws with descriptive error', () => {
  const rec = makeRec('not_ready');
  assert.throws(() => outreachTransition(rec, 'contacted'), /invalid_outreach_transition:not_ready->contacted/);
});

// ─── OUT-06: invalid status name throws ────────────────────────────
test('OUT-06: invalid status name throws', () => {
  const rec = makeRec('not_ready');
  assert.throws(() => outreachTransition(rec, 'banana'), /invalid_outreach_status:banana/);
});

// ─── OUT-07: suppressed prospect cannot transition even if field set ─
test('OUT-07: suppressed prospect cannot transition via outreachTransition', () => {
  const rec = makeRec('contacted');
  rec.suppressed = true;
  assert.throws(() => outreachTransition(rec, 'replied'), /suppressed_prospect_cannot_transition/);
});
