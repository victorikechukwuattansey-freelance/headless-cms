# OpenCanva Windows @fs Path Bug — Upstream PR

## Bug

`@opencanva/core` v0.3.0 generates broken import URLs on Windows when the project path contains spaces.

**URL generated:** `http://localhost:5173/@fsC:/Users/Name%20With%20Spaces/...` (404)
**Correct URL:** `http://localhost:5173/@fs/C:/Users/Name%20With%20Spaces/...` (200)

## Root Cause

`packages/core/src/vite/opencanva-plugin.ts:47`:

```js
const fsPath = `/@fs${normalizePath(e.abs)}`;
```

Missing `/` after `@fs`. Should be:

```js
const fsPath = `/@fs/${normalizePath(e.abs)}`;
```

## How to Submit

1. Go to https://github.com/daniellee-ux/open-canva
2. Fork the repo
3. Edit `packages/core/src/vite/opencanva-plugin.ts` line 47
4. Change `` `/@fs${normalizePath(e.abs)}` `` to `` `/@fs/${normalizePath(e.abs)}` ``
5. Create a PR with title: `fix: Windows @fs path breaks when project path contains spaces`
6. Use body from `0001-fix-windows-@fs-path-spaces.patch`

## Local Fix (already applied)

The fix is applied to `_open-canva/node_modules/@opencanva/core/src/vite/opencanva-plugin.ts`.
It will be overwritten on `npm install`. The `postinstall` script in `_open-canva/package.json`
re-applies it via `scripts/patch-theme.mjs`.
