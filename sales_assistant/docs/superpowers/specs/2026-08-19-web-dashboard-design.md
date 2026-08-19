# Web Dashboard — Design

- **Date:** 2026-08-19
- **Status:** Approved (pending spec review)
- **Decisions:** LLM4.4 — Internal ops dashboard · Full ops read+act · Next.js App Router + Tailwind · Server-side session

## 1. Goal

A web dashboard for the sales team to operate the org-scoped CRM API: leads pipeline (assign, score, transition), agents, reminders, deals, and users (admin). All data flows through the existing `packages/api`; no new backend logic.

## 2. Architecture

```
Browser ──▶ apps/web (Next.js App Router, :4000)
             ├─ middleware.ts        session gate + redirect
             ├─ app/api/[...path]/   same-origin proxy → packages/api (:3000)
             ├─ server components    read sa_session cookie, call api-client directly
             └─ client components    fetch('/api/...') then router.refresh()
                        │
              packages/api-client    typed fetch helpers (server-only)
                        │
              API (:3000) ──▶ Postgres + Redis (unchanged)
```

- No CORS changes to the API (proxy is server-side; token never reaches the browser).
- API remains the only enforcement point; the UI hides actions the role cannot perform.

## 3. New workspace: `apps/web`

- Next.js (App Router) + TypeScript + Tailwind CSS v4. Dev port **4000**.
- Hand-scaffolded (no `create-next-app`): `next`, `react`, `react-dom`, `tailwindcss` + `@tailwindcss/postcss`; thin self-contained `tsconfig.json` (repo has no shared TS base yet).
- Scripts mirror existing workspaces: `dev`, `build`, `lint` (eslint flat config, next plugin).
- Registered in turbo (already picked up by `apps/*` glob): `dev` task added to `turbo.json` when first needed; root scripts `dev:web` / `build:web` optional convenience wrappers.
- `next.config.ts`: port 4000; `API_URL` read via `env` (server-only).

## 4. New workspace: `packages/api-client`

- Server-only fetch helper: `request(path, { method, body, query, token })` → `{ status, json }`, base URL from `API_URL` env.
- Typed per-endpoint helpers for the routes the UI uses (login, users, leads, agents, reminders, deals) with shared `Role` re-exported from `packages/shared`.
- Consumed by the proxy route handlers, server components, and server actions.
- Unit-tested with `node:test` (mocked fetch), consistent with repo style; exported via `dist` build like other packages.

## 5. Auth & session

- `POST /api/auth/login` (route handler):
  1. Call API `POST /auth/token` with `{ email, password }`.
  2. On 200: set `sa_session` httpOnly cookie: `{ token, expiresAt, role }` (JSON, secure in prod, `sameSite: lax`).
  3. Return `{ role }`. On 401: 401 to the form.
- `POST /api/auth/logout`: clear cookie.
- `middleware.ts`: redirect to `/login` when cookie missing or `expiresAt` < now. No silent refresh — API has no refresh endpoint (1h token); re-login on expiry.
- Session cookie is opaque storage only; token validity is enforced by the API HMAC check.

## 6. Pages & actions

| Route | Content | Actions visible |
|---|---|---|
| `/login` | email/password form | login |
| `/` | KPI cards (lead totals per status from list `total`, open deals, pending reminders, agents count), due-reminders panel, recent leads | — |
| `/leads` | table, status filter, offset pagination (`limit`/`offset`, `total`) | assign agent, re-score, transition status |
| `/leads/[id]` | profile fields, score + reason, current status | transition, assign |
| `/agents` | table: availability, assigned-lead counts | toggle availability |
| `/reminders` | table, status filter | generate (ADMIN), dismiss |
| `/deals` | table | transition won/lost |
| `/users` (ADMIN) | table + create form | create user |

- KPIs derived from list endpoints (`data`/`total`) — no new metrics endpoint.
- Server components fetch fresh per request (`cache: 'no-store'`); interactive components (filters, forms, modals, actions) are client components calling `/api/...` then `router.refresh()`.
- No new client data deps (no SWR/react-query); hand-rolled primitives: `Card`, `Table`, `Badge`, `Button`, `Modal`; domain status → badge color map.

## 7. Env & runtime

- `apps/web/.env.local`: `API_URL=http://localhost:3000` (dev). `.env.example` updated to document it.
- API + web run side by side: `npm --workspace @sales_assistant/api run dev` and `npm --workspace @sales_assistant/web run dev`.

## 8. Verification

1. `turbo lint` + `turbo build` pass (all workspaces incl. new `web`, `api-client`).
2. `npm test` still green (repo + api + via + new api-client tests).
3. Manual flow: start API (:3000) + web (:4000) → login as `admin@acme.test/password123` → dashboard KPIs render → create lead → assign → score → transition → reminders generate/dismiss → users create; repeat login as `user@acme.test` and confirm admin-only UI hidden and API still returns 403 if forced.
4. Existing API tests `test:integration` untouched.

## 9. Out of scope

Token refresh; multi-org switcher; charts from `/metrics`; notifications; bookings UI; deal/lead creation forms beyond users; the mobile `via` client.