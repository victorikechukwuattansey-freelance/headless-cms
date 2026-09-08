import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const authControllerPath = path.join(repoRoot, 'packages/api/src/modules/auth/auth.controller.ts');
const authController = fs.readFileSync(authControllerPath, 'utf8');

assert.equal(
  authController.includes("import { AppError } from '../../middleware/errorHandler';"),
  true,
  'auth.controller.ts should import AppError for invalid request token handling',
);

assert.equal(
  authController.includes('const token = req.params.token;'),
  true,
  'auth.controller.ts should read the verify-email token into a local variable',
);

assert.equal(
  authController.includes("if (typeof token !== 'string') {"),
  true,
  'auth.controller.ts should narrow verify-email token to a string',
);

assert.equal(
  authController.includes("throw new AppError(400, 'INVALID_TOKEN', 'Verification token is required');"),
  true,
  'auth.controller.ts should reject missing or non-string verify-email tokens',
);

assert.equal(
  authController.includes('await authService.verifyEmail(token);'),
  true,
  'auth.controller.ts should pass the narrowed token to authService.verifyEmail',
);
