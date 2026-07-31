# Phase 2 — Infrastructure Polish

## Objective

Tighten and fix the existing Docker, CI/CD, and developer tooling without adding new major services (monitoring, K8s, staging environment). This is a polish pass over what already exists.

## Changes

### 1. Next.js Standalone Output

`apps/web/next.config.ts` must set `output: "experimental-compile"` or `output: "standalone"` so that `pnpm build` produces the self-contained `apps/web/.next/standalone/` tree that the Docker CMD expects.

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  // ...existing config
};
```

### 2. .dockerignore

Create `docker/.dockerignore` to exclude from the Docker build context:

- `node_modules/` and all `*/node_modules/`
- `.git/` and `.github/`
- `.next/`, `dist/`, `turbo/`, `.turbo/`
- `.env`, `.env.*`
- `*.md`
- `coverage/`

### 3. Dockerfile Fixes

The builder stage runs `pnpm db:generate` which needs the Prisma schema. The current COPY only copies package.json manifests. Add explicit `COPY packages/database/prisma ./packages/database/prisma` before `pnpm db:generate`.

### 4. CI Optimizations

Add to `.github/workflows/ci.yml`:

- **pnpm store caching** — speeds up `pnpm install` from ~40s to ~5s
- **Turbe remote caching** — via `TURBO_TOKEN` and `TURBO_TEAM` env vars
- **Format check** — `pnpm format --check` in the lint job
- **Build verification** — ensure `pnpm build` runs after typecheck

### 5. Makefile

Create root `Makefile` with targets:

| Target              | Command                                  |
| ------------------- | ---------------------------------------- |
| `make dev`          | Start dev server + DB                    |
| `make db`           | Start only PostgreSQL + Redis via Docker |
| `make db:setup`     | Generate, push, seed                     |
| `make build`        | Full production build                    |
| `make lint`         | Lint + typecheck                         |
| `make test`         | Run tests                                |
| `make format`       | Format all files                         |
| `make clean`        | Clean all build artifacts                |
| `make docker:build` | Build Docker image                       |
| `make docker:up`    | Docker Compose up                        |

### 6. Husky + lint-staged

- Install `husky` and `lint-staged`
- Add `prepare` script to `package.json`: `husky`
- Add pre-commit hook: `lint-staged`
- Add `.lintstagedrc.js`: run `prettier --write` and `eslint --fix` on staged `*.{ts,tsx,js,jsx,md,json}`

### 7. turbo.json Format Task

Add a `format` task entry pointing to `prettier --check`.

## Files Changed

| File                       | Action                                      |
| -------------------------- | ------------------------------------------- |
| `apps/web/next.config.ts`  | Edit — add `output: "standalone"`           |
| `docker/.dockerignore`     | Create                                      |
| `docker/Dockerfile`        | Edit — add prisma copy step                 |
| `.github/workflows/ci.yml` | Edit — add caching, format check            |
| `Makefile`                 | Create                                      |
| `package.json`             | Edit — add husky prepare + lint-staged deps |
| `.husky/pre-commit`        | Create                                      |
| `.lintstagedrc.js`         | Create                                      |
| `turbo.json`               | Edit — add format task                      |
