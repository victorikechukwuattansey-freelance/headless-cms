import { readFile } from 'node:fs/promises';
import YAML from 'yaml';

let cachedSpec: object | null = null;

export async function getOpenApiSpec(): Promise<object> {
  if (!cachedSpec) {
    const specFile = new URL('../../openapi/openapi.yaml', import.meta.url);
    const text = await readFile(specFile, 'utf8');
    cachedSpec = YAML.parse(text) as object;
  }
  return cachedSpec;
}