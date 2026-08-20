# Expo Mobile Client - Design Spec

- **Date:** 2026-08-20
- **Project:** Sales Assistant (`sales_assistant/`)
- **Status:** approved - ready for implementation plan

## Objective

Scaffold the Sales Assistant mobile client as a new Expo workspace (`apps/mobile/`) that authenticates against the existing API and proves the authenticated loop end-to-end: login -> token stored securely -> one authenticated fetch rendered on a protected home screen.

## Context

- The repo already ships `@sales_assistant/api-client` (`packages/api-client`), a typed fetch-based client with a `login(email, password)` helper, `apiUrl()` (reads `API_URL` env), and helpers for every resource (`listLeads`, `listBookings`, `listAuditEvents`, ...).
- `apps/via/` is a metadata-only stub ("Sales assistant mobile client") that the README notes as a packaging question: Metro consumers should confirm TS-source consumption before changing `main`/`types`/`exports`. This project does NOT change `via` or `api-client` packaging; it empirically verifies Metro can bundle workspace TypeScript source (approach A).
- API contract: `POST /auth/token` `{email, password}` -> `{token, expiresAt, role}`; bearer auth for everything else; structured errors `{error: {code, message}}`.

## Architecture

### New workspace: `apps/mobile/`

- Created with `create-expo-app` (latest Expo SDK, TypeScript, expo-router template), package name `@sales_assistant/mobile`, `private: true`.
- Workspace dependency on `@sales_assistant/api-client` (TS source, transpiled by Metro; Expo SDK 52+ monorepo support).
- `expo-secure-store` installed via `npx expo install` (version-matched).
- Covered automatically by root `workspaces: ["apps/*", "packages/*"]`; turbo `build`/`lint`/`test` untouched (Metro bundling is not a turbo task; run `npx expo export` for bundle verification).
- eslint config from the Expo template (`expo lint`).

### API URL configuration

- `EXPO_PUBLIC_API_URL` env (Expo public env, inlined at bundle time). Default when unset: `http://localhost:3000` (matches `api-url` default in api-client).
- `apps/mobile/.env.example` documents:
  - iOS simulator / web: `http://localhost:3000`
  - Android emulator: `http://10.0.2.2:3000`
  - Physical device via Expo Go: LAN IP, e.g. `http://192.168.x.x:3000`
- `.env.local` gitignored (template default `.gitignore` covers local env files).

## Screens & Data Flow

### `app/_layout.tsx` - root layout / auth gate

- On mount, read session from SecureStore (async).
- No session -> `<Redirect href="/login" />`.
- Session present -> render children (home).
- Splash/loading state while the SecureStore read resolves (no flash of login).

### `app/login.tsx`

- Email + password inputs (TextInput), Sign in button with busy state (disabled while in flight).
- Submit -> `login(email, password)` from `@sales_assistant/api-client`.
- 200 -> store `{token, expiresAt, role}` as JSON in SecureStore under a single key (e.g. `sa_session`), then `router.replace('/')`.
- Non-200 -> inline error message derived from `{error: {code, message}}`; network failure -> distinct "cannot reach API at <url>" message. Token never surfaced in UI.

### `app/index.tsx` - home (protected)

- Reads session from SecureStore (router guard guarantees it exists).
- Shows signed-in role.
- Fetches `listLeads(token, {limit: 20})`; renders lead count and the first 5 lead names/phones; minimal loading/error states.
- Sign out -> delete SecureStore key -> `router.replace('/login')`.

### Theme/UI

- Default Expo styling only; no design-system work in this pass (YAGNI).

## Error Handling

- Auth failures: inline, from `error.message` when present.
- Data fetch failures on home: inline error + retry button (simple re-run of the fetch).
- All failures human-readable; no raw JSON dumps beyond dev convenience.

## Non-Goals

- No dashboard screens beyond home lead preview (no leads CRUD, bookings, deals, activity on mobile yet).
- No offline storage, no biometrics, no token refresh (1-hour expiry; re-login).
- No changes to `apps/via` or `packages/api-client` packaging (`main`/`types`/`exports` stay as-is).
- No jest/unit test framework in this pass; verification is typecheck + lint + bundle export + manual Expo Go smoke.

## Out of Scope (future)

- Full navigation stack for leads/bookings/deals/activity.
- Push notifications, deep links beyond router defaults.
- Token refresh flow when the API gains one.

## Verification

1. `npm run build --workspace @sales_assistant/mobile` (or `tsc --noEmit` per template) - types clean.
2. `npm run lint --workspace @sales_assistant/mobile` - lint clean (template defaults).
3. `npx expo export` (web bundle) - proves Metro resolves `@sales_assistant/api-client` TS source without packaging changes (the README's open question, answered empirically).
4. Manual smoke (user): `npm run dev` stack up, then `npx expo start` and Expo Go on device - login with seeded `admin@acme.test / password123`, see home lead count, sign out.

## Risks

- **Android emulator / device networking:** localhost does not reach the dev machine; solved via `EXPO_PUBLIC_API_URL` documentation above. Windows Firewall may need to allow inbound :3000 for physical devices.
- **Metro + workspace TS:** if Expo's bundler does NOT transpile the workspace package despite monorepo support, fall back is a tiny Metro `watchFolders`/`unstable_enablePackageExports` config tweak in `apps/mobile/metro.config.js` - no packaging change to api-client required.
- **CORS:** the API is CORS-free by design (web uses a server proxy). The mobile app calls the API directly from the device and is not subject to browser CORS - native fetch has no such restriction. No change needed.