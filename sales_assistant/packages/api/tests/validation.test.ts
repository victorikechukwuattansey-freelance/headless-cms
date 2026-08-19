import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBookingSchema,
  createDealSchema,
  createLeadSchema,
  listAgentsQuerySchema,
  listDealsQuerySchema,
  listLeadsQuerySchema,
  parseOrThrow,
  parseQuery,
  updateLeadSchema,
  validationError,
} from '../src/validation/schemas.js';

test('createLeadSchema accepts a valid payload and rejects invalid ones', () => {
  const valid = parseOrThrow(createLeadSchema, { phone: '+2348000000000', name: 'Grace', score: 40 });
  assert.deepEqual(valid, { phone: '+2348000000000', name: 'Grace', score: 40 });

  assert.throws(() => parseOrThrow(createLeadSchema, { phone: '   ' }), (err) => {
    assert.equal((err as { code?: string }).code, 'VALIDATION');
    return true;
  });
  assert.throws(() => parseOrThrow(createLeadSchema, { phone: '+2348000000000', score: 101 }), /score/);
  assert.throws(() => parseOrThrow(createLeadSchema, { phone: '+2348000000000', score: 4.5 }), /score/);
});

test('updateLeadSchema validates partial updates and rejects bad fields', () => {
  assert.deepEqual(parseOrThrow(updateLeadSchema, { score: 70 }), { score: 70 });
  assert.deepEqual(parseOrThrow(updateLeadSchema, {}), {});
  assert.throws(() => parseOrThrow(updateLeadSchema, { score: -1 }), /score/);
  assert.throws(() => parseOrThrow(updateLeadSchema, { phone: '' }), /phone/);
});

test('pagination query parsing applies defaults, limits, and enum filters', () => {
  const defaults = parseQuery(listLeadsQuerySchema, new URLSearchParams(''));
  assert.deepEqual(defaults, { limit: 20, offset: 0 });

  const paged = parseQuery(listLeadsQuerySchema, new URLSearchParams('limit=5&offset=2&status=new&agentId=agent-1'));
  assert.deepEqual(paged, { limit: 5, offset: 2, status: 'new', agentId: 'agent-1' });

  assert.throws(() => parseQuery(listLeadsQuerySchema, new URLSearchParams('limit=0')), /limit/);
  assert.throws(() => parseQuery(listLeadsQuerySchema, new URLSearchParams('limit=999')), /limit/);
  assert.throws(() => parseQuery(listLeadsQuerySchema, new URLSearchParams('offset=-1')), /offset/);
  assert.throws(() => parseQuery(listLeadsQuerySchema, new URLSearchParams('status=banana')), /status/);
});

test('agent availability query coerces boolean strings', () => {
  assert.equal(parseQuery(listAgentsQuerySchema, new URLSearchParams('available=true')).available, true);
  assert.equal(parseQuery(listAgentsQuerySchema, new URLSearchParams('available=false')).available, false);
  assert.equal(parseQuery(listAgentsQuerySchema, new URLSearchParams('')).available, undefined);
  assert.throws(() => parseQuery(listAgentsQuerySchema, new URLSearchParams('available=yes')), /available/);
});

test('deal and booking list queries filter by stage/status', () => {
  assert.deepEqual(parseQuery(listDealsQuerySchema, new URLSearchParams('stage=won')), { limit: 20, offset: 0, stage: 'won' });
  assert.throws(() => parseQuery(listDealsQuerySchema, new URLSearchParams('stage=completed')), /stage/);
});

test('booking creation schema transforms ISO dates into Date instances', () => {
  const output = parseOrThrow(createBookingSchema, { leadId: 'lead-1', at: '2026-08-20T10:00:00.000Z' });
  assert.equal(output.leadId, 'lead-1');
  assert.ok(output.at instanceof Date);
  assert.equal(output.at.toISOString(), '2026-08-20T10:00:00.000Z');

  assert.throws(
    () => parseOrThrow(createBookingSchema, { leadId: 'lead-1', at: 'not-a-date' }),
    (err) => (err as { code?: string }).code === 'VALIDATION',
  );
});

test('deal creation schema requires a finite non-negative amount', () => {
  assert.deepEqual(parseOrThrow(createDealSchema, { amount: 90_000 }), { amount: 90_000 });
  assert.throws(() => parseOrThrow(createDealSchema, { amount: -5 }), /amount/);
  assert.throws(() => parseOrThrow(createDealSchema, { amount: Number.NaN }), /amount/);
});

test('validationError aggregates issues with paths', () => {
  const message = validationError(
    (createLeadSchema.safeParse({}).error as unknown) as import('zod').ZodError,
  );
  assert.match(message.message, /phone/);
});