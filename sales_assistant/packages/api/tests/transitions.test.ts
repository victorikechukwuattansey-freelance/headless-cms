import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../src/domain/domain-error.js';
import {
  assertTransition,
  BOOKING_TRANSITIONS,
  DEAL_TRANSITIONS,
  LEAD_TRANSITIONS,
} from '../src/domain/transitions.js';

test('booking allows pending -> confirmed -> completed', () => {
  assert.deepEqual(BOOKING_TRANSITIONS.pending, ['confirmed', 'cancelled']);
  assertTransition(BOOKING_TRANSITIONS, 'pending', 'confirmed', 'booking status');
  assertTransition(BOOKING_TRANSITIONS, 'confirmed', 'completed', 'booking status');
});

test('booking rejects skipping confirmed', () => {
  assert.throws(
    () => assertTransition(BOOKING_TRANSITIONS, 'pending', 'completed', 'booking status'),
    (err: unknown) => err instanceof DomainError && err.code === 'INVALID_TRANSITION',
  );
});

test('booking rejects transitioning out of a terminal state', () => {
  assert.throws(
    () => assertTransition(BOOKING_TRANSITIONS, 'completed', 'confirmed', 'booking status'),
    (err: unknown) => err instanceof DomainError && err.code === 'INVALID_TRANSITION',
  );
});

test('deal allows proposed -> won and proposed -> lost only', () => {
  assert.deepEqual(DEAL_TRANSITIONS.proposed, ['won', 'lost']);
  assertTransition(DEAL_TRANSITIONS, 'proposed', 'won', 'deal stage');
  assertTransition(DEAL_TRANSITIONS, 'proposed', 'lost', 'deal stage');
});

test('deal rejects unknown stage targets', () => {
  assert.throws(
    () =>
      assertTransition(
        DEAL_TRANSITIONS,
        'proposed',
        'completed' as (typeof DEAL_TRANSITIONS)['proposed'][number],
        'deal stage',
      ),
    (err: unknown) => err instanceof DomainError && err.code === 'INVALID_TRANSITION',
  );
});

test('lead lifecycle follows new -> assigned -> contacted -> qualified -> converted', () => {
  assertTransition(LEAD_TRANSITIONS, 'new', 'assigned', 'lead status');
  assertTransition(LEAD_TRANSITIONS, 'assigned', 'contacted', 'lead status');
  assertTransition(LEAD_TRANSITIONS, 'contacted', 'qualified', 'lead status');
  assertTransition(LEAD_TRANSITIONS, 'qualified', 'converted', 'lead status');
});

test('lead can be lost from assigned or contacted but not from converted', () => {
  assertTransition(LEAD_TRANSITIONS, 'assigned', 'lost', 'lead status');
  assertTransition(LEAD_TRANSITIONS, 'contacted', 'lost', 'lead status');
  assert.throws(
    () => assertTransition(LEAD_TRANSITIONS, 'converted', 'lost', 'lead status'),
    (err: unknown) => err instanceof DomainError && err.code === 'INVALID_TRANSITION',
  );
});