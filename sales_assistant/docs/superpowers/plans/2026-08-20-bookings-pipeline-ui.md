# Bookings Pipeline UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Bookings page to the `apps/web` dashboard — list (with status filter + pagination), create, and transition bookings through the pipeline.

**Architecture:** Server page (`force-dynamic`) fetches bookings + leads in parallel via `@sales_assistant/api-client`, passes the booking list as `initial` to a colocated client table (which filters/paginates with `/api/*` fetches), and passes the leads to both the create form (lead picker / `<select>`) and the table (a `leadId → lead` map to render names). Transition/create actions are thin client components that `POST` through the proxy and `router.refresh()`. The API stays frozen (web-side lead lookup; no `?expand=lead`).

**Tech Stack:** Next.js 15.5 (App Router), Tailwind v4, React 19, `@sales_assistant/api-client`, npm workspaces + Turborepo.

## Global Constraints

- No API, OpenAPI, worker, Prisma/migration, or contract-test changes (API is the source of truth and stays frozen).
- No new dependencies.
- Follow the established web pattern (Tasks 6–8): server page does the initial parallel fetch and session-guard; colocated client table component (`app/<domain>/<domain>-table.tsx`) manages status filter + pagination via `fetch('/api/...')` with `cache: 'no-store'`; client action components live in `src/components/`; success → `router.refresh()`; failures render `json.error.message` inline.
- Transition edges in `src/lib/status-maps.ts` MUST mirror the API's `BOOKING_TRANSITIONS` (the API is authoritative): `pending → [confirmed, cancelled]`, `confirmed → [completed, cancelled]`, `completed/cancelled → []`.
- Verification per task: `npm run lint` (expect 0 errors, 2 pre-existing config warnings allowed) and typecheck via the workspace build. There is no frontend test framework — acceptance is lint + build + manual smoke against the dev stack (API :3000, web `next start` :4000, host PostgreSQL dev DB).
- After any code change, the web dev server (`next start` on :4000) serves the built `.next` — rebuild before restarting it.
- Commits are made at the parent repo root (`C:\Users\1040 G8\Documents\jarvis-demo`) with `sales_assistant/...` path prefixes.
- Global feature deps: `@sales_assistant/api-client` workspace must be built before `apps/web` rebuilds (`turbo` handles ordering via `dependsOn`).

---

### Task 1: api-client — Booking types + typed helpers

**Files:**
- Modify: `packages/api-client/src/types.ts` (append types)
- Modify: `packages/api-client/src/index.ts` (type imports, exports, helpers)
- Test: `packages/api-client/src/index.ts` (bundled into workspace tests — `npm --workspace @sales_assistant/api-client test` stays green)

**Interfaces:**
- Consumes: existing api-client structure (`types.ts` + re-export barrel in `index.ts`).
- Produces: `BookingStatus`, `Booking` types, and `listBookings` / `createBooking` / `transitionBooking` helpers — used by Task 6's page.

- [ ] **Step 1: Append types to `packages/api-client/src/types.ts`** — after the `Reminder` interface (line 66):

```ts
export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export interface Booking {
  id: string;
  organizationId: string;
  leadId: string;
  at: string;
  status: BookingStatus;
  createdAt: string;
}
```

- [ ] **Step 2: Export the types from `packages/api-client/src/index.ts`** — extend the type import on line 1 and the `export type` list:

```ts
import type { Booking, BookingStatus, DealStage, LeadStatus, ReminderStatus, Role } from './types.js';

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
  BookingStatus,
  Booking,
} from './types.js';
```

- [ ] **Step 3: Add the typed helpers to `packages/api-client/src/index.ts`** — append after `transitionDeal` (line 102):

```ts
export const listBookings = (
  token: string,
  query: { limit?: number; offset?: number; status?: BookingStatus } = {},
) => apiRequest('/bookings', { token, query });

export const createBooking = (token: string, input: { leadId: string; at: string }) =>
  apiRequest('/bookings', { method: 'POST', token, body: input });

export const transitionBooking = (token: string, id: string, status: BookingStatus) =>
  apiRequest(`/bookings/${encodeURIComponent(id)}/transition`, { method: 'POST', token, body: { status } });
```

- [ ] **Step 4: Verify** — from `sales_assistant/`:

```bash
npm --workspace @sales_assistant/api-client run build
npm --workspace @sales_assistant/api-client test
```

Expected: build compiles (0 type errors), all 3 api-client tests pass.

- [ ] **Step 5: Commit** (from repo root `C:\Users\1040 G8\Documents\jarvis-demo`):

```bash
git add sales_assistant/packages/api-client/src/types.ts sales_assistant/packages/api-client/src/index.ts
git commit -m "feat(api-client): booking types and helpers"
```

---

### Task 2: Booking status maps + nav link

**Files:**
- Modify: `apps/web/src/lib/status-maps.ts` (extend import + append exports)
- Modify: `apps/web/src/components/nav.tsx` (add nav item)
- Test: `apps/web` lint (below)

**Interfaces:**
- Consumes: `BookingStatus` from `@sales_assistant/api-client` (Task 1).
- Produces: `BOOKING_TRANSITIONS` and `BOOKING_BADGES` — consumed by Tasks 3 and 5; the nav `Bookings` link used by the layout.

- [ ] **Step 1: Extend the import in `apps/web/src/lib/status-maps.ts`** (line 1):

```ts
import type { BookingStatus, DealStage, LeadStatus, ReminderStatus } from '@sales_assistant/api-client';
```

- [ ] **Step 2: Append the booking maps** to `apps/web/src/lib/status-maps.ts` (after `AGENT_BADGES`). The edges MUST mirror the API's `BOOKING_TRANSITIONS` (see Global Constraints):

```ts
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export const BOOKING_BADGES: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-neutral-200 text-neutral-700',
};
```

- [ ] **Step 3: Add the nav item** to `apps/web/src/components/nav.tsx` — insert into `ITEMS` between Agents and Reminders:

```ts
  { href: '/bookings', label: 'Bookings' },
```

- [ ] **Step 4: Verify** — from `sales_assistant/`:

```bash
npm --workspace @sales_assistant/web run lint
```

Expected: 0 errors (2 pre-existing config warnings allowed).

- [ ] **Step 5: Commit** (repo root):

```bash
git add sales_assistant/apps/web/src/lib/status-maps.ts sales_assistant/apps/web/src/components/nav.tsx
git commit -m "feat(web): booking status maps and nav link"
```

---

### Task 3: Booking transition actions

**Files:**
- Create: `apps/web/src/components/booking-actions.tsx`
- Test: `apps/web` lint (below)

**Interfaces:**
- Consumes: `BookingStatus` (Task 1), `BOOKING_TRANSITIONS` (Task 2), the `Button` primitive.
- Produces: `BookingActions({ bookingId: string, status: BookingStatus })` — consumed by Task 5's table rows.

- [ ] **Step 1: Create `apps/web/src/components/booking-actions.tsx`** (mirrors `src/components/deal-actions.tsx`):

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';
import { BOOKING_TRANSITIONS } from '@/src/lib/status-maps';
import type { BookingStatus } from '@sales_assistant/api-client';

export function BookingActions({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const router = useRouter();
  const [error, setError] = useState('');
  const targets = BOOKING_TRANSITIONS[status];

  async function transition(to: BookingStatus) {
    setError('');
    const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}/transition`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: to }),
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

- [ ] **Step 2: Verify** — from `sales_assistant/`:

```bash
npm --workspace @sales_assistant/web run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit** (repo root):

```bash
git add sales_assistant/apps/web/src/components/booking-actions.tsx
git commit -m "feat(web): booking transition actions"
```

---

### Task 4: Create booking form

**Files:**
- Create: `apps/web/src/components/create-booking-form.tsx`
- Test: `apps/web` lint (below)

**Interfaces:**
- Consumes: `Lead` type (exported by `@sales_assistant/api-client`), the `Button` primitive.
- Produces: `CreateBookingForm({ leads: Lead[] })` — consumed by Task 6's page.

- [ ] **Step 1: Create `apps/web/src/components/create-booking-form.tsx`** (mirrors the form structure of `src/components/create-user-form.tsx`):

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/components/button';
import type { Lead } from '@sales_assistant/api-client';

export function CreateBookingForm({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [leadId, setLeadId] = useState('');
  const [at, setAt] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId, at: new Date(at).toISOString() }),
    });
    const json = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(json?.error?.message ?? 'Booking failed');
      return;
    }
    setLeadId('');
    setAt('');
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-4">
      <select
        required
        value={leadId}
        onChange={(e) => setLeadId(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="">Select a lead…</option>
        {leads.map((lead) => (
          <option key={lead.id} value={lead.id}>
            {lead.name ?? lead.phone} — {lead.phone}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        required
        value={at}
        onChange={(e) => setAt(e.target.value)}
        className="rounded border border-neutral-300 px-3 py-2 text-sm"
      />
      <div className="flex items-center">
        <Button disabled={busy}>{busy ? 'Creating…' : 'Create booking'}</Button>
      </div>
      {error && <p className="text-sm text-red-600 md:col-span-4">{error}</p>}
    </form>
  );
}
```

Notes: `new Date(at).toISOString()` serializes the local `datetime-local` value to UTC ISO (ends in `Z`), which satisfies the API's `z.string().datetime({ offset: true })` requirement.

- [ ] **Step 2: Verify** — from `sales_assistant/`:

```bash
npm --workspace @sales_assistant/web run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit** (repo root):

```bash
git add sales_assistant/apps/web/src/components/create-booking-form.tsx
git commit -m "feat(web): create booking form"
```

---

### Task 5: Bookings table (filter + pagination + lead display)

**Files:**
- Create: `apps/web/app/bookings/bookings-table.tsx`
- Test: `apps/web` lint (below)

**Interfaces:**
- Consumes: `Booking`, `BookingStatus`, `Lead`, `Paginated<Booking>` types (Task 1), `BOOKING_BADGES` (Task 2), `BookingActions` (Task 3), `Table`/`Badge`/`Button` primitives.
- Produces: `BookingsTable({ initial: Paginated<Booking>, leads: Lead[] })` — consumed by Task 6's page.

- [ ] **Step 1: Create `apps/web/app/bookings/bookings-table.tsx`** (colocated, cloned/adapted from `app/leads/leads-table.tsx`):

```tsx
'use client';

import { useState } from 'react';
import { Badge } from '@/src/components/badge';
import { Table } from '@/src/components/table';
import { Button } from '@/src/components/button';
import { BOOKING_BADGES } from '@/src/lib/status-maps';
import { BookingActions } from '@/src/components/booking-actions';
import type { Booking, BookingStatus, Lead, Paginated } from '@sales_assistant/api-client';

const PAGE_SIZE = 20;
const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled'];

export function BookingsTable({ initial, leads }: { initial: Paginated<Booking>; leads: Lead[] }) {
  const [status, setStatus] = useState<BookingStatus | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));

  async function load(nextStatus: BookingStatus | undefined, nextOffset: number) {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(nextOffset) });
    if (nextStatus) params.set('status', nextStatus);
    const res = await fetch(`/api/bookings?${params.toString()}`, { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok || !json) {
      setError(json?.error?.message ?? 'Failed to load bookings');
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
        headers={['When', 'Lead', 'Status', 'Actions']}
        rows={(data?.data ?? []).map((booking) => {
          const lead = leadById.get(booking.leadId);
          return [
            new Date(booking.at).toLocaleString(),
            lead ? `${lead.name ?? '—'} · ${lead.phone}` : booking.leadId.slice(0, 8),
            <Badge key={booking.id} className={BOOKING_BADGES[booking.status]}>
              {booking.status}
            </Badge>,
            <BookingActions key={booking.id} bookingId={booking.id} status={booking.status} />,
          ];
        })}
      />
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Page {currentPage} of {totalPages} · {data?.total ?? 0} bookings{loading ? ' (loading…)' : ''}
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

- [ ] **Step 2: Verify** — from `sales_assistant/`:

```bash
npm --workspace @sales_assistant/web run lint
```

Expected: 0 errors.

- [ ] **Step 3: Commit** (repo root):

```bash
git add sales_assistant/apps/web/app/bookings/bookings-table.tsx
git commit -m "feat(web): bookings table with filter and pagination"
```

---

### Task 6: Bookings page

**Files:**
- Create: `apps/web/app/bookings/page.tsx`
- Test: `apps/web` build (below)

**Interfaces:**
- Consumes: `getSession()` (from `@/src/lib/session`), `listBookings` / `listLeads` (Task 1), `CreateBookingForm` (Task 4), `BookingsTable` (Task 5), `Card` primitive.
- Produces: the `/bookings` route.

- [ ] **Step 1: Create `apps/web/app/bookings/page.tsx`** (mirrors `app/leads/page.tsx` and `app/deals/page.tsx`):

```tsx
import { redirect } from 'next/navigation';
import { listBookings, listLeads } from '@sales_assistant/api-client';
import { getSession } from '@/src/lib/session';
import { Card } from '@/src/components/card';
import { BookingsTable } from './bookings-table';
import { CreateBookingForm } from '@/src/components/create-booking-form';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function BookingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  const token = session.token;
  const [bookings, leads] = await Promise.all([
    listBookings(token, { limit: PAGE_SIZE }),
    listLeads(token, { limit: 100 }),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-lg font-semibold">Bookings</h1>
      <Card title="Book a call">
        <CreateBookingForm leads={leads.json?.data ?? []} />
      </Card>
      <Card>
        <BookingsTable initial={bookings.json} leads={leads.json?.data ?? []} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build + lint** — from `sales_assistant/`:

```bash
npm --workspace @sales_assistant/web run lint
npm --workspace @sales_assistant/web run build
```

Expected: lint 0 errors; build compiles and lists a new `ƒ /bookings` route.

- [ ] **Step 3: Start the web server on the new build** — restart `next start` on :4000:

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Process powershell -WindowStyle Hidden -WorkingDirectory "C:\Users\1040 G8\Documents\jarvis-demo\sales_assistant\apps\web" -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "C:\Users\1040G8~1\AppData\Local\Temp\opencode\run-sa-web.ps1"'
```

(Assumes the API on :3000 and `run-sa-web.ps1` launcher already exist from the dashboard plan.)

- [ ] **Step 4: Manual smoke** — login as `admin@acme.test` / `password123` (save the jar), then:

```powershell
$jar = "C:\Users\1040G8~1\AppData\Local\Temp\opencode\sa-cookies.txt"
curl.exe -s -o NUL -w "login: %{http_code}`n" -c $jar -H "content-type: application/json" -d "@C:\Users\1040G8~1\AppData\Local\Temp\opencode\login-body.json" http://localhost:4000/api/auth/login
curl.exe -s -b $jar http://localhost:4000/bookings | Select-String -Pattern "Book a call|Select a lead|All|pending|confirmed" | ForEach-Object { "render: FOUND" }
```

- [ ] **Step 5: Commit** (repo root):

```bash
git add sales_assistant/apps/web/app/bookings
git commit -m "feat(web): bookings page"
```

---

### Task 7: Full verification + plan close-out

**Files:**
- Modify: `docs/superpowers/plans/2026-08-20-bookings-pipeline-ui.md` (check boxes)
- Test: full suite (below)

**Interfaces:** None new — final verification of the /bookings feature end to end.

- [ ] **Step 1: Repo-wide verification** — from `sales_assistant/`:

```bash
npm run lint
npm run build
```

Expected: lint 0 errors across all workspaces; turbo build 8/8 packages successful, exit 0.

- [ ] **Step 2: Rebuild + restart web** (Task 6 Step 3), then smoke the full flow against the dev stack (API :3000 running, host PostgreSQL dev DB):

1. Login as `admin@acme.test` → `/bookings` renders with `Book a call` form, filter chips, and the `Bookings` nav link.
2. Create a booking (pick a lead, choose a future time) → row appears with `pending` badge and buttons `Mark confirmed` + `Mark cancelled`.
3. Transition `pending → confirmed` → buttons become `Mark completed` + `Mark cancelled`.
4. Create another booking; transition `pending → cancelled` → shows `Terminal`, no buttons.
5. Transition one `confirmed → completed` → `Terminal`.
6. Filter chips: select `completed` → only completed bookings; `All` resets. Pagination result count matches `total`.
7. Lead column shows `name · phone` (or the `— · phone` form for unnamed leads).
8. Login as `user@acme.test` → `/bookings` is viewable (no admin gate).
9. Confirm no API/OpenAPI/worker files changed: `git status --short` in `sales_assistant/` shows only the web + api-client + docs changes above.

- [ ] **Step 3: Check this plan's boxes** — replace every `- [ ]` in this file with `- [x]`, using the UTF-8-safe PowerShell write (plain `Set-Content` corrupts non-ASCII):

```powershell
$p = "C:\Users\1040 G8\Documents\jarvis-demo\sales_assistant\docs\superpowers\plans\2026-08-20-bookings-pipeline-ui.md"
$lines = Get-Content -Encoding UTF8 $p
for ($i = 0; $i -lt $lines.Length; $i++) { if ($lines[$i] -match '^- \[ \]') { $lines[$i] = $lines[$i] -replace '^- \[ \]', '- [x]' } }
[System.IO.File]::WriteAllLines((Resolve-Path $p), $lines, (New-Object System.Text.UTF8Encoding($false)))
```

- [ ] **Step 4: Commit** (repo root):

```bash
git add "sales_assistant/docs/superpowers/plans/2026-08-20-bookings-pipeline-ui.md"
git commit -m "docs(web): mark bookings pipeline plan complete"
```