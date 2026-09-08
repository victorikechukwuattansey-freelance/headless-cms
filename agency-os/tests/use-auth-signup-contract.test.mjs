import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const useAuthPath = path.join(repoRoot, 'apps/web/src/hooks/useAuth.ts');
const authStorePath = path.join(repoRoot, 'apps/web/src/store/authStore.ts');
const pagesPath = path.join(repoRoot, 'apps/web/src/pages/index.tsx');
const apiTypesPath = path.join(repoRoot, 'packages/shared/src/types/api.ts');

const useAuth = fs.readFileSync(useAuthPath, 'utf8');
const authStore = fs.readFileSync(authStorePath, 'utf8');
const pages = fs.readFileSync(pagesPath, 'utf8');
const apiTypes = fs.readFileSync(apiTypesPath, 'utf8');

assert.equal(
  useAuth.includes("const { data } = await apiClient.post('/auth/register', payload);"),
  false,
  'useAuth.ts should use the unwrapped register result instead of reading .data from apiClient.post',
);

assert.equal(
  useAuth.includes('authApi.register(payload)'),
  true,
  'useAuth.ts should register through authApi so the hook matches the shared auth service contract',
);

assert.equal(
  apiTypes.includes('setAuth:'),
  false,
  'AuthState should not expose setAuth when the store does not implement it',
);

assert.equal(
  authStore.includes('setAuth:'),
  false,
  'authStore.ts should not keep a stale setAuth implementation after the auth state contract is removed',
);

assert.equal(
  pages.includes("navigate('/verify', { replace: true })"),
  true,
  'Signup success should send the user to the verification page because registration requires email verification',
);
