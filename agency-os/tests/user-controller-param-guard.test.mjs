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
  controller.includes("import { AppError } from '../../middleware/errorHandler';"),
  true,
  'user.controller.ts should import AppError for invalid user-id handling',
);

assert.equal(
  controller.includes("const getUserIdFromParams = (req: AuthRequest) => {"),
  true,
  'user.controller.ts should define a shared user-id param guard',
);

assert.equal(
  controller.includes("if (typeof userId !== 'string') {"),
  true,
  'user.controller.ts should narrow req.params.id to a string',
);

assert.equal(
  controller.includes("throw new AppError(400, 'INVALID_USER_ID', 'User id is required');"),
  true,
  'user.controller.ts should reject missing or invalid user ids',
);

assert.equal(
  controller.includes('const userId = getUserIdFromParams(req);'),
  true,
  'user.controller.ts should use the guarded userId before calling the service layer',
);

assert.equal(
  controller.includes('userService.getUserById(req.params.id)'),
  false,
  'user.controller.ts should not pass req.params.id directly to getUserById',
);

assert.equal(
  controller.includes('userService.updateUser(req.params.id, req.body)'),
  false,
  'user.controller.ts should not pass req.params.id directly to updateUser',
);

assert.equal(
  controller.includes('userService.softDeleteUser(req.params.id, req.user!.userId)'),
  false,
  'user.controller.ts should not pass req.params.id directly to softDeleteUser',
);
