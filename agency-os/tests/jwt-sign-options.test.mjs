import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const authServicePath = path.join(repoRoot, 'packages/api/src/modules/auth/auth.service.ts');
const authService = fs.readFileSync(authServicePath, 'utf8');

assert.equal(
  authService.includes("import jwt, { type SignOptions } from 'jsonwebtoken';"),
  true,
  'auth.service.ts should import SignOptions to type jwt.sign options',
);

assert.equal(
  authService.includes("const ACCESS_TOKEN_EXPIRES_IN: NonNullable<SignOptions['expiresIn']> ="),
  true,
  'auth.service.ts should narrow access-token expiry to a non-undefined SignOptions value',
);

assert.equal(
  authService.includes("const REFRESH_TOKEN_EXPIRES_IN: NonNullable<SignOptions['expiresIn']> ="),
  true,
  'auth.service.ts should narrow refresh-token expiry to a non-undefined SignOptions value',
);

assert.equal(
  authService.includes('expiresIn: ACCESS_TOKEN_EXPIRES_IN'),
  true,
  'auth.service.ts should use the typed access-token expiry constant',
);

assert.equal(
  authService.includes('expiresIn: REFRESH_TOKEN_EXPIRES_IN'),
  true,
  'auth.service.ts should use the typed refresh-token expiry constant',
);
