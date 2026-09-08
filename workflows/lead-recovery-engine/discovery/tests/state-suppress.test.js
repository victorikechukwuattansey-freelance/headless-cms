'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  loadStore,
  reviewApproval,
  reviewRejected,
  reviewSuppressed,
  reachOutreachReady,
} = require('../src/queue');
const { transition } = require('../src/lib/states');
const { isSuppressed } = require('../src/lib/suppress');
const { buildOutreachBrief } = require('../src/outreach-brief');

function makeQueue() {
  return [
    {
      prospect_id: 'p1',
      business_name: 'Alpha',
      research_status: 'discovered',
      suppressed: false,
      suppression_reason: '',
      city: 'Austin',
      state: 'TX',
      updated_at: '',
      research_notes: '',
    },
    {
      prospect_id: 'p2',
      business_name: 'Beta',
      research_status: 'discovered',
      suppressed: false,
      city: 'Dallas',
      state: 'TX',
      updated_at: '',
      research_notes: '',
    },
    {
      prospect_id: 'p3',
      business_name: 'Gamma',
      research_status: 'discovered',
      suppressed: true,
      suppression_reason: 'no_contact_path',
      city: 'Houston',
      state: 'TX',
      updated_at: '',
      research_notes: '',
    },
  ];
}

test('suppressed prospect cannot become outreach-ready', () => {
  const q = makeQueue();
  const res = reachOutreachReady(q, 'p3');
  assert.equal(res.ok, false);
  assert.equal(res.error, 'suppressed');
});

test('review approval -> approved, then outreach-ready', () => {
  const q = makeQueue();
  reviewApproval(q, 'p1');
  assert.equal(q[0].research_status, 'approved');
  const ready = reachOutreachReady(q, 'p1');
  assert.equal(ready.ok, true);
  assert.equal(q[0].research_status, 'outreach_ready');
});

test('rejected prospect transitions but is flagged', () => {
  const q = makeQueue();
  reviewRejected(q, 'p2', 'wrong_vertical');
  assert.equal(q[1].rejected, true);
  assert.ok(q[1].research_notes.includes('REJECTED:wrong_vertical'));
});

test('suppression is terminal: cannot transition out', () => {
  const q = makeQueue();
  reviewSuppressed(q, 'p2', 'suppressed_by_operator');
  assert.equal(isSuppressed(q[1]), true);
  assert.throws(() => transition(q[1], 'outreach_ready'), /suppressed/);
});

test('invalid transition is rejected', () => {
  const q = makeQueue();
  assert.throws(() => transition(q[0], 'client'), /invalid_transition/);
});

test('outreach-ready is a precondition for a brief; suppressed yields no brief', () => {
  const q = makeQueue();
  const suppressedBrief = buildOutreachBrief(q[2]);
  assert.equal(suppressedBrief.ok, false);
  reviewApproval(q, 'p1');
  reachOutreachReady(q, 'p1');
  const brief = buildOutreachBrief(q[0]);
  assert.equal(brief.ok, true);
  assert.ok(brief.brief.business === 'Alpha');
  assert.ok(typeof brief.brief.recovery_hypothesis === 'string');
});
