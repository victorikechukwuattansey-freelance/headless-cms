import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decryptSecret, encryptSecret } from '../src/integrations/integration-gateway.service.js';
import { AuthService } from '../src/services/auth.service.js';
import { assertSameOrganization } from '../src/domain/resource-policy.service.js';

test('integration gateway round-trips an encrypted secret', () => {
  const payload = encryptSecret('super-secret');
  assert.notEqual(payload.ciphertext, 'super-secret');
  assert.equal(decryptSecret(payload), 'super-secret');
});

test('auth service hashes refresh tokens', async () => {
  const auth = new AuthService();
  const session = await auth.createSession({ userId: 'u1', organizationId: 'o1', role: 'USER' });
  assert.equal(session.refreshTokenHash.length, 64);
});

test('resource policy rejects cross-organization access', () => {
  assert.throws(() => assertSameOrganization('org-a', { organizationId: 'org-b' }, 'LeadProfile'));
});