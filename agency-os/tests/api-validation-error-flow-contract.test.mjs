import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const validatePath = path.join(repoRoot, 'packages/api/src/middleware/validate.ts');
const errorHandlerPath = path.join(repoRoot, 'packages/api/src/middleware/errorHandler.ts');

const validateSource = fs.readFileSync(validatePath, 'utf8');
const errorHandlerSource = fs.readFileSync(errorHandlerPath, 'utf8');

assert.equal(
  validateSource.includes('try {'),
  true,
  'validate.ts should catch schema parsing failures before they escape Express middleware',
);

assert.equal(
  validateSource.includes('return next(error);'),
  true,
  'validate.ts should forward validation failures to Express error handling with next(error)',
);

assert.equal(
  errorHandlerSource.indexOf('if (err instanceof ZodError)') < errorHandlerSource.indexOf('logger.error('),
  true,
  'errorHandler.ts should classify Zod validation failures before the generic unhandled error logger runs',
);

assert.equal(
  errorHandlerSource.includes("code: 'VALIDATION_ERROR'"),
  true,
  'errorHandler.ts should return a VALIDATION_ERROR payload for Zod failures',
);
