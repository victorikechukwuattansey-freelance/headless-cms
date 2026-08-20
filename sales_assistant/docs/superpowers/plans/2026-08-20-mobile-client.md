# Expo Mobile Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold `apps/mobile/` (Expo Router + TypeScript) with a login screen against the existing API, secure token storage, and a protected home screen proving the authenticated loop.

**Architecture:** New workspace `@sales_assistant/mobile` consuming `@sales_assistant/api-client` TypeScript source directly (Metro transpiles workspace packages; no packaging changes to api-client or via). Session `{token, expiresAt, role}` lives in `expo-secure-store`; the root layout gates on it; the login screen swaps it in/out. API base URL comes from `EXPO_PUBLIC_API_URL` bridged onto `process.env.API_URL` (what api-client's `apiUrl()` reads).

**Tech Stack:** Expo SDK (latest), expo-router, expo-secure-store, React Native, TypeScript, `@sales_assistant/api-client`.

## Global Constraints

- All work under `sales_assistant/`; commits from repo root with `sales_assistant/...` paths. Repo root commit style: `feat(mobile): ...`, `docs(mobile): ...`.
- Do NOT modify `packages/api-client` or `apps/via` packaging (`main`/`types`/`exports` stay as-is).
- Do NOT add files outside `apps/mobile/` except: root `package-lock.json` (npm workspace link) and `sales_assistant/README.md` (structure tree + mobile run docs — Task 5).
- API URL config is `EXPO_PUBLIC_API_URL` (default `http://localhost:3000`); Android emulator `http://10.0.2.2:3000`; physical device LAN IP.
- No new runtime deps beyond the workspace api-client + `expo-secure-store` + what the Expo template ships.
- Session key: `sa_session`. Session shape: `{ token: string; expiresAt: string; role: string }`.
- Files must end with a trailing newline. Write files with the Write tool (UTF-8, no BOM).
- Verification commands run from `sales_assistant/`; API stack (`npm run dev`) must be up for the manual smoke only.

---

### Task 1: Scaffold the Expo app in `apps/mobile/`

**Files:**
- Create: `apps/mobile/` (scaffolded by `create-expo-app`)
- Modify: root `sales_assistant/package-lock.json` (via npm install)
- Delete: example template files (tabs, demo components, constants, hooks)

**Interfaces:**
- Consumes: nothing.
- Produces: an Expo Router TypeScript app at `apps/mobile/` with scripts `start`, `android`, `ios`, `web`, `lint`; `EXPO_PUBLIC_API_URL` support.

- [ ] **Step 1: Scaffold without installing**

From `sales_assistant/apps/`:

```powershell
npx create-expo-app@latest mobile --template default --no-install
```

Expected: `apps/mobile/` created with `package.json` (`name: mobile`, `main: expo-router/entry`), `app/`, `assets/`, `eslint.config.js`, `tsconfig.json` (extends `expo/tsconfig.base`, `strict: true`).

- [ ] **Step 2: Rename package to `@sales_assistant/mobile` and strip example content**

In `apps/mobile/package.json`: set `"name": "@sales_assistant/mobile"` and `"private": true` (keep everything else). Delete the example app content so only our screens remain:

```powershell
cd sales_assistant/apps/mobile
Remove-Item -Recurse -Force "app/(tabs)" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force components, constants, hooks, scripts -ErrorAction SilentlyContinue
```

(If the template version names these differently, delete whatever is outside `app/`, `assets/` and the config files.)

- [ ] **Step 3: Add the workspace dependency and link through root npm**

In `apps/mobile/package.json` `"dependencies"` add:

```json
"@sales_assistant/api-client": "*"
```

Then from `sales_assistant/`:

```powershell
npm install
```

Expected: `package-lock.json` gains `apps/mobile`; `node_modules/@sales_assistant/api-client` symlinks to `packages/api-client`.

- [ ] **Step 4: Install expo-secure-store (version-matched)**

From `sales_assistant/apps/mobile/`:

```powershell
npx expo install expo-secure-store
```

- [ ] **Step 5: Add mobile env example**

Create `apps/mobile/.env.example`:

```env
# API base URL. Dev defaults:
#   iOS simulator / web : http://localhost:3000
#   Android emulator    : http://10.0.2.2:3000
#   Physical device     : http://<your-LAN-IP>:3000
EXPO_PUBLIC_API_URL=http://localhost:3000
```

- [ ] **Step 6: Verify scaffold health**

From `sales_assistant/apps/mobile/`:

```powershell
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

Expected: typecheck clean, lint clean, export produces `dist/` (web bundle). If `expo export` fails to resolve `@sales_assistant/api-client`, add `apps/mobile/metro.config.js`:

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
module.exports = config;
```

- [ ] **Step 7: Commit**

```bash
git add sales_assistant/apps/mobile sales_assistant/package-lock.json
git commit -m "feat(mobile): scaffold Expo Router app in apps/mobile"
```

---

### Task 2: Session store + API URL bridge

**Files:**
- Create: `apps/mobile/src/config.ts`
- Create: `apps/mobile/src/session.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `src/config.ts` — side-effect module; setting `process.env.API_URL` on import.
  - `src/session.ts` — `export interface Session { token: string; expiresAt: string; role: string }`, `saveSession(s: Session): Promise<void>`, `getSession(): Promise<Session | null>` (expiry-aware, clears expired), `clearSession(): Promise<void>`.

- [ ] **Step 1: Write the API URL bridge**

Create `apps/mobile/src/config.ts`:

```ts
process.env.API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
```

(Metro inlines `EXPO_PUBLIC_API_URL` at bundle time; assigning it onto `process.env.API_URL` is what `@sales_assistant/api-client`'s `apiUrl()` reads. Import this module before any API call.)

- [ ] **Step 2: Write the session store**

Create `apps/mobile/src/session.ts`:

```ts
import * as SecureStore from 'expo-secure-store';

export interface Session {
  token: string;
  expiresAt: string;
  role: string;
}

const KEY = 'sa_session';

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(session));
}

export async function getSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session.token || !session.expiresAt || !session.role) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
```

- [ ] **Step 3: Typecheck**

From `sales_assistant/apps/mobile/`:

```powershell
npx tsc --noEmit
```

Expected: clean (TS types resolve; `expo-secure-store` types come from the package).

- [ ] **Step 4: Commit**

```bash
git add sales_assistant/apps/mobile/src
git commit -m "feat(mobile): session store (expo-secure-store) and API URL bridge"
```

---

### Task 3: Login screen

**Files:**
- Create: `apps/mobile/app/login.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (minimal Stack; gate comes in Task 4)

**Interfaces:**
- Consumes: `login` from `@sales_assistant/api-client` (POST `/auth/token`, returns `{status, json}`; 200 -> `json.token/expiresAt/role`); `saveSession` from `../src/session`; `../src/config` side effect.
- Produces: `/login` route; on success `router.replace('/')`.

- [ ] **Step 1: Write the root layout**

Replace `apps/mobile/app/_layout.tsx`:

```tsx
import '../../src/config';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Write the login screen**

Create `apps/mobile/app/login.tsx`:

```tsx
import '../../src/config';
import { useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform } from 'react-native';
import { login as apiLogin } from '@sales_assistant/api-client';
import { saveSession } from '../src/session';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiLogin(email.trim(), password);
      if (res.status === 200 && res.json?.token) {
        await saveSession({
          token: res.json.token,
          expiresAt: res.json.expiresAt,
          role: res.json.role ?? 'USER',
        });
        router.replace('/');
        return;
      }
      setError(res.json?.error?.message ?? `Sign-in failed (${res.status})`);
    } catch {
      setError('Cannot reach the API. Check EXPO_PUBLIC_API_URL and that the dev stack is running.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <Text style={styles.title}>Sales Assistant</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={[styles.button, busy && styles.buttonDisabled]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  error: { color: '#dc2626', fontSize: 13 },
  button: { backgroundColor: '#171717', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
```

- [ ] **Step 3: Typecheck + lint**

From `sales_assistant/apps/mobile/`:

```powershell
npx tsc --noEmit
npm run lint
```

Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add sales_assistant/apps/mobile/app
git commit -m "feat(mobile): login screen against the API"
```

---

### Task 4: Auth gate + protected home screen

**Files:**
- Modify: `apps/mobile/app/_layout.tsx`
- Create: `apps/mobile/app/index.tsx`

**Interfaces:**
- Consumes: `getSession`, `clearSession`, `Session` from `../src/session`; `listLeads(token, {limit})` from `@sales_assistant/api-client` (`json.data` = leads with `{id, name?, phone}`, `json.total` = count); `../src/config` side effect.
- Produces: `/` route (home). Layout behavior: no session -> `<Redirect href="/login" />`; login screen shows `<Redirect href="/" />` when a session exists.

- [ ] **Step 1: Write the auth-gate layout**

Replace `apps/mobile/app/_layout.tsx`:

```tsx
import '../../src/config';
import { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { getSession, type Session } from '../src/session';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getSession().then((s) => {
      setSession(s);
      setReady(true);
    });
  }, []);

  if (!ready) return null;
  if (!session) return <Redirect href="/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Redirect authed users away from /login**

Append to `apps/mobile/app/login.tsx` (above the return in `LoginScreen`):

```tsx
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    getSession().then(setSession);
  }, []);
  if (session) return <Redirect href="/" />;
```

and extend the imports at the top of the file:

```tsx
import { useEffect } from 'react';
import { Redirect, router } from 'expo-router';
import { getSession, type Session } from '../src/session';
```

(replacing the existing `import { router } from 'expo-router';` line).

- [ ] **Step 3: Write the home screen**

Create `apps/mobile/app/index.tsx`:

```tsx
import '../../src/config';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { listLeads } from '@sales_assistant/api-client';
import { clearSession, type Session } from '../src/session';

interface LeadRow {
  id: string;
  name?: string | null;
  phone: string;
}

export default function HomeScreen() {
  const [session, setSession] = useState<Session | null>(null);
  const [leadCount, setLeadCount] = useState<number | null>(null);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const s = await getSession();
    setSession(s);
    if (!s) {
      router.replace('/login');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await listLeads(s.token, { limit: 20 });
      if (res.status === 200) {
        setLeadCount(res.json?.total ?? res.json?.data?.length ?? 0);
        setLeads(res.json?.data ?? []);
      } else {
        setError(res.json?.error?.message ?? `Failed to load leads (${res.status})`);
      }
    } catch {
      setError('Cannot reach the API. Check EXPO_PUBLIC_API_URL.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function signOut() {
    await clearSession();
    router.replace('/login');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sales Assistant</Text>
      {session ? <Text style={styles.subtitle}>Signed in as {session.role}</Text> : null}
      <View style={styles.rowBetween}>
        <Text style={styles.count}>{leadCount === null ? '—' : `${leadCount} leads`}</Text>
        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.rowText}>{item.name ?? item.phone}</Text>
              <Text style={styles.rowSub}>{item.phone}</Text>
            </View>
          )}
          ListEmptyComponent={!error ? <Text style={styles.empty}>No leads yet</Text> : null}
        />
      )}
      {error && !loading ? (
        <Pressable style={styles.retry} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '600' },
  subtitle: { fontSize: 14, color: '#525252' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 16, fontWeight: '500' },
  signOut: { borderWidth: 1, borderColor: '#d4d4d4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  signOutText: { color: '#171717' },
  error: { color: '#dc2626', fontSize: 13 },
  loader: { marginTop: 24 },
  row: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  rowText: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 13, color: '#525252' },
  empty: { color: '#737373', marginTop: 12 },
  retry: { marginTop: 8 },
  retryText: { color: '#171717', fontWeight: '600', textAlign: 'center' },
});
```

- [ ] **Step 4: Typecheck + lint + web export**

From `sales_assistant/apps/mobile/`:

```powershell
npx tsc --noEmit
npm run lint
npx expo export --platform web
```

Expected: clean; `dist/` produced (Metro resolved `@sales_assistant/api-client` TS source).

- [ ] **Step 5: Commit**

```bash
git add sales_assistant/apps/mobile/app
git commit -m "feat(mobile): auth gate and protected home screen"
```

---

### Task 5: Docs + full verification + close-out

**Files:**
- Modify: `sales_assistant/README.md` (structure tree + mobile run docs)
- Modify: plan checklist (this file)

**Interfaces:**
- Consumes: nothing. Completes the deliverable.

- [ ] **Step 1: Update README structure tree**

In `sales_assistant/README.md` structure tree, add under `apps/`:

```
│   └── mobile/       # Expo mobile client (login + secure session)
```

(before the closing `├── packages/` line; keep the existing `web/` and `via/` lines).

- [ ] **Step 2: Add a mobile section to the README**

Append after the "Run locally in VSCode" subsection (still inside the Web Dashboard section's area or as its own `## Mobile Client` section before `## Background Jobs`):

```markdown
## Mobile Client

`apps/mobile` — Expo Router + TypeScript client (`@sales_assistant/mobile`). Login against the API, session stored in `expo-secure-store`, protected home screen with a live lead list.

Run it (dev stack first: `npm run dev`):

```bash
cd apps/mobile
cp .env.example .env.local   # set EXPO_PUBLIC_API_URL (see file comments)
npx expo start               # scan QR with Expo Go
```

- `EXPO_PUBLIC_API_URL` — API base URL; default `http://localhost:3000`. Android emulator: `http://10.0.2.2:3000`; physical device: your LAN IP.
- Consumes `@sales_assistant/api-client` TypeScript source directly (Metro transpiles workspace packages; verified via `npx expo export`).
- Session key `sa_session`; 1-hour token expiry, no refresh — re-login when it expires.
```

- [ ] **Step 3: Full verification battery**

From `sales_assistant/`:

```powershell
npm run lint --workspace @sales_assistant/mobile
```

From `sales_assistant/`: run the repo test suite to confirm nothing regressed:

```powershell
npm run test:repo
```

Expected: mobile lint clean; `test:repo` (repo contract tests) all pass (verifies workspace list, via eslint config path, api-client surface unchanged).

- [ ] **Step 4: Manual smoke (user)**

1. `npm run dev` at `sales_assistant/` (API :3000, web :4000, worker up).
2. `cd apps/mobile && npx expo start`, open in Expo Go.
3. Login with `admin@acme.test / password123` -> lands on home, shows role + lead count + rows.
4. Sign out -> returns to login. Relaunch app -> still logged in (session persisted). (Optional: kill + restart `npm run dev`, home shows "Cannot reach the API" + Retry works when stack is back.)

- [ ] **Step 5: Tick the plan checklist**

Tick every box in this plan. Run `git status --porcelain -- sales_assistant` and confirm only intended files are uncommitted.

- [ ] **Step 6: Commit close-out**

```bash
git add sales_assistant/README.md sales_assistant/package-lock.json
git commit -m "docs(mobile): README mobile client section"
```

---

## Risks / Gotchas

- **Metro workspace resolution:** `expo export` must transpile `@sales_assistant/api-client` TS. If it fails, the metro.config.js in Task 1 Step 6 is the fallback — no packaging change to api-client.
- **`EXPO_PUBLIC_` vs `API_URL`:** Metro only inlines `EXPO_PUBLIC_*`. The `src/config.ts` bridge maps it onto `process.env.API_URL` for api-client; every screen imports `../../src/config` (or `../src/config`) FIRST.
- **Windows paths:** all template deletion/creation commands are PowerShell (this repo's shell). `git add` commands use forward slashes and run from the repo root.
- **Firewall:** physical devices hitting the machine's LAN IP need inbound :3000 allowed in Windows Firewall.
- **Template drift:** if the Expo template folder names differ (tabs/components/constants/hooks), delete whatever example content exists; only `app/`, `assets/`, configs, and our new files must remain.