import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'packages/api/package.json');
const scriptPath = path.join(repoRoot, 'packages/api/src/scripts/reset-user-password.ts');

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const scriptSource = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf8') : '';

assert.equal(
  packageJson.scripts['db:reset-password'],
  'tsx src/scripts/reset-user-password.ts',
  'packages/api/package.json should expose a db:reset-password script',
);

assert.equal(
  fs.existsSync(scriptPath),
  true,
  'packages/api/src/scripts/reset-user-password.ts should exist',
);

assert.equal(
  scriptSource.includes('process.argv.slice(2)'),
  true,
  'reset-user-password.ts should read email and password from CLI arguments',
);

assert.equal(
  scriptSource.includes('bcrypt.hash('),
  true,
  'reset-user-password.ts should hash the provided password before persisting it',
);

assert.equal(
  scriptSource.includes('await prisma.user.update('),
  true,
  'reset-user-password.ts should update an existing user record',
);

assert.equal(
  scriptSource.includes('passwordResetToken: null'),
  true,
  'reset-user-password.ts should clear password reset tokens after changing the password',
);

assert.equal(
  scriptSource.includes('isEmailVerified: true'),
  true,
  'reset-user-password.ts should keep the account usable for local development by marking it email-verified',
);
