import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'packages/api/package.json');
const seedScriptPath = path.join(repoRoot, 'packages/api/src/scripts/seed-admin.ts');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const hasSeedScript = fs.existsSync(seedScriptPath);
const seedScript = hasSeedScript ? fs.readFileSync(seedScriptPath, 'utf8') : '';

assert.equal(
  packageJson.scripts['db:seed:admin'],
  'tsx src/scripts/seed-admin.ts',
  'packages/api/package.json should expose a db:seed:admin script',
);

assert.equal(
  hasSeedScript,
  true,
  'packages/api/src/scripts/seed-admin.ts should exist',
);

assert.equal(
  seedScript.includes('prisma.user.upsert('),
  true,
  'seed-admin.ts should upsert the admin user so the command is repeatable',
);

assert.equal(
  seedScript.includes("role: 'ADMIN'"),
  true,
  'seed-admin.ts should create an ADMIN user',
);

assert.equal(
  seedScript.includes('isEmailVerified: true'),
  true,
  'seed-admin.ts should mark the local admin as verified',
);

assert.equal(
  seedScript.includes('isActive: true'),
  true,
  'seed-admin.ts should keep the local admin active',
);

assert.equal(
  seedScript.includes('bcrypt.hash('),
  true,
  'seed-admin.ts should hash the seeded password before storing it',
);
