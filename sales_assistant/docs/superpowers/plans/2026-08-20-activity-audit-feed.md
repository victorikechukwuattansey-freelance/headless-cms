# Activity / Audit Feed - Implementation Plan

- **Date:** 2026-08-20
- **Project:** SaaS Boilerplate (`sales_assistant/`)
- **Source of truth:** `docs/superpowers/specs/2026-08-20-activity-audit-feed-design.md` (committed `224aa48`, approved)
- **Status:** unchecked - begin by ticking boxes as tasks complete

## Objective

Make the recorded-but-unreadable audit trail visible to admins: a new `GET /audit-events` endpoint (ADMIN-only, org-scoped, newest-first, `type`/`limit`/`offset` filters) and an **/activity** dashboard page that renders each event as a human-readable sentence with entity links.

**Gap being closed:** `DomainAuditEvent` (17 event types) is written by every domain action (`writeAuditEvent`) but there is no read path - no endpoint, no route, no UI.

## Scope

### In scope
- `AUDIT_EVENT_TYPES` + `listAuditEventsQuerySchema` in `packages/api/src/validation/schemas.ts` (`...pagination` spread + optional `type` enum).
- `AuditService.list()` in `packages/api/src/services/audit.service.ts` (org-scoped, `createdAt desc`, skip/take, `select` id/eventType/payload/createdAt).
- `routeAuditEvents` in `packages/api/src/app.ts` (bearer + `requireRole(['ADMIN'])`, GET only, `paginated(...)` envelope identical to `/bookings`).
- OpenAPI: `Audit` tag, `AuditEventType` enum, `AuditEvent` schema, `/audit-events` GET (type filter param mirrors `/bookings`).
- Repo contract test: add `/audit-events` to the route-coverage list + app-wiring needle.
- `packages/api-client`: `AuditEventType` union type, `AuditEvent` interface, `AUDIT_EVENT_TYPES` const, `listAuditEvents` helper.
- `apps/web/src/lib/audit-formatters.ts` (new): `describeAuditEvent(type, payload)` per-type sentence - links to `/leads/:id` (leads only; deals/bookings/agents have no detail routes), plain `shortId(...)` otherwise, JSON `<code>` fallback, never throws. Plus `AUDIT_TYPE_GROUPS` badge class map.
- `apps/web/app/activity/` (new): server `page.tsx` (session + ADMIN gate, redirect to `/` for non-admins) + client `activity-list.tsx` (type chips + pagination, cloned from `bookings-table.tsx`).
- `apps/web/src/components/nav.tsx`: **Activity** link in the ADMIN-only section (above Users).

### Non-goals (explicit, per approved spec)
- **No schema/migration changes** - `DomainAuditEvent` already has `organizationId`, `eventType`, `payload`, `createdAt`, `@@index([organizationId])`.
- **No actor tracking** - events do not record *who* performed the action; deferred.
- **No entity-name enrichment** - sentences use short ids, not lead names.
- **No AI-usage summary cards** - AI usage appears only as `AI_USAGE_LOGGED` rows.
- **No frontend test framework** - acceptance for web = lint (0 errors) + production build + live smoke.

## 17 Event Types (authoritative list - see `packages/api/src/services/*.service.ts` call sites of `writeAuditEvent`)

`AGENT_AVAILABILITY_CHANGED, AI_USAGE_LOGGED, BOOKING_CREATED, BOOKING_STATUS_CHANGED, BULK_REMINDERS_GENERATED, DEAL_CREATED, DEAL_STAGE_CHANGED, INTEGRATION_TOKEN_DELETED, INTEGRATION_TOKEN_STORED, LEAD_ASSIGNED, LEAD_CREATED, LEAD_SCORED, LEAD_STATUS_CHANGED, LEAD_UPDATED, REMINDER_DISMISSED, USER_CREATED, USER_UPDATED`

> Note: the spec says "16 event types" - that count was a miscount; the list itself enumerates **17**. Use 17 everywhere.

Known payload shapes (from call sites):
- `LEAD_SCORED` -> `{ leadId, score, reason, source: 'ai' | 'fallback' }`
- `LEAD_STATUS_CHANGED` -> `{ leadId, from, to }`
- `LEAD_ASSIGNED` -> `{ leadId, agentId }`
- `DEAL_STAGE_CHANGED` -> `{ dealId, from, to }`
- `BOOKING_CREATED` -> `{ bookingId, leadId, at }`
- `BOOKING_STATUS_CHANGED` -> `{ bookingId, from, to }`
- `AI_USAGE_LOGGED` -> `{ organizationId, model, tokensIn, tokensOut, cost }`
- `BULK_REMINDERS_GENERATED` -> `{ generated, total }`
- `USER_CREATED` / `USER_UPDATED` -> `{ email, role }`
- The rest carry entity ids only. Every sentence must tolerate missing/mistyped fields (never throw).

## Approach

Single-pass vertical slice per layer, one commit per task, same flow that shipped the Bookings pipeline (checklist ticking + per-task verification + commit; final full-verification + live smoke + close-out). Executed either subagent-driven (per task, with the orchestrator reviewing diffs + committing + smoking) or inline - owner picks at kickoff.

## Task Checklist

- [ ] T1 - AuditService + event-types schema + schema unit test - commit
- [ ] T2 - `routeAuditEvents` wired into `app.ts` - commit
- [ ] T3 - OpenAPI spec + repo contract-test update - commit
- [ ] T4 - api-client types/const/helper - commit
- [ ] T5 - `audit-formatters.ts` - commit
- [ ] T6 - `/activity` page + `activity-list` + nav link - commit
- [ ] T7 - integration tests + full verification + live smoke + plan close-out - commit
---

## T1 - AuditService + schema + unit test

### Files
- `packages/api/src/validation/schemas.ts` - add const + query schema
- `packages/api/src/services/audit.service.ts` - add `AuditService` class (keep `writeAuditEvent` as-is)
- `packages/api/tests/audit-events.test.ts` - new unit test (pure; no DB)

### 1. `schemas.ts` - append near the other list schemas

```ts
export const AUDIT_EVENT_TYPES = [
  'AGENT_AVAILABILITY_CHANGED',
  'AI_USAGE_LOGGED',
  'BOOKING_CREATED',
  'BOOKING_STATUS_CHANGED',
  'BULK_REMINDERS_GENERATED',
  'DEAL_CREATED',
  'DEAL_STAGE_CHANGED',
  'INTEGRATION_TOKEN_DELETED',
  'INTEGRATION_TOKEN_STORED',
  'LEAD_ASSIGNED',
  'LEAD_CREATED',
  'LEAD_SCORED',
  'LEAD_STATUS_CHANGED',
  'LEAD_UPDATED',
  'REMINDER_DISMISSED',
  'USER_CREATED',
  'USER_UPDATED',
] as const;
export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const listAuditEventsQuerySchema = z.object({
  ...pagination,
  type: z.enum(AUDIT_EVENT_TYPES).optional(),
});
```

### 2. `services/audit.service.ts` - append (the current file is 17 lines; keep `writeAuditEvent` unchanged)

```ts
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { DomainContext } from '../domain/domain-context.js';
import type { AuditEventType } from '../validation/schemas.js';

// ... existing writeAuditEvent unchanged ...

export class AuditService {
  async list(
    context: DomainContext,
    options: { limit: number; offset: number; type?: AuditEventType },
  ) {
    const where: Prisma.DomainAuditEventWhereInput = {
      organizationId: context.organizationId,
      ...(options.type ? { eventType: options.type } : {}),
    };
    const [data, total] = await Promise.all([
      prisma.domainAuditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: options.offset,
        take: options.limit,
        select: { id: true, eventType: true, payload: true, createdAt: true },
      }),
      prisma.domainAuditEvent.count({ where }),
    ]);
    return { data, total };
  }
}
```

### 3. New unit test `packages/api/tests/audit-events.test.ts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIT_EVENT_TYPES,
  listAuditEventsQuerySchema,
  parseQuery,
} from '../src/validation/schemas.js';

test('audit event type list covers every writeAuditEvent caller', () => {
  const expected = [
    'AGENT_AVAILABILITY_CHANGED', 'AI_USAGE_LOGGED', 'BOOKING_CREATED', 'BOOKING_STATUS_CHANGED',
    'BULK_REMINDERS_GENERATED', 'DEAL_CREATED', 'DEAL_STAGE_CHANGED', 'INTEGRATION_TOKEN_DELETED',
    'INTEGRATION_TOKEN_STORED', 'LEAD_ASSIGNED', 'LEAD_CREATED', 'LEAD_SCORED', 'LEAD_STATUS_CHANGED',
    'LEAD_UPDATED', 'REMINDER_DISMISSED', 'USER_CREATED', 'USER_UPDATED',
  ];
  assert.deepEqual([...AUDIT_EVENT_TYPES].sort(), expected.sort());
});

test('audit list query applies defaults and validates the type filter', () => {
  assert.deepEqual(parseQuery(listAuditEventsQuerySchema, new URLSearchParams('')), {
    limit: 20,
    offset: 0,
  });
  assert.deepEqual(
    parseQuery(listAuditEventsQuerySchema, new URLSearchParams('type=LEAD_CREATED&limit=5')),
    { limit: 5, offset: 0, type: 'LEAD_CREATED' },
  );
  assert.throws(
    () => parseQuery(listAuditEventsQuerySchema, new URLSearchParams('type=NOPE')),
    /VALIDATION/,
  );
  assert.throws(
    () => parseQuery(listAuditEventsQuerySchema, new URLSearchParams('limit=999')),
    /VALIDATION/,
  );
});
```

### Verify (API dir)
```powershell
npm test
```
All unit tests pass (existing 69 + 2 new). No DB or server needed.

### Commit
`git add sales_assistant/packages/api/src/validation/schemas.ts sales_assistant/packages/api/src/services/audit.service.ts sales_assistant/packages/api/tests/audit-events.test.ts` then
`git commit -m "feat(api): audit event types schema and AuditService.list"`

---

## T2 - wire `routeAuditEvents` into `app.ts`

### Files
- `packages/api/src/app.ts`

### Diffs

1. **Import:** add `listAuditEventsQuerySchema,` to the existing schemas import block (after `listAgentsQuerySchema`). Add `import { AuditService } from './services/audit.service.js';` with the service imports.

2. **RouteHandlers interface + factory** (around lines 151/160):
```ts
interface RouteHandlers {
  // ...
  agents: AgentService;
  bookings: BookingService;
  deals: DealService;
  leads: LeadProfileService;
  reminders: FollowUpReminderService;
  audit: AuditService;   // add
  users: UserService;
}
function createRouteHandlers(): RouteHandlers {
  // ...existing...
  agents: new AgentService(),
  bookings: new BookingService(),
  deals: new DealService(),
  leads: new LeadProfileService(),
  reminders: new FollowUpReminderService(),
  audit: new AuditService(),   // add
  users: new UserService(),
}
```

3. **Dispatch branch** (after the `reminders` branch, ~line 238):
```ts
} else if (segments[0] === 'audit-events') {
  await routeAuditEvents(res, services.audit, context, method, segments, body, query);
}
```

4. **Route handler** (place after `routeBookings`; mirror its signature + envelope):
```ts
async function routeAuditEvents(
  res: ServerResponse,
  service: AuditService,
  context: DomainContext,
  method: string,
  segments: string[],
  body: Record<string, unknown>,
  query: URLSearchParams,
): Promise<void> {
  requireRole(context, ['ADMIN']);
  if (segments.length === 1 && method === 'GET') {
    const options = parseQuery(listAuditEventsQuerySchema, query);
    sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset));
  } else {
    sendJson(res, 404, { error: { code: 'NOT_FOUND', message: 'Route not found' } });
  }
}
```

### Verify
- `npm run build` in `packages/api` compiles.
- `npm test` - existing tests still green (no contract change yet).
- Manual: `GET http://localhost:3000/audit-events` with admin token returns `{ data, total, limit, offset }` (empty for a fresh org). With a USER token returns 403. Unauthenticated returns 401.

### Commit
`git add sales_assistant/packages/api/src/app.ts` then
`git commit -m "feat(api): add ADMIN-only GET /audit-events route"`
---

## T3 - OpenAPI + repo contract test

### Files
- `packages/openapi/openapi.yaml`
- `tests/contracts.test.mjs`

### 1. `openapi.yaml`

**Tags** - add `- name: Audit` to the tags list (line ~10 block).

**Schemas** - add (any location inside `schemas:`; alphabetically near `Booking`):
```yaml
    AuditEventType:
      type: string
      enum: [AGENT_AVAILABILITY_CHANGED, AI_USAGE_LOGGED, BOOKING_CREATED, BOOKING_STATUS_CHANGED, BULK_REMINDERS_GENERATED, DEAL_CREATED, DEAL_STAGE_CHANGED, INTEGRATION_TOKEN_DELETED, INTEGRATION_TOKEN_STORED, LEAD_ASSIGNED, LEAD_CREATED, LEAD_SCORED, LEAD_STATUS_CHANGED, LEAD_UPDATED, REMINDER_DISMISSED, USER_CREATED, USER_UPDATED]
    AuditEvent:
      type: object
      required: [id, eventType, payload, createdAt]
      properties:
        id:
          type: string
          description: Event ID.
        eventType:
          $ref: '#/components/schemas/AuditEventType'
        payload:
          type: object
          description: Event-specific data (entity ids, amounts, statuses).
        createdAt:
          type: string
          format: date-time
```

**Path** - add after `/bookings`, mirroring its GET:
```yaml
  /audit-events:
    get:
      tags: [Audit]
      summary: List audit events with pagination and optional type filter
      security:
        - bearerAuth: []
      parameters:
        - $ref: '#/components/parameters/LimitParam'
        - $ref: '#/components/parameters/OffsetParam'
        - name: type
          in: query
          schema:
            $ref: '#/components/schemas/AuditEventType'
      responses:
        '200':
          description: Paginated audit events
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/Paginated'
                  - type: object
                    properties:
                      data:
                        type: array
                        items:
                          $ref: '#/components/schemas/AuditEvent'
        '401':
          $ref: '#/components/responses/Unauthorized'
        '403':
          $ref: '#/components/responses/Forbidden'
        '429':
          $ref: '#/components/responses/RateLimited'
```

> `Forbidden` / `Unauthorized` / `RateLimited` response components already exist (components block at line ~301).

### 2. `tests/contracts.test.mjs`

Extend the first test's route array (line ~20) to include `'/audit-events'`. In the existing app-wiring test that greps `app.ts` for routing needles, add assertions that `app.ts` contains `audit-events` and `routeAuditEvents` (extend that test, do not add a duplicate suite).

### Verify
```powershell
node tests/contracts.test.mjs
```
Green. (Repo root.)

### Commit
`git add sales_assistant/packages/openapi/openapi.yaml sales_assistant/tests/contracts.test.mjs` then
`git commit -m "docs(api): OpenAPI contract for GET /audit-events"`

---

## T4 - api-client types + const + helper

### Files
- `packages/api-client/src/types.ts`
- `packages/api-client/src/index.ts`

### 1. `types.ts` - append

```ts
export type AuditEventType =
  | 'AGENT_AVAILABILITY_CHANGED'
  | 'AI_USAGE_LOGGED'
  | 'BOOKING_CREATED'
  | 'BOOKING_STATUS_CHANGED'
  | 'BULK_REMINDERS_GENERATED'
  | 'DEAL_CREATED'
  | 'DEAL_STAGE_CHANGED'
  | 'INTEGRATION_TOKEN_DELETED'
  | 'INTEGRATION_TOKEN_STORED'
  | 'LEAD_ASSIGNED'
  | 'LEAD_CREATED'
  | 'LEAD_SCORED'
  | 'LEAD_STATUS_CHANGED'
  | 'LEAD_UPDATED'
  | 'REMINDER_DISMISSED'
  | 'USER_CREATED'
  | 'USER_UPDATED';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  payload: Record<string, unknown>;
  createdAt: string;
}
```

### 2. `index.ts` - add exports + helper

```ts
export const AUDIT_EVENT_TYPES = [
  'AGENT_AVAILABILITY_CHANGED', 'AI_USAGE_LOGGED', 'BOOKING_CREATED', 'BOOKING_STATUS_CHANGED',
  'BULK_REMINDERS_GENERATED', 'DEAL_CREATED', 'DEAL_STAGE_CHANGED', 'INTEGRATION_TOKEN_DELETED',
  'INTEGRATION_TOKEN_STORED', 'LEAD_ASSIGNED', 'LEAD_CREATED', 'LEAD_SCORED', 'LEAD_STATUS_CHANGED',
  'LEAD_UPDATED', 'REMINDER_DISMISSED', 'USER_CREATED', 'USER_UPDATED',
] as const;
```

```ts
export const listAuditEvents = (
  token: string,
  query: { limit?: number; offset?: number; type?: AuditEventType } = {},
) => apiRequest('/audit-events', { token, query });
```

Ensure `AuditEvent` and `AuditEventType` are exported from the barrel (match the file's existing type-export style).

### Verify
- `packages/api-client` build + type-check clean.

### Commit
`git add sales_assistant/packages/api-client/src/types.ts sales_assistant/packages/api-client/src/index.ts` then
`git commit -m "feat(api-client): audit event types and listAuditEvents helper"`
---

## T5 - `audit-formatters.ts`

### File
- `apps/web/src/lib/audit-formatters.ts` (new)

```ts
import Link from 'next/link';
import type { AuditEventType } from '@sales_assistant/api-client';

const shortId = (id: unknown) =>
  typeof id === 'string' && id.length > 8 ? `${id.slice(0, 8)}...` : String(id ?? '-');

const leadLink = (id: unknown) => (
  <Link href={`/leads/${encodeURIComponent(String(id))}`} className="font-mono underline hover:opacity-70">
    {shortId(id)}
  </Link>
);

export const AUDIT_TYPE_GROUPS: Record<AuditEventType, string> = {
  AGENT_AVAILABILITY_CHANGED: 'bg-violet-100 text-violet-800',
  AI_USAGE_LOGGED: 'bg-indigo-100 text-indigo-800',
  BOOKING_CREATED: 'bg-sky-100 text-sky-800',
  BOOKING_STATUS_CHANGED: 'bg-sky-100 text-sky-800',
  BULK_REMINDERS_GENERATED: 'bg-amber-100 text-amber-800',
  DEAL_CREATED: 'bg-emerald-100 text-emerald-800',
  DEAL_STAGE_CHANGED: 'bg-emerald-100 text-emerald-800',
  INTEGRATION_TOKEN_DELETED: 'bg-neutral-200 text-neutral-700',
  INTEGRATION_TOKEN_STORED: 'bg-neutral-200 text-neutral-700',
  LEAD_ASSIGNED: 'bg-blue-100 text-blue-800',
  LEAD_CREATED: 'bg-blue-100 text-blue-800',
  LEAD_SCORED: 'bg-blue-100 text-blue-800',
  LEAD_STATUS_CHANGED: 'bg-blue-100 text-blue-800',
  LEAD_UPDATED: 'bg-blue-100 text-blue-800',
  REMINDER_DISMISSED: 'bg-amber-100 text-amber-800',
  USER_CREATED: 'bg-red-100 text-red-800',
  USER_UPDATED: 'bg-red-100 text-red-800',
};

export function describeAuditEvent(
  type: AuditEventType,
  payload: Record<string, unknown>,
): React.ReactNode {
  switch (type) {
    case 'AGENT_AVAILABILITY_CHANGED':
      return `Agent ${shortId(payload.agentId)} is now ${payload.available ? 'available' : 'busy'}`;
    case 'AI_USAGE_LOGGED':
      return `AI call via ${String(payload.model ?? '-')} (${String(payload.tokensIn ?? 0)} in / ${String(payload.tokensOut ?? 0)} out, USD ${String(payload.cost ?? '0')})`;
    case 'BOOKING_CREATED':
      return <>Booking {shortId(payload.bookingId)} booked for {leadLink(payload.leadId)} at {new Date(String(payload.at)).toLocaleString()}</>;
    case 'BOOKING_STATUS_CHANGED':
      return <>Booking {shortId(payload.bookingId)} moved {String(payload.from)} -> {String(payload.to)}</>;
    case 'BULK_REMINDERS_GENERATED':
      return <>Generated {String(payload.generated ?? 0)} reminders from {String(payload.total ?? 0)} qualifying leads</>;
    case 'DEAL_CREATED':
      return <>Deal {shortId(payload.dealId)} created for {leadLink(payload.leadId)} at {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(payload.amount ?? 0))}</>;
    case 'DEAL_STAGE_CHANGED':
      return <>Deal {shortId(payload.dealId)} moved {String(payload.from)} -> {String(payload.to)}</>;
    case 'INTEGRATION_TOKEN_DELETED':
      return <>Integration token removed</>;
    case 'INTEGRATION_TOKEN_STORED':
      return <>Integration token stored</>;
    case 'LEAD_ASSIGNED':
      return <>Lead {leadLink(payload.leadId)} assigned to agent {shortId(payload.agentId)}</>;
    case 'LEAD_CREATED':
      return <>Lead {leadLink(payload.leadId)} created{payload.phone ? <> with phone {String(payload.phone)}</> : null}</>;
    case 'LEAD_SCORED':
      return <>Lead {leadLink(payload.leadId)} scored {String(payload.score ?? 0)}/100 via {String(payload.source ?? 'ai')}{payload.reason ? <> - {String(payload.reason)}</> : null}</>;
    case 'LEAD_STATUS_CHANGED':
      return <>Lead {leadLink(payload.leadId)} status changed {String(payload.from)} -> {String(payload.to)}</>;
    case 'LEAD_UPDATED':
      return <>Lead {leadLink(payload.leadId)} details updated</>;
    case 'REMINDER_DISMISSED':
      return <>Reminder {shortId(payload.reminderId)} dismissed for {leadLink(payload.leadId)}</>;
    case 'USER_CREATED':
      return `User ${String(payload.email ?? '-')} created with role ${String(payload.role ?? 'USER')}`;
    case 'USER_UPDATED':
      return `User ${String(payload.email ?? '-')} profile updated`;
    default:
      return <code className="text-xs break-all">{JSON.stringify(payload)}</code>;
  }
}
```

Notes:
- Only leads have a detail route (`/leads/[id]`); deals/bookings/agents render as plain `shortId(...)`.
- Never throws: every field access is guarded with `?? ...` / `String(...)`.
- `React.ReactNode` return - matches existing component typing in the repo (`table.tsx` / `card.tsx` use the global JSX namespace without importing React).
- Keep every Tailwind class a string literal (they are, in the map) so the class scanner keeps them.

### Verify
- Web type-check clean; production build succeeds.

### Commit
`git add sales_assistant/apps/web/src/lib/audit-formatters.ts` then
`git commit -m "feat(web): audit event sentence formatters"`
---

## T6 - `/activity` page + `activity-list` + nav link

### Files
- `apps/web/app/activity/page.tsx` (new)
- `apps/web/app/activity/activity-list.tsx` (new)
- `apps/web/src/components/nav.tsx` (edit)

### 1. `page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { listAuditEvents } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { ActivityList } from './activity-list';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function ActivityPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.role !== 'ADMIN') redirect('/');
  const audit = await listAuditEvents(session.token, { limit: PAGE_SIZE });
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Activity</h1>
      <Card>
        <ActivityList initial={audit.json} />
      </Card>
    </div>
  );
}
```

> Mirror the exact imports (`getSession`, `Card`) and the `audit.json` shape from the existing `/bookings` page - adjust to that file's proven conventions.

### 2. `activity-list.tsx` (client; clone the structure of `apps/web/app/bookings/bookings-table.tsx`)

```tsx
'use client';

import { useState } from 'react';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { Button } from '@/src/components/button';
import { describeAuditEvent, AUDIT_TYPE_GROUPS } from '@/src/lib/audit-formatters';
import { AUDIT_EVENT_TYPES } from '@sales_assistant/api-client';
import type { AuditEvent, AuditEventType, Paginated } from '@sales_assistant/api-client';

const PAGE_SIZE = 20;

export function ActivityList({ initial }: { initial: Paginated<AuditEvent> }) {
  const [type, setType] = useState<AuditEventType | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load(nextType: AuditEventType | undefined, nextOffset: number) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
    if (nextType) params.set('type', nextType);
    const res = await fetch(`/api/audit-events?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) {
      setError(json?.error?.message ?? 'Failed to load events');
      return;
    }
    setType(nextType);
    setOffset(nextOffset);
    setData(json);
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          onClick={() => load(undefined, 0)}
          className={!type ? 'bg-neutral-900 text-white' : ''}
        >
          All
        </Button>
        {AUDIT_EVENT_TYPES.map((t) => (
          <Button
            key={t}
            variant="ghost"
            onClick={() => load(t, 0)}
            className={type === t ? 'bg-neutral-900 text-white' : ''}
          >
            {t}
          </Button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Table
        headers={['Event', 'Details', 'When']}
        rows={(data?.data ?? []).map((event) => [
          <Badge key={event.id} className={AUDIT_TYPE_GROUPS[event.eventType]}>
            {event.eventType}
          </Badge>,
          describeAuditEvent(event.eventType, event.payload ?? {}),
          new Date(event.createdAt).toLocaleString(),
        ])}
      />
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Page {currentPage} of {totalPages} - {data?.total ?? 0} events{loading ? ' (loading...)' : ''}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={offset === 0 || loading}
            onClick={() => load(type, Math.max(0, offset - PAGE_SIZE))}
          >
            <- Prev
          </Button>
          <Button
            variant="ghost"
            disabled={offset + PAGE_SIZE >= (data?.total ?? 0) || loading}
            onClick={() => load(type, offset + PAGE_SIZE)}
          >
            Next ->
          </Button>
        </div>
      </div>
    </div>
  );
}
```

> The web app proxies `/api/*` to the API (rewrite) - confirm the exact proxy/`NEXT_PUBLIC_API_URL` convention from an existing client list component before finalizing the fetch URL; adjust to match.

### 3. `nav.tsx`

In the ADMIN-only section (where `Users` lives), add the Activity item **above Users**:

```tsx
<Link href="/activity" className="block rounded px-3 py-2 text-sm hover:bg-neutral-800">
  Activity
</Link>
```

(Match the existing nav item styling exactly - e.g. active-state handling - by copying an adjacent item.)

### Verify
- Web lint 0 errors.
- Production build succeeds.
- Manual: `/activity` renders for admin, redirects for non-admin.

### Commit
`git add sales_assistant/apps/web/app/activity sales_assistant/apps/web/src/components/nav.tsx` then
`git commit -m "feat(web): activity audit feed page"`
---

## T7 - integration tests + full verification + live smoke + close-out

### 1. Integration test (`packages/api/tests/runtime/integration.test.ts`)

In the describe block that already exercises `leads`/`bookings`/etc. via the `api()` helper, add a new `it(...)` for audit events. Reuse the fixture tokens: `tokenA` = ADMIN of orgA, `tokenB` = ADMIN of orgB (already seeded at lines 119-125). For the role check, create a USER in orgA directly with prisma + `auth.issueToken` (pattern already used in the file).

```ts
it('audit events are org-scoped, newest-first, type-filterable, and admin-only', async () => {
  const lead = await api('/leads', {
    token: tokenA,
    method: 'POST',
    body: { phone: '+2349000000001' },
  });
  assert.equal(lead.status, 201);

  const events = await api('/audit-events', { token: tokenA });
  assert.equal(events.status, 200);
  assert.ok(events.json.data.length >= 1);
  assert.equal(events.json.data[0].eventType, 'LEAD_CREATED');
  assert.equal(events.json.data[0].payload.leadId, lead.json.data.id);

  const ordered = await api('/audit-events?limit=5', { token: tokenA });
  const stamps = ordered.json.data.map((e: { createdAt: string }) => new Date(e.createdAt).getTime());
  assert.deepEqual(stamps, [...stamps].sort((a, b) => b - a));

  const filtered = await api('/audit-events?type=LEAD_CREATED', { token: tokenA });
  assert.ok(filtered.json.data.length >= 1);
  assert.ok(filtered.json.data.every((e: { eventType: string }) => e.eventType === 'LEAD_CREATED'));

  const otherOrg = await api('/audit-events', { token: tokenB });
  assert.equal(otherOrg.status, 200);
  assert.ok(otherOrg.json.data.length === 0);

  const userA = await prisma.user.create({
    data: { organizationId: orgA, role: 'USER', email: 'audit-user-' + Date.now() + '@acme.test' },
  });
  const userToken = auth.issueToken({ userId: userA.id, organizationId: orgA, role: 'USER' });
  const forbidden = await api('/audit-events', { token: userToken });
  assert.equal(forbidden.status, 403);
});
```

> Adjust names/types to the file's existing conventions (e.g. whether `prisma.user` columns require a password hash - seed a dummy hash if required). Confirm the per-org phone uniqueness rule - do NOT reuse an existing org-A phone.

### 2. Full verification battery

- `npm test` in `packages/api` (unit) - all green.
- `npm run test:integration` in `packages/api` - all green (now >=26 with the audit test).
- `node tests/contracts.test.mjs` at repo root - green.
- Web: lint 0 errors; production build (`build:web`) succeeds.
- Rebuild + restart the dev stack (API :3000, web :4000) per the launcher scripts in `%TEMP%\opencode`.

### 3. Live smoke (production build served by `next start`)

With admin cookie (`admin@acme.test` / `password123`, relogin first - cookie TTL is 1h):
1. Perform real actions: create a lead (`POST /leads`), score it (`POST /leads/:id/score`), assign it, change its status, create a booking + transition to confirmed, create a deal + advance its stage, generate reminders (`/reminders/generate`).
2. Open `/activity` -> each action renders as its sentence with a working `/leads/...` link on lead ids; `AI_USAGE_LOGGED` rows appear; order is newest-first.
3. Type chips: `All` restores the full list; `LEAD_CREATED` filters; pagination moves pages (seed >20 events by repeating actions to verify total math).
4. Non-admin: `user@acme.test` opening `/activity` redirects to `/`; USER-token `GET /api/audit-events` returns 403.
5. Unauthenticated `GET /api/audit-events` returns 401.
6. `?type=NOPE` returns 400 VALIDATION (curl-level check).
7. **Cleanup:** delete the smoke-created org-A rows from the dev DB (as done for the bookings smoke) so the feed isn't polluted.

### 4. Plan close-out

- Tick every box in this plan's checklist.
- Run `git status` -> confirm only intended files changed.
- Update the repo `docs/decisions/` running log with a one-line **Activity audit feed shipped** (#date) entry.

### Commit
`git add sales_assistant/packages/api/tests/runtime/integration.test.ts sales_assistant/docs/decisions` then
`git commit -m "feat(web): activity audit feed - integration tests and close-out"`

---

## Risks / Gotchas

- **Tailwind class scanning:** all chip/badge classes must be full string literals in `AUDIT_TYPE_GROUPS` - do not build class strings dynamically.
- **`next start` serves the built bundle** - every web change needs `build:web` + restart before smoke; API changes need the API restart.
- **UTF-8 writes:** any plan/spec edits via PowerShell must use the no-BOM UTF8 writer (`New-Object System.Text.UTF8Encoding($false)` / `[System.Text.UTF8Encoding]::new($false)`).
- **Payload drift:** if a future event's payload shape changes, sentence rendering is already defensive (`?? fallbacks`), but the OpenAPI `AuditEventType` enum in this file must be kept in sync manually with `schemas.ts` (3 copies: OpenAPI, api-client, web - noted in spec; acceptable, no shared runtime dependency).
- **Per-org phone uniqueness:** integration + live smoke must use phones not already present in org A.

## Rollback

Feature is additive (new endpoint, new page, new files, one nav link). To revert: revert the 7 commits in reverse order; the API/OpenAPI/contract/client/web layers revert independently without schema or migration impact.
