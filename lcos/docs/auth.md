# Authentication & Authorization

> **Version:** 1.0.0  
> **Status:** Approved  
> **Last Updated:** 2026-07-21  

---

## 1. Authentication Strategy

LCOS uses a **multi-strategy authentication system** that supports:

| Strategy | Use Case | Security Level |
|----------|----------|----------------|
| JWT (Access + Refresh Tokens) | Web app sessions | High |
| API Keys | M2M integrations | High |
| OAuth 2.0 / OIDC | Social login, SSO | High |
| MFA (TOTP) | Admin accounts | Very High |

All authentication flows are routed through `/auth/*` and logged in the audit trail.

---

## 2. JWT Token Structure

### Access Token

Short-lived token for API authorization. Lifetime: **15 minutes**.

**Header:**
```json
{
  "alg": "RS256",
  "kid": "key_v1",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "sub": "usr_001",
  "tenant_id": "tnt_001",
  "role": "inventory_manager",
  "permissions": ["products:read", "products:write", "inventory:read", "inventory:write"],
  "mfa_verified": true,
  "iat": 1721568000,
  "exp": 1721568900,
  "jti": "unique-token-id"
}
```

**Custom Claims:**

| Claim | Type | Description |
|-------|------|-------------|
| `tenant_id` | string | Tenant this user belongs to |
| `role` | string | User role (see RBAC below) |
| `permissions` | string[] | Cached permission list for fast access control |
| `mfa_verified` | boolean | Whether MFA was verified in this session |

### Refresh Token

Long-lived token used to obtain new access tokens. Lifetime: **7 days** (configurable per tenant).

- Stored as **httpOnly, Secure, SameSite=Strict** cookie
- Hashed in the database (`refresh_token_hashes` table)
- Rotation: each refresh invalidates the previous token (prevents replay)
- Max concurrent refresh tokens per user: 5

### Token Signing

- Algorithm: RS256 (asymmetric)
- Public key available at `GET /.well-known/jwks.json` (for third-party verification)
- Private key rotated every 90 days
- Key rotation grace period: 24h (old key still accepted during window)
- Keys stored in environment variables / Vault (not in the database)

### Token Revocation

Tokens are blacklisted via the `jti` (JWT ID) in Redis with expiry matching the token's original `exp`.

Scenarios:
- User changes password → all tokens revoked
- Admin suspends user → all tokens revoked
- MFA enforced → unverified tokens revoked
- Logout → current refresh token revoked

---

## 3. RBAC Model

### Role Hierarchy

```
super_admin (global, not tenant-scoped)
└── tenant_admin
    └── manager
        ├── inventory_manager
        ├── sales_associate
        ├── customer_support
        ├── marketing_manager
        └── fulfillment_operator
            └── viewer
```

### Permission Definitions

Permissions follow the pattern: `{resource}:{action}`

| Action | Meaning |
|--------|---------|
| `read` | View resource |
| `write` | Create and update |
| `delete` | Soft-delete or archive |
| `admin` | All actions including settings |

### Role-Permission Matrix

| Resource | super_admin | tenant_admin | manager | inventory_mgr | sales_assoc | support | marketing | fulfillment | viewer |
|----------|-------------|--------------|---------|---------------|-------------|---------|-----------|-------------|--------|
| tenant.settings | admin | admin | read | - | - | - | - | - | - |
| users | admin | admin | write | - | - | - | - | - | - |
| roles | admin | admin | - | - | - | - | - | - | - |
| products | admin | admin | admin | write | read | read | read | read | read |
| inventory | admin | admin | admin | admin | read | read | read | write | read |
| categories | admin | admin | admin | write | read | read | read | read | read |
| brands | admin | admin | admin | write | read | read | read | read | read |
| customers | admin | admin | admin | read | write | write | read | read | read |
| orders | admin | admin | admin | read | write | read | read | read | read |
| payments | admin | admin | admin | read | read | read | read | read | read |
| crm.segments | admin | admin | write | - | read | read | write | - | read |
| crm.tickets | admin | admin | admin | - | write | write | read | - | read |
| marketing | admin | admin | admin | - | - | - | admin | - | - |
| automation | admin | admin | write | read | read | read | write | read | read |
| suppliers | admin | admin | admin | write | - | - | - | read | read |
| integrations | admin | admin | admin | - | - | - | write | - | read |
| ai-studio | admin | admin | write | read | write | write | write | - | read |
| reports | admin | admin | admin | write | read | read | write | read | read |
| billing | admin | admin | admin | - | - | - | - | - | - |

### Custom Roles

Tenant admins can create custom roles via:

```http
POST /users/roles
{
  "name": "warehouse_lead",
  "description": "Manages warehouse operations",
  "permissions": ["inventory:admin", "suppliers:read", "products:read", "fulfillment:write"],
  "basedOn": "fulfillment_operator"
}
```

### Permission Enforcement

Three layers:

1. **API Gateway** — validates JWT and checks `permissions` claim against route requirements (fast path, cached)
2. **Service Layer** — re-checks permissions for fine-grained access (e.g., "can only edit own tickets")
3. **Database RLS** — row-level security as final safety net

---

## 4. MFA Implementation

### Supported Methods

| Method | Status | Description |
|--------|--------|-------------|
| **TOTP** | Primary | Time-based one-time passwords (Google Authenticator, Authy, 1Password) |
| **SMS** | Backup | OTP sent via SMS (requires SMS provider integration) |
| **Recovery Codes** | Fallback | 10 one-time use codes provided during setup |

### Enrollment Flow

```
User → Settings → Security → Enable MFA
  │
  ├─ POST /auth/mfa/setup
  │    ├─ Generates TOTP secret (32 random bytes, base32-encoded)
  │    ├─ Generates QR code URL (otpauth://...)
  │    ├─ Generates 10 recovery codes (8-char hex)
  │    └─ Returns { secret, qrCodeUrl, recoveryCodes }
  │
  ├─ User scans QR with authenticator app
  │
  ├─ POST /auth/mfa/verify { token: "123456" }
  │    ├─ Server validates TOTP
  │    ├─ On success: stores backup_codes (hashed) + mfa_enrolled = true
  │    └─ Returns { verified: true }
  │
  └─ MFA Active
```

### Login Flow with MFA

```
POST /auth/login
  → { mfaRequired: true, mfaToken: "temp_token_..." }

POST /auth/mfa/challenge { mfaToken, code: "123456" }
  → { session tokens }

OR (recovery code)
POST /auth/mfa/recover { mfaToken, recoveryCode: "a1b2-c3d4" }
  → { session tokens }
```

### Enforcement Rules

- **Required for:** all admin roles (`tenant_admin`, `manager`)
- **Optional for:** standard roles
- **Grace period:** 7 days after first login to set up MFA (configurable)

---

## 5. Session Management

### Session Store

Sessions are stored in **Redis** with the following structure:

```
Key: session:{session_id}
Value:
{
  "userId": "usr_001",
  "tenantId": "tnt_001",
  "role": "inventory_manager",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0 ...",
  "mfaVerified": true,
  "createdAt": 1721568000,
  "lastActivity": 1721568900
}
TTL: 7 days (extended on activity)
```

### Concurrent Session Limits

| Plan | Max Concurrent Sessions |
|------|------------------------|
| Starter | 3 |
| Professional | 10 |
| Enterprise | Unlimited |

If the limit is exceeded, the oldest session is invalidated.

### Session Invalidation Triggers

- Explicit logout
- Password change
- MFA enrollment/removal
- Account suspension
- Role change
- Admin force-logout (via user management)
- Inactivity timeout (24h for admin, 72h for standard)

---

## 6. API Key Authentication

### Key Structure

```
lcos_{prefix}_{api_key}
    │       │        │
    │       │        └─ 48 chars of cryptographic random (base62)
    │       └─ 8 chars prefix for identification (e.g., "prod_a1b2")
    └─ prefix identifies environment (live/test)
```

**Example:** `lcos_live_a1b2c3d4_9X7rK2mP4vN8qL1wR5tY3bH6jU0eA8sD5fG2hJ1kL4`

### Storage

- **Full key:** shown only once at creation time (never stored in plaintext)
- **Database:** stores only `SHA-256(api_key)` hash + prefix + last 4 chars (for display)
- **Key format** is versioned to allow rotation

### Permissions

API keys are scoped to specific permissions (not roles):

```json
{
  "id": "apk_001",
  "name": "Shopify Sync Key",
  "prefix": "live_a1b2",
  "lastFour": "kL4",
  "permissions": ["products:read", "products:write", "inventory:read", "orders:read"],
  "ipRestrictions": ["203.0.113.0/24"],
  "expiresAt": "2027-01-01T00:00:00Z",
  "createdAt": "2026-01-01T00:00:00Z"
}
```

### Usage

```http
GET /products
X-API-Key: lcos_live_a1b2c3d4_9X7rK2mP4vN8qL1wR5tY3bH6jU0eA8sD5fG2hJ1kL4
X-Tenant-ID: tnt_001
```

### Key Management Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/api-keys` | List API keys (masked) |
| POST | `/auth/api-keys` | Create new key |
| DELETE | `/auth/api-keys/:id` | Revoke key |
| PATCH | `/auth/api-keys/:id` | Update permissions/restrictions |

---

## 7. OAuth & Social Login

### Supported Providers

| Provider | Scope | Use |
|----------|-------|-----|
| **Google** | `email profile openid` | Customer & staff login |
| **Apple** | `name email` | Customer login (iOS) |
| **Instagram** | `instagram_business_basic instagram_business_content_message` | Social commerce |
| **Facebook** | `email pages_manage_metadata pages_messaging` | Messenger commerce |
| **Microsoft** | `email profile openid offline_access` | Enterprise SSO (Azure AD) |

### OAuth Flow

```
┌─────────┐         ┌──────────┐         ┌─────────┐         ┌──────────┐
│  Client  │         │   LCOS   │         │ Provider │         │   User   │
└────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
     │   POST /auth/oauth/google                │                   │
     │─────────────────────>                    │                   │
     │  { authorizationUrl }                    │                   │
     │<─────────────────────                    │                   │
     │                                          │                   │
     │  Redirect to provider                    │                   │
     │─────────────────────────────────────────────────────────────>│
     │                                          │                   │
     │                                          │  User consents    │
     │                                          │<──────────────────│
     │                                          │                   │
     │  Redirect to callback with auth code      │                   │
     │<─────────────────────────────────────────────────────────────│
     │                                          │                   │
     │ POST /auth/oauth/google/callback          │                   │
     │ { code, redirectUri }                    │                   │
     │─────────────────────────────>            │                   │
     │                                          │  Exchange code    │
     │                                          │──────────────────>│
     │                                          │  Access + ID Token│
     │                                          │<──────────────────│
     │                                          │                   │
     │  { session }                             │                   │
     │<─────────────────────────────            │                   │
```

### Account Linking

Social login is linked to existing accounts via email matching. If the email already exists:
- If matching social provider → auto-link
- If new social provider → prompt user to link in settings

### Enterprise SSO (SAML/OIDC)

Enterprise tenants can configure SSO:
- Metadata URL or XML upload
- Automatic user provisioning (JIT)
- Role mapping from SAML attributes

---

## 8. Password Policy

| Requirement | Value |
|-------------|-------|
| Minimum length | 10 characters |
| Complexity | Upper + lower + number + special char |
| Max consecutive same char | 3 |
| History | Last 10 passwords blocked |
| Max login attempts | 5 before 15-min lockout |
| Expiry | 90 days (configurable per tenant) |
| Reset link expiry | 1 hour |

---

## 9. Security Headers

Every response includes:

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self' cdn.lcos.io
Referrer-Policy: strict-origin-when-cross-origin
```

---

## 10. Audit Logging

All authentication events are logged:

| Event | Details Logged |
|-------|----------------|
| Login success | user, IP, user-agent, timestamp |
| Login failure | email used, IP, reason (wrong password / account locked / MFA failed) |
| Token refresh | user, old token prefix, new token prefix |
| Logout | user, session ID |
| MFA enrollment | user, method (TOTP/SMS) |
| MFA removal | user |
| Password change | user, timestamp |
| API key creation | user, key prefix, permissions |
| API key usage | key prefix, endpoint, tenant, IP |

---

## 11. Rate Limiting by Auth Action

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /auth/login` | 10 attempts | 15 min per IP + email |
| `POST /auth/mfa/challenge` | 5 attempts | 15 min per user |
| `POST /auth/password/reset` | 3 attempts | 1 hour per email |
| `POST /auth/register` | 3 attempts | 1 hour per IP |
| All other auth endpoints | 30 | 1 min per IP |
