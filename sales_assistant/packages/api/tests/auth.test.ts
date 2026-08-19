import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AuthService } from '../src/services/auth.service.js';
import { DomainError } from '../src/domain/domain-error.js';
import { authenticate } from '../src/middleware/authenticate.js';
import type { IncomingMessage } from 'node:http';

process.env.JWT_SECRET = 'unit-test-secret';

const auth = new AuthService();

function requestWithAuthorization(header?: string): IncomingMessage {
  const headers = header ? { authorization: header } : {};
  return { headers } as IncomingMessage;
}

beforeEach(() => {
  process.env.JWT_SECRET = 'unit-test-secret';
});

test('issued token verifies back to the same claims', () => {
  const token = auth.issueToken({ userId: 'u1', organizationId: 'o1', role: 'AGENT' });
  assert.deepEqual(auth.verifyToken(token), {
    userId: 'u1',
    organizationId: 'o1',
    role: 'AGENT',
    exp: (auth.verifyToken(token) as { exp: number }).exp,
  });
});

test('token with a tampered payload fails verification', () => {
  const token = auth.issueToken({ userId: 'u1', organizationId: 'o1', role: 'USER' });
  const [payload, signature] = token.split('.');
  const tampered = Buffer.from(
    JSON.stringify({ userId: 'u1', organizationId: 'o2', role: 'USER', exp: Date.now() + 100_000 }),
  ).toString('base64url');
  assert.throws(
    () => auth.verifyToken(`${tampered}.${signature}`),
    (err: unknown) => err instanceof DomainError && err.code === 'UNAUTHORIZED',
  );
});

test('expired token is rejected', () => {
  const token = auth.issueToken({ userId: 'u1', organizationId: 'o1', role: 'USER', ttlMs: -1000 });
  assert.throws(
    () => auth.verifyToken(token),
    (err: unknown) => err instanceof DomainError && err.code === 'UNAUTHORIZED',
  );
});

test('malformed token is rejected', () => {
  assert.throws(
    () => auth.verifyToken('not-a-token'),
    (err: unknown) => err instanceof DomainError && err.code === 'UNAUTHORIZED',
  );
});

test('authenticate rejects missing and malformed authorization headers', () => {
  assert.throws(
    () => authenticate(requestWithAuthorization()),
    (err: unknown) => err instanceof DomainError && err.code === 'UNAUTHORIZED',
  );
  assert.throws(
    () => authenticate(requestWithAuthorization('Basic abc')),
    (err: unknown) => err instanceof DomainError && err.code === 'UNAUTHORIZED',
  );
  assert.throws(
    () => authenticate(requestWithAuthorization('Bearer ') ),
    (err: unknown) => err instanceof DomainError && err.code === 'UNAUTHORIZED',
  );
});

test('authenticate accepts a valid token and returns org-scoped context', () => {
  const token = auth.issueToken({ userId: 'u1', organizationId: 'o1', role: 'ADMIN' });
  const context = authenticate(requestWithAuthorization(`Bearer ${token}`));
  assert.equal(context.userId, 'u1');
  assert.equal(context.organizationId, 'o1');
  assert.equal(context.role, 'ADMIN');
});