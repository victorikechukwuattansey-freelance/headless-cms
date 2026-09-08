import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const clientPath = path.join(repoRoot, 'packages/shared/src/service/client.ts');
const crudServicePath = path.join(repoRoot, 'apps/web/src/lib/crudService.ts');
const useCrudPath = path.join(repoRoot, 'apps/web/src/hooks/useCrud.ts');

const client = fs.readFileSync(clientPath, 'utf8');
const crudService = fs.readFileSync(crudServicePath, 'utf8');
const useCrud = fs.readFileSync(useCrudPath, 'utf8');

assert.equal(
  client.includes('async delete<T>(url: string, data?: unknown): Promise<T> {'),
  true,
  'shared apiClient.delete should accept an optional request body',
);

assert.equal(
  client.includes('this.client.delete<ApiResponse<T>>(url, { data })'),
  true,
  'shared apiClient.delete should forward the optional body via Axios delete config',
);

assert.equal(
  crudService.includes('AxiosResponse'),
  false,
  'web crudService should not type shared client responses as AxiosResponse',
);

assert.equal(
  crudService.includes('ApiResponse'),
  false,
  'web crudService should not type shared client responses as ApiResponse envelopes',
);

assert.equal(
  crudService.includes('bulkDelete: (ids) => apiClient.delete(`/${resource}/bulk`, { ids })'),
  true,
  'web crudService bulkDelete should send ids directly through the shared delete wrapper',
);

assert.equal(
  useCrud.includes('response.data.data'),
  false,
  'useCrud should not treat CrudService results like raw Axios responses',
);
