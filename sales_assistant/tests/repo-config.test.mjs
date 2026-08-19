import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('root package declares expected workspaces', async () => {
  const pkg = await readJson('../package.json');

  assert.deepEqual(pkg.workspaces, ['apps/*', 'packages/*']);
});

test('api package exposes build and test scripts', async () => {
  const pkg = await readJson('../packages/api/package.json');

  assert.equal(pkg.scripts.build, 'tsc -p tsconfig.json');
  assert.equal(pkg.scripts.test, 'node --import tsx --test tests/*.test.ts');
});

test('root package exposes CI scripts used by the workflow', async () => {
  const pkg = await readJson('../package.json');

  assert.equal(pkg.scripts.typecheck, 'turbo run build');
  assert.match(pkg.scripts.test, /npm run test:repo/);
  assert.match(pkg.scripts.test, /--workspace @sales_assistant\/api run test/);
  assert.match(pkg.scripts.test, /--workspace @sales_assistant\/via run test/);
  assert.equal(pkg.scripts['db:generate'], 'npm --workspace @sales_assistant/api run db:generate');
  assert.equal(pkg.scripts['db:migrate:deploy'], 'npm --workspace @sales_assistant/api run db:migrate:deploy');
});

test('CI workflow validates pgvector migrations and has no echo deploy stubs', async () => {
  const workflow = await readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');

  assert.match(workflow, /image:\s+pgvector\/pgvector:pg16/);
  assert.match(workflow, /npm run db:generate/);
  assert.match(workflow, /npm run db:migrate:deploy/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run test/);
  assert.doesNotMatch(workflow, /echo "Deploy/);
});

test('Via lint config disables import resolver crash path and ignores generated folders', async () => {
  const config = await readFile(new URL('../apps/via/eslint.config.js', import.meta.url), 'utf8');

  assert.match(config, /'import\/no-unresolved': 'off'/);
  assert.match(config, /'dist\/\*\*'/);
  assert.match(config, /'\.expo\/\*\*'/);
  assert.match(config, /'node_modules\/\*\*'/);
});

test('API Dockerfile builds from monorepo context with workspace install', async () => {
  const dockerfile = await readFile(new URL('../packages/api/Dockerfile', import.meta.url), 'utf8');

  assert.match(dockerfile, /WORKDIR \/repo/);
  assert.match(dockerfile, /npm ci --workspace @sales_assistant\/api/);
  assert.match(dockerfile, /npm --workspace @sales_assistant\/api run build/);
  assert.match(dockerfile, /CMD \["node", "packages\/api\/dist\/index\.js"\]/);
});

test('production compose defines API, worker, Redis, and pgvector runtime services', async () => {
  const compose = await readFile(new URL('../docker-compose.production.yml', import.meta.url), 'utf8');

  assert.match(compose, /postgres:/);
  assert.match(compose, /image:\s+pgvector\/pgvector:pg16/);
  assert.match(compose, /redis:/);
  assert.match(compose, /api:/);
  assert.match(compose, /worker:/);
  assert.match(compose, /npm --workspace @sales_assistant\/api run start/);
  assert.match(compose, /npm --workspace @sales_assistant\/api run start:worker/);
  assert.match(compose, /healthcheck:/);
});

test('shared role contract matches backend Prisma roles', async () => {
  const sharedApi = await readFile(new URL('../packages/shared/src/types/api.ts', import.meta.url), 'utf8');
  const prismaSchema = await readFile(new URL('../packages/api/prisma/schema.prisma', import.meta.url), 'utf8');

  assert.match(sharedApi, /export type Role = 'USER' \| 'AGENT' \| 'ADMIN';/);
  assert.match(prismaSchema, /enum Role \{\s+USER\s+AGENT\s+ADMIN\s+\}/);
  assert.doesNotMatch(sharedApi, /MANAGER/);
});
