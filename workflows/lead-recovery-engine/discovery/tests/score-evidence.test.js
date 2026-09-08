'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { score } = require('../src/lib/score');
const { classify, isAllowedClaim } = require('../src/lib/evidence');
const { assessOpportunity, buildProspect } = require('../src/pipeline');

test('opportunity score is computed from flagged factors and is transparent', () => {
  const rec = buildProspect({ business_name: 'Appliance Repair', state: 'TX' }).value;
  const result = assessOpportunity(
    rec,
    {
      appointment_dependency: true,
      inbound_lead_dependency: true,
      service_ticket_value: true,
      service_area: true,
      manual_inquiry_handling: true,
      model_fit: true,
    },
    { cls: 'OBSERVED', text: 'Public website with inquiry form.' }
  );
  assert.equal(result.ok, true);
  assert.ok(result.score > 50);
  assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
  assert.ok(result.factors.length > 0);
});

test('score never exceeds 100 and is bound', () => {
  const rec = buildProspect({ business_name: 'All Flags', state: 'TX' }).value;
  const { score: s } = score(rec, { appointment_dependency: 1, inbound_lead_dependency: 1, service_ticket_value: 1, business_scale: 1, service_area: 1, manual_inquiry_handling: 1, followup_operational_difficulty: 1, model_fit: 1 }, { cls: 'OBSERVED' });
  assert.ok(s >= 0 && s <= 100);
});

test('no unsupported claim: lead volume not inferred from OBSERVED', () => {
  assert.equal(isAllowedClaim('OBSERVED', 'lead_volume'), false);
  assert.equal(isAllowedClaim('OBSERVED', 'revenue'), false);
  assert.equal(isAllowedClaim('UNKNOWN', 'followup_gap'), false);
});

test('client-provided/verified permits lead-volume claim (scoped, not used in prospecting score)', () => {
  assert.equal(isAllowedClaim('CLIENT_PROVIDED', 'lead_volume'), true);
  assert.equal(isAllowedClaim('VERIFIED', 'lead_volume'), true);
  assert.equal(isAllowedClaim('VERIFIED', 'revenue'), true);
});

test('evidence classification maps exactly to the five classes', () => {
  assert.equal(classify({ cls: 'OBSERVED' }).cls, 'OBSERVED');
  assert.equal(classify({ cls: 'INFERRED' }).cls, 'INFERRED');
  assert.equal(classify({ cls: 'CLIENT_PROVIDED' }).cls, 'CLIENT_PROVIDED');
  assert.equal(classify({ cls: 'VERIFIED' }).cls, 'VERIFIED');
  assert.equal(classify({ cls: 'UNKNOWN' }).cls, 'UNKNOWN');
  assert.equal(classify({ cls: 'UNKNOWN' }).valid, true);
});

test('classify returns UNKNOWN for invalid class', () => {
  assert.equal(classify({ cls: 'MADE_UP' }).cls, 'UNKNOWN');
  assert.equal(classify({ cls: 'MADE_UP' }).valid, false);
});

test('assessOpportunity sets evidence_class on record', () => {
  const rec = buildProspect({ business_name: 'Gutter Co', state: 'TX' }).value;
  assessOpportunity(rec, { service_area: true }, { cls: 'OBSERVED', text: 'Directory listing.' });
  assert.equal(rec.evidence_class, 'OBSERVED');
});
