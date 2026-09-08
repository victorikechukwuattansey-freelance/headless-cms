import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const indexPath = path.join(repoRoot, 'packages/api/src/index.ts');
const errorHandlerPath = path.join(repoRoot, 'packages/api/src/middleware/errorHandler.ts');

const indexSource = fs.readFileSync(indexPath, 'utf8');
const errorHandlerSource = fs.readFileSync(errorHandlerPath, 'utf8');

assert.equal(
  indexSource.includes("import './modules/auth/worker';"),
  true,
  'API startup should import the auth worker so verification email jobs are actually processed',
);

assert.equal(
  errorHandlerSource.includes('logger.warn('),
  true,
  'errorHandler.ts should warn for expected AppError request failures instead of logging them as unhandled errors',
);

assert.equal(
  errorHandlerSource.indexOf('if (err instanceof AppError)') < errorHandlerSource.indexOf('logger.error('),
  true,
  'errorHandler.ts should classify AppError responses before the generic error logger runs',
);
