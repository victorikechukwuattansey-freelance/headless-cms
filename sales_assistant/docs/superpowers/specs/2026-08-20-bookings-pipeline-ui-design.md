# Design: Bookings Pipeline UI

**Date:** 2026-08-20
**Project:** sales_assistant
**Status:** Approved

## Objective

Fill the last missing domain page in the `apps/web` dashboard: a **Bookings** page that lists the org's bookings, lets users create a booking, and transition it through the pipeline (`pending → confirmed → completed | cancelled`). This completes dashboard coverage of every domain the API exposes (Leads, Agents, Reminders, Deals, Users, Bookings).

## Current State

- API already ships the full booking domain with **no changes required**:
  - `GET /bookings?status=&limit=&offset=` — paginated, ordered by `at` ascending (status filter optional).
  - `POST /bookings` — body `{ leadId, at }` (ISO datetime with offset), creates a `pending` booking, writes `BOOKING_CREATED` audit event.
  - `POST /bookings/:id/transition` — body `{ status }`, `assertTransition(BOOKING_TRANSITIONS, …)`, writes `BOOKING_STATUS_CHANGED` audit event.
- Booking shape: `id, organizationId, leadId, at (DateTime), status, createdAt`. The list returns `leadId` **without** lead name/phone (no Prisma include).
- Transitions (API, `packages/api/src/domain/transitions.ts`): `pending → confirmed → completed | cancelled`.
- Web dashboard has pages for every domain except Bookings; `src/lib/status-maps.ts` has no booking entries; nav links don't include Bookings.

## Scope

**In scope (UI only, API frozen):**
- `/bookings` server page (session-guarded, all roles may view — the API applies no role gate to bookings).
- Bookings table with status filter chips + pagination, mirroring `app/leads/leads-table.tsx`.
- Create-booking form (lead picker + datetime input).
- Per-row transition buttons for the booking's allowed next states.
- Booking badge colors + transition map added to `src/lib/status-maps.ts`.
- `Bookings` link added to the nav.

**Non-goals:**
- No `/bookings/[id]` detail page.
- No board/kanban or drag-and-drop.
- No API/OpenAPI/contract-test changes (no `?expand=lead`, no lead include on the booking payload).
- No role gating in the UI (the API is the enforcement point).
- No worker/queue changes, no new migrations.

## Approach

**Web-side lead lookup.** The booking payload only carries `leadId`; rather than changing the API shape, the page fetches `/leads?limit=100` once and builds a `leadId → { name, phone }` map used both to render lead info on rows and to populate the create form's lead `<select>`. This keeps the API frozen (the project's source of truth), adds no OpenAPI/contract-test churn, and the leads set is small enough that one capped fetch is trivial. Consistent with the thin-web pattern established in Tasks 6–8.

## Components & Data Flow

### `app/bookings/page.tsx` (server, `force-dynamic`)

- `getSession()` guard — `redirect('/login')` when absent.
- Parallel initial fetch, mirroring `app/leads/page.tsx`:
  - `apiRequest('/bookings', { token, query: { limit: 20 } })`
  - `apiRequest('/leads', { token, query: { limit: 100 } })`
- Renders `<h1>Bookings</h1>`, `<CreateBookingForm leads=… />`, `<BookingsTable initial=… leads=… />`.

### `app/bookings/bookings-table.tsx` (client)

Cloned/adapted from `app/leads/leads-table.tsx`:

- Status filter chips — `All` plus `pending | confirmed | completed | cancelled`; active chip highlighted.
- Offset pagination (page size 20) with Prev/Next and `<Page n of m> · N bookings`.
- Client `fetch('/api/bookings?limit=&offset=&status=')` with `cache: 'no-store'`; non-OK responses render the API error message inline.
- Row columns: **When** (local `toLocaleString`), **Lead** (name + phone from the `leadId → lead` map; fallback to truncated `leadId` if the lead is missing), **Status** (`Badge` with `BOOKING_BADGES`), **Actions** (`<BookingActions>`).

### `src/components/create-booking-form.tsx` (client)

- `<select>` populated from the `leads` prop (option label: `name — phone`, value: lead id), plus `<input type="datetime-local">` (required).
- `POST /api/bookings` with `{ leadId, at }` (`at` serialized from the local `datetime-local` value as ISO with offset).
- On success: clear the form and `router.refresh()` (re-runs the server page, refreshing the table).
- On failure: render `json.error.message` inline (e.g. `NOT_FOUND` for a bad lead, `VALIDATION` for a malformed datetime).

### `src/components/booking-actions.tsx` (client)

- Given a booking, render one button per allowed next state from `BOOKING_TRANSITIONS` (imported from `status-maps`).
- `POST /api/bookings/:id/transition` with `{ status }`, then `router.refresh()`.
- No buttons at terminal stages (`completed`, `cancelled`).

### `src/lib/status-maps.ts`

- Add `BOOKING_BADGES`: `pending` amber, `confirmed` blue, `completed` green, `cancelled` neutral (matches the tone of `LEAD_BADGES`/`DEAL_BADGES`).
- Add `BOOKING_TRANSITIONS: Record<'pending'|'confirmed'|'completed'|'cancelled', readonly ('pending'|'confirmed'|'completed'|'cancelled')[]>` mirroring the API's transition table.

### `src/components/nav.tsx`

- Add `{ href: '/bookings', label: 'Bookings' }` to the nav link list (between Agents and Reminders).

## Error Handling

- Create/transition: API `{ error: { code, message } }` rendered inline under the form / row-actions.
- Filter/pagination: fetch failure shows a top error line and keeps the last good data (same as `leads-table`).
- Transition buttons only render for permitted next states, so `INVALID_TRANSITION` (409) is effectively unreachable via the UI; the error path still displays if hit.

## Testing & Verification

1. `npm run lint` — 0 errors.
2. `npm run build` (turbo, all workspaces) — clean.
3. Restart the web server (`next start` on :4000) after the rebuild.
4. Manual smoke against the dev stack (API :3000, host PostgreSQL seeded org):
   - Sign in as `admin@acme.test` → `/bookings` renders with the `Bookings` nav link.
   - Create a booking (pick a lead + time) → appears as `pending`.
   - Transition `pending → confirmed → completed`; separately create one and go `pending → cancelled`.
   - Confirm the action button set is correct at each stage (no buttons at terminal states).
   - Filter chips and pagination work; lead name/phone render on rows.
   - Sign in as `user@acme.test` → `/bookings` viewable (no admin gate).
5. Commit the page + components + status-maps + nav changes in one commit; mark boxes checked in the implementation plan (plan authored next).

## Files

- Add: `apps/web/app/bookings/page.tsx`
- Add: `apps/web/app/bookings/bookings-table.tsx`
- Add: `apps/web/src/components/create-booking-form.tsx`
- Add: `apps/web/src/components/booking-actions.tsx`
- Modify: `apps/web/src/lib/status-maps.ts`
- Modify: `apps/web/src/components/nav.tsx`