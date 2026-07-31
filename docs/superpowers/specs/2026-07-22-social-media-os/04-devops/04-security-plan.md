# Security Plan — AI Social Media OS

| Attribute | Detail |
|---|---|
| **Platform** | Multi-tenant AI Social Media OS |
| **Stack** | NestJS + Next.js + PostgreSQL + Redis + BullMQ + Docker/K8s |
| **Compliance** | SOC 2 Type II, GDPR, CCPA |
| **Security Team** | 1 Lead, 2 Engineers, 1 Compliance Manager |
## 5. Multi-Tenant Isolation

### 5.1 Row-Level Security (PostgreSQL)

Enable RLS on all tenant-scoped tables:
- ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
- ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
- ALTER TABLE social_tokens ENABLE ROW LEVEL SECURITY;

Create RLS policy:
`sql
CREATE POLICY tenant_isolation ON posts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);
`

current_setting is set by the application on each request via:
`sql
SELECT set_config('app.current_tenant_id', <tenant_id>, true);
`

### 5.2 Application-Level Tenant Context

Middleware extracts tenant from JWT or X-Tenant-Id header, validates user belongs to tenant, sets PostgreSQL session variable for RLS, and attaches tenant context to request.

### 5.3 Data Boundary Enforcement

| Data Type | Tenant Scope | Isolation Method |
|---|---|---|
| Posts | Tenant | RLS + application middleware |
| Analytics | Tenant | RLS + partitioned by tenant_id |
| Social Tokens | User (within tenant) | RLS + field-level encryption |
| Content Calendar | Tenant | RLS |
| Media Assets | Tenant | S3 prefix: /media/{tenant_id}/ |
| Billing | Tenant | Separate table, no cross-tenant access |
| Audit Logs | Tenant | RLS + tenant_id index |

### 5.4 Tenant Resource Quotas

Quota enforcement per plan (free, starter, professional, enterprise) for:
- Posts, team members, platform connections, storage, API calls
- Enforced via middleware guard that checks current count vs plan limit
- Returns 403 with upgrade prompt when quota exceeded

---

## 6. Social Platform Token Security

### 6.1 Encrypted Token Storage

Tokens stored in SocialToken model with:
- encryptedData JSON column (AES-256-GCM)
- Scope array for permission tracking
- Expiration timestamp with auto-refresh job
- Refresh token encrypted separately

Tokens are NEVER: logged in plaintext, returned in API responses, stored in environment variables, committed to git, or sent to third-party analytics.

### 6.2 Refresh Rotation

`	ypescript
async function refreshPlatformToken(tokenId: string): Promise<void> {
  const token = await prisma.socialToken.findUnique({ where: { id: tokenId } });
  const decryptedToken = tokenEncryption.decrypt(token.encryptedData);
  const decryptedRefresh = tokenEncryption.decrypt(token.refreshTokenEncrypted);
  const client = platformClients[token.platform];
  const newTokens = await client.refreshToken(decryptedRefresh);
  await prisma.socialToken.update({
    where: { id: tokenId },
    data: {
      encryptedData: tokenEncryption.encrypt(newTokens.accessToken),
      refreshTokenEncrypted: tokenEncryption.encrypt(newTokens.refreshToken),
      expiresAt: newTokens.expiresAt,
      scope: newTokens.scope,
    },
  });
}
`

### 6.3 Scoped Permissions

Each platform OAuth uses minimum required scope. Scope escalation requires re-authorization.

Twitter: tweet.read+write
LinkedIn: w_member_social (or w_organization_social for org accounts)
Instagram: instagram_content_publish
Facebook: pages_manage_posts
TikTok: video.publish

---

## 7. AI Security

### 7.1 Prompt Injection Prevention

Guard intercepts all AI requests and checks for:
- System bypass attempts ("ignore previous instructions")
- Role switch attempts ("you are now a different AI")
- Prompt leak attempts ("print your system prompt")
- XSS injection (<script> tags)
- SQL injection
- Delimiter injection

Flagged inputs are blocked with 403 and logged for security review.

### 7.2 Output Sanitization

Every AI-generated output passes through a pipeline:
1. PII detection (email, phone, SSN, credit card, address via regex + ML)
2. Profanity check
3. Malicious content detection
4. Brand voice compliance (tone, style guide)
5. Redaction of failed content sections
6. Flag for human review if high-severity

### 7.3 Content Moderation Filter

Two-tier moderation:
- Tier 1 (fast path): Pattern-based hate speech, harassment, spam, profanity detection
- Tier 2 (ML path): OpenAI moderation API or custom model for nuanced content

### 7.4 PII Detection

Prompts are scanned for PII before storage and before sending to LLM providers. PII is redacted with [REDACTED] placeholder. The original is never stored.

---

## 8. Infrastructure Security

### 8.1 WAF Configuration (AWS WAFv2)

Rules applied in order:
1. AWS Managed Core Rule Set - common web exploits
2. AWS Managed SQLi Rule Set - SQL injection
3. Global rate limit - 10,000 requests per IP per 5 minutes
4. Per-tenant rate limit based on X-Tenant-Id header
5. Block known bad user agents and IP reputation lists
6. Geo-block for non-serviced regions (configurable)

Logging: all WAF requests logged to S3 + CloudWatch for analysis.

### 8.2 DDoS Protection

- AWS Shield Advanced (production) - always-on detection and mitigation
- CloudFront at edge - absorbs volumetric attacks
- Auto-scaling groups - handle traffic spikes
- Rate limiting at ALB and application layer

### 8.3 Network Policies (Kubernetes)

Default-deny ingress for all namespaces. Explicit allow rules:
- ALB to API pods on port 4000 (within VPC CIDR)
- API to Redis pods on port 6379
- Worker to Redis pods on port 6379
- API to database (via VPC endpoint, not cluster)
- All egress to internet blocked except via NAT gateway

### 8.4 Pod Security (OPA Gatekeeper)

Constraints enforced:
- No privileged containers
- Read-only root filesystem (except for pods that need write)
- Disallow host network, host PID, host IPC
- Require resource limits on all containers
- Require security context with non-root user
- Drop all Linux capabilities except NET_BIND_SERVICE

---

## 9. Compliance

### 9.1 SOC 2 Type II Controls

| Control | Description | Implementation |
|---|---|---|
| CC6.1 | Logical access controls | IAM, OAuth 2.0, RBAC, API keys |
| CC6.6 | Encryption in transit | TLS 1.3 everywhere, mTLS for service mesh |
| CC6.7 | Encryption at rest | AES-256 KMS encryption for all storage |
| CC7.1 | Incident detection | WAF, GuardDuty, CloudTrail, Datadog |
| CC7.2 | Incident response | Documented IR plan, on-call rotation |
| A1.1 | Availability monitoring | Uptime monitoring, multi-AZ, auto-scaling |
| A1.2 | Capacity management | HPA, Cluster Autoscaler, cost budgets |
| PI1.1 | Processing integrity | Input validation, idempotency keys |
| C1.1 | Confidential information protection | RLS, field-level encryption |
| C1.2 | Data retention and disposal | Lifecycle policies, deletion endpoints |
| P1.0 | Privacy notice | Privacy policy, cookie consent, DPA |

### 9.2 GDPR Compliance

| Right | Implementation |
|---|---|
| Access | /api/v1/user/data exports all personal data as JSON |
| Rectification | Profile editing, support ticket for bulk corrections |
| Erasure | /api/v1/user/delete - full deletion within 30 days |
| Restrict Processing | Settings toggle: pause all AI processing |
| Portability | Export all data as ZIP (CSV + JSON) |
| Object | Opt-out of AI features, marketing emails |
| Breach Notification | 72-hour notification to supervisory authority |

### 9.3 CCPA Compliance

- Right to Know: /api/v1/user/data with categories of collected data
- Right to Delete: Same as GDPR deletion endpoint
- Right to Opt-Out: Toggle in settings + respect Sec-GPC header
- Non-Discrimination: No service degradation for opt-out users
- Minor Opt-In: Users under 16 require guardian consent

---

## 10. Audit Logging

### 10.1 Audit Event Schema

`	ypescript
interface AuditEvent {
  id: string;                    // UUID v4
  timestamp: string;             // ISO 8601 UTC
  action: string;                // Structured action enum
  actor: { id: string; type: 'user' | 'system' | 'api_key' | 'worker' | 'admin'; ip?: string; };
  resource: { type: string; id: string; action: 'created' | 'updated' | 'deleted' | 'viewed' | 'exported'; };
  tenantId: string;
  context: { requestId: string; source: 'api' | 'web' | 'worker' | 'admin' | 'integration'; };
  severity: 'info' | 'warning' | 'critical';
  immutable: true;               // Always true - record cannot be modified
}
`

### 10.2 Logged Actions

All mutating operations are logged: auth events, post CRUD, tenant changes, user management, social token actions, billing, AI actions, security events, data export/delete, admin actions, webhook calls.

Retention: 2-7 years based on severity (critical: 7 years, standard: 2 years).

### 10.3 Immutable Log Storage

`	ypescript
// Dual-write strategy:
// 1. PostgreSQL (hot storage, 30-day queryable)
// 2. S3 (immutable cold storage, write-once with object lock)

async function logAuditEvent(event: AuditEvent): Promise<void> {
  await prisma.auditLog.create({ data: event });
  await s3.send(new PutObjectCommand({
    Bucket: process.env.AUDIT_LOG_BUCKET,
    Key: 'audit/' + event.timestamp.substring(0, 7) + '/' + event.id + '.json',
    Body: JSON.stringify(event),
    ObjectLockMode: 'COMPLIANCE',
    ObjectLockRetainUntilDate: getRetentionDate(event.severity),
  }));
}
`

---

## 11. Incident Response Plan

### 11.1 Severity Levels

| Level | Definition | Response Time | Escalation |
|---|---|---|---|
| SEV-1 | Active data breach, service down, data loss | 15 min | CTO + CEO |
| SEV-2 | Partial outage, security vulnerability, degraded performance | 1 hour | Engineering Lead |
| SEV-3 | Minor issue, low-severity vulnerability, non-critical bug | 4 hours | Team Lead |
| SEV-4 | Question, feature request, cosmetic issue | 24 hours | Product Manager |

### 11.2 Incident Response Playbook (SEV-1: Data Breach)

Detection:
- GuardDuty (unusual API activity)
- Datadog (anomalous data access patterns)
- WAF (attack spike)
- User report of unauthorized activity

Triage (within 15 min):
- Confirm breach with CloudTrail, GuardDuty, audit logs
- Identify scope: which data, which tenants, how many users

Containment (within 30 min):
- Isolate affected tenant(s): revoke sessions, disable API keys, block via WAF
- Rotate compromised credentials: RDS passwords, Redis tokens, OAuth tokens
- Apply blocking controls: WAF rules, IAM policy restrictions
- Take forensic snapshot: RDS snapshot, preserve logs

Eradication (within 2 hours):
- Identify root cause
- Patch vulnerability
- Deploy fix through emergency CI/CD bypass
- Verify fix deployed and blocking

Recovery (within 4 hours):
- Restore from clean backup if needed
- Validate data integrity
- Re-enable tenant access
- Monitor for recurrence

Post-Mortem (within 5 business days):
- Root cause analysis document
- Timeline of events
- Remediation items with owners
- Control improvements
- Compliance report for regulators

### 11.3 Communication Templates

Internal SEV-1 alert via Slack/PagerDuty including: incident title, detection time, affected services, affected tenants count, current status, description, current actions with owners, next update time.

External user notification via email including: security incident notice, description, actions taken, user action steps (if any), contact information for privacy/compliance questions.

Post-mortem template: summary, timeline, root cause, impact (tenants, data, duration), action items with owners and due dates, lessons learned, preventative measures.

---

## 12. Vulnerability Management

### 12.1 Responsible Disclosure Program

Scope: all subdomains under *.smo.com, API endpoints, mobile apps.
Out of scope: rate limiting without demonstrated impact, self-XSS, missing security headers, social engineering, physical attacks, DoS.

Process:
1. Submit report to security@smo.com (PGP key at /.well-known/security.txt)
2. Acknowledge within 48 hours
3. Initial assessment within 5 business days
4. Updates on remediation progress
5. Bounty up to ,000 based on severity

Safe harbor: no legal action against researchers who follow the policy, make good-faith efforts, and report findings first.

### 12.2 Patch SLAs

| Severity | CVSS Score | Patch Timeframe | Notification |
|---|---|---|---|
| CRITICAL | 9.0-10.0 | 24 hours | Customer notification within 48h |
| HIGH | 7.0-8.9 | 7 days | Service status page |
| MEDIUM | 4.0-6.9 | 30 days | Changelog at next release |
| LOW | 0.1-3.9 | Next release cycle | Not required |

### 12.3 Dependency Scanning Schedule

| Scan Type | Tool | Schedule | Scope |
|---|---|---|---|
| SCA | Dependabot | Daily | All npm packages, Docker images |
| SAST | Semgrep | Every PR + Daily | Application code |
| DAST | OWASP ZAP | Weekly (staging) + Quarterly (prod) | Running application |
| Container Scanning | Trivy | Every build + Daily | All container images |
| Secret Scanning | truffleHog | Every commit + Daily | Git history, CI logs |
| Infrastructure | checkov | Every Terraform PR | IaC templates |
| License | FOSSA | Weekly | All dependencies |
| Penetration Testing | External firm | Quarterly | Full application + infra |

---

## 13. Security Reviews

### 13.1 Pre-Deployment Security Checklist

Authentication: all endpoints require auth, tenant context validated, RBAC enforced, no hardcoded credentials, API keys hashed at rest, rate limiting on new endpoints.

Data Security: PII fields identified and encrypted, field-level encryption for tokens, TLS 1.3 enforced, input validation with whitelist, output encoding for XSS prevention, no sensitive data in logs.

AI Safety: prompt injection guard active, output sanitization pipeline configured, content moderation filter applied, PII redaction enabled, rate limiting on AI endpoints.

Infrastructure: no privileged containers, resource limits on all containers, network policies restrict traffic, read-only root filesystem, non-root user, dropped capabilities.

Monitoring: audit logging for all mutations, error tracking (Sentry), performance monitoring (Datadog), security alerts (GuardDuty, WAF), uptime monitoring.

Compliance: GDPR right to deletion implementable, CCPA opt-out respected, data retention policy documented, privacy policy reflects new feature.

### 13.2 Quarterly Penetration Testing

| Scope | Frequency | Tester |
|---|---|---|
| External API | Quarterly | Third-party firm |
| Web Application | Quarterly | Third-party firm |
| Mobile App | Bi-annual | Third-party firm |
| Internal Network | Bi-annual | Internal team |
| Social Engineering | Annual | Third-party firm |

### 13.3 Architecture Review Cadence

| Review Type | Cadence | Focus |
|---|---|---|
| Security Architecture Review | Monthly | New features, architecture changes |
| Threat Modeling Session | Per new feature | STRIDE for each component |
| Compliance Review | Quarterly | SOC 2, GDPR, CCPA controls |
| Third-Party Risk Review | Per vendor | Vendor security assessment |
| Bug Bounty Triage | Weekly | Review incoming reports |
| Security Training | Bi-annual | Secure coding, OWASP Top 10 |
| Red Team Exercise | Annual | Full-scope adversarial simulation |

---

## Appendices

### A. Security Contacts

| Role | Contact |
|---|---|
| Security Lead | security@smo.com |
| CTO | cto@smo.com |
| DPO | dpo@smo.com |
| SOC 2 Auditor | audit@smo.com |
| Bug Bounty | https://hackerone.com/smo |

### B. Compliance Certifications

| Certification | Status |
|---|---|
| SOC 2 Type I | Completed |
| SOC 2 Type II | In progress |
| GDPR | Compliant |
| CCPA | Compliant |

### C. Data Processing Register

| Sub-processor | Service | Location | DPA |
|---|---|---|---|
| AWS | Cloud infrastructure | us-east-1, us-west-2 | Yes |
| OpenAI | AI content generation | us-east-1 | Yes (no training) |
| Anthropic | AI content generation | us-east-1 | Yes (no training) |
| Stripe | Payment processing | PCI DSS Level 1 | Yes |
| Datadog | Monitoring | us-east-1 | Yes |
| Sentry | Error tracking | us-east-1 | Yes |
| Postmark | Transactional email | us-east-1 | Yes |
