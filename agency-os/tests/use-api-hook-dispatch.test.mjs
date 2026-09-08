import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const useApiPath = path.join(repoRoot, 'apps/web/src/hooks/useApi.ts');
const useApi = fs.readFileSync(useApiPath, 'utf8');

assert.equal(
  useApi.includes('apiClient[method]'),
  false,
  'useApi.ts should not call apiClient through indexed method access',
);

assert.equal(
  useApi.includes("case 'get':"),
  true,
  'useApi.ts should dispatch GET requests explicitly',
);

assert.equal(
  useApi.includes("case 'delete':"),
  true,
  'useApi.ts should dispatch DELETE requests explicitly',
);

assert.equal(
  useApi.includes('setData(result);'),
  true,
  'useApi.ts should store the unwrapped result returned by apiClient',
);

assert.equal(
  useApi.includes('res.data.data'),
  false,
  'useApi.ts should not treat apiClient responses like raw Axios responses',
);
