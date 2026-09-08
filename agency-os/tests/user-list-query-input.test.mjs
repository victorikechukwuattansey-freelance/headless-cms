import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const controllerPath = path.join(
  repoRoot,
  'packages/api/src/modules/users/user.controller.ts',
);
const controller = fs.readFileSync(controllerPath, 'utf8');

assert.equal(
  controller.includes('const listUsersInput: Parameters<typeof userService.listUsers>[0] = {'),
  true,
  'user.controller.ts should build a typed listUsersInput object',
);

assert.equal(
  controller.includes("if (typeof req.query.search === 'string') {"),
  true,
  'user.controller.ts should only assign search when it is a string',
);

assert.equal(
  controller.includes("if (req.query.role === 'USER' || req.query.role === 'MANAGER' || req.query.role === 'ADMIN') {"),
  true,
  'user.controller.ts should only assign role when it matches a valid enum value',
);

assert.equal(
  controller.includes("if (req.query.sortOrder === 'asc' || req.query.sortOrder === 'desc') {"),
  true,
  'user.controller.ts should only assign sortOrder when it matches a valid option',
);

assert.equal(
  controller.includes('search: req.query.search as string | undefined'),
  false,
  'user.controller.ts should not pass undefined-valued search fields into listUsers',
);

assert.equal(
  controller.includes('listUsersInput.role = req.query.role;'),
  true,
  'user.controller.ts should assign the narrowed role onto the typed listUsersInput object',
);
