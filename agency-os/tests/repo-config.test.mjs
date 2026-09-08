import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const workspacePackageJsonPaths = [
  'apps/mobile/package.json',
  'apps/web/package.json',
  'packages/api/package.json',
  'packages/shared/package.json',
];
const requiredWebFiles = [
  'apps/web/vite.config.ts',
  'apps/web/src/components/layout/AuthLayout.tsx',
  'apps/web/src/components/layout/Header.tsx',
  'apps/web/src/lib/crudService.ts',
  'apps/web/src/lib/utils.ts',
];
const requiredPrismaSnippets = [
  'generator client',
  'datasource db',
  'isActive',
  'deletedAt',
];

for (const relativePath of workspacePackageJsonPaths) {
  const manifestPath = path.join(repoRoot, relativePath);
  const rawManifest = fs.readFileSync(manifestPath, 'utf8');

  assert.notEqual(
    rawManifest.trim(),
    '',
    `${relativePath} should not be empty`,
  );

  const manifest = JSON.parse(rawManifest);

  assert.equal(typeof manifest.name, 'string', `${relativePath} should define a package name`);
  assert.notEqual(manifest.name.trim(), '', `${relativePath} should define a non-empty package name`);
}

for (const relativePath of requiredWebFiles) {
  const filePath = path.join(repoRoot, relativePath);
  assert.equal(fs.existsSync(filePath), true, `${relativePath} should exist`);

  const rawFile = fs.readFileSync(filePath, 'utf8');
  assert.notEqual(rawFile.trim(), '', `${relativePath} should not be empty`);
}

const prismaSchemaPath = path.join(repoRoot, 'packages/api/prisma/schema.prisma');
const prismaSchema = fs.readFileSync(prismaSchemaPath, 'utf8');

for (const snippet of requiredPrismaSnippets) {
  assert.equal(
    prismaSchema.includes(snippet),
    true,
    `packages/api/prisma/schema.prisma should include "${snippet}"`,
  );
}
