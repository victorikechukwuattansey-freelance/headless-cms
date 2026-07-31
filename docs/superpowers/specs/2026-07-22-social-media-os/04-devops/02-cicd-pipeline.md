# CI/CD Pipeline — AI Social Media OS

| Attribute | Detail |
|---|---|
| **Platform** | Multi-tenant AI Social Media OS |
| **Repository** | Monorepo (pnpm workspaces) |
| **CI/CD** | GitHub Actions |
| **Container Registry** | Amazon ECR + Docker Hub (cache) |
| **Deployment** | Helm + ArgoCD (GitOps) |
| **Mobile** | CodePush (OTA) + Fastlane (App Store/Play Store) |

---

## 1. Monorepo Structure & Workflow Matrix

### 1.1 Repository Layout

```
smo/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # Main CI pipeline
│       ├── cd-staging.yml           # Staging deployment
│       ├── cd-production.yml        # Production deployment (approval gate)
│       ├── preview-environment.yml  # Per-branch preview environments
│       ├── database-migrations.yml  # Runway for DB migrations
│       ├── monthly-release.yml      # Monthly release automation
│       ├── security-scan.yml        # Scheduled security scanning
│       ├── slackbot-deploy.yml      # Chatops deployment trigger
│       └── cleanup.yml              # Cleanup stale preview environments
├── apps/
│   ├── api/                         # NestJS backend (main API)
│   │   ├── src/
│   │   ├── prisma/                  # Database schema + migrations
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── worker/                      # BullMQ background workers
│   │   ├── src/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── web/                         # Next.js frontend
│   │   ├── src/
│   │   ├── public/
│   │   ├── e2e/                     # Playwright tests
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── next.config.js
│   └── landing/                     # Landing page (separate deploy)
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── shared/                      # Shared types, validation schemas, utilities
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── config/                      # Shared ESLint, Prettier, TS configs
│   │   ├── eslint-preset.js
│   │   ├── tsconfig.base.json
│   │   └── package.json
│   └── ai-engine/                   # AI prompt management + model clients
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
├── deploy/
│   ├── helm/
│   │   ├── api/
│   │   │   ├── Chart.yaml
│   │   │   ├── values.yaml
│   │   │   ├── values-staging.yaml
│   │   │   ├── values-prod.yaml
│   │   │   └── templates/
│   │   ├── worker/
│   │   ├── web/
│   │   └── landing/
│   └── kustomize/                   # Alternative: Kustomize overlays
├── scripts/
│   ├── release.sh
│   ├── changelog.sh
│   └── seed-preview-db.sh
├── docker-compose.yml               # Local development
├── pnpm-workspace.yaml
├── package.json                     # Root scripts
├── turbo.json                       # Turborepo pipeline (if used)
└── nx.json                          # Nx pipeline (if used)
```

### 1.2 Workflow Matrix

| Workflow | Trigger | Apps Built | Tests | Deploy To | Time |
|---|---|---|---|---|---|
| `ci.yml` | PR to `main`/`develop`, push to branches | api, worker, web, landing | Lint, typecheck, unit, integration, container scan | — | 8-12m |
| `cd-staging.yml` | Push to `develop` | api, worker, web, landing | + E2E tests | Staging K8s | 12-18m |
| `cd-production.yml` | Push to `main` (tagged) | api, worker, web, landing | + Smoke + Perf | Prod K8s (canary) | 20-30m |
| `preview-environment.yml` | PR opened/synchronized | api, worker, web | + Seed data | Ephemeral K8s namespace | 15-20m |
| `database-migrations.yml` | On demand / CI call | — | — | Sequential: dev→staging→prod | 5-15m |
| `monthly-release.yml` | Manual / schedule | — | — | GitHub Release + Changelog | 2m |
| `security-scan.yml` | Daily + PR | — | SAST + SCA + DAST + Trivy | — | 10-15m |

---

## 2. CI Pipeline

### 2.1 Pipeline Stages

```
[Lint & Typecheck] → [Unit Tests] → [Build] → [Integration Tests] → [Container Build] → [Container Scan] → [Push Images]
```

### 2.2 Stage Details

#### Stage 1: Lint & Typecheck

```yaml
lint-typecheck:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm lint
    - run: pnpm typecheck
    - run: pnpm format:check
    - run: pnpm audit --audit-level=high
```

**Quality gates:**
- Zero ESLint errors (`.jsx`, `.tsx` — React-specific rules)
- Zero TypeScript errors (strict mode)
- No `any` type violations
- No high/critical severity vulnerabilities (`pnpm audit`)

#### Stage 2: Unit Tests

```yaml
unit-tests:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      app: [api, worker, web]
    fail-fast: false
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter ${{ matrix.app }} test:unit -- --coverage
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: coverage-${{ matrix.app }}
        path: apps/${{ matrix.app }}/coverage/
    - name: Check Coverage Threshold
      run: |
        npx istanbul check-coverage \
          --statement 80 \
          --branch 75 \
          --function 80 \
          --line 80 \
          apps/${{ matrix.app }}/coverage/coverage-final.json
```

#### Stage 3: Build

```yaml
build:
  runs-on: ubuntu-latest
  needs: [lint-typecheck, unit-tests]
  strategy:
    matrix:
      app: [api, worker, web, landing]
    fail-fast: false
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter ${{ matrix.app }} build
    - uses: actions/upload-artifact@v4
      with:
        name: build-${{ matrix.app }}
        path: apps/${{ matrix.app }}/.next  # or dist/
```

#### Stage 4: Integration Tests

```yaml
integration-tests:
  runs-on: ubuntu-latest
  needs: [build]
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_DB: smo_test
        POSTGRES_USER: smo
        POSTGRES_PASSWORD: smo_test
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432
    redis:
      image: redis:7-alpine
      options: >-
        --health-cmd "redis-cli ping"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 6379:6379
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile
    - run: pnpm --filter api test:integration
      env:
        DATABASE_URL: postgresql://smo:smo_test@localhost:5432/smo_test
        REDIS_URL: redis://localhost:6379
```

#### Stage 5: Container Build & Scan

```yaml
container-build-scan:
  runs-on: ubuntu-latest
  needs: [integration-tests]
  strategy:
    matrix:
      app: [api, worker, web, landing]
    fail-fast: false
  steps:
    - uses: actions/checkout@v4
    - uses: actions/download-artifact@v4
      with:
        name: build-${{ matrix.app }}
        path: apps/${{ matrix.app }}/dist

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Configure AWS Credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsECR
        aws-region: us-east-1

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v2

    - name: Build and Push
      uses: docker/build-push-action@v6
      with:
        context: .
        file: apps/${{ matrix.app }}/Dockerfile
        push: ${{ github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v') }}
        tags: |
          ${{ steps.login-ecr.outputs.registry }}/smo-${{ matrix.app }}:${{ github.sha }}
          ${{ steps.login-ecr.outputs.registry }}/smo-${{ matrix.app }}:latest
        cache-from: type=gha
        cache-to: type=gha,mode=max
        provenance: false

    - name: Run Trivy Scan
      uses: aquasecurity/trivy-action@master
      with:
        image-ref: ${{ steps.login-ecr.outputs.registry }}/smo-${{ matrix.app }}:${{ github.sha }}
        format: sarif
        output: trivy-results-${{ matrix.app }}.sarif
        severity: CRITICAL,HIGH
        exit-code: 1

    - name: Upload Trivy Results
      if: always()
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: trivy-results-${{ matrix.app }}.sarif
```

---

## 3. CD Pipeline

### 3.1 Staging Deployment (Push to `develop`)

```
[CI Passes] → [Deploy to Staging K8s] → [E2E Tests] → [Smoke Tests] → [Notify Slack]
```

```yaml
# .github/workflows/cd-staging.yml (partial)
deploy-staging:
  runs-on: ubuntu-latest
  needs: [lint-typecheck, unit-tests, integration-tests, container-build-scan]
  environment: staging
  concurrency: staging
  steps:
    - uses: actions/checkout@v4

    - name: Configure AWS Credentials
      uses: aws-actions/configure-aws-credentials@v4
      with:
        role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsDeploy
        aws-region: us-east-1

    - name: Update kubeconfig
      run: aws eks update-kubeconfig --name smo-staging --region us-east-1

    - name: Deploy via Helm
      run: |
        helm upgrade --install smo-api deploy/helm/api \
          --namespace smo-staging \
          --values deploy/helm/api/values.yaml \
          --values deploy/helm/api/values-staging.yaml \
          --set image.tag=${{ github.sha }} \
          --set image.repository=${{ secrets.ECR_REGISTRY }}/smo-api

    - name: Verify Deployment
      run: |
        kubectl rollout status deployment/smo-api -n smo-staging --timeout=300s
        kubectl rollout status deployment/smo-worker -n smo-staging --timeout=300s

    - name: Run E2E Tests
      run: pnpm --filter web test:e2e
      env:
        BASE_URL: https://staging.smo.com

    - name: Run Smoke Tests
      run: pnpm --filter api test:smoke
      env:
        API_BASE_URL: https://api.staging.smo.com

    - name: Notify Slack
      uses: slackapi/slack-github-action@v1
      with:
        payload: '{"text": "✅ Staging deployed: <${{ github.server_url }}/${{ github.repository }}/commit/${{ github.sha }}|${{ github.sha }}>"}'
      env:
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_STAGING }}
```

### 3.2 Production Deployment (Push to `main` with tag)

```
[CI Passes] → [Canary Deploy (10%)] → [Smoke] → [Scale to 50%] → [Smoke] → [Full Rollout] → [Post-Deploy Tests] → [Slack + Datadog]
```

```yaml
# .github/workflows/cd-production.yml (partial)
deploy-production:
  runs-on: ubuntu-latest
  needs: [ci-pass]
  environment:
    name: production
    url: https://app.smo.com
  concurrency: production
  steps:
    - uses: actions/checkout@v4
    - name: Configure AWS & kubectl
      # ... same as staging

    - name: Canary Deploy (10%)
      run: |
        helm upgrade --install smo-api deploy/helm/api \
          --namespace smo-prod \
          --values deploy/helm/api/values.yaml \
          --values deploy/helm/api/values-prod.yaml \
          --set image.tag=${{ github.ref_name }} \
          --set canary.enabled=true \
          --set canary.weight=10

    - name: Wait & Monitor Canary
      run: |
        sleep 120  # Let canary bake for 2 minutes
        # Check error rate threshold
        ERROR_RATE=$(curl -s "https://api.datadoghq.com/api/v1/query" \
          -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
          --data-urlencode "query=avg:smo.api.error_rate{*}.rollup(avg, 60)" | \
          jq '.series[0].pointlist[-1][1]')
        if (( $(echo "$ERROR_RATE > 0.01" | bc -l) )); then
          echo "Error rate exceeded 1%. Rolling back canary."
          exit 1
        fi

    - name: Promote to 50%
      run: |
        helm upgrade --install smo-api deploy/helm/api \
          --namespace smo-prod \
          --set canary.weight=50

    - name: Wait & Monitor
      run: sleep 120

    - name: Full Rollout
      run: |
        helm upgrade --install smo-api deploy/helm/api \
          --namespace smo-prod \
          --set canary.enabled=false

    - name: Post-Deploy Smoke
      run: pnpm --filter api test:smoke
      env:
        API_BASE_URL: https://api.smo.com

    - name: Datadog Deployment Marker
      run: |
        curl -X POST "https://api.datadoghq.com/api/v1/events" \
          -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
          -H "Content-Type: application/json" \
          -d '{
            "title": "Deployment: smo-api v${{ github.ref_name }}",
            "text": "Deployed to production. Commit: ${{ github.sha }}",
            "priority": "normal",
            "alert_type": "success",
            "tags": ["application:smo-api", "environment:production"]
          }'
```

### 3.3 Blue/Green Deployment Strategy (Alternative)

For major releases with schema changes where zero-downtime is critical:

```yaml
# Blue/Green workflow approach
blue-green-deploy:
  steps:
    - name: Deploy Green Environment
      run: |
        helm upgrade --install smo-api-green deploy/helm/api \
          --set deployment.name=smo-api-green \
          --set image.tag=${{ github.ref_name }}

    - name: Test Green Environment
      run: |
        GREEN_URL=$(kubectl get svc smo-api-green -n smo-prod -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
        pnpm --filter api test:smoke -- --base-url=https://$GREEN_URL

    - name: Switch Traffic to Green
      run: |
        kubectl patch svc smo-api -n smo-prod -p \
          '{"spec":{"selector":{"app":"smo-api-green"}}}'

    - name: Scale Down Blue
      run: |
        kubectl scale deployment smo-api-blue -n smo-prod --replicas=0

    - name: Clean Up Old Green (rename for next cycle)
      run: |
        kubectl delete svc smo-api-green -n smo-prod
```

---

## 4. Database Migration Pipeline

### 4.1 Migration Strategy

| Tool | Purpose |
|---|---|
| Prisma Migrate | Schema migrations (NestJS + PostgreSQL) |
| Runway (by Prisma) | Safe, zero-downtime deployment migrations |
| `prisma migrate deploy` | Apply pending migrations |
| `prisma migrate resolve` | Mark migrations as applied/rolled back |

### 4.2 Migration Workflow

```yaml
# .github/workflows/database-migrations.yml
name: Database Migrations
on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      DATABASE_URL:
        required: true

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile

      - name: Run Pre-Migration Checks
        run: |
          # Check for destructive operations
          pnpm --filter api prisma migrate diff \
            --from-url "${{ secrets.DATABASE_URL }}" \
            --to-schema-datamodel apps/api/prisma/schema.prisma \
            --exit-code

      - name: Apply Migrations
        id: migrate
        run: |
          pnpm --filter api prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Verify Migration
        if: steps.migrate.outcome == 'success'
        run: |
          pnpm --filter api prisma migrate status
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Notify
        if: always()
        run: |
          echo "Migration ${{ job.status }} on ${{ inputs.environment }}"
```

### 4.3 Rollback Procedure

```yaml
rollback-migration:
  steps:
    - name: Rollback Last Migration
      run: |
        # Prisma doesn't support automatic rollback for data migrations.
        # Each migration should be reversible. Manual rollback example:
        pnpm --filter api prisma migrate resolve --rolled-back "<migration_name>"

    - name: Apply Previous Version
      run: |
        # Re-deploy previous application version
        helm rollback smo-api -n smo-prod --revision=$((CURRENT-1))

    - name: Verify Rollback
      run: |
        # Run pre-deployment smoke tests
        pnpm --filter api test:smoke
```

### 4.4 Migration Safety Rules

| Check | Enforcement | Action on Failure |
|---|---|---|
| No `DROP COLUMN` without `--allow-destructive` | Pre-migration check | Block deploy |
| No `RENAME COLUMN` (add new + migrate data instead) | Pre-migration check | Block deploy |
| Migration runs in explicit transaction | Prisma default | Auto-fail |
| New columns must be nullable or have defaults | Pre-migration check | Block deploy |
| Index creation must use `CONCURRENTLY` | Pre-migration check | Flag warning |
| Back-fill data migrations must be idempotent | Code review | Block deploy |

---

## 5. Preview Environments

### 5.1 Architecture

```
PR #123 → GitHub Action
    │
    ├── Generate unique namespace: smo-pr-123
    ├── Create K8s namespace
    ├── Deploy api, worker, web (PR image tags)
    ├── Spin up ephemeral PostgreSQL (Cloud SQL snapshot)
    ├── Run seed data script
    └── Comment PR with:
        ├── 🌐 Frontend: https://pr-123.smo.preview.dev
        ├── 🔌 API: https://api.pr-123.smo.preview.dev
        └── 🗄️ Database: ephemeral (destroyed on close)
```

### 5.2 Preview Workflow

```yaml
# .github/workflows/preview-environment.yml
name: Preview Environment
on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]

jobs:
  deploy-preview:
    if: |
      (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository) ||
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '/preview'))
    runs-on: ubuntu-latest
    environment: preview
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile

      - name: Build All Apps
        run: pnpm build

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsPreview
          aws-region: us-east-1

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build & Push Preview Images
        run: |
          PR_NUMBER=${{ github.event.pull_request.number || github.event.issue_number }}
          for app in api worker web; do
            docker build -t $ECR_REGISTRY/smo-$app:pr-$PR_NUMBER -f apps/$app/Dockerfile .
            docker push $ECR_REGISTRY/smo-$app:pr-$PR_NUMBER
          done

      - name: Deploy Preview Namespace
        run: |
          PR_NUMBER=${{ github.event.pull_request.number || github.event.issue_number }}
          kubectl create namespace smo-pr-$PR_NUMBER --dry-run=client -o yaml | kubectl apply -f -

          # Deploy each service
          for app in api worker web; do
            helm upgrade --install smo-$app deploy/helm/$app \
              --namespace smo-pr-$PR_NUMBER \
              --set image.tag=pr-$PR_NUMBER \
              --set preview.enabled=true \
              --set preview.prNumber=$PR_NUMBER
          done

      - name: Seed Preview Database
        run: |
          PR_NUMBER=${{ github.event.pull_request.number || github.event.issue_number }}
          # Spin up ephemeral DB or clone latest snapshot
          ./scripts/seed-preview-db.sh smo-pr-$PR_NUMBER

      - name: Wait for Rollout
        run: |
          PR_NUMBER=${{ github.event.pull_request.number || github.event.issue_number }}
          kubectl rollout status deployment/smo-api -n smo-pr-$PR_NUMBER --timeout=300s
          kubectl rollout status deployment/smo-web -n smo-pr-$PR_NUMBER --timeout=300s

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const prNumber = context.issue.number;
            github.rest.issues.createComment({
              issue_number: prNumber,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## 🚀 Preview Environment Ready\n\n` +
                    `| Service | URL |\n` +
                    `|---|---|\n` +
                    `| Frontend | https://pr-${prNumber}.smo.preview.dev |\n` +
                    `| API | https://api.pr-${prNumber}.smo.preview.dev |\n` +
                    `| Database | ephemeral (data from latest staging snapshot) |\n\n` +
                    `⏳ Auto-destroyed when PR is closed.`
            });

  cleanup-preview:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    steps:
      - name: Delete Preview Namespace
        run: |
          PR_NUMBER=${{ github.event.pull_request.number }}
          kubectl delete namespace smo-pr-$PR_NUMBER --ignore-not-found
          echo "Preview environment pr-$PR_NUMBER destroyed."
```

---

## 6. Quality Gates

### 6.1 Gate Criteria

| Gate | Tool | Pass/Fail | Blocking | Env |
|---|---|---|---|---|
| **Test Coverage** | Istanbul + Jest | ≥80% stmts, ≥75% branch | Yes (CI) | All |
| **Security Scan** | Trivy | 0 CRITICAL/HIGH | Yes (CI) | All |
| **License Compliance** | FOSSA / `pnpm licenses` | No GPL/AGPL in prod | Yes (CI) | All |
| **Performance Budget** | Lighthouse CI | < 3s LCP, < 50ms API P95 | Warning (CI), Block (CD) | Staging+Prod |
| **Bundle Size** | `size-limit` | Each entry < 250KB gzip | Yes (CI) | All |
| **API Contract Breaking** | OpenAPI diff | No breaking changes | Warning (Staging), Block (Prod) | Staging+Prod |
| **Migration Safety** | Migration analyzer | No destructive ops | Yes (CD) | Prod |
| **Code Quality** | CodeRabbit / SonarQube | No blocker/critical issues | Warning (CI) | All |
| **Dependency Freshness** | Dependabot | No critical unpatched vulns | Yes (CI weekly) | All |
| **Container Size** | Trivy | < 500MB per image | Warning (CI) | All |

### 6.2 Performance Budget Configuration

```javascript
// apps/web/lighthouserc.js
module.exports = {
  ci: {
    collect: {
      url: [
        'https://staging.smo.com/',
        'https://staging.smo.com/posts',
        'https://staging.smo.com/analytics'
      ],
      settings: {
        preset: 'desktop',
        throttling: { cpuSlowdownMultiplier: 2 }
      }
    },
    assert: {
      assertions: {
        'first-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 200 }],
        'interactive': ['warn', { maxNumericValue: 5000 }],
        'speed-index': ['warn', { maxNumericValue: 4000 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
```

---

## 7. Release Strategy

### 7.1 Semantic Versioning

| Component | Version Scheme | Examples |
|---|---|---|
| Backend API | Semver (strict) | `v2.5.0`, `v2.5.1`, `v3.0.0` |
| Frontend | Semver (minor patches only) | `v1.2.0`, `v1.2.1` |
| Worker | Matches API version | `v2.5.0` |
| Shared packages | Semver | `v0.4.0` |
| Helm charts | Semver (independent) | `api-1.3.0` |

### 7.2 Release Cadence

| Release Type | Cadence | Branch | Changelog |
|---|---|---|---|
| **Patch** (bug fixes) | As needed | `main` → tag | `fix:` commits |
| **Minor** (features) | Bi-weekly | `develop` → `main` | `feat:` + `fix:` commits |
| **Major** (breaking) | Quarterly | `develop` → `main` with approval | Full changelog + migration guide |

### 7.3 Automated Changelog & Release

```yaml
# .github/workflows/monthly-release.yml
name: Create Release
on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version bump (patch, minor, major)'
        required: true
        default: 'minor'

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Generate Changelog
        id: changelog
        uses: conventional-changelog/action@v1
        with:
          output-file: CHANGELOG.md
          release-count: 10
          skip-commit: true

      - name: Bump Version
        id: bump
        run: |
          git config user.name "Release Bot"
          git config user.email "bot@smo.com"
          npm version ${{ github.event.inputs.version }} --no-git-tag-version
          NEW_VERSION=$(node -p "require('./lerna.json').version || require('./package.json').version")
          echo "version=v$NEW_VERSION" >> $GITHUB_OUTPUT

      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v7
        with:
          commit-message: "chore: bump version to ${{ steps.bump.outputs.version }}"
          title: "Release ${{ steps.bump.outputs.version }}"
          body: ${{ steps.changelog.outputs.changelog }}
          branch: release/${{ steps.bump.outputs.version }}
          base: main

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        if: github.event.inputs.version != 'prerelease'
        with:
          tag_name: ${{ steps.bump.outputs.version }}
          body: ${{ steps.changelog.outputs.changelog }}
          generate_release_notes: true
```

### 7.4 Commit Convention

```
<type>(<scope>): <description>

Types: feat, fix, chore, docs, style, refactor, perf, test, ci, security
Scopes: api, web, worker, shared, ai, deploy, helm, migrations

Examples:
  feat(api): add scheduled post publishing endpoint
  fix(web): correct timezone rendering in calendar view
  security(api): sanitize prompt injection vectors in AI endpoint
  ci(deploy): add canary analysis step to prod deployment
  perf(worker): optimize batch post queuing for high-throughput tenants
```

---

## 8. CI/CD for Mobile Apps

### 8.1 OTA Updates (CodePush)

For React Native or Capacitor-based companion apps:

```yaml
mobile-codepush:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
      with:
        version: 9
    - uses: actions/setup-node@v4
      with:
        node-version: "20"
        cache: "pnpm"
    - run: pnpm install --frozen-lockfile

    - name: Build Mobile Bundle
      run: pnpm --filter mobile build

    - name: Publish OTA Update (Staging)
      run: |
        npx appcenter codepush release-react \
          -a smo/mobile-app \
          -d Staging \
          -m \
          --description "${{ github.event.head_commit.message }}"

    - name: Publish OTA Update (Production)
      if: startsWith(github.ref, 'refs/tags/v')
      run: |
        npx appcenter codepush release-react \
          -a smo/mobile-app \
          -d Production \
          -m \
          --description "Release ${{ github.ref_name }}"
```

### 8.2 App Store / Play Store Deployment

```yaml
mobile-store-deploy:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v4
    - uses: ruby/setup-ruby@v1
      with:
        ruby-version: "3.3"

    - name: Install Fastlane
      run: gem install fastlane

    - name: Deploy to TestFlight
      run: |
        fastlane ios beta
      env:
        MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
        APP_STORE_CONNECT_API_KEY: ${{ secrets.APP_STORE_CONNECT_API_KEY }}

    - name: Deploy to Play Store (Internal Track)
      run: |
        fastlane android internal
      env:
        PLAY_STORE_SERVICE_ACCOUNT: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT }}

    - name: Promote to Production
      if: startsWith(github.ref, 'refs/tags/v')
      run: |
        fastlane ios release
        fastlane android production
```

### 8.3 Mobile CI Matrix

```yaml
mobile-ci:
  strategy:
    matrix:
      platform: [ios, android]
    fail-fast: false
  steps:
    - uses: actions/checkout@v4
    - name: Setup
      run: |
        if [ "${{ matrix.platform }}" = "ios" ]; then
          bundle exec pod install --project-directory=apps/mobile/ios
        fi

    - name: Unit Tests
      run: pnpm --filter mobile test:unit -- --platform=${{ matrix.platform }}

    - name: Build
      run: pnpm --filter mobile build -- --platform=${{ matrix.platform }}

    - name: Upload Artifact
      uses: actions/upload-artifact@v4
      with:
        name: mobile-${{ matrix.platform }}
        path: apps/mobile/build/
```

---

## 9. Complete Sample Workflow

Below is the complete, production-ready CI/CD workflow for the main application (API + Worker + Web):

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [develop, main]
    tags: ["v*"]
  pull_request:
    branches: [develop, main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"
  PNPM_VERSION: "9"
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}

jobs:
  lint-typecheck:
    name: Lint & Typecheck
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm format:check
      - run: pnpm audit --audit-level=high

  unit-tests:
    name: Unit Tests
    needs: lint-typecheck
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, worker, web, shared]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Run Tests
        run: pnpm --filter ${{ matrix.app }} test:unit -- --coverage
        env:
          CI: true
      - name: Check Coverage Thresholds
        run: |
          npx istanbul check-coverage \
            --statement 80 --branch 75 --function 80 --line 80 \
            apps/${{ matrix.app }}/coverage/coverage-final.json
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage-${{ matrix.app }}
          path: apps/${{ matrix.app }}/coverage/

  build:
    name: Build
    needs: unit-tests
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, worker, web, landing]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter ${{ matrix.app }} build
      - uses: actions/upload-artifact@v4
        with:
          name: build-${{ matrix.app }}
          path: |
            apps/${{ matrix.app }}/dist
            apps/${{ matrix.app }}/.next
          if-no-files-found: error

  integration-tests:
    name: Integration Tests
    needs: build
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: smo_test
          POSTGRES_USER: smo
          POSTGRES_PASSWORD: smo_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Run API Integration Tests
        run: pnpm --filter api test:integration
        env:
          DATABASE_URL: postgresql://smo:smo_test@localhost:5432/smo_test
          REDIS_URL: redis://localhost:6379
          NODE_ENV: test

  security-scan:
    name: Security Scan
    needs: build
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, worker, web]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: pnpm
      - run: pnpm install --frozen-lockfile

      - name: SAST (Semgrep)
        uses: semgrep/semgrep-action@v1
        with:
          config: >
            p/typescript
            p/owasp-top-ten
            p/expressjs
          auditOn: push

      - name: SCA (Dependabot)
        run: |
          # Dependabot runs independently; verify lockfile integrity
          pnpm audit --audit-level=high

      - name: Secret Scanning (truffleHog)
        uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified --results=verified.json

  container-build:
    name: Container Build
    needs: [integration-tests, security-scan]
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, worker, web, landing]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/download-artifact@v4
        with:
          name: build-${{ matrix.app }}
          path: apps/${{ matrix.app }}/dist

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsECR
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Docker Metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ steps.login-ecr.outputs.registry }}/smo-${{ matrix.app }}
          tags: |
            type=sha,prefix=sha-
            type=ref,event=branch
            type=ref,event=pr
            type=semver,pattern={{version}}
            type=semver,pattern={{major}}.{{minor}}
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build & Push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: apps/${{ matrix.app }}/Dockerfile
          push: ${{ github.ref == 'refs/heads/develop' || github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v') }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          provenance: false

      - name: Container Scan (Trivy)
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.login-ecr.outputs.registry }}/smo-${{ matrix.app }}:${{ steps.meta.outputs.version }}
          format: sarif
          output: trivy-${{ matrix.app }}.sarif
          severity: CRITICAL,HIGH
          exit-code: 1
          ignore-unfixed: true
          vuln-type: os,library

      - name: Upload Trivy SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: trivy-${{ matrix.app }}.sarif

      - name: SBOM Generation
        uses: anchore/sbom-action@v0
        with:
          image: ${{ steps.login-ecr.outputs.registry }}/smo-${{ matrix.app }}:${{ steps.meta.outputs.version }}
          format: cyclonedx-json
          output-file: sbom-${{ matrix.app }}.cdx.json

  # ─── Deployment ──────────────────────────────────────────────────────────────

  deploy-staging:
    name: Deploy to Staging
    if: github.ref == 'refs/heads/develop'
    needs: container-build
    runs-on: ubuntu-latest
    environment:
      name: staging
      url: https://staging.smo.com
    concurrency: staging
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsDeploy
          aws-region: ${{ env.AWS_REGION }}
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name smo-staging --region ${{ env.AWS_REGION }}
      - name: Run Migrations
        run: |
          helm upgrade --install smo-migrations deploy/helm/migrations \
            --namespace smo-staging \
            --set image.tag=${{ github.sha }}
          kubectl wait --for=condition=complete job/smo-migrations -n smo-staging --timeout=300s
      - name: Deploy API
        run: |
          helm upgrade --install smo-api deploy/helm/api \
            --namespace smo-staging \
            --values deploy/helm/api/values.yaml \
            --values deploy/helm/api/values-staging.yaml \
            --set image.tag=${{ github.sha }}
      - name: Deploy Worker
        run: |
          helm upgrade --install smo-worker deploy/helm/worker \
            --namespace smo-staging \
            --values deploy/helm/worker/values.yaml \
            --values deploy/helm/worker/values-staging.yaml \
            --set image.tag=${{ github.sha }}
      - name: Deploy Web
        run: |
          helm upgrade --install smo-web deploy/helm/web \
            --namespace smo-staging \
            --values deploy/helm/web/values.yaml \
            --values deploy/helm/web/values-staging.yaml \
            --set image.tag=${{ github.sha }}
      - name: Verify Rollouts
        run: |
          kubectl rollout status deployment/smo-api -n smo-staging --timeout=300s
          kubectl rollout status deployment/smo-worker -n smo-staging --timeout=300s
          kubectl rollout status deployment/smo-web -n smo-staging --timeout=300s
      - name: E2E Tests
        run: |
          npx wait-on https://staging.smo.com/api/health
          pnpm --filter web test:e2e
        env:
          BASE_URL: https://staging.smo.com
          API_BASE_URL: https://api.staging.smo.com
      - name: Lighthouse CI
        run: |
          npm install -g @lhci/cli
          lhci autorun --config=apps/web/lighthouserc.js
      - name: Notify
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text":":white_check_mark: *Staging* deployed: `${{ github.sha }}` | <https://staging.smo.com|staging.smo.com>"}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_STAGING }}

  deploy-production:
    name: Deploy to Production
    if: startsWith(github.ref, 'refs/tags/v')
    needs: container-build
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.smo.com
    concurrency: production
    steps:
      - uses: actions/checkout@v4
      - name: Configure AWS
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ secrets.AWS_ACCOUNT_ID }}:role/GitHubActionsDeployProd
          aws-region: ${{ env.AWS_REGION }}
      - name: Update kubeconfig
        run: aws eks update-kubeconfig --name smo-prod --region ${{ env.AWS_REGION }}
      - name: Pre-Deploy Smoke Test
        run: |
          curl -f -s -o /dev/null -w "%{http_code}" https://app.smo.com/api/health | grep 200
      - name: Run Migrations
        run: |
          helm upgrade --install smo-migrations deploy/helm/migrations \
            --namespace smo-prod \
            --set image.tag=${{ github.ref_name }} \
            --set migration.safe=true
          kubectl wait --for=condition=complete job/smo-migrations -n smo-prod --timeout=300s
      - name: Canary Deploy (10%)
        id: canary
        run: |
          helm upgrade --install smo-api deploy/helm/api \
            --namespace smo-prod \
            --values deploy/helm/api/values.yaml \
            --values deploy/helm/api/values-prod.yaml \
            --set image.tag=${{ github.ref_name }} \
            --set canary.enabled=true \
            --set canary.weight=10
          sleep 180  # Let canary bake
      - name: Analyze Canary
        run: |
          ERROR_RATE=$(curl -s -G "https://api.datadoghq.com/api/v1/query" \
            -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
            -H "DD-APPLICATION-KEY: ${{ secrets.DD_APP_KEY }}" \
            --data-urlencode "query=avg:smo.api.error_rate{canary:true}.rollup(avg, 60)" | \
            jq -r '.series[0].pointlist[-1][1] // "0"')
          LATENCY_P99=$(curl -s -G "https://api.datadoghq.com/api/v1/query" \
            -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
            -H "DD-APPLICATION-KEY: ${{ secrets.DD_APP_KEY }}" \
            --data-urlencode "query:p99:smo.api.latency{canary:true}.rollup(avg, 60)" | \
            jq -r '.series[0].pointlist[-1][1] // "0"')
          echo "Canary error rate: $ERROR_RATE%, p99 latency: ${LATENCY_P99}ms"
          if (( $(echo "$ERROR_RATE > 0.5" | bc -l) )); then
            echo "Error rate exceeds threshold. Triggering rollback..."
            helm rollback smo-api -n smo-prod
            exit 1
          fi
      - name: Full Rollout
        run: |
          helm upgrade --install smo-api deploy/helm/api \
            --namespace smo-prod \
            --values deploy/helm/api/values.yaml \
            --values deploy/helm/api/values-prod.yaml \
            --set image.tag=${{ github.ref_name }} \
            --set canary.enabled=false
          helm upgrade --install smo-worker deploy/helm/worker \
            --namespace smo-prod \
            --values deploy/helm/worker/values.yaml \
            --values deploy/helm/worker/values-prod.yaml \
            --set image.tag=${{ github.ref_name }}
          helm upgrade --install smo-web deploy/helm/web \
            --namespace smo-prod \
            --values deploy/helm/web/values.yaml \
            --values deploy/helm/web/values-prod.yaml \
            --set image.tag=${{ github.ref_name }}
      - name: Verify Rollouts
        run: |
          for deploy in smo-api smo-worker smo-web; do
            kubectl rollout status deployment/$deploy -n smo-prod --timeout=300s
          done
      - name: Post-Deploy Smoke
        run: |
          pnpm --filter api test:smoke
          pnpm --filter web test:smoke
        env:
          API_BASE_URL: https://api.smo.com
      - name: Datadog Deployment Event
        run: |
          curl -X POST "https://api.datadoghq.com/api/v1/events" \
            -H "DD-API-KEY: ${{ secrets.DD_API_KEY }}" \
            -H "DD-APPLICATION-KEY: ${{ secrets.DD_APP_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "title": "Release ${{ github.ref_name }} deployed to production",
              "text": "Commit: ${{ github.sha }}<br>Deployed by: ${{ github.actor }}",
              "priority": "normal",
              "alert_type": "success",
              "tags": ["app:smo", "env:production", "release:${{ github.ref_name }}"]
            }'
      - name: Notify
        uses: slackapi/slack-github-action@v1
        with:
          payload: '{"text":":rocket: *Production* release `${{ github.ref_name }}` deployed! <https://app.smo.com|app.smo.com> | <${{ github.server_url }}/${{ github.repository }}/releases/tag/${{ github.ref_name }}|Changelog>"}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_PROD }}
```

---

## 10. Runbooks

### 10.1 Rollback Procedure

```bash
# Quick rollback (last revision)
kubectl rollout undo deployment/smo-api -n smo-prod
kubectl rollout status deployment/smo-api -n smo-prod --timeout=300s

# Rollback to specific revision
helm rollback smo-api -n smo-prod --revision 42

# Database rollback (if migration caused the issue)
# 1. Revert migration
pnpm --filter api prisma migrate resolve --rolled-back "20240722000000_add_scheduling"
# 2. Re-deploy previous app version
helm rollback smo-api -n smo-prod
# 3. Verify
pnpm --filter api test:smoke
```

### 10.2 CI Failure Recovery

| Symptom | Likely Cause | Action |
|---|---|---|
| `pnpm install` fails | Lockfile mismatch | Run `pnpm install --frozen-lockfile` locally, commit lockfile |
| TypeScript error | Breaking API change | Fix or suppress with `@ts-expect-error` (temporary) |
| Integration test timeout | DB connection | Verify service health: `docker ps`, check port mapping |
| Trivy scan fails | Vulnerability in dependency | Update dependency, or add to `.trivyignore` with justification |
| E2E test fails | UI regression | Check Playwright screenshots in artifacts |
| Helm deploy fails | Invalid values | Run `helm template --debug` locally |
| Migration fails | Destructive change | Review migration SQL, fix and create new migration |

### 10.3 Deployment Checklist

- [ ] All CI gates pass
- [ ] Database migration reviewed for safety
- [ ] Canary analysis completed (prod only)
- [ ] Smoke tests pass against deployed environment
- [ ] Changelog updated
- [ ] Release notes reviewed
- [ ] Rollback plan confirmed
- [ ] Datadog monitors acknowledged
- [ ] Slack notified
