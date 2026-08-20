# Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/web`, a Next.js ops dashboard consuming the org-scoped CRM API, plus the `packages/api-client` typed fetch layer and one small API addition (reminder dismissal) the UI needs.

**Architecture:** Browser → Next.js App Router app (:4000). A catch-all route handler (`app/api/[...path]`) proxies to the API (:3000) with a bearer token from an httpOnly `sa_session` cookie. Server components call `packages/api-client` directly; client components call the same-origin `/api/...` proxy, then `router.refresh()`. `middleware.ts` gates pages on the session cookie. No CORS changes, no new client-side data deps.

**Tech Stack:** Next.js ^15.1.6 (App Router), React ^19, Tailwind CSS v4 (`@tailwindcss/postcss`), TypeScript ^5.7, npm workspaces + Turbo. Nothing shared with the API runtime except `@sales_assistant/shared` (type-only `Role`).

## Global Constraints

- Monorepo root: `sales_assistant/` in repo `C:\Users\1040 G8\Documents\jarvis-demo` (worktree = the `sales_assistant` directory only; never touch sibling projects).
- npm workspaces `["apps/*", "packages/*"]`; npm@11.18.0; `"type": "module"`; package names follow `@sales_assistant/<name>` (existing: api, via, config, db, shared, ui).
- TypeScript NodeNext resolution for node packages → relative imports must use `.js` extensions (`import { x } from './y.js'`). The web app uses `moduleResolution: "bundler"` (Next standard — no `.js` extensions there).
- API contract (verified against `packages/api/src/app.ts` and `packages/openapi/openapi.yaml`):
  - All business routes require `Authorization: Bearer <token>`; errors always `{ error: { code, message } }`.
  - Lists: `{ data: [...], total, limit, offset }`; singles: `{ data: {...} }`; create: 201 `{ data }`; errors: 400 VALIDATION, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 409 INVALID_TRANSITION | NO_AGENT_AVAILABLE, 429 RATE_LIMITED (with `retry-after` + `x-ratelimit-*` headers).
  - `POST /auth/token` (public) → `{ token, expiresAt, role }`, token TTL 1h, no refresh endpoint.
  - Lead statuses `new|assigned|contacted|qualified|converted|lost`; transitions: `new→assigned`, `assigned→contacted|lost`, `contacted→qualified|lost`, `qualified→converted|lost`; terminal `converted|lost`. Deal stages `proposed|won|lost`, transitions `proposed→won|lost`. Reminder statuses `pending|sent|dismissed`. Agent status `idle|busy`.
  - `GET /reminders` items include `lead: { phone, name }`. Lead items include `agent` (full Agent or null). Deal `amount` is a `number`.
- No CORS changes to the API. No new dependencies in `apps/web` beyond next/react/tailwind toolchain; no data-fetching libs.
- API remains the only authorization enforcement point; UI hides what roles can't do.
- Dashboards fetch fresh (no store caching); client mutations end with `router.refresh()`.
- Session cookie `sa_session` = JSON `{ token, expiresAt, role }`, httpOnly, `sameSite: lax`, `secure` in production, path `/`.
- Don't touch `.opencode/`, other projects, or the API's auth/rate-limit behavior.
- The API currently has NO reminder-dismiss route — Task 1 adds it (required by the design spec's "dismiss" action).

---

### Task 1: API — reminder dismiss endpoint

**Files:**
- Modify: `packages/api/src/services/follow-up-reminder.service.ts` (add `dismiss` after `list`)
- Modify: `packages/api/src/app.ts:426` (`routeReminders` — add the dismiss branch)
- Modify: `packages/openapi/openapi.yaml` (new path after the `/reminders/generate` block, line ~990)
- Modify: `packages/api/tests/runtime/integration.test.ts` (new test + 1 assertion in the docs test)

**Interfaces:**
- Produces: `FollowUpReminderService.dismiss(context: DomainContext, reminderId: string): Promise<Reminder & { lead: { phone: string; name: string | null } }>` — 404 `NOT_FOUND` when missing/foreign; sets `status: 'dismissed'`; writes audit event `REMINDER_DISMISSED`; returns the updated reminder (with `include.lead`).
- Produces: HTTP `POST /reminders/:id/dismiss` → 200 `{ data: <reminder> }`, 401, 404.

- [x] **Step 1: Add the failing service method** in `packages/api/src/services/follow-up-reminder.service.ts` — `prisma` and `writeAuditEvent` are already imported, but `DomainError` must be added: `import { DomainError } from '../domain/domain-error.js';` after the `DomainContext` import. Then add after the `list` method (end of class):

```ts
  async dismiss(context: DomainContext, reminderId: string) {
    const reminder = await prisma.followUpReminder.findFirst({
      where: { id: reminderId, organizationId: context.organizationId },
    });
    if (!reminder) throw new DomainError('NOT_FOUND', 'Reminder not found');
    const updated = await prisma.followUpReminder.update({
      where: { id: reminder.id },
      data: { status: 'dismissed' },
      include: { lead: { select: { phone: true, name: true } } },
    });
    await writeAuditEvent(context, 'REMINDER_DISMISSED', { reminderId: reminder.id, leadId: reminder.leadId });
    return updated;
  }
```

- [x] **Step 2: Wire the route** in `packages/api/src/app.ts`. In `routeReminders` (starts line 426), the function currently has no `id`/`action` destructure. Change the signature line to add it, and insert the dismiss branch before the final `else`:

```ts
async function routeReminders(
  res: ServerResponse,
  service: FollowUpReminderService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  const [, id, action] = segments;
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listRemindersQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else if (segments.length === 2 && segments[1] === 'generate' && method === 'POST') {
    requireRole(context, ['ADMIN']);
    const jobId = `reminders-${randomUUID()}`;
    await enqueueJob({
      id: jobId,
      type: 'generate-follow-up-reminders',
      payload: { organizationId: context.organizationId, userId: context.userId, role: context.role },
    });
    sendJson(res, 202, { data: { queued: true, jobId } });
  } else if (segments.length === 3 && id && action === 'dismiss' && method === 'POST') {
    sendJson(res, 200, { data: plain(await service.dismiss(context, id)) });
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}
```

- [x] **Step 3: Document in OpenAPI** — insert this block at the end of `packages/openapi/openapi.yaml` paths (after the `/reminders/generate` block closes at line ~990, before the `/health` path):

```yaml
  /reminders/{id}/dismiss:
    post:
      tags: [Reminders]
      summary: Dismiss a follow-up reminder
      security:
        - bearerAuth: []
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: Reminder dismissed
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    $ref: '#/components/schemas/FollowUpReminder'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '404':
          $ref: '#/components/responses/NotFound'
```

- [x] **Step 4: Write the failing integration test** — append to `packages/api/tests/runtime/integration.test.ts` (after the `follow-up reminders list, filter, and generate endpoint` test, ~line 744):

```ts
test('reminder dismiss endpoint flips status, audits, and is org-scoped', async () => {
  const lead = await prisma.leadProfile.create({ data: { organizationId: orgA, phone: '+2348000001000' } });
  const reminder = await prisma.followUpReminder.create({
    data: { organizationId: orgA, leadId: lead.id, dueAt: new Date(Date.now() + 86_400_000), message: 'Follow up with lead' },
  });

  const dismissed = await api(`/reminders/${reminder.id}/dismiss`, { method: 'POST', token: tokenA });
  assert.equal(dismissed.status, 200);
  assert.equal(dismissed.json.data.id, reminder.id);
  assert.equal(dismissed.json.data.status, 'dismissed');

  const audit = await prisma.domainAuditEvent.findFirst({
    where: { organizationId: orgA, eventType: 'REMINDER_DISMISSED' },
  });
  assert.ok(audit);

  const crossOrg = await api(`/reminders/${reminder.id}/dismiss`, { method: 'POST', token: tokenB });
  assert.equal(crossOrg.status, 404);
  assert.equal(crossOrg.json.error.code, 'NOT_FOUND');

  const missing = await api('/reminders/reminder-missing/dismiss', { method: 'POST', token: tokenA });
  assert.equal(missing.status, 404);
});
```

- [x] **Step 5: Extend the docs test** — in the `docs and openapi.json are served without auth` test (~line 753), add after the `/reminders/generate` assertion:

```ts
  assert.ok(spec.json.paths['/reminders/{id}/dismiss']);
```

- [x] **Step 6: Run integration tests** — from `sales_assistant/`:

Run: `npm run test:integration`
Expected: 25/25 pass (including the new dismiss test).

- [x] **Step 7: Commit**

```bash
git add sales_assistant/packages/api/src/services/follow-up-reminder.service.ts sales_assistant/packages/api/src/app.ts sales_assistant/packages/openapi/openapi.yaml sales_assistant/packages/api/tests/runtime/integration.test.ts
git commit -m "feat(api): reminder dismiss endpoint"
```

---

### Task 2: `packages/api-client` workspace

**Files:**
- Create: `packages/api-client/package.json`, `packages/api-client/tsconfig.json`, `packages/api-client/eslint.config.js`, `packages/api-client/src/types.ts`, `packages/api-client/src/index.ts`, `packages/api-client/tests/api-client.test.ts`
- Modify: `sales_assistant/package.json` (add api-client test to root `test` script)

**Interfaces:**
- Consumes: `@sales_assistant/shared` (type-only `Role`), `process.env.API_URL` (default `http://localhost:3000`).
- Produces: `apiRequest(path: string, options?: { method?: string; body?: unknown; query?: Record<string, string | number | boolean | undefined>; token?: string }): Promise<{ status: number; json: any }>`.
- Produces the endpoint helpers in `src/index.ts` (used by every later task): `login`, `listUsers`, `createUser`, `listLeads`, `getLead`, `transitionLeadStatus`, `assignLead`, `scoreLead`, `listAgents`, `setAgentAvailability`, `listDeals`, `transitionDeal`, `listReminders`, `generateReminders`, `dismissReminder` — all `(token, ...)` style returning the `apiRequest` promise. Signature detail: `assignLead(token, id, agentId?)` sends body `{ agentId }` when provided, else `{}`.

- [x] **Step 1: Write `package.json`**:

```json
{
  "name": "@sales_assistant/api-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint .",
    "test": "node --import tsx --test tests/*.test.ts"
  },
  "dependencies": {
    "@sales_assistant/shared": "*"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "eslint": "^9.17.0",
    "eslint-plugin-import": "^2.31.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [x] **Step 2: Write `tsconfig.json`** (mirror `packages/api/tsconfig.json` style):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

- [x] **Step 3: Write `eslint.config.js`** — copy the contents of `packages/api/eslint.config.js` verbatim (it sets `node` languageOptions with the import plugin via flat config).

- [x] **Step 4: Write `src/types.ts`** (uses `.js`-free type-only import so it compiles under NodeNext without a runtime dep on shared's dist):

```ts
export type Role = 'USER' | 'AGENT' | 'ADMIN';
export interface Paginated<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
export interface ApiErrorBody {
  error: { code: string; message: string };
}
export interface LoginResult {
  token: string;
  expiresAt: string;
  role: Role;
}
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  organizationId: string;
  createdAt: string;
}
export type LeadStatus = 'new' | 'assigned' | 'contacted' | 'qualified' | 'converted' | 'lost';
export interface Agent {
  id: string;
  organizationId: string;
  name: string;
  status: 'idle' | 'busy';
  createdAt: string;
}
export interface Lead {
  id: string;
  organizationId: string;
  phone: string;
  name: string | null;
  score: number;
  scoreReason: string | null;
  lastScoredAt: string | null;
  lastContactedAt: string | null;
  status: LeadStatus;
  agentId: string | null;
  agent: Agent | null;
  createdAt: string;
}
export type DealStage = 'proposed' | 'won' | 'lost';
export interface Deal {
  id: string;
  organizationId: string;
  amount: number;
  stage: DealStage;
  createdAt: string;
}
export type ReminderStatus = 'pending' | 'sent' | 'dismissed';
export interface Reminder {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string | null;
  dueAt: string;
  message: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
  lead: { phone: string; name: string | null };
}
```

- [x] **Step 5: Write `src/index.ts`**:

```ts
export type {
  Role,
  Paginated,
  ApiErrorBody,
  LoginResult,
  User,
  LeadStatus,
  Agent,
  Lead,
  DealStage,
  Deal,
  ReminderStatus,
  Reminder,
} from './types.js';

export interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  token?: string;
}

export interface ApiResponse {
  status: number;
  json: any;
}

export function apiUrl(): string {
  return process.env.API_URL ?? 'http://localhost:3000';
}

export async function apiRequest(path: string, options: RequestOptions = {}): Promise<ApiResponse> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) search.set(key, String(value));
  }
  const queryString = search.size > 0 ? `?${search.toString()}` : '';
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${apiUrl()}${path}${queryString}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  let json: any = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return { status: response.status, json };
}

export const login = (email: string, password: string) =>
  apiRequest('/auth/token', { method: 'POST', body: { email, password } });

export const listUsers = (token: string, query: { limit?: number; offset?: number } = {}) =>
  apiRequest('/users', { token, query });

export const createUser = (
  token: string,
  input: { email: string; password: string; name?: string; role?: Role },
) => apiRequest('/users', { method: 'POST', token, body: input });

export const listLeads = (
  token: string,
  query: { limit?: number; offset?: number; status?: LeadStatus; agentId?: string } = {},
) => apiRequest('/leads', { token, query });

export const getLead = (token: string, id: string) =>
  apiRequest(`/leads/${encodeURIComponent(id)}`, { token });

export const transitionLeadStatus = (token: string, id: string, status: LeadStatus) =>
  apiRequest(`/leads/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: { status } });

export const assignLead = (token: string, id: string, agentId?: string) =>
  apiRequest(`/leads/${encodeURIComponent(id)}/assign`, {
    method: 'POST',
    token,
    body: agentId ? { agentId } : {},
  });

export const scoreLead = (token: string, id: string) =>
  apiRequest(`/leads/${encodeURIComponent(id)}/score`, { method: 'POST', token });

export const listAgents = (token: string, query: { limit?: number; offset?: number; available?: boolean } = {}) =>
  apiRequest('/agents', { token, query });

export const setAgentAvailability = (token: string, id: string, available: boolean) =>
  apiRequest(`/agents/${encodeURIComponent(id)}/availability`, { method: 'POST', token, body: { available } });

export const listDeals = (token: string, query: { limit?: number; offset?: number; stage?: DealStage } = {}) =>
  apiRequest('/deals', { token, query });

export const transitionDeal = (token: string, id: string, stage: DealStage) =>
  apiRequest(`/deals/${encodeURIComponent(id)}/transition`, { method: 'POST', token, body: { stage } });

export const listReminders = (
  token: string,
  query: { limit?: number; offset?: number; status?: ReminderStatus } = {},
) => apiRequest('/reminders', { token, query });

export const generateReminders = (token: string) =>
  apiRequest('/reminders/generate', { method: 'POST', token });

export const dismissReminder = (token: string, id: string) =>
  apiRequest(`/reminders/${encodeURIComponent(id)}/dismiss`, { method: 'POST', token });
```

- [x] **Step 6: Write tests `tests/api-client.test.ts`** (mock `globalThis.fetch`; mirrors repo `node:test` style):

```ts
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest, assignLead, listLeads, login, dismissReminder } from '../src/index.js';

let calls: { url: string; init: RequestInit }[] = [];

function mockFetch(status: number, body: unknown) {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
}

beforeEach(() => {
  calls = [];
});

test('apiRequest sends method, bearer token, json body, and query params', async () => {
  mockFetch(200, { ok: true });
  const result = await apiRequest('/leads', {
    method: 'POST',
    token: 'tok-1',
    body: { phone: '+1' },
    query: { limit: 5, status: 'new', agentId: undefined },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { ok: true });
  assert.equal(calls[0].url, 'http://localhost:3000/leads?limit=5&status=new');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal((calls[0].init.headers as Record<string, string>).authorization, 'Bearer tok-1');
  assert.equal((calls[0].init.headers as Record<string, string>)['content-type'], 'application/json');
  assert.equal(calls[0].init.body, JSON.stringify({ phone: '+1' }));
});

test('apiRequest GET without token or body sends no auth header and parses empty body as null', async () => {
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response('', { status: 204 });
  }) as typeof fetch;
  const result = await apiRequest('/health');
  assert.equal(result.status, 204);
  assert.equal(result.json, null);
  assert.ok(!('authorization' in (calls[0].init.headers ?? {})));
});

test('helpers build the documented paths and payloads', async () => {
  mockFetch(200, {});
  await login('a@b.c', 'pw');
  assert.equal(calls[0].url, 'http://localhost:3000/auth/token');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.body, JSON.stringify({ email: 'a@b.c', password: 'pw' }));

  await listLeads('tok', { status: 'converted', limit: 10 });
  assert.equal(calls[1].url, 'http://localhost:3000/leads?limit=10&status=converted');
  assert.equal((calls[1].init.headers as Record<string, string>).authorization, 'Bearer tok');

  await assignLead('tok', 'lead-1', 'agent-9');
  assert.equal(calls[2].url, 'http://localhost:3000/leads/lead-1/assign');
  assert.equal(calls[2].init.method, 'POST');
  assert.equal(calls[2].init.body, JSON.stringify({ agentId: 'agent-9' }));

  await dismissReminder('tok', 'rem-1');
  assert.equal(calls[3].url, 'http://localhost:3000/reminders/rem-1/dismiss');
  assert.equal(calls[3].init.method, 'POST');
});
```

(Note: the `listLeads` assertion — `query` object literal spread keeps insertion order, `limit` then `status`; if ordering differs, adjust the expected string to match `URLSearchParams` iteration.)

- [x] **Step 7: Run the api-client tests**

Run: `npm --workspace @sales_assistant/api-client run test`
Expected: 3/3 pass. Then `npm --workspace @sales_assistant/api-client run build` — expected: `dist/` with `index.js` + `index.d.ts` + `types.js`.

- [x] **Step 8: Wire into root test script** — in `sales_assistant/package.json`, change the `test` line (line 15) to:

```json
    "test": "npm run test:repo && npm --workspace @sales_assistant/api run test && npm --workspace @sales_assistant/api-client run test && npm --workspace @sales_assistant/via run test",
```

- [x] **Step 9: Commit**

```bash
git add sales_assistant/packages/api-client sales_assistant/package.json
git commit -m "feat(api-client): typed HTTP client workspace"
```

---

### Task 3: `apps/web` scaffold, session, auth flow, proxy

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/postcss.config.mjs`, `apps/web/eslint.config.mjs`, `apps/web/middleware.ts`, `apps/web/app/globals.css`, `apps/web/app/layout.tsx`, `apps/web/app/login/page.tsx`, `apps/web/src/lib/session-core.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/components/nav.tsx`, `apps/web/src/components/login-form.tsx`, `apps/web/app/api/auth/login/route.ts`, `apps/web/app/api/auth/logout/route.ts`, `apps/web/app/api/[...path]/route.ts`
- Modify: root `sales_assistant/package.json` (turbo workspaces pick up `apps/*` automatically; nothing else yet)

**Interfaces:**
- Consumes: `apiRequest` + `login` from `@sales_assistant/api-client`; the `sa_session` cookie.
- Produces: `Session` `{ token, expiresAt, role }`; `parseSession(value?: string): Session | null`; `sessionCookieOptions(expiresAt: string)`; `getSession(): Promise<Session | null>` (server-only, `next/headers`); `POST /api/auth/login` → `{ role }` or error json; `POST /api/auth/logout` → `{ ok: true }`; `API_URL`-based proxy; middleware gating pages/API.
- Proxy contract for client components: any `fetch('/api/<api-path>?query')` with method/body passthrough returns `{ status, json }` of the API and forwards `retry-after` + `x-ratelimit-*` headers; 401 json when no valid session.

- [x] **Step 1: Write `apps/web/package.json`**:

```json
{
  "name": "@sales_assistant/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 4000",
    "build": "next build",
    "start": "next start -p 4000",
    "lint": "eslint ."
  },
  "dependencies": {
    "@sales_assistant/api-client": "*",
    "next": "^15.1.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.1.6",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2"
  }
}
```

- [x] **Step 2: Write `apps/web/tsconfig.json`** (standard Next config, `@/*` alias → app root):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [x] **Step 3: Write `next.config.ts`**:

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [x] **Step 4: Write `postcss.config.mjs`**:

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [x] **Step 5: Write `eslint.config.mjs`**:

```js
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

export default [...compat.extends('next/core-web-vitals', 'next/typescript')];
```

(If installing `@eslint/eslintrc` is required, add it to devDependencies: `"@eslint/eslintrc": "^3.2.0"`.)

- [x] **Step 6: Write `app/globals.css`**:

```css
@import 'tailwindcss';
```

- [x] **Step 7: Write `src/lib/session-core.ts`** (pure module — imported by Edge middleware, keep free of `next/*` imports):

```ts
export const SESSION_COOKIE = 'sa_session';

export interface Session {
  token: string;
  expiresAt: string;
  role: 'USER' | 'AGENT' | 'ADMIN';
}

export function parseSession(value: string | undefined): Session | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Session>;
    if (
      typeof parsed.token === 'string' &&
      typeof parsed.expiresAt === 'string' &&
      (parsed.role === 'USER' || parsed.role === 'AGENT' || parsed.role === 'ADMIN')
    ) {
      return { token: parsed.token, expiresAt: parsed.expiresAt, role: parsed.role };
    }
    return null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(expiresAt: string) {
  return {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  };
}
```

- [x] **Step 8: Write `src/lib/session.ts`** (server-only):

```ts
import { cookies } from 'next/headers';
import { parseSession, SESSION_COOKIE, type Session } from './session-core';

export type { Session } from './session-core';

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}
```

- [x] **Step 9: Write `middleware.ts`**:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { parseSession, SESSION_COOKIE } from './src/lib/session-core';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  const expired = !session || new Date(session.expiresAt).getTime() <= Date.now();

  if (expired) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

- [x] **Step 10: Write `app/api/[...path]/route.ts`** (catch-all proxy):

```ts
import { NextRequest, NextResponse } from 'next/server';
import { parseSession, SESSION_COOKIE } from '../../../src/lib/session-core';

const FORWARD_HEADERS = ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'];

async function proxy(req: NextRequest, path: string[]) {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'Method not allowed' } }, { status: 405 });
  }
  const session = parseSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Session required' } }, { status: 401 });
  }
  const target = `${process.env.API_URL ?? 'http://localhost:3000'}/${path.join('/')}${req.nextUrl.search}`;
  const headers: Record<string, string> = { authorization: `Bearer ${session.token}` };
  if (req.body && req.method !== 'GET' && req.method !== 'DELETE') headers['content-type'] = 'application/json';
  let upstream: Response;
  try {
    upstream = await fetch(target, { method: req.method, headers, body: req.body, cache: 'no-store' });
  } catch {
    return NextResponse.json({ error: { code: 'INTERNAL', message: 'API unreachable' } }, { status: 502 });
  }
  const text = await upstream.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  const response = NextResponse.json(json, { status: upstream.status });
  for (const name of FORWARD_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) response.headers.set(name, value);
  }
  return response;
}

async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return proxy(req, path ?? []);
}

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
```

- [x] **Step 11: Write `app/api/auth/login/route.ts`**:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { apiRequest } from '@sales_assistant/api-client';
import { SESSION_COOKIE, sessionCookieOptions } from '../../../src/lib/session-core';

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const email = typeof raw?.email === 'string' ? raw.email : undefined;
  const password = typeof raw?.password === 'string' ? raw.password : undefined;
  if (!email || !password) {
    return NextResponse.json({ error: { code: 'VALIDATION', message: 'email and password are required' } }, { status: 400 });
  }
  const result = await apiRequest('/auth/token', { method: 'POST', body: { email, password } });
  if (result.status !== 200 || !result.json?.token) {
    return NextResponse.json(
      result.json ?? { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } },
      { status: result.status },
    );
  }
  const expiresAt = result.json.expiresAt as string;
  const role = result.json.role as 'USER' | 'AGENT' | 'ADMIN';
  const store = await cookies();
  store.set(SESSION_COOKIE, JSON.stringify({ token: result.json.token, expiresAt, role }), sessionCookieOptions(expiresAt));
  return NextResponse.json({ role });
}
```

- [x] **Step 12: Write `app/api/auth/logout/route.ts`**:

```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '../../../src/lib/session-core';

export async function POST() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
```

- [x] **Step 13: Write `app/layout.tsx`** (shell: fixed sidebar when logged in):

```tsx
import type { Metadata } from 'next';
import './globals.css';
import { getSession } from '@/src/lib/session';
import { Nav } from '@/src/components/nav';

export const metadata: Metadata = {
  title: 'Sales Assistant',
  description: 'Org operations dashboard',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-100 text-neutral-900 antialiased">
        {session && <Nav role={session.role} />}
        <main className={session ? 'lg:pl-56' : ''}>{children}</main>
      </body>
    </html>
  );
}
```

- [x] **Step 14: Write `src/components/nav.tsx`** (client — logout button needs interactivity):

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Session } from '@/src/lib/session';

const ITEMS: { href: string; label: string }[] = [
  { href: '/', label: 'Dashboard' },
  { href: '/leads', label: 'Leads' },
  { href: '/agents', label: 'Agents' },
  { href: '/reminders', label: 'Reminders' },
  { href: '/deals', label: 'Deals' },
];

export function Nav({ role }: { role: Session['role'] }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="fixed inset-y-0 left-0 z-10 hidden w-56 flex-col border-r border-neutral-800 bg-neutral-900 p-4 text-neutral-100 lg:flex">
      <div className="mb-6 text-sm font-semibold uppercase tracking-widest text-neutral-400">Sales Assistant</div>
      <ul className="space-y-1">
        {ITEMS.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block rounded px-3 py-2 text-sm hover:bg-neutral-800">
              {item.label}
            </Link>
          </li>
        ))}
        {role === 'ADMIN' && (
          <li>
            <Link href="/users" className="block rounded px-3 py-2 text-sm hover:bg-neutral-800">
              Users
            </Link>
          </li>
        )}
      </ul>
      <div className="mt-auto space-y-2 text-xs text-neutral-400">
        <div className="px-3">Signed in as {role}</div>
        <button onClick={logout} className="w-full rounded bg-neutral-800 px-3 py-2 text-left hover:bg-neutral-700">
          Sign out
        </button>
      </div>
    </nav>
  );
}
```

- [x] **Step 15: Write `app/login/page.tsx`**:

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/src/lib/session';
import { LoginForm } from '@/src/components/login-form';

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect('/');
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold">Sales Assistant</h1>
        <p className="mb-6 text-sm text-neutral-500">Sign in to the operations dashboard</p>
        <LoginForm />
      </div>
    </div>
  );
}
```

- [x] **Step 16: Write `src/components/login-form.tsx`**:

```tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error?.message ?? 'Login failed');
      setBusy(false);
      return;
    }
    const next = searchParams.get('next');
    router.push(next && next.startsWith('/') ? next : '/');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
      >
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
```

- [x] **Step 17: Install and boot**

Run: `npm install` (root — installs next/react/tailwind + links `@sales_assistant/api-client`; expect a few minutes).
Then: `npm --workspace @sales_assistant/web run dev`
Expected: Next dev server on http://localhost:4000, `/login` renders the form; visiting `/` while logged out redirects to `/login`; `curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/login` → 200.

- [x] **Step 18: Manual login smoke test** (API running on :3000 — `npm --workspace @sales_assistant/api run start` with `.env` set per `docker-compose.yml`; seeds `admin@acme.test` / `password123`):

```bash
curl -s -c cookies.txt -X POST http://localhost:4000/api/auth/login -H "content-type: application/json" -d "{\"email\":\"admin@acme.test\",\"password\":\"password123\"}"
```
Expected: `{"role":"ADMIN"}`.
Then: `curl -s -b cookies.txt -o /dev/null -w "%{http_code}" http://localhost:4000/` → 200 with the dashboard shell markup (KPI sections render in Task 5).
And: `curl -s -b cookies.txt http://localhost:4000/api/leads` → 200 `{"data":[...],"total":...}` (proves the proxy injects the token).

- [x] **Step 19: Commit**

```bash
git add sales_assistant/apps/web
git commit -m "feat(web): Next.js app scaffold, session auth, API proxy"
```

---

### Task 4: UI primitives and domain maps

**Files:**
- Create: `apps/web/src/components/button.tsx`, `apps/web/src/components/badge.tsx`, `apps/web/src/components/card.tsx`, `apps/web/src/components/table.tsx`, `apps/web/src/components/modal.tsx`, `apps/web/src/lib/status-maps.ts`

**Interfaces:**
- Produces: `Button` (variants `primary`|`ghost`|`danger`), `Badge` (className string), `Card` ({ title?, children, action? }), `Table` ({ headers: [string, string][], rows: ReactNode[][] }), `Modal` ({ open, title, onClose, children }) — plus `LEAD_TRANSITIONS`, `DEAL_TRANSITIONS`, `LEAD_BADGES`, `DEAL_BADGES`, `REMINDER_BADGES`, `AGENT_BADGES` maps. All are plain function components (no client state except Modal) that any page can import.

- [x] **Step 1: Write `src/lib/status-maps.ts`**:

```ts
import type { DealStage, LeadStatus, ReminderStatus } from '@sales_assistant/api-client';

export const LEAD_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  new: ['assigned'],
  assigned: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['converted', 'lost'],
  converted: [],
  lost: [],
};

export const DEAL_TRANSITIONS: Record<DealStage, DealStage[]> = {
  proposed: ['won', 'lost'],
  won: [],
  lost: [],
};

export const LEAD_BADGES: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  assigned: 'bg-violet-100 text-violet-800',
  contacted: 'bg-amber-100 text-amber-800',
  qualified: 'bg-emerald-100 text-emerald-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

export const DEAL_BADGES: Record<DealStage, string> = {
  proposed: 'bg-blue-100 text-blue-800',
  won: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
};

export const REMINDER_BADGES: Record<ReminderStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  sent: 'bg-blue-100 text-blue-800',
  dismissed: 'bg-neutral-200 text-neutral-700',
};

export const AGENT_BADGES: Record<'idle' | 'busy', string> = {
  idle: 'bg-emerald-100 text-emerald-800',
  busy: 'bg-neutral-200 text-neutral-700',
};
```

- [x] **Step 2: Write `src/components/badge.tsx`**:

```tsx
export function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  );
}
```

- [x] **Step 3: Write `src/components/button.tsx`**:

```tsx
import { type ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'ghost' | 'danger';

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-700',
  ghost: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
  danger: 'bg-red-100 text-red-700 hover:bg-red-200',
};

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center rounded px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
```

- [x] **Step 4: Write `src/components/card.tsx`**:

```tsx
export function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between">
          {title && <h2 className="text-sm font-semibold text-neutral-700">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
```

- [x] **Step 5: Write `src/components/table.tsx`**:

```tsx
export function Table({
  headers,
  rows,
  empty = 'No records',
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) {
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-neutral-400">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-500">
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {rows.map((row, index) => (
            <tr key={index} className="hover:bg-neutral-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [x] **Step 6: Write `src/components/modal.tsx`**:

```tsx
'use client';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [x] **Step 7: Verify + commit**

Run: `npm --workspace @sales_assistant/web run lint` and `npm --workspace @sales_assistant/web run build`
Expected: lint clean, build success (`route / (app)`, `/login`, API route handlers compiled).
Then:

```bash
git add sales_assistant/apps/web/src/components sales_assistant/apps/web/src/lib/status-maps.ts
git commit -m "feat(web): UI primitives and status maps"
```

---

### Task 5: Dashboard page

**Files:**
- Create: `apps/web/app/page.tsx`, `apps/web/src/components/reminder-actions.tsx`

**Interfaces:**
- Consumes: `getSession`, `apiRequest`, `Card`, `Badge`, `Table`, `REMINDER_BADGES`, `LEAD_BADGES`; proxy `POST /api/reminders/:id/dismiss`.
- Produces: KPI grid from list `total`s; recent leads table; pending reminders panel with `DismissReminderButton` (client) that posts to `/api/reminders/{id}/dismiss` then `router.refresh()`.

- [x] **Step 1: Write `app/page.tsx`**:

```tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { LEAD_BADGES, REMINDER_BADGES } from '@/src/lib/status-maps';
import { DismissReminderButton } from '@/src/components/reminder-actions';

export const dynamic = 'force-dynamic';

const STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'converted', 'lost'] as const;

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;

  const [statusResults, agents, deals, reminders, recent] = await Promise.all([
    ...STATUSES.map((status) => apiRequest('/leads', { token, query: { status, limit: 1 } })),
    apiRequest('/agents', { token, query: { limit: 1 } }),
    apiRequest('/deals', { token, query: { stage: 'proposed', limit: 1 } }),
    apiRequest('/reminders', { token, query: { status: 'pending', limit: 5 } }),
    apiRequest('/leads', { token, query: { limit: 5 } }),
  ]);

  const totals = Object.fromEntries(STATUSES.map((status, i) => [status, statusResults[i].json?.total ?? 0])) as Record<
    (typeof STATUSES)[number],
    number
  >;
  const agentsTotal = agents.json?.total ?? 0;
  const openDeals = deals.json?.total ?? 0;
  const pendingReminders = reminders.json?.total ?? 0;
  const recentLeads = (recent.json?.data ?? []) as { id: string; phone: string; name: string | null; status: string; score: number }[];
  const reminderItems = (reminders.json?.data ?? []) as { id: string; message: string; dueAt: string; status: string }[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card title="Total leads">{totals.new + totals.assigned + totals.contacted + totals.qualified + totals.converted + totals.lost}</Card>
        <Card title="Active pipeline">{totals.new + totals.assigned + totals.contacted + totals.qualified}</Card>
        <Card title="Open deals">{openDeals}</Card>
        <Card title="Pending reminders">{pendingReminders}</Card>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        {STATUSES.map((status) => (
          <Card key={status} title={status}>
            <span className="text-xl font-semibold">{totals[status]}</span>
          </Card>
        ))}
        <Card title="Agents">
          <span className="text-xl font-semibold">{agentsTotal}</span>
        </Card>
      </div>
      <Card title="Recent leads">
        <Table
          headers={['Phone', 'Name', 'Status', 'Score', '']}
          rows={recentLeads.map((lead) => [
            lead.phone,
            lead.name ?? '—',
            <Badge key={lead.id} className={LEAD_BADGES[lead.status as keyof typeof LEAD_BADGES] ?? LEAD_BADGES.new}>
              {lead.status}
            </Badge>,
            String(lead.score),
            <Link key={lead.id} href={`/leads/${lead.id}`} className="text-neutral-500 hover:text-neutral-900">
              View →
            </Link>,
          ])}
        />
      </Card>
      <Card title="Pending follow-ups" action={<Link href="/reminders" className="text-sm text-neutral-500 hover:text-neutral-900">All reminders →</Link>}>
        <Table
          headers={['Message', 'Due', 'Status', '']}
          rows={reminderItems.map((reminder) => [
            reminder.message,
            new Date(reminder.dueAt).toLocaleString(),
            <Badge key={reminder.id} className={REMINDER_BADGES[reminder.status as keyof typeof REMINDER_BADGES] ?? REMINDER_BADGES.pending}>
              {reminder.status}
            </Badge>,
            <DismissReminderButton key={reminder.id} reminderId={reminder.id} />,
          ])}
        />
      </Card>
    </div>
  );
}
```

- [x] **Step 2: Write `src/components/reminder-actions.tsx`**:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';

export function DismissReminderButton({ reminderId }: { reminderId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function dismiss() {
    setBusy(true);
    await fetch(`/api/reminders/${encodeURIComponent(reminderId)}/dismiss`, { method: 'POST' });
    setBusy(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" onClick={dismiss} disabled={busy} className="text-xs">
      Dismiss
    </Button>
  );
}
```

- [x] **Step 3: Verify + commit**

Run: `npm --workspace @sales_assistant/web run dev` (API on :3000, logged in per Task 3 steps) → http://localhost:4000 shows KPIs, recent leads, pending reminders; clicking **Dismiss** drops the reminder from the panel.
Run: `npm --workspace @sales_assistant/web run lint && npm --workspace @sales_assistant/web run build` — expected clean.
Then:

```bash
git add sales_assistant/apps/web/app/page.tsx sales_assistant/apps/web/src/components/reminder-actions.tsx
git commit -m "feat(web): dashboard page with KPIs, recent leads, reminder actions"
```

---

### Task 6: Leads pages

**Files:**
- Create: `apps/web/app/leads/page.tsx`, `apps/web/app/leads/leads-table.tsx`, `apps/web/app/leads/[id]/page.tsx`, `apps/web/src/components/lead-actions.tsx`

**Interfaces:**
- Consumes: `listLeads`, `getLead`, `transitionLeadStatus`, `assignLead`, `scoreLead` (via proxy `/api/...` in client components); `LEAD_TRANSITIONS`, `LEAD_BADGES`, `Modal`, `Badge`, `Table`, `Button`.
- Produces: `LeadsTable` (client: status filter, offset pagination, row actions assign/transition/score, then `router.refresh()`); `LeadActions` (client, shared by table + detail: transition select, assign select, score button).

- [x] **Step 1: Write `app/leads/page.tsx`** (server — initial data):

```tsx
import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { LeadsTable } from './leads-table';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function LeadsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const [leads, agents] = await Promise.all([
    apiRequest('/leads', { token, query: { limit: PAGE_SIZE } }),
    apiRequest('/agents', { token, query: { limit: 100 } }),
  ]);
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Leads</h1>
      <LeadsTable initial={leads.json} agents={agents.json?.data ?? []} />
    </div>
  );
}
```

- [x] **Step 2: Write `app/leads/leads-table.tsx`** (client):

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { Button } from '@/src/components/button';
import { LEAD_BADGES } from '@/src/lib/status-maps';
import type { Agent, Lead, LeadStatus, Paginated } from '@sales_assistant/api-client';
import { LeadActions } from '@/src/components/lead-actions';

const PAGE_SIZE = 20;
const STATUSES = ['new', 'assigned', 'contacted', 'qualified', 'converted', 'lost'] as const;

export function LeadsTable({ initial, agents }: { initial: Paginated<Lead>; agents: Agent[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<LeadStatus | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextStatus: LeadStatus | undefined, nextOffset: number) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
    if (nextStatus) params.set('status', nextStatus);
    const res = await fetch(`/api/leads?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) {
      setError(json?.error?.message ?? 'Failed to load leads');
      return;
    }
    setStatus(nextStatus);
    setOffset(nextOffset);
    setData(json);
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" onClick={() => load(undefined, 0)} className={!status ? 'bg-neutral-900 text-white' : ''}>
          All
        </Button>
        {STATUSES.map((s) => (
          <Button key={s} variant="ghost" onClick={() => load(s, 0)} className={status === s ? 'bg-neutral-900 text-white' : ''}>
            {s}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Table
        headers={['Phone', 'Name', 'Status', 'Score', 'Agent', 'Actions']}
        rows={(data?.data ?? []).map((lead) => [
          <Link key={lead.id} href={`/leads/${lead.id}`} className="hover:underline">
            {lead.phone}
          </Link>,
          lead.name ?? '—',
          <Badge key={lead.id} className={LEAD_BADGES[lead.status]}>
            {lead.status}
          </Badge>,
          String(lead.score),
          lead.agent?.name ?? '—',
          <LeadActions key={lead.id} lead={lead} agents={agents} refresh={router.refresh} />,
        ])}
      />
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Page {currentPage} of {totalPages} · {data?.total ?? 0} leads{loading ? ' (loading…)' : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" disabled={offset === 0 || loading} onClick={() => load(status, Math.max(0, offset - PAGE_SIZE))}>
            ← Prev
          </Button>
          <Button variant="ghost" disabled={offset + PAGE_SIZE >= (data?.total ?? 0) || loading} onClick={() => load(status, offset + PAGE_SIZE)}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [x] **Step 3: Write `src/components/lead-actions.tsx`** (client):

```tsx
'use client';

import { useState } from 'react';
import { Modal } from '@/src/components/modal';
import { Button } from '@/src/components/button';
import { LEAD_TRANSITIONS } from '@/src/lib/status-maps';
import type { Agent, Lead } from '@sales_assistant/api-client';

export function LeadActions({
  lead,
  agents,
  refresh,
}: {
  lead: Lead;
  agents: Agent[];
  refresh: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [agentId, setAgentId] = useState(lead.agentId ?? '');
  const [error, setError] = useState('');

  async function run(method: string, path: string, body?: unknown) {
    setError('');
    const res = await fetch(path, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Action failed');
      return false;
    }
    refresh();
    return true;
  }

  async function assign() {
    const ok = await run('POST', `/api/leads/${encodeURIComponent(lead.id)}/assign`, { agentId: agentId || undefined });
    if (ok) setAssignOpen(false);
  }

  async function score() {
    await run('POST', `/api/leads/${encodeURIComponent(lead.id)}/score`);
  }

  const targets = LEAD_TRANSITIONS[lead.status];
  const assignable = lead.status === 'new' || lead.status === 'assigned';

  return (
    <div className="flex items-center gap-2">
      {assignable && (
        <Button variant="ghost" className="text-xs" onClick={() => setAssignOpen(true)}>
          Assign
        </Button>
      )}
      {targets.length > 0 && (
        <select
          defaultValue=""
          className="rounded border border-neutral-300 px-2 py-1 text-xs"
          onChange={(e) => {
            if (e.target.value) run('PATCH', `/api/leads/${encodeURIComponent(lead.id)}`, { status: e.target.value });
          }}
        >
          <option value="" disabled>
            Move to…
          </option>
          {targets.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      )}
      <Button variant="ghost" className="text-xs" onClick={score}>
        Score
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Modal open={assignOpen} title="Assign lead" onClose={() => setAssignOpen(false)}>
        <div className="space-y-4">
          <select
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          >
            <option value="">Auto (least loaded)</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.status})
              </option>
            ))}
          </select>
          <Button onClick={assign}>Assign</Button>
        </div>
      </Modal>
    </div>
  );
}
```

- [x] **Step 4: Write `app/leads/[id]/page.tsx`** (server):

```tsx
import { redirect, notFound } from 'next/navigation';
import { apiRequest, type Lead } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { LEAD_BADGES } from '@/src/lib/status-maps';
import { LeadActions } from '@/src/components/lead-actions';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const [leadResult, agentsResult] = await Promise.all([
    apiRequest(`/leads/${encodeURIComponent(id)}`, { token }),
    apiRequest('/agents', { token, query: { limit: 100 } }),
  ]);
  if (leadResult.status === 404) notFound();
  const lead = leadResult.json?.data as Lead;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">{lead.name ?? lead.phone}</h1>
      <Card>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-neutral-500">Phone</dt>
            <dd className="font-medium">{lead.phone}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Status</dt>
            <dd>
              <Badge className={LEAD_BADGES[lead.status]}>{lead.status}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-neutral-500">Score</dt>
            <dd className="font-medium">{lead.score} / 100</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Agent</dt>
            <dd className="font-medium">{lead.agent?.name ?? 'Unassigned'}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Created</dt>
            <dd className="font-medium">{new Date(lead.createdAt).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Last contacted</dt>
            <dd className="font-medium">{lead.lastContactedAt ? new Date(lead.lastContactedAt).toLocaleString() : '—'}</dd>
          </div>
          {lead.scoreReason && (
            <div className="col-span-2">
              <dt className="text-neutral-500">Score reason</dt>
              <dd className="mt-1 rounded bg-neutral-50 p-2 text-neutral-700">{lead.scoreReason}</dd>
            </div>
          )}
        </dl>
      </Card>
      <Card title="Actions">
        <LeadActions lead={lead} agents={agentsResult.json?.data ?? []} refresh={() => undefined} />
        <p className="mt-2 text-xs text-neutral-400">Refresh the page to see changes.</p>
      </Card>
    </div>
  );
}
```

- [x] **Step 5: Verify + commit** — manual: `/leads` filters/paginates; `Assign` modal → auto or agent; `Move to…` transitions per `LEAD_TRANSITIONS` (invalid → API 409 shows message); `Score` updates the score cell; `/leads/:id` renders detail. Lint + build clean. Then:

```bash
git add sales_assistant/apps/web/app/leads sales_assistant/apps/web/src/components/lead-actions.tsx
git commit -m "feat(web): leads list, filters, actions, detail page"
```

---

### Task 7: Agents, Reminders, Deals pages

**Files:**
- Create: `apps/web/app/agents/page.tsx`, `apps/web/src/components/agent-actions.tsx`, `apps/web/app/reminders/page.tsx`, `apps/web/src/components/reminder-actions.tsx` (extend: add `GenerateRemindersButton`), `apps/web/app/deals/page.tsx`, `apps/web/src/components/deal-actions.tsx`

**Interfaces:**
- Consumes: `listAgents`, `setAgentAvailability`, `listReminders`, `generateReminders`, `dismissReminder`, `listDeals`, `transitionDeal` via `/api/...` proxy; HTTP 403 passthrough (UI hides admin-only buttons for non-admins).
- Produces: `AvailabilityToggle` (client), `GenerateRemindersButton` (client, shown only when `role === 'ADMIN'`), `DealTransitionButtons` (client).
- Extends `reminder-actions.tsx` with the generate button (adds the second export to that file).

- [ ] **Step 1: Write `app/agents/page.tsx`** (server):

```tsx
import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { AGENT_BADGES } from '@/src/lib/status-maps';
import { AvailabilityToggle } from '@/src/components/agent-actions';

export const dynamic = 'force-dynamic';

export default async function AgentsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const result = await apiRequest('/agents', { token, query: { limit: 100 } });
  const agents = (result.json?.data ?? []) as { id: string; name: string; status: 'idle' | 'busy'; createdAt: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Agents</h1>
      <Card>
        <Table
          headers={['Name', 'Status', 'Created', 'Availability']}
          rows={agents.map((agent) => [
            agent.name,
            <Badge key={agent.id} className={AGENT_BADGES[agent.status]}>
              {agent.status}
            </Badge>,
            new Date(agent.createdAt).toLocaleDateString(),
            <AvailabilityToggle key={agent.id} agentId={agent.id} status={agent.status} />,
          ])}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/agent-actions.tsx`** (client):

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AvailabilityToggle({ agentId, status }: { agentId: string; status: 'idle' | 'busy' }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await fetch(`/api/agents/${encodeURIComponent(agentId)}/availability`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ available: status !== 'idle' }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="rounded border border-neutral-300 px-2 py-1 text-xs font-medium hover:bg-neutral-50 disabled:opacity-50"
    >
      {status === 'idle' ? 'Mark busy' : 'Mark available'}
    </button>
  );
}
```

- [ ] **Step 3: Write `app/reminders/page.tsx`** (server):

```tsx
import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { REMINDER_BADGES } from '@/src/lib/status-maps';
import { DismissReminderButton, GenerateRemindersButton } from '@/src/components/reminder-actions';

export const dynamic = 'force-dynamic';

export default async function RemindersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const result = await apiRequest('/reminders', { token, query: { limit: 100 } });
  const reminders = (result.json?.data ?? []) as {
    id: string;
    message: string;
    dueAt: string;
    status: 'pending' | 'sent' | 'dismissed';
    lead: { phone: string; name: string | null };
  }[];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Reminders</h1>
        {session.role === 'ADMIN' && <GenerateRemindersButton />}
      </div>
      <Card>
        <Table
          headers={['Lead', 'Message', 'Due', 'Status', '']}
          rows={reminders.map((reminder) => [
            reminder.lead.name ?? reminder.lead.phone,
            reminder.message,
            new Date(reminder.dueAt).toLocaleString(),
            <Badge key={reminder.id} className={REMINDER_BADGES[reminder.status]}>
              {reminder.status}
            </Badge>,
            reminder.status === 'pending' ? <DismissReminderButton key={reminder.id} reminderId={reminder.id} /> : null,
          ])}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Extend `src/components/reminder-actions.tsx`** — append (file already has `DismissReminderButton`; keep it untouched):

```tsx
export function GenerateRemindersButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function generate() {
    setBusy(true);
    setMessage('');
    const res = await fetch('/api/reminders/generate', { method: 'POST' });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMessage(json?.error?.message ?? 'Generation failed');
      return;
    }
    setMessage(`Job queued (${json?.data?.jobId ?? 'unknown'})`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="primary" onClick={generate} disabled={busy}>
        {busy ? 'Queuing…' : 'Generate reminders'}
      </Button>
      {message && <span className="text-xs text-neutral-500">{message}</span>}
    </div>
  );
}
```

(The `Button` and `useState` imports are already present in that file.)

- [ ] **Step 5: Write `app/deals/page.tsx`** (server):

```tsx
import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { DEAL_BADGES } from '@/src/lib/status-maps';
import { DealTransitionButtons } from '@/src/components/deal-actions';

export const dynamic = 'force-dynamic';

export default async function DealsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const result = await apiRequest('/deals', { token, query: { limit: 100 } });
  const deals = (result.json?.data ?? []) as { id: string; amount: number; stage: 'proposed' | 'won' | 'lost'; createdAt: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Deals</h1>
      <Card>
        <Table
          headers={['Amount', 'Stage', 'Created', 'Actions']}
          rows={deals.map((deal) => [
            new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(deal.amount),
            <Badge key={deal.id} className={DEAL_BADGES[deal.stage]}>
              {deal.stage}
            </Badge>,
            new Date(deal.createdAt).toLocaleDateString(),
            <DealTransitionButtons key={deal.id} dealId={deal.id} stage={deal.stage} />,
          ])}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Write `src/components/deal-actions.tsx`** (client):

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';
import { DEAL_TRANSITIONS } from '@/src/lib/status-maps';
import type { DealStage } from '@sales_assistant/api-client';

export function DealTransitionButtons({ dealId, stage }: { dealId: string; stage: DealStage }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const targets = DEAL_TRANSITIONS[stage];

  async function transition(to: DealStage) {
    setError('');
    const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage: to }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Transition failed');
      return;
    }
    router.refresh();
  }

  if (targets.length === 0) return <span className="text-xs text-neutral-400">Terminal</span>;
  return (
    <div className="flex items-center gap-2">
      {targets.map((target) => (
        <Button key={target} variant="ghost" className="text-xs" onClick={() => transition(target)}>
          Mark {target}
        </Button>
      ))}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
```

- [ ] **Step 7: Verify + commit** — manual: agents toggle flips idle↔busy; reminders page lists + dismiss works; admin sees **Generate reminders** (queues job → 202 message logged); deals transition proposed→won/lost. Lint + build clean. Then:

```bash
git add sales_assistant/apps/web/app/agents sales_assistant/apps/web/app/reminders sales_assistant/apps/web/app/deals sales_assistant/apps/web/src/components/agent-actions.tsx sales_assistant/apps/web/src/components/deal-actions.tsx sales_assistant/apps/web/src/components/reminder-actions.tsx
git commit -m "feat(web): agents, reminders, deals pages"
```

---

### Task 8: Users admin page

**Files:**
- Create: `apps/web/app/users/page.tsx`, `apps/web/src/components/create-user-form.tsx`

**Interfaces:**
- Consumes: `listUsers`, `createUser` via proxy; session role gate.
- Produces: `/users` (server, ADMIN-only — non-admin gets 403-equivalent redirect to `/`), users table, `CreateUserForm` (client, posts `/api/users`, then `router.refresh()`).

- [ ] **Step 1: Write `app/users/page.tsx`** (server):

```tsx
import { redirect } from 'next/navigation';
import { apiRequest } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { CreateUserForm } from '@/src/components/create-user-form';

export const dynamic = 'force-dynamic';

const ROLE_BADGES: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-800',
  AGENT: 'bg-blue-100 text-blue-800',
  USER: 'bg-neutral-200 text-neutral-700',
};

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/');
  const token = session.token;
  const result = await apiRequest('/users', { token, query: { limit: 100 } });
  const users = (result.json?.data ?? []) as { id: string; email: string; name: string | null; role: 'ADMIN' | 'AGENT' | 'USER'; createdAt: string }[];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Users</h1>
      <Card title="Create user">
        <CreateUserForm />
      </Card>
      <Card>
        <Table
          headers={['Name', 'Email', 'Role', 'Created']}
          rows={users.map((user) => [
            user.name ?? '—',
            user.email,
            <Badge key={user.id} className={ROLE_BADGES[user.role]}>
              {user.role}
            </Badge>,
            new Date(user.createdAt).toLocaleDateString(),
          ])}
        />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/components/create-user-form.tsx`** (client):

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';
import type { Role } from '@sales_assistant/api-client';

export function CreateUserForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('USER');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || undefined, role }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Create failed');
      return;
    }
    setEmail('');
    setPassword('');
    setName('');
    setRole('USER');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
      <input
        type="email"
        required
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        type="password"
        required
        minLength={8}
        placeholder="Password (8+ chars)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <input
        type="text"
        placeholder="Name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="USER">USER</option>
          <option value="AGENT">AGENT</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <Button disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button>
      </div>
      {error && <p className="text-sm text-red-600 md:col-span-4">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Verify + commit** — manual: sign in as `admin@acme.test` → `/users` visible in nav, create a user (it appears in the table); sign in as `user@acme.test` → `/users` redirects to `/`. Lint + build clean. Then:

```bash
git add sales_assistant/apps/web/app/users sales_assistant/apps/web/src/components/create-user-form.tsx
git commit -m "feat(web): admin users page"
```

---

### Task 9: Root wiring, docs, full verification

**Files:**
- Modify: `sales_assistant/turbo.json` (add `dev` task), `sales_assistant/package.json` (add `dev:web` + `build:web` scripts), `sales_assistant/.env.example` (document `API_URL`), `sales_assistant/README.md` (web section)
- (This plan document is committed separately at planning time — `docs/superpowers/plans/2026-08-19-web-dashboard.md`.)

**Interfaces:** None new — final wiring + verification.

- [ ] **Step 1: Update `turbo.json`** — add the `dev` task:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "lint": {},
    "test": {},
    "dev": {}
  }
}
```

- [ ] **Step 3: Update root `package.json`** — add convenience scripts after `db:seed` (line 21):

```json
    "dev:web": "npm --workspace @sales_assistant/web run dev",
    "build:web": "npm --workspace @sales_assistant/web run build"
```

- [ ] **Step 4: Update `.env.example`** — append:

```
# Web dashboard (apps/web)
API_URL=http://localhost:3000
```

- [ ] **Step 5: Update `README.md`** — add a **Web Dashboard** section after the API section: stack (Next.js App Router + Tailwind v4), run command (`npm run dev:web`, requires API on `:3000`), login with seeded credentials, session cookie `sa_session` (1h, re-login on expiry), proxy note (`/api/*` forwards with the session token; no CORS needed), and available pages (Dashboard, Leads, Lead detail, Agents, Reminders, Deals, Users-admin).

- [ ] **Step 6: Full verification**

Run from `sales_assistant/`:
1. `npm run lint` — all workspaces clean.
2. `npm run build` — turbo builds every workspace (api, api-client, shared, config, db, ui, via, web).
3. `npm test` — repo 26 + api 39 + api-client 3 + via 1 all pass.
4. `npm run test:integration` — 25/25 with clean exit.
5. Full E2E: `docker compose up -d` → `npm --workspace @sales_assistant/api run db:migrate:deploy` → `npm --workspace @sales_assistant/api run db:seed` → `npm --workspace @sales_assistant/api run start` → `npm run dev:web`.
   - Login `admin@acme.test/password123` → dashboard KPIs; create + score + assign + transition a lead; toggle agent availability; generate + dismiss reminders; create user; verify `/users` hidden for `user@acme.test` login; tokens expire → middleware redirects to `/login`.

- [ ] **Step 7: Commit**

```bash
git add sales_assistant/turbo.json sales_assistant/package.json sales_assistant/.env.example sales_assistant/README.md
git commit -m "chore(web): root wiring, docs, verification"
```
