# Design: Activity / Audit Feed

**Date:** 2026-08-20
**Project:** sales_assistant
**Status:** Approved

## Objective

Surface the platform's existing (currently invisible) audit trail in the `apps/web` dashboard. Every significant mutation already writes a `DomainAuditEvent` row (16 event types) and every AI call logs to `AiUsageLog`, but no API endpoint or dashboard page can read them. This spec adds a read path: an ADMIN-only, org-scoped audit feed endpoint plus an `/activity` dashboard page that turns each event into a readable sentence with type filtering and pagination.

## Current State

- `DomainAuditEvent` model exists: `id, organizationId, eventType (String), payload (Json), createdAt(default now())`, indexed on `organizationId`. No schema change needed.
- `writeAuditEvent(context, eventType, payload)` in `packages/api/src/services/audit.service.ts` writes every event; invoked from lead, agent, booking, deal, reminder, user, and AI-scoring services.
- 16 event types: `AGENT_AVAILABILITY_CHANGED`, `AI_USAGE_LOGGED`, `BOOKING_CREATED`, `BOOKING_STATUS_CHANGED`, `BULK_REMINDERS_GENERATED`, `DEAL_CREATED`, `DEAL_STAGE_CHANGED`, `INTEGRATION_TOKEN_DELETED`, `INTEGRATION_TOKEN_STORED`, `LEAD_ASSIGNED`, `LEAD_CREATED`, `LEAD_SCORED`, `LEAD_STATUS_CHANGED`, `LEAD_UPDATED`, `REMINDER_DISMISSED`, `USER_CREATED`, `USER_UPDATED`.
- API routing (`packages/api/src/app.ts`) dispatches on `segments[0]` for leads/agents/bookings/deals/users/reminders; no audit route exists.
- Known payload shapes (values are ids/amounts, not names): e.g. `LEAD_ASSIGNED {leadId, agentId}`, `DEAL_STAGE_CHANGED {dealId, from, to}`, `LEAD_SCORED {leadId, score, reason, source}`, `AI_USAGE_LOGGED {organizationId, model, tokensIn, tokensOut, cost}`, `USER_CREATED {userId, email, role}`, `BOOKING_CREATED {bookingId, leadId, at}`, `REMINDER_DISMISSED {reminderId, leadId}`.
- Web dashboard has pages for every domain and an ADMIN-only `/users` page; nav supports an ADMIN-only section.

## Scope

**In scope:**
- `GET /audit-events` — bearer auth, ADMIN-only, org-scoped, newest-first, `?type=` + `?limit=`/`?offset=` filter + pagination.
- `AuditService.list()` reading `DomainAuditEvent` (findMany + count).
- OpenAPI `/audit-events` entry + `AuditEvent` schema + `AuditEventType` enum; repo contract test updated to assert the path.
- api-client: `AuditEventType`, `AuditEvent`, `listAuditEvents(...)`.
- `/activity` dashboard page (server, ADMIN-only) + colocated `ActivityList` client component (type filter chips + pagination) + per-type sentence formatter (`src/lib/audit-formatters.ts`) + ADMIN-gated nav link.

**Non-goals:**
- No schema/migration changes.
- No actor tracking: events do not record the acting user — the feed shows what changed and when, not who did it. Deferred (schema change across all `writeAuditEvent` calls).
- No entity name enrichment: sentences reference short entity ids and link to entity pages where a route exists (leads, deals, bookings). No N+1 lookups.
- No AI usage summary cards (AiUsageLog remains unread for now; separate future feature).
- No web frontend test framework; verification is lint + build + manual smoke (established pattern).

## Design

### API

`GET /audit-events` (authenticated, `requireRole(context, ['ADMIN'])`; org-scoped):

- Query schema `listAuditEventsQuerySchema = { ...pagination, type: z.enum(AUDIT_EVENT_TYPES).optional() }` where `AUDIT_EVENT_TYPES` is the shared const of the 16 event types.
- Handler `routeAuditEvents` (mirrors `routeReminders`): `sendJson(res, 200, paginated(await service.list(context, options), options.limit, options.offset))`.
- `AuditService.list(context, { limit, offset, type? })`:
  - `prisma.domainAuditEvent.findMany({ where: { organizationId, ...(type ? { eventType: type } : {}) }, orderBy: { createdAt: 'desc' }, skip, take, select: { id, eventType, payload, createdAt } })` + `prisma.domainAuditEvent.count({ where })`.
  - Returns raw rows; `plain()` serialization converts `Json`/`Date`/`Decimal` to plain JSON.
- Response event shape: `{ id, eventType, payload, createdAt }` — payload is parsed JSON (the persisted `payload` column).

### OpenAPI + contract test

- `openapi.yaml`: add an `Audit` tag, `AuditEventType` enum (16 values), `AuditEvent` schema (`id`, `eventType`, `payload` (object), `createdAt`), and the `/audit-events` GET operation with `LimitParam`/`OffsetParam` + `type` param (enum) and `Paginated`-style response (same pattern as `/bookings`).
- Repo contract test (`tests/*.test.mjs`): extend the existing openapi surface assertions to require the `/audit-events` path and its GET method.

### packages/api-client

- `types.ts`: `export type AuditEventType = '…' | …` (all 16) and `interface AuditEvent { id: string; eventType: AuditEventType; payload: Record<string, unknown>; createdAt: string; }`.
- `index.ts`: export both; `export const listAuditEvents = (token, query: { limit?; offset?; type?: AuditEventType } = {}) => apiRequest('/audit-events', { token, query })`.

### Web — `/activity` page

- `app/activity/page.tsx` (server, `force-dynamic`): session guard (`redirect('/login')`), ADMIN gate (`redirect('/')` if `session.role !== 'ADMIN'`, same as `/users`), initial fetch `listAuditEvents(token, { limit: 20 })`, renders `<h1>Activity</h1>` + `Card` wrapping `<ActivityList initial=… />`.
- `app/activity/activity-list.tsx` (client, colocated, cloned from the bookings-table pattern): type filter chips (`All` + 16 types from a static const) + pagination via `fetch('/api/audit-events?...', { cache: 'no-store' })`; rows: event-type `Badge` (colored by group from `AUDIT_TYPE_GROUPS`), formatted sentence, local timestamp; error line on fetch failure.
- `src/lib/audit-formatters.ts`: `describeAuditEvent(type, payload): string` — switch over the 16 types reading known keys and formatting as a sentence; entity ids truncated (first 8 chars) and wrapped in a `<Link>` to the entity page where a route exists (`/leads/:id`, `/deals/:id`, `/bookings/:id`); fallback: JSON.stringify(payload); plus `AUDIT_TYPE_GROUPS: Record<AuditEventType, string>` badge-color map grouped by domain (lead/agent/deal/booking/reminder/user/system).
- `src/components/nav.tsx`: add `Activity` link in the ADMIN-only section (above Users).

### Error handling

- Non-admin API call → `403 FORBIDDEN` (requireRole); page-level redirect for non-admin (defense in depth, matches `/users`).
- Invalid `type` query → `VALIDATION` 400 from enum validation (same as other list endpoints).
- `describeAuditEvent` never throws: default branch returns JSON; payload missing keys render as `—`.

### Verification

1. New API unit test (`packages/api/tests/`): `AuditService.list` scopes to org (events from another org not returned), orders newest-first, filters by type.
2. Repo contract test asserts `/audit-events` exists in OpenAPI.
3. `npm run lint` — 0 errors; `npm run build` (turbo) — all workspaces compile, `/activity` route present.
4. `npm test` + `npm run test:integration` — existing suites stay green.
5. Live smoke: admin signs in → create a lead, assign, score, transition deal, create booking, dismiss reminder → each appears in `/activity` with a readable sentence; type filter isolates events; pagination paging works; non-admin (`user@acme.test`) gets 403 at the API and is redirect-gated at the page; admin-only nav shows Activity for admin and hides it for others.

## Files

- Add: `packages/api/src/services/audit.service.ts` (extend with `AuditService` / `list`)
- Add: `packages/api/src/validation/schemas.ts` (`AUDIT_EVENT_TYPES`, `listAuditEventsQuerySchema`)
- Add: `packages/api/src/app.ts` (import + `routeAuditEvents` + dispatch)
- Modify: `packages/openapi/openapi.yaml` (Audit tag, schemas, `/audit-events` operation)
- Modify: `tests/*.test.mjs` (contract assertion for `/audit-events`)
- Add: `packages/api/tests/audit-events.test.ts` (unit test)
- Modify: `packages/api-client/src/types.ts`, `packages/api-client/src/index.ts` (type + helper)
- Add: `apps/web/src/lib/audit-formatters.ts`
- Add: `apps/web/app/activity/page.tsx`, `apps/web/app/activity/activity-list.tsx`
- Modify: `apps/web/src/components/nav.tsx`