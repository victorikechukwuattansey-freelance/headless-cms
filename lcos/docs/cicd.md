# CI/CD Pipeline Design

## Overview

LCOS uses **GitHub Actions** for continuous integration and deployment. The pipeline follows a **trunk-based development** model with short-lived feature branches, automatic preview deployments, and a staged promotion process from development through production.

---

## Pipeline Architecture

```
                    ┌─────────────────────┐
                    │   Feature Branch     │
                    │   (feat/*, fix/*)   │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Pull Request       │
                    │   → CI Checks        │
                    │   → Preview Deploy   │
                    └──────────┬──────────┘
                               │ (merge to main)
                    ┌──────────▼──────────┐
                    │   main branch        │
                    │   → CI + CD          │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
    ┌─────────▼──────┐  ┌─────▼──────┐  ┌──────▼─────────┐
    │   Dev          │  │  Staging   │  │  Production     │
    │   (auto)       │  │  (manual)  │  │  (manual+gate)  │
    └────────────────┘  └────────────┘  └─────────────────┘
```

---

## 1. Build Stage

### Trigger: All branches

```yaml
name: Build
on:
  push:
    branches: [main, 'feat/**', 'fix/**']
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci --frozen-lockfile
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build-output
          path: dist/
```

### Output

| Artifact | Description |
|---|---|
| `dist/` | Compiled Next.js app (frontend) |
| `build/` | Compiled NestJS app (API) |
| `prisma/` | Generated Prisma client |

---

## 2. Test Stage

### Unit & Integration Tests

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: lcos_test
          POSTGRES_USER: lcos
          POSTGRES_PASSWORD: lcos
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --frozen-lockfile
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

### Test Strategy

| Layer | Tool | Coverage Target |
|---|---|---|
| Unit (Frontend) | Vitest | ≥ 80% |
| Unit (API) | Jest | ≥ 85% |
| Integration | Supertest + Testcontainers | ≥ 70% |
| E2E | Playwright | Critical paths |
| Visual Regression | Chromatic/Percy | UI components |

---

## 3. Lint & Typecheck Stage

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --frozen-lockfile
      - run: npm run lint
      - run: npm run typecheck
      - run: npx prettier --check .
```

### Checks

| Check | Command | Fail On |
|---|---|---|
| ESLint | `npm run lint` | Errors, warnings |
| TypeScript | `npm run typecheck` | Type errors |
| Prettier | `npx prettier --check` | Formatting diff |
| Prisma validate | `npx prisma validate` | Schema errors |
| Secrets scan | `npx secretlint` | Hardcoded secrets |

---

## 4. Preview Deployments (Pull Requests)

### Environment

- **Platform**: Vercel (frontend) + Render/Railway (API)
- **URL pattern**: `pr-{number}.lcos.preview.app`
- **Database**: Ephemeral Postgres instance (spun up per PR)
- **Tear-down**: Automatic on PR close/merge

### Configuration

```yaml
jobs:
  preview:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --frozen-lockfile
      - run: npm run build
      - name: Deploy Frontend Preview
        run: npx vercel --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
      - name: Deploy API Preview
        run: npx railway up --service api
      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `🚀 Preview deployed\n- Frontend: ${frontendUrl}\n- API: ${apiUrl}`
            })
```

### Preview Features

- **Comment Bot**: Auto-comments deployment URLs on PR
- **Database Seed**: Fresh data seed per preview
- **Smoke Tests**: Basic health checks post-deploy
- **Performance Budget**: Lighthouse score check (optional)

---

## 5. Production Deployment Gate

### Approval Flow

1. PR merges to `main`
2. `main` auto-deploys to **dev** environment
3. Dev deployment runs integration smoke tests
4. Trigger staging deployment via GitHub Environments (requires approval)
5. Staging runs full E2E test suite
6. Production deployment requires **2 approvals + chatops** (`/deploy prod`)

### GitHub Environments

| Environment | Auto-deploy | Required Approvals | Protection Rules |
|---|---|---|---|
| Development | On push to `main` | 0 | None |
| Staging | Manual workflow_dispatch | 1 | Wait for CI |
| Production | Chatops (`/deploy prod`) | 2 | Wait for CI, branch protection |

### Production Deploy Action

```yaml
name: Deploy Production
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., v1.2.3)'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.inputs.version }}
      - run: npm ci --frozen-lockfile
      - run: npm run build
      - name: Run database migrations
        run: npx prisma migrate deploy
      - name: Deploy API
        run: ./scripts/deploy-api.sh production
      - name: Deploy Frontend
        run: ./scripts/deploy-frontend.sh production
      - name: Run post-deploy health checks
        run: ./scripts/health-check.sh production
      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
```

---

## 6. Database Migration Strategy

### Principles

- **Forward-only migrations**: Never modify a committed migration
- **Backward compatible**: All migrations must be revertible
- **Zero-downtime**: Deployed with expand-migrate-contract pattern

### Migration Workflow

```
1. PR introduces schema change → generates migration file
2. CI validates migration (npx prisma migrate dev)
3. Preview deploy applies migration to ephemeral DB
4. Production deploy:
   a. Expand phase: Add new columns/tables (old code still works)
   b. Deploy phase: New code reads/writes new schema
   c. Contract phase: Remove deprecated columns (separate release)
```

### Prisma Migrate Commands

```bash
# Generate migration
npx prisma migrate dev --name add_customer_tier

# Apply to production
npx prisma migrate deploy

# Rollback (if needed)
npx prisma migrate resolve --rolled-back "20240701000000_add_customer_tier"
```

### Migration Checklist

- [ ] Migration is backward compatible
- [ ] No `NOT NULL` on new columns (use default)
- [ ] No renaming columns (create new, migrate data, drop old)
- [ ] Large tables: use `CREATE INDEX CONCURRENTLY`
- [ ] Run against staging first with production-like data volume

---

## 7. Environment Promotion

### Promotion Flow

```
dev ──(auto)──► staging ──(manual approval)──► production
```

| Property | Dev | Staging | Production |
|---|---|---|---|
| Deploy trigger | Push to main | Manual workflow | Chatops + approval |
| Database | Shared dev | Clone of prod (anonymized) | Primary prod |
| Data integrity | Acceptable loss | Production-like | SAC protected |
| Monitoring | Basic | Full (Sentry, DataDog) | Full + PagerDuty |
| Backup | None | Daily | Continuous WAL |
| SSL | Let's Encrypt | Let's Encrypt | EV cert |

### Version Tagging

```bash
# Create release tag
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3

# Release workflow
# 1. Changelog generated from conventional commits
# 2. GitHub Release created with changelog
# 3. Docker images tagged with semver
# 4. Deployment triggered via workflow_dispatch
```

---

## 8. Rollback Strategy

### Rollback Types

| Type | Scope | Time | Risk |
|---|---|---|---|
| Code rollback | Revert merge commit | 5 min | Low — old code is stable |
| Database rollback | Migration reversal | 15 min | Medium — data loss if destructive |
| Full restore | Point-in-time recovery | 1 hour | High — service disruption |

### Code Rollback

```bash
# Rollback to previous version
git revert HEAD --no-edit
git push origin main

# Or via Chatops
/deploy prod v1.2.2
```

### Database Rollback

```yaml
# prisma/rollback.ts — run as part of rollback workflow
- npx prisma migrate resolve --rolled-back "20240701000000_bad_migration"
- npx prisma migrate deploy  # Re-applies previous good migrations
- # Manual data fixup if rollback was destructive
```

### Rollback Runbook

1. Halt deployment pipeline
2. Identify rollback version (previous stable tag)
3. Execute code rollback via revert or tag deploy
4. If schema change: run rollback migration or restore from backup
5. Verify health checks pass
6. Notify team in #incidents channel
7. Post-mortem within 24 hours

---

## 9. Secrets Management

### Tool: GitHub Actions Secrets + HashiCorp Vault (for production)

### Secrets by Environment

| Secret | Dev | Staging | Production |
|---|---|---|---|
| `DATABASE_URL` | GitHub Secret | Vault | Vault |
| `REDIS_URL` | GitHub Secret | Vault | Vault |
| `STRIPE_API_KEY` | Test key (secret) | Test key (vault) | Live key (vault) |
| `SENDGRID_API_KEY` | Test key | Test key | Live key |
| `AWS_ACCESS_KEY_ID` | GitHub Secret | Vault | Vault |
| `ENCRYPTION_KEY` | GitHub Secret | Vault | Vault (HSM-backed) |

### Secret Rotation Policy

| Secret Type | Rotation Cycle | Method |
|---|---|---|
| API Keys | 90 days | Automated via Vault |
| Database credentials | 180 days | Automated via Vault |
| Encryption keys | 365 days | Manual (key ceremony) |
| JWT signing keys | 90 days | Automated via Vault |

### CI Secret Access Pattern

```yaml
- name: Fetch secrets from Vault
  uses: hashicorp/vault-action@v2
  with:
    url: ${{ secrets.VAULT_URL }}
    token: ${{ secrets.VAULT_TOKEN }}
    secrets: |
      kv/data/lcos/prod/database DATABASE_URL;
      kv/data/lcos/prod/stripe STRIPE_API_KEY;
```

### Security Measures

- Never log secrets in CI output
- Mask secrets in GitHub Actions automatically
- Audit access to Vault secrets
- Rotate CI tokens regularly
- No secrets in code (use `.env.example` for shape only)
