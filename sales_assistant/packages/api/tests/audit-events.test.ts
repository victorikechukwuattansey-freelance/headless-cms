import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_EVENT_TYPES,
  listAuditEventsQuerySchema,
  parseQuery,
} from '../src/validation/schemas.js';

test('audit event type list covers every writeAuditEvent caller', () => {
  const expected = [
    'AGENT_AVAILABILITY_CHANGED', 'AI_USAGE_LOGGED', 'BOOKING_CREATED', 'BOOKING_STATUS_CHANGED',
    'BULK_REMINDERS_GENERATED', 'DEAL_CREATED', 'DEAL_STAGE_CHANGED', 'INTEGRATION_TOKEN_DELETED',
    'INTEGRATION_TOKEN_STORED', 'LEAD_ASSIGNED', 'LEAD_CREATED', 'LEAD_SCORED', 'LEAD_STATUS_CHANGED',
    'LEAD_UPDATED', 'REMINDER_DISMISSED', 'USER_CREATED', 'USER_UPDATED',
  ];
  assert.deepEqual([...AUDIT_EVENT_TYPES].sort(), expected.sort());
});

test('audit list query applies defaults and validates the type filter', () => {
  assert.deepEqual(parseQuery(listAuditEventsQuerySchema, new URLSearchParams('')), {
    limit: 20,
    offset: 0,
  });
  assert.deepEqual(
    parseQuery(listAuditEventsQuerySchema, new URLSearchParams('type=LEAD_CREATED&limit=5')),
    { limit: 5, offset: 0, type: 'LEAD_CREATED' },
  );
  assert.throws(
    () => parseQuery(listAuditEventsQuerySchema, new URLSearchParams('type=NOPE')),
    (err) => (err as { code?: string }).code === 'VALIDATION',
  );
  assert.throws(
    () => parseQuery(listAuditEventsQuerySchema, new URLSearchParams('limit=999')),
    (err) => (err as { code?: string }).code === 'VALIDATION',
  );
});
