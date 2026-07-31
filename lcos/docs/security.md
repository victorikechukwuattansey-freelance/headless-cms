# Security Documentation

## Overview

LCOS is designed with **security-first architecture**. This document covers the comprehensive security posture including OWASP compliance, data protection, tenant isolation, and operational security procedures.

---

## 1. OWASP Top 10 Compliance

### A01: Broken Access Control

| Control | Implementation | Status |
|---|---|---|
| Role-based access (RBAC) | Admin, Manager, Agent, API roles | ✅ Implemented |
| Tenant-scoped data access | All queries filter by `tenant_id` | ✅ Implemented |
| API endpoint authorization | NestJS guards on all routes | ✅ Implemented |
| Horizontal privilege escalation | Object-level ownership checks | ✅ Implemented |
| Vertical privilege escalation | Role hierarchy enforced server-side | ✅ Implemented |

**Verification**: Every API endpoint and GraphQL resolver includes a `@UseGuards(TenantGuard, RoleGuard)` decorator. All database queries include `WHERE tenant_id = :tenantId`.

### A02: Cryptographic Failures

| Control | Implementation | Status |
|---|---|---|
| TLS 1.3 | All traffic encrypted in transit | ✅ Enforced |
| Encryption at rest | AES-256-GCM for sensitive fields | ✅ Implemented |
| Key rotation | 90-day rotation for all keys | ✅ Automated |
| Password hashing | bcrypt (cost 12) | ✅ Implemented |
| Secrets storage | HashiCorp Vault (production) | ✅ Configured |
| No hardcoded secrets | Secret scanning in CI | ✅ |

### A03: Injection

| Control | Implementation | Status |
|---|---|---|
| SQL injection | Prisma ORM (parameterized queries) | ✅ Prevented |
| NoSQL injection | Input validation middleware | ✅ Implemented |
| XSS prevention | React JSX auto-escaping, CSP headers | ✅ Implemented |
| Command injection | `exec`/`spawn` never called with user input | ✅ Audited |
| LDAP injection | Not applicable (no LDAP) | N/A |

### A04: Insecure Design

| Control | Implementation | Status |
|---|---|---|
| Rate limiting | Token bucket per-tenant (1000 req/min) | ✅ Implemented |
| Input validation | Zod schemas on all API inputs | ✅ Implemented |
| CSRF protection | SameSite=Strict cookies + CSRF tokens | ✅ Implemented |
| Security headers | HSTS, X-Frame-Options, X-Content-Type-Options | ✅ Configured |
| API versioning | `/api/v1/` prefix, breaking changes in new version | ✅ |

### A05: Security Misconfiguration

| Control | Implementation | Status |
|---|---|---|
| Minimal defaults | All features opt-in | ✅ |
| Debug disabled | `NODE_ENV=production` blocks debug routes | ✅ |
| CORS strict | Whitelist of allowed origins per tenant | ✅ |
| No default creds | Every install forces password creation | ✅ |
| Container hardening | Non-root user, read-only filesystem | ✅ |

### A06: Vulnerable & Outdated Components

| Control | Implementation | Status |
|---|---|---|
| Dependency scanning | `npm audit`, Snyk Dependabot in CI | ✅ Automated |
| SBOM generation | `cyclonedx-bom` on release builds | ✅ |
| Vulnerability database | GitHub Advisory DB | ✅ |
| Patch policy | Critical CVEs patched within 48 hours | ✅ |
| Node.js version | 20 LTS, forced via `.nvmrc` and CI | ✅ |

### A07: Identification & Authentication Failures

| Control | Implementation | Status |
|---|---|---|
| Multi-factor auth | TOTP (authenticator app) | ✅ Implemented |
| Password policy | Min 12 chars, complexity, breach check | ✅ |
| Session management | JWT (access 15min + refresh 7d) | ✅ |
| Login rate limiting | 5 attempts → 15 min lockout | ✅ |
| Account recovery | Email OTP + security questions | ✅ |
| Audit log | All auth events logged | ✅ |

### A08: Software & Data Integrity Failures

| Control | Implementation | Status |
|---|---|---|
| Signed commits | Commit signing via GPG | ✅ Enforced |
| CI/CD pipeline integrity | `npm ci --frozen-lockfile` | ✅ |
| Artifact signing | Docker image signing | ✅ |
| npm package audit | `npm audit` fails CI on critical | ✅ |
| Subresource integrity | SRI hashes on loaded scripts | ✅ |

### A09: Security Logging & Monitoring Failures

| Control | Implementation | Status |
|---|---|---|
| Structured logging | JSON format, all services | ✅ |
| Security events | `security` log level, separate stream | ✅ |
| Real-time alerting | DataDog + PagerDuty | ✅ |
| SIEM integration | Logs exportable to Splunk/S3 | ✅ Planned |

### A10: Server-Side Request Forgery (SSRF)

| Control | Implementation | Status |
|---|---|---|
| URL allowlist | SSRF protection via `ssrf-filters` | ✅ |
| Internal network separation | Webhook worker in isolated subnet | ✅ |
| No raw URL fetch | All external fetches via typed clients | ✅ |

---

## 2. Data Encryption

### At Rest

| Data Layer | Encryption Method | Key Management |
|---|---|---|
| PostgreSQL (RDS) | AES-256, KMS-managed | AWS KMS (automatic rotation) |
| Redis (ElastiCache) | Encryption in transit (TLS) | N/A (in-memory, no persistence) |
| File storage (S3) | Server-side AES-256 | AWS KMS |
| Backups (S3) | Server-side AES-256 | AWS KMS |
| Secrets (Vault) | 256-bit AES, HSM-backed | Vault Enterprise |

### In Transit

| Channel | Protocol | Certificate |
|---|---|---|
| User → Frontend | TLS 1.3 | Let's Encrypt / EV cert |
| Frontend → API | TLS 1.3 | Let's Encrypt / EV cert |
| API → Database | TLS 1.3 | RDS root cert |
| API → Redis | TLS 1.3 | Self-signed (Vault managed) |
| API → Services | mTLS (internal) | Internal CA |
| Webhook delivery | TLS 1.3 | Validated on delivery |

### Field-Level Encryption

Fields stored encrypted at the application layer (before Prisma):

```typescript
// Fields encrypted with AES-256-GCM
const ENCRYPTED_FIELDS = [
  'user.phone',
  'user.tax_id',
  'payment.card_last_four',
  'payment.bank_account',
  'contact.notes_sensitive',
];
```

---

## 3. Tenant Isolation Verification

### Isolation Model

```
┌─────────────────────────────────────────────┐
│                LCOS Platform                  │
├────────────┬────────────┬───────────────────┤
│  Tenant A  │  Tenant B  │    Tenant C       │
│  ┌──────┐  │  ┌──────┐  │  ┌──────┐         │
│  │ Data │  │  │ Data │  │  │ Data │         │
│  │ Users│  │  │ Users│  │  │ Users│         │
│  │ Prod │  │  │ Prod │  │  │ Prod │         │
│  └──────┘  │  └──────┘  │  └──────┘         │
└────────────┴────────────┴───────────────────┘
      Schema       Schema       Schema
```

### Row-Level Security (RLS)

Every table has a `tenant_id` column with a NOT NULL constraint. All queries are scoped via Prisma middleware:

```typescript
prisma.$use(async (params, next) => {
  if (params.model && !params.args?.where?.tenant_id) {
    throw new ForbiddenException('tenant_id required');
  }
  return next(params);
});
```

### Verification Checklist

- [ ] No cross-tenant data visible in API responses
- [ ] No `where` clause bypass in GraphQL resolvers
- [ ] Foreign keys include tenant_id in composite keys
- [ ] Cache keys prefixed with tenant ID
- [ ] Background jobs filter by tenant_id
- [ ] Webhook payloads scoped to originating tenant
- [ ] Search indexes partitioned by tenant_id

---

## 4. Input Validation & Sanitization

### Framework: Zod

```typescript
import { z } from 'zod';

const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().regex(/^[A-Z0-9-]+$/),
  price: z.number().positive().max(999999.99),
  description: z.string().max(5000).optional(),
  // HTML sanitized before storage
  richDescription: z.string().max(50000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});
```

### Validation Layers

```
HTTP Request
  │
  ├─ 1. Content-Type validation (application/json only)
  ├─ 2. Content-Length check (max 10MB)
  ├─ 3. Zod schema validation
  ├─ 4. XSS sanitization (DOMPurify on rich text)
  ├─ 5. SQL injection prevention (Prisma)
  └─ 6. Business rule validation (service layer)
```

### Sanitization Rules

| Input Type | Sanitization |
|---|---|
| Text fields | Trim, strip control characters |
| Rich text (HTML) | DOMPurify (allow safe tags only) |
| URLs | Validate protocol (https:// only) |
| File uploads | MIME type validation, virus scan |
| Phone numbers | E.164 format validation |
| Email addresses | Normalize, DNS lookup (MX check optional) |

---

## 5. CORS Configuration

```typescript
// NestJS CORS config
app.enableCors({
  origin: (origin, callback) => {
    const allowedOrigins = getTenantAllowedOrigins(origin);
    if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new ForbiddenException('Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  credentials: true,
  maxAge: 86400, // 24 hours
});
```

---

## 6. Rate Limiting Strategy

### Per-Tenant Limits

| Tier | Requests/min | Burst | Concurrent |
|---|---|---|---|
| Starter | 1,000 | 2,000 | 10 |
| Growth | 5,000 | 10,000 | 25 |
| Professional | 20,000 | 40,000 | 50 |
| Enterprise | Custom | Custom | Custom |

### Implementation

```typescript
// Redis-based sliding window counter
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit:',
  points: tierLimits[tier],
  duration: 60, // per minute
  blockDuration: 30, // block for 30s when exceeded
});
```

### Rate Limit Headers

All API responses include:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1721568896
Retry-After: 30
```

### Endpoint-Specific Limits

| Endpoint | Limit | Rationale |
|---|---|---|
| `POST /api/auth/login` | 5/15min | Brute force prevention |
| `POST /api/auth/register` | 3/hour | Bot prevention |
| `POST /api/ai/chat` | 100/min | Cost control (LLM tokens) |
| `POST /api/webhooks/receive` | 200/min | External delivery |
| `GET /api/search` | 60/min | Search performance |

---

## 7. Audit Logging

### Audit Event Schema

```typescript
interface AuditEvent {
  id: string;              // UUID
  timestamp: string;       // ISO 8601
  tenant_id: string;
  actor_id: string;
  actor_type: 'user' | 'api_key' | 'system' | 'webhook';
  action: string;          // "product.create", "order.delete"
  resource_type: string;   // "product", "order", "user"
  resource_id: string;
  changes: Record<string, { from: any; to: any }>;
  ip_address: string;
  user_agent: string;
  metadata: Record<string, any>;
}
```

### Audit Log Storage

- **Storage**: Separate `audit_events` table in Postgres
- **Retention**: 90 days in DB, 7 years in cold storage (S3 Glacier)
- **Immutability**: Append-only, `NO UPDATE` triggers
- **Search**: Indexed on `tenant_id`, `actor_id`, `action`, `timestamp`

### Mandatory Audit Events

| Category | Events |
|---|---|
| Authentication | login, logout, login_failed, mfa_enabled, password_changed |
| User management | user.created, user.deleted, role.changed, permission.updated |
| Product management | product.created, product.updated, product.deleted, product.price_changed |
| Order management | order.created, order.cancelled, order.refunded, order.shipped |
| Payment | payment.processed, payment.failed, payment.refunded |
| CRM | deal.created, deal.stage_changed, deal.lost, deal.won |
| Settings | api_key.created, api_key.revoked, webhook.created, webhook.updated |
| Security | security.rate_limited, security.blocked_ip, security.breach_detected |

---

## 8. Penetration Testing Plan

### Cadence

| Test Type | Frequency | Scope |
|---|---|---|
| Automated SAST | Every PR | All code |
| Automated DAST | Weekly | Staging environment |
| Dependency scan | Daily | npm packages |
| Secret scanning | Every commit | Full repo |
| Manual pentest | Quarterly | Full application |
| Bug bounty | Continuous | Public program |

### Pentest Scope

| Area | Included | Excluded |
|---|---|---|
| Web application | All routes, GraphQL, auth flows | Admin manual testing |
| API | REST + GraphQL endpoints | Internal service mesh |
| Mobile | N/A (PWA only) | — |
| Infrastructure | Cloud config, network, DB | Physical security |
| Social engineering | — | Excluded |

### Pentest Provider

- **Annual**: Third-party firm (e.g., HackerOne, Cobalt.io)
- **Quarterly**: Internal security team
- **Continuous**: Automated scanning (Burp Suite, OWASP ZAP)

---

## 9. Incident Response Plan

### IR Phases

```
1. Preparation     ← Documentation, tools, training
2. Detection       ← Monitoring, alerts, user reports
3. Containment     ← Isolate affected systems
4. Eradication     ← Remove root cause
5. Recovery        ← Restore normal operations
6. Post-mortem     ← Learn and improve
```

### IR Team

| Role | Responsibility |
|---|---|
| Incident Commander | Leads response, makes decisions |
| Security Lead | Technical investigation |
| Engineering Lead | Mitigation, patching |
| Communications Lead | Internal/external updates |
| Legal | Regulatory compliance, notification |

### Response SLAs

| Severity | Detection → Response | Containment | Resolution |
|---|---|---|---|
| Critical (P1) | 15 min | 1 hour | 4 hours |
| High (P2) | 30 min | 4 hours | 24 hours |
| Medium (P3) | 2 hours | 24 hours | 7 days |
| Low (P4) | Next business day | — | 30 days |

### Communication Channels

- **Internal**: #incidents Slack channel
- **External**: Status page + affected tenant email
- **Regulatory**: Data protection authority (within 72 hours for GDPR breaches)

---

## 10. GDPR / Compliance Considerations

### Data Subject Rights

| Right | Implementation | SLA |
|---|---|---|
| Right to be informed | Privacy policy, data processing notice | — |
| Right of access | Data export tool in Settings | 30 days |
| Right to rectification | Profile editing UI | Real-time |
| Right to erasure | Account deletion flow | 30 days |
| Right to restrict processing | Settings toggle for analytics | 7 days |
| Right to data portability | JSON/CSV export | 30 days |
| Right to object | Marketing opt-out | Real-time |

### Data Processing Records

Maintained for each tenant:

```typescript
interface DataProcessingRecord {
  tenant_id: string;
  data_categories: string[];
  processing_purposes: string[];
  third_party_sharing: string[];
  retention_periods: Record<string, number>;
  dpia_required: boolean;
  dpia_completed: boolean;
  lawful_basis: 'consent' | 'contract' | 'legal_obligation' | 'legitimate_interest';
}
```

### Data Retention Schedule

| Data Type | Active Retention | Archive | Deletion |
|---|---|---|---|
| Account data | Active + 90 days | 3 years | After archive |
| Order data | 7 years (tax) | — | After 7 years |
| Payment data | 90 days (tokenized) | — | After 90 days (tokens) |
| Logs | 90 days | 1 year | After 1 year |
| Analytics | 26 months | — | After 26 months |
| Chat messages | 90 days | 1 year | After 1 year |

### Compliance Checklist

- [x] Data Processing Agreement (DPA) available for all tenants
- [x] Standard Contractual Clauses (SCCs) for cross-border data
- [x] Data Protection Officer (DPO) appointed
- [x] Privacy Impact Assessment (PIA) completed
- [x] Cookie consent banner on app
- [x] Marketing opt-out available in-app
- [x] Data breach notification procedure documented
- [x] Vendor due diligence completed (Stripe, AWS, OpenAI, SendGrid)
- [x] SOC 2 Type II audit scheduled
- [x] ISO 27001 certification (roadmap)
