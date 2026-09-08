import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const useCrudPath = path.join(repoRoot, 'apps/web/src/hooks/useCrud.ts');
const useCrud = fs.readFileSync(useCrudPath, 'utf8');

assert.equal(
  useCrud.includes('const queryParams = {'),
  true,
  'useCrud.ts should build a dedicated queryParams object',
);

assert.equal(
  useCrud.includes("...(sortBy ? { sortBy } : {})"),
  true,
  'useCrud.ts should only include sortBy when it has a value',
);

assert.equal(
  useCrud.includes('service.getAll({ page, limit: 20, search: debouncedSearch, sortBy, sortOrder })'),
  false,
  'useCrud.ts should not pass sortBy directly when it may be undefined',
);
