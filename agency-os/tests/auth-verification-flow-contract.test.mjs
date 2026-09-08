import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const routesPath = path.join(repoRoot, 'apps/web/src/routes/index.tsx');
const pagesPath = path.join(repoRoot, 'apps/web/src/pages/index.tsx');
const servicesPath = path.join(repoRoot, 'packages/shared/src/service/services.ts');
const clientPath = path.join(repoRoot, 'packages/shared/src/service/client.ts');
const authStorePath = path.join(repoRoot, 'apps/web/src/store/authStore.ts');

const routes = fs.readFileSync(routesPath, 'utf8');
const pages = fs.readFileSync(pagesPath, 'utf8');
const services = fs.readFileSync(servicesPath, 'utf8');
const client = fs.readFileSync(clientPath, 'utf8');
const authStore = fs.readFileSync(authStorePath, 'utf8');

assert.equal(
  routes.includes("{ path: '/verify', element: <VerifyEmailPage /> }"),
  true,
  'routes/index.tsx should expose a /verify route for email verification links',
);

assert.equal(
  pages.includes('export function VerifyEmailPage()'),
  true,
  'pages/index.tsx should define a VerifyEmailPage to handle verification tokens and empty-state guidance',
);

assert.equal(
  services.includes('verifyEmail: (token: string) =>'),
  true,
  'shared auth services should expose verifyEmail(token) for the web verification page',
);

assert.equal(
  client.includes('class ApiClientError extends Error'),
  true,
  'apiClient should reject a real Error subtype so React Query and auth state can surface backend messages',
);

assert.equal(
  client.includes('Promise.reject(new ApiClientError(apiError))'),
  true,
  'apiClient should reject ApiClientError instead of a plain object',
);

assert.equal(
  authStore.includes('throw error;'),
  true,
  'authStore.login should rethrow login failures after recording state so the login mutation exposes the backend error',
);

assert.equal(
  authStore.includes('return false;'),
  false,
  'authStore.login should not swallow login failures by returning false',
);
