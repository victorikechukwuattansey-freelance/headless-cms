# API Specification — AI Social Media OS

**Version:** 1.0.0  
**Last Updated:** 2026-07-22  
**Status:** Draft — Internal Review

---

## Table of Contents

1. [API Design Principles](#1-api-design-principles)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Standard Response Envelope](#3-standard-response-envelope)
4. [Error Codes and Error Response Format](#4-error-codes-and-error-response-format)
5. [Rate Limiting Strategy](#5-rate-limiting-strategy)
6. [Complete REST API Reference](#6-complete-rest-api-reference)
7. [GraphQL Schema](#7-graphql-schema)
8. [WebSocket Events](#8-websocket-events)
9. [Webhook System](#9-webhook-system)
10. [Platform API Integration Patterns](#10-platform-api-integration-patterns)

---

## 1. API Design Principles

### 1.1 REST + GraphQL Hybrid

The platform exposes a dual-interface API:

| Interface | Base URL | Use Case |
|---|---|---|
| REST | `https://api.smos.io/v1` | CRUD operations, file uploads, admin actions, integrations |
| GraphQL | `https://api.smos.io/graphql` | Complex queries, dashboard data, real-time subscriptions |
| WebSocket | `wss://api.smos.io/ws` | Real-time events, publishing status, notifications |

**REST** is the primary interface for resource-oriented operations and third-party integrations. Every REST endpoint returns a [standard envelope](#3-standard-response-envelope).

**GraphQL** is the secondary interface intended for the web dashboard and mobile apps. It delegates mutations to the same service layer as REST to guarantee consistency.

**Rule of thumb:** If you can express the operation as a CRUD action on a resource, use REST. If you need to fetch deeply nested data in a single round-trip, use GraphQL.

### 1.2 Versioning

- The API version is embedded in the URL path: `v1`, `v2`, etc.
- Minor breaking changes increment the minor version communicated via the `API-Version` response header.
- Deprecated endpoints remain active for 90 days after a replacement is announced.
- The `Sunset` HTTP header is set on deprecated endpoints with the ISO date of removal.
- Clients must send `Accept: application/vnd.smos.v1+json` to pin a version. Without it, the latest stable version is used.

### 1.3 HTTP Methods

| Method | Semantics |
|---|---|
| `GET` | Retrieve resource(s). Idempotent, safe. |
| `POST` | Create a resource, or execute an action. |
| `PUT` | Full replacement of a resource. |
| `PATCH` | Partial update of a resource. |
| `DELETE` | Remove a resource. |

### 1.4 Idempotency

All `POST` mutations that create resources support an `Idempotency-Key` header. If a request is retried with the same key within 24 hours, the server returns the original response without side effects. Idempotency keys are scoped to the authenticated user.

### 1.5 Pagination

Cursor-based pagination is used for all list endpoints:

```
GET /v1/posts?cursor=eyJpZCI6MTIzfQ==&limit=25
```

Response includes:

```json
{
  "data": [...],
  "pagination": {
    "nextCursor": "eyJpZCI6MTQ4fQ==",
    "hasMore": true,
    "totalCount": 142
  }
}
```

- `limit` defaults to 25, max 100.
- The cursor is an opaque base64-encoded value. Clients must not inspect or construct it.
- Offset-based pagination (`?page=2&per_page=25`) is also supported on endpoints where cursor ordering is unnecessary (e.g., static reference data).

### 1.6 Filtering, Sorting, and Field Selection

- **Filtering:** `GET /v1/posts?status=draft&platform=twitter` — filters are AND-combined. Nested filters use dot notation: `?author.name=John`.
- **Sorting:** `?sort=-createdAt` (descending) or `?sort=createdAt` (ascending). Multiple sort keys: `?sort=-priority,createdAt`.
- **Field selection:** `?fields=id,title,status,platforms` — returns only the requested fields to reduce payload size.

---

## 2. Authentication & Authorization

### 2.1 OAuth 2.0 Flows

The API supports three OAuth 2.0 grant types:

| Grant Type | Use Case |
|---|---|
| `authorization_code` | First-party web app, mobile app |
| `client_credentials` | Server-to-server (MCP servers, webhook consumers) |
| `refresh_token` | Token renewal |

#### Authorization Code Flow

```
+--------+                               +--------+
|        |--- Authorization Request ---->|        |
| Client |                               | Auth   |
|        |<-- Authorization Code --------| Server |
|        |                               |        |
|        |--- Access Token Request ----->|        |
|        |                               |        |
|        |<-- Access + Refresh Token ----|        |
+--------+                               +--------+
```

1. Client redirects user to `https://auth.smos.io/authorize?response_type=code&client_id={id}&redirect_uri={uri}&scope={scopes}&state={csrf_token}`
2. User authenticates and consents.
3. Auth server redirects to `redirect_uri?code={code}&state={state}`.
4. Client exchanges `code` at `POST /v1/auth/token` for an access + refresh token pair.

#### Client Credentials Flow

Used by MCP servers and automated integrations. The client authenticates with its `client_id` and `client_secret` and receives a short-lived access token scoped to the permissions granted to that client.

```
POST /v1/auth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "mcp-server-abc123",
  "client_secret": "smos_secret_xyz..."
}
```

### 2.2 JWT Structure

Access tokens are JWTs with the following payload:

```json
{
  "sub": "user_2f3a1b",
  "org_id": "org_8d4e2c",
  "workspace_id": "ws_5a7b3c",
  "scopes": ["posts:read", "posts:write", "analytics:read"],
  "iat": 1689000000,
  "exp": 1689003600,
  "jti": "token_abc123",
  "type": "access"
}
```

- **Algorithm:** RS256 (asymmetric, public key available at `https://auth.smos.io/.well-known/jwks.json`).
- **Expiry:** Access tokens expire in 60 minutes. Refresh tokens expire in 30 days.
- **Refresh:** `POST /v1/auth/refresh` with `{ "refresh_token": "..." }` returns a new access + refresh token pair.
- **Revocation:** `POST /v1/auth/revoke` immediately invalidates all tokens for the user session.

### 2.3 API Keys

For programmatic access (CI/CD, MCP servers, custom scripts), users can generate API keys from the dashboard:

| Property | Value |
|---|---|
| Format | `smos_sk_live_xxxx` (live) / `smos_sk_test_xxxx` (test) |
| Prefix | `smos_sk_` |
| Length | 48 chars |
| Scope | User-assigned (can be restricted to specific endpoints) |
| Rotation | Keys can be rotated from the dashboard. Old key invalidated immediately. |

API keys are sent via the `Authorization: Bearer smos_sk_live_xxxx` header.

### 2.4 Scopes

Scopes are space-separated strings following the pattern `{resource}:{action}`.

| Scope | Description |
|---|---|
| `posts:read` | Read posts and drafts |
| `posts:write` | Create, update, delete posts |
| `posts:publish` | Publish and schedule posts |
| `analytics:read` | View analytics data |
| `analytics:export` | Export analytics reports |
| `media:read` | Read media assets |
| `media:write` | Upload and delete media |
| `accounts:read` | View connected social accounts |
| `accounts:write` | Connect/disconnect social accounts |
| `workspaces:read` | View workspace settings |
| `workspaces:write` | Modify workspace settings |
| `workflows:read` | View workflows |
| `workflows:write` | Create and modify workflows |
| `workflows:execute` | Trigger workflow executions |
| `webhooks:read` | View webhook configurations |
| `webhooks:write` | Create and modify webhooks |
| `mcp:read` | View MCP server registrations |
| `mcp:write` | Register and manage MCP servers |
| `admin:read` | Read system-level data (admin only) |
| `admin:write` | Modify system-level data (admin only) |

### 2.5 Role-Based Access Control (RBAC)

| Role | Scope Level |
|---|---|
| `owner` | Full access to organization and billing |
| `admin` | Full access to organization resources |
| `editor` | Create and edit content, view analytics |
| `viewer` | Read-only access |
| `mcp` | Limited to MCP server operations |

---

## 3. Standard Response Envelope

All REST responses (success and error) use a consistent envelope:

### 3.1 Success Response

```json
{
  "status": "ok",
  "data": { ... },
  "pagination": { ... },
  "meta": {
    "requestId": "req_a1b2c3d4",
    "timestamp": "2026-07-22T12:00:00Z",
    "apiVersion": "1.0.0"
  }
}
```

### 3.2 Error Response

```json
{
  "status": "error",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request payload failed validation.",
    "details": [
      {
        "field": "title",
        "message": "Title is required",
        "code": "REQUIRED"
      }
    ],
    "documentationUrl": "https://docs.smos.io/api/errors#VALIDATION_ERROR"
  },
  "meta": {
    "requestId": "req_a1b2c3d4",
    "timestamp": "2026-07-22T12:00:00Z",
    "apiVersion": "1.0.0"
  }
}
```

### 3.3 Envelope Fields

| Field | Type | Description |
|---|---|---|
| `status` | string | `"ok"` or `"error"` |
| `data` | object/array | Response payload (absent on errors) |
| `pagination` | object | Cursor info for list endpoints (absent otherwise) |
| `error` | object | Error details (absent on success) |
| `meta.requestId` | string | Unique request identifier for debugging |
| `meta.timestamp` | string | ISO 8601 timestamp |
| `meta.apiVersion` | string | API version that handled the request |

---

## 4. Error Codes and Error Response Format

### 4.1 HTTP Status Code Usage

| Status | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `204` | Success, no content (deletion) |
| `400` | Bad request — validation error, malformed payload |
| `401` | Unauthenticated — missing or invalid credentials |
| `403` | Forbidden — authenticated but not authorized |
| `404` | Resource not found |
| `409` | Conflict — duplicate resource, state conflict |
| `422` | Unprocessable entity — business logic rejection |
| `429` | Rate limit exceeded |
| `500` | Internal server error |
| `502` | Bad gateway — upstream platform error |
| `503` | Service unavailable |

### 4.2 Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `AUTHENTICATION_REQUIRED` | 401 | No credentials provided |
| `INVALID_TOKEN` | 401 | Token is expired or malformed |
| `INSUFFICIENT_PERMISSIONS` | 403 | Token lacks required scope |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource does not exist |
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `DUPLICATE_RESOURCE` | 409 | Resource with unique constraint already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `PLATFORM_ERROR` | 502 | Upstream social platform returned an error |
| `PLATFORM_RATE_LIMITED` | 429 | Upstream platform rate limit hit |
| `PLATFORM_AUTH_REQUIRED` | 401 | Social account token expired, re-auth needed |
| `QUOTA_EXCEEDED` | 403 | Plan limit reached (posts, workspaces, etc.) |
| `WORKFLOW_EXECUTION_FAILED` | 500 | Workflow engine encountered an error |
| `AI_PROVIDER_ERROR` | 502 | LLM provider returned an error |
| `AI_CONTENT_MODERATED` | 422 | Generated content flagged by moderation |
| `MCP_SERVER_ERROR` | 502 | Connected MCP server returned an error |
| `MCP_SERVER_TIMEOUT` | 504 | MCP server did not respond in time |
| `MCP_SERVER_NOT_FOUND` | 404 | MCP server not registered or offline |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `MAINTENANCE_MODE` | 503 | System is under maintenance |

### 4.3 Error Detail Object

```json
{
  "field": "scheduledAt",
  "message": "Scheduled time must be in the future",
  "code": "INVALID_FUTURE_DATE"
}
```

For validation errors, `details` is an array of these objects. For single errors, `details` may be absent or a single object.

---

## 5. Rate Limiting Strategy

### 5.1 Tiers

| Tier | Rate Limit | Burst | Applied To |
|---|---|---|---|
| Free | 100 req/min | 150 | All endpoints |
| Pro | 1,000 req/min | 2,000 | All endpoints |
| Business | 5,000 req/min | 10,000 | All endpoints |
| Enterprise | 20,000 req/min | 50,000 | All endpoints |
| MCP Server | 500 req/min | 1,000 | MCP-specific endpoints |
| Webhook Delivery | 100 req/min per target | — | Webhook outbound |

### 5.2 Rate Limit Headers

Every response includes:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 987
X-RateLimit-Reset: 1689004200
Retry-After: 12
```

### 5.3 Rate Limit Algorithm

Token bucket algorithm with per-user + per-endpoint + per-organization accounting. The effective rate is the minimum of the three.

### 5.4 Handling Rate Limits

When a `429` is returned, clients must:

1. Read `Retry-After` header (seconds).
2. Wait the specified duration before retrying.
3. Implement exponential backoff for subsequent retries: `2^n + jitter`.
4. Maximum retries: 5. After that, surface the error to the user.

### 5.5 Platform-Specific Rate Limits

The platform tracks per-platform rate limits for each connected social account. When a platform rate limit is hit:

1. The request is queued for retry.
2. The user is notified via the dashboard.
3. The platform adapter uses the `Retry-After` from the platform's response.

---

## 6. Complete REST API Reference

### 6.1 Authentication

#### `POST /v1/auth/register`

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "name": "Jane Doe",
  "organizationName": "Acme Corp",
  "workspaceName": "Main"
}
```

**Response `201`:**
```json
{
  "data": {
    "user": { "id": "user_2f3a1b", "email": "user@example.com", "name": "Jane Doe" },
    "organization": { "id": "org_8d4e2c", "name": "Acme Corp", "slug": "acme-corp" },
    "workspace": { "id": "ws_5a7b3c", "name": "Main" },
    "accessToken": "eyJhbGciOiJSUzI1...",
    "refreshToken": "smos_rt_xxxx..."
  }
}
```

**Errors:** `VALIDATION_ERROR`, `DUPLICATE_RESOURCE` (email exists)

#### `POST /v1/auth/login`

Authenticate and receive tokens.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss123"
}
```

**Response `200`:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1...",
    "refreshToken": "smos_rt_xxxx...",
    "expiresIn": 3600
  }
}
```

**Errors:** `AUTHENTICATION_REQUIRED` (invalid credentials), `RATE_LIMIT_EXCEEDED` (after 5 failed attempts)

#### `POST /v1/auth/refresh`

Exchange a refresh token for a new token pair.

**Request:**
```json
{
  "refreshToken": "smos_rt_xxxx..."
}
```

**Response `200`:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1...",
    "refreshToken": "smos_rt_xxxx...",
    "expiresIn": 3600
  }
}
```

**Errors:** `INVALID_TOKEN`, `AUTHENTICATION_REQUIRED`

#### `POST /v1/auth/revoke`

Revoke all tokens for the current session.

**Auth:** Required

**Response `204`:** No content

#### `POST /v1/auth/oauth/{platform}`

Initiate OAuth flow to connect a social account.

**Auth:** Required

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `redirectUri` | string | Where to redirect after auth |

**Response `200`:**
```json
{
  "data": {
    "authUrl": "https://platform.com/oauth/authorize?...",
    "state": "csrf_state_token"
  }
}
```

**Platforms:** `facebook`, `instagram`, `twitter`, `linkedin`, `tiktok`, `pinterest`, `youtube`, `threads`, `bluesky`, `reddit`, `telegram`, `google-business`

#### `POST /v1/auth/oauth/{platform}/callback`

Complete OAuth flow with the authorization code.

**Auth:** Required

**Request:**
```json
{
  "code": "auth_code_from_platform",
  "state": "csrf_state_token"
}
```

**Response `201`:**
```json
{
  "data": {
    "accountId": "sa_4e5f6g",
    "platform": "twitter",
    "platformUserId": "12345678",
    "platformUsername": "@janedoe",
    "expiresAt": "2026-08-21T12:00:00Z"
  }
}
```

**Errors:** `PLATFORM_AUTH_REQUIRED`, `VALIDATION_ERROR`

#### `POST /v1/auth/logout`

End the current session.

**Auth:** Required

**Response `204`:** No content

---

### 6.2 Organizations

#### `GET /v1/orgs`

List organizations the authenticated user belongs to.

**Auth:** Required

**Response `200`:**
```json
{
  "data": [
    {
      "id": "org_8d4e2c",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "role": "owner",
      "memberCount": 5,
      "plan": "business",
      "createdAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

#### `POST /v1/orgs`

Create a new organization.

**Auth:** Required

**Request:**
```json
{
  "name": "New Org",
  "slug": "new-org"
}
```

**Response `201`:** Organization object

**Errors:** `VALIDATION_ERROR`, `DUPLICATE_RESOURCE` (slug taken)

#### `GET /v1/orgs/{orgId}`

Get organization details.

**Auth:** Required, `workspaces:read`

#### `PATCH /v1/orgs/{orgId}`

Update organization name, slug, or settings.

**Auth:** Required, role `admin` or `owner`

**Request:**
```json
{
  "name": "Acme Corp Rebranded",
  "settings": {
    "defaultTimezone": "America/New_York",
    "defaultPostingTime": "09:00",
    "approvalRequired": true
  }
}
```

#### `DELETE /v1/orgs/{orgId}`

Delete organization and all associated data.

**Auth:** Required, role `owner`

**Response `204`**

#### `GET /v1/orgs/{orgId}/members`

List organization members.

**Query Parameters:** `?role=editor`

**Response `200`:**
```json
{
  "data": [
    {
      "userId": "user_2f3a1b",
      "email": "jane@acme.com",
      "name": "Jane Doe",
      "role": "admin",
      "joinedAt": "2026-01-15T10:00:00Z"
    }
  ]
}
```

#### `POST /v1/orgs/{orgId}/invites`

Invite a user to the organization.

**Auth:** Required, role `admin` or `owner`

**Request:**
```json
{
  "email": "newuser@acme.com",
  "role": "editor",
  "workspaceIds": ["ws_5a7b3c"]
}
```

**Response `201`:** Invite object with status `pending`

**Errors:** `VALIDATION_ERROR`, `DUPLICATE_RESOURCE` (already invited or member)

#### `GET /v1/orgs/{orgId}/invites`

List pending invites.

#### `DELETE /v1/orgs/{orgId}/invites/{inviteId}`

Cancel an invite.

#### `PUT /v1/orgs/{orgId}/members/{userId}/role`

Change member role.

**Auth:** Required, role `owner`

**Request:**
```json
{
  "role": "editor"
}
```

#### `DELETE /v1/orgs/{orgId}/members/{userId}`

Remove a member from the organization.

**Auth:** Required, role `owner`

**Response `204`**

#### `PUT /v1/orgs/{orgId}/transfer`

Transfer organization ownership.

**Auth:** Required, role `owner`

**Request:**
```json
{
  "newOwnerUserId": "user_9h8i7j"
}
```

**Errors:** `VALIDATION_ERROR` (user must be an existing admin)

---

### 6.3 Workspaces

#### `GET /v1/orgs/{orgId}/workspaces`

List workspaces in the organization.

**Auth:** Required, `workspaces:read`

#### `POST /v1/orgs/{orgId}/workspaces`

Create a workspace.

**Auth:** Required, role `admin` or `owner`

**Request:**
```json
{
  "name": "Social Team",
  "description": "Main social media workspace",
  "settings": {
    "timezone": "UTC",
    "defaultPostVisibility": "draft",
    "requireApproval": true
  }
}
```

**Response `201`:** Workspace object

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}`

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}`

**Auth:** Required, `workspaces:write`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}`

**Auth:** Required, role `admin` or `owner`

**Response `204`**

---

### 6.4 Social Accounts

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/accounts`

List connected social accounts.

**Auth:** Required, `accounts:read`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "sa_4e5f6g",
      "platform": "twitter",
      "platformUserId": "12345678",
      "platformUsername": "@janedoe",
      "platformDisplayName": "Jane Doe",
      "avatarUrl": "https://pbs.twimg.com/...",
      "status": "connected",
      "permissions": ["tweet", "read"],
      "expiresAt": "2026-08-21T12:00:00Z",
      "lastSyncedAt": "2026-07-22T11:55:00Z"
    }
  ]
}
```

**Account statuses:** `connected`, `expired`, `revoked`, `error`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/accounts/connect`

Initiate OAuth for a social account.

**Auth:** Required, `accounts:write`

**Platform-specific request body:**

```json
{
  "platform": "twitter",
  "redirectUri": "https://app.smos.io/oauth/callback"
}
```

**Response `200`:**
```json
{
  "data": {
    "authUrl": "https://twitter.com/i/oauth2/authorize?..."
  }
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/accounts/{accountId}/refresh`

Manually trigger token refresh.

**Auth:** Required, `accounts:write`

**Response `200`:**
```json
{
  "data": {
    "status": "connected",
    "expiresAt": "2026-08-21T12:00:00Z"
  }
}
```

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/accounts/{accountId}`

Disconnect a social account.

**Auth:** Required, `accounts:write`

**Response `204`**

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/accounts/{accountId}/status`

Get detailed account health.

**Response `200`:**
```json
{
  "data": {
    "status": "connected",
    "rateLimitRemaining": 280,
    "rateLimitResetAt": "2026-07-22T13:00:00Z",
    "lastError": null
  }
}
```

---

### 6.5 Posts

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/posts`

List posts.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `status` | string | `draft`, `scheduled`, `published`, `failed`, `all` |
| `platform` | string | Filter by platform |
| `q` | string | Search by title or content |
| `tags` | string | Comma-separated tag filter |
| `startDate` | string | ISO date range start |
| `endDate` | string | ISO date range end |
| `createdBy` | string | User ID filter |

**Auth:** Required, `posts:read`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/posts`

Create a post.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "title": "Product Launch Announcement",
  "content": {
    "text": "We're thrilled to announce...",
    "mediaIds": ["media_abc123", "media_def456"]
  },
  "platforms": [
    {
      "platform": "twitter",
      "contentOverride": { "text": "Shorter version for Twitter..." },
      "scheduledAt": "2026-07-23T09:00:00Z",
      "publishAs": "sa_4e5f6g"
    },
    {
      "platform": "linkedin",
      "scheduledAt": "2026-07-23T09:00:00Z",
      "publishAs": "sa_7h8i9j"
    }
  ],
  "tags": ["launch", "product"],
  "campaignId": "cmp_abc123"
}
```

**Response `201`:**
```json
{
  "data": {
    "id": "post_xyz789",
    "status": "draft",
    "platforms": [
      {
        "platform": "twitter",
        "status": "draft",
        "scheduledAt": "2026-07-23T09:00:00Z"
      },
      {
        "platform": "linkedin",
        "status": "draft",
        "scheduledAt": "2026-07-23T09:00:00Z"
      }
    ]
  }
}
```

**Errors:** `VALIDATION_ERROR`, `QUOTA_EXCEEDED`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}`

Get post details including version history summary.

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}`

Update post content, platforms, or schedule.

**Auth:** Required, `posts:write`

**Note:** Updating a post creates a new version entry. The post must not be in `published` status.

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}`

Delete a post. If published, the post remains in analytics but is marked as deleted.

**Auth:** Required, `posts:write`

**Response `204`**

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}/publish`

Publish immediately.

**Auth:** Required, `posts:publish`

**Response `200`:**
```json
{
  "data": {
    "id": "post_xyz789",
    "status": "publishing",
    "platformStatuses": [
      { "platform": "twitter", "status": "publishing" },
      { "platform": "linkedin", "status": "queued" }
    ]
  }
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}/schedule`

Set or update the schedule.

**Auth:** Required, `posts:publish`

**Request:**
```json
{
  "platforms": [
    { "platform": "twitter", "scheduledAt": "2026-07-24T10:00:00Z" }
  ]
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}/approve`

Approve a post for publishing (when workflow requires approval).

**Auth:** Required, role `admin` or `editor`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}/cancel`

Cancel a scheduled post.

**Auth:** Required, `posts:write`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}/versions`

List version history.

**Response `200`:**
```json
{
  "data": [
    {
      "versionId": "pv_001",
      "version": 3,
      "updatedBy": "user_2f3a1b",
      "updatedAt": "2026-07-22T11:00:00Z",
      "changeDescription": "Updated image and caption"
    }
  ]
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/{postId}/versions/{versionId}`

Get full content of a specific version.

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/bulk`

Create multiple posts at once.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "posts": [
    { "title": "Post 1", "content": { "text": "..." }, "platforms": [...] },
    { "title": "Post 2", "content": { "text": "..." }, "platforms": [...] }
  ]
}
```

**Response `201`:** Array of created posts

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/posts/bulk-publish`

Publish multiple posts.

**Request:**
```json
{
  "postIds": ["post_1", "post_2", "post_3"]
}
```

---

### 6.6 Content Library

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/content`

List content items.

**Query Parameters:** `?folderId=...&tag=...&q=search&sort=-updatedAt`

**Auth:** Required, `posts:read`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/content`

Create a content item.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "title": "Evergreen Blog Post",
  "body": "Full content body in markdown...",
  "type": "blog_post",
  "folderId": "folder_abc",
  "tags": ["evergreen", "blog"],
  "metadata": {
    "wordCount": 1200,
    "readTime": 5
  }
}
```

**Content types:** `social_post`, `blog_post`, `email`, `ad_copy`, `landing_page`, `script`, `custom`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/content/{contentId}`

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/content/{contentId}`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/content/{contentId}`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/folders`

List content folders (tree structure).

**Response `200`:**
```json
{
  "data": [
    {
      "id": "folder_abc",
      "name": "Q3 Campaigns",
      "parentId": null,
      "children": [
        { "id": "folder_def", "name": "Product Launch", "parentId": "folder_abc", "children": [] }
      ]
    }
  ]
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/folders`

Create a folder.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "name": "New Folder",
  "parentId": "folder_abc"
}
```

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/folders/{folderId}`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/folders/{folderId}`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/tags`

List all tags with usage counts.

**Response `200`:**
```json
{
  "data": [
    { "tag": "launch", "count": 24 },
    { "tag": "product", "count": 15 }
  ]
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/content/search`

Full-text search across content library.

**Request:**
```json
{
  "query": "product launch",
  "filters": {
    "tags": ["launch"],
    "type": "blog_post",
    "dateRange": { "start": "2026-01-01", "end": "2026-12-31" }
  }
}
```

---

### 6.7 Media

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/media`

List media assets.

**Query Parameters:** `?type=image&sort=-createdAt`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/media/upload`

Upload a media file.

**Auth:** Required, `media:write`

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | file | The media file |
| `altText` | string | Accessibility description |
| `folderId` | string | Optional folder assignment |

**Supported formats:**
- Images: JPEG, PNG, GIF, WebP, AVIF, SVG (max 50MB)
- Videos: MP4, MOV, AVI, WebM (max 500MB)
- Audio: MP3, WAV, AAC, OGG (max 100MB)
- Documents: PDF (max 50MB)

**Response `201`:**
```json
{
  "data": {
    "id": "media_abc123",
    "url": "https://media.smos.io/org_8d4e2c/abc123.png",
    "thumbnailUrl": "https://media.smos.io/org_8d4e2c/abc123_thumb.png",
    "type": "image",
    "mimeType": "image/png",
    "size": 245000,
    "width": 1920,
    "height": 1080,
    "altText": "Product launch banner"
  }
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/media/{mediaId}`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/media/{mediaId}`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/media/{mediaId}/optimize`

Optimize an image for a specific platform.

**Auth:** Required, `media:write`

**Request:**
```json
{
  "platform": "twitter",
  "format": "webp",
  "quality": 80
}
```

**Response `200`:**
```json
{
  "data": {
    "url": "https://media.smos.io/org_8d4e2c/abc123_optimized.webp",
    "size": 45000,
    "width": 1200,
    "height": 675
  }
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/media/{mediaId}/transform`

Apply image transformations.

**Request:**
```json
{
  "resize": { "width": 800, "height": 800, "fit": "cover" },
  "crop": { "x": 0, "y": 0, "width": 500, "height": 500 },
  "filters": {
    "brightness": 1.1,
    "contrast": 1.2,
    "saturate": 1.0
  },
  "format": "webp",
  "quality": 85
}
```

---

### 6.8 AI

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/ai/generate`

Generate content using AI.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "prompt": "Write a Twitter thread about our new AI-powered scheduling feature",
  "platform": "twitter",
  "tone": "professional",
  "brandVoiceId": "bv_abc123",
  "maxLength": 280,
  "variations": 3,
  "includeHashtags": true,
  "referenceUrls": ["https://blog.smos.io/new-feature"]
}
```

**Response `201`:**
```json
{
  "data": {
    "variations": [
      {
        "text": "We just launched AI-powered scheduling...",
        "hashtags": ["#SocialMedia", "#AI"],
        "characterCount": 245,
        "score": 0.92
      }
    ],
    "usage": {
      "model": "claude-sonnet-4",
      "promptTokens": 450,
      "completionTokens": 120,
      "costCredits": 0.05
    }
  }
}
```

**Errors:** `AI_PROVIDER_ERROR`, `AI_CONTENT_MODERATED`, `QUOTA_EXCEEDED`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/ai/repurpose`

Repurpose content for multiple platforms.

**Request:**
```json
{
  "sourceContent": "Full blog post content...",
  "sourceType": "blog_post",
  "targets": [
    { "platform": "twitter", "format": "thread" },
    { "platform": "linkedin", "format": "article" },
    { "platform": "instagram", "format": "carousel" }
  ],
  "brandVoiceId": "bv_abc123"
}
```

**Response `201`:** Content variations per platform

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/ai/improve`

Improve existing content.

**Request:**
```json
{
  "content": "Original post text...",
  "aspects": ["clarity", "engagement", "length"],
  "platform": "twitter",
  "brandVoiceId": "bv_abc123"
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/ai/translate`

Translate content.

**Request:**
```json
{
  "content": "Text to translate...",
  "sourceLanguage": "en",
  "targetLanguages": ["es", "fr", "de", "ja"],
  "preserveTone": true
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/ai/analyze`

Analyze content for effectiveness.

**Request:**
```json
{
  "content": "Post content to analyze...",
  "platform": "twitter",
  "analysisType": "engagement_potential"
}
```

**Analysis types:** `engagement_potential`, `sentiment`, `readability`, `seo`, `brand_consistency`

**Response `200`:**
```json
{
  "data": {
    "engagementScore": 78,
    "sentiment": "positive",
    "readabilityScore": 65,
    "suggestions": [
      "Add a call to action",
      "Consider using more emojis for this platform"
    ]
  }
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/ai/hashtags`

Generate hashtag suggestions.

**Request:**
```json
{
  "content": "Post about AI-powered social media scheduling",
  "platform": "instagram",
  "count": 10
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/ai/best-time`

Get AI-suggested best posting times.

**Request:**
```json
{
  "platforms": ["twitter", "instagram", "linkedin"],
  "accountIds": ["sa_4e5f6g", "sa_7h8i9j"]
}
```

---

### 6.9 Analytics

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/analytics/overview`

Get workspace analytics summary.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `startDate` | string | ISO date (default: 30 days ago) |
| `endDate` | string | ISO date (default: today) |
| `granularity` | string | `day`, `week`, `month` |

**Auth:** Required, `analytics:read`

**Response `200`:**
```json
{
  "data": {
    "summary": {
      "totalPosts": 142,
      "totalImpressions": 1250000,
      "totalEngagements": 45000,
      "totalClicks": 12000,
      "engagementRate": 3.6,
      "followerGrowth": 1250
    },
    "byPlatform": [
      {
        "platform": "twitter",
        "impressions": 450000,
        "engagements": 18000,
        "engagementRate": 4.0
      }
    ],
    "trends": [
      { "date": "2026-06-22", "impressions": 40000, "engagements": 1500 },
      { "date": "2026-06-23", "impressions": 42000, "engagements": 1600 }
    ]
  }
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/analytics/platform/{platform}`

Detailed analytics for a single platform.

**Additional query params:** `?accountId=sa_4e5f6g`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/analytics/post/{postId}`

Analytics for a single post.

**Response `200`:**
```json
{
  "data": {
    "postId": "post_xyz789",
    "platformBreakdown": [
      {
        "platform": "twitter",
        "impressions": 12500,
        "likes": 450,
        "retweets": 120,
        "replies": 34,
        "clicks": 890,
        "bookmarks": 67,
        "reach": 15000
      },
      {
        "platform": "linkedin",
        "impressions": 8000,
        "likes": 234,
        "comments": 45,
        "shares": 67,
        "clicks": 456
      }
    ],
    "total": {
      "impressions": 20500,
      "engagements": 2463,
      "engagementRate": 12.0
    }
  }
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/analytics/best-posts`

Get top performing posts.

**Query Parameters:** `?metric=engagement&limit=10&startDate=...&endDate=...`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/analytics/audience`

Audience demographics and insights.

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/analytics/export`

Export analytics report.

**Request:**
```json
{
  "format": "csv",
  "dateRange": { "start": "2026-06-01", "end": "2026-07-22" },
  "platforms": ["twitter", "instagram"],
  "metrics": ["impressions", "engagements", "clicks", "followers"],
  "granularity": "day"
}
```

**Response `202`:**
```json
{
  "data": {
    "exportId": "exp_abc123",
    "status": "processing",
    "downloadUrl": null
  }
}
```

**Export statuses:** `processing`, `ready`, `failed`

The export is processed asynchronously. Poll `GET /v1/analytics/exports/{exportId}` for status.

---

### 6.10 Engagement

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/engagement/comments`

List comments across connected accounts.

**Query Parameters:**
| Param | Type | Description |
|---|---|---|
| `accountId` | string | Filter by social account |
| `status` | string | `pending`, `replied`, `archived`, `flagged` |
| `sentiment` | string | `positive`, `negative`, `neutral` |
| `q` | string | Search in comment text |

**Auth:** Required, `posts:read`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/engagement/comments/{commentId}`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/engagement/comments/{commentId}/reply`

Reply to a comment.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "text": "Thank you for your feedback! We're glad you love the feature.",
  "aiAssisted": true
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/engagement/comments/{commentId}/draft-reply`

Generate an AI-powered draft reply.

**Request:**
```json
{
  "tone": "friendly",
  "includeEmoji": true
}
```

**Response `200`:**
```json
{
  "data": {
    "draftText": "Thanks so much for sharing your thoughts! 😊 We're always working to improve."
  }
}
```

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/engagement/comments/{commentId}`

Update comment status or assignee.

**Request:**
```json
{
  "status": "archived",
  "assignedTo": "user_2f3a1b"
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/engagement/sentiment`

Sentiment analysis overview.

**Query Parameters:** `?startDate=...&endDate=...&platform=twitter`

**Response `200`:**
```json
{
  "data": {
    "overall": { "positive": 65, "neutral": 25, "negative": 10 },
    "trend": [
      { "date": "2026-07-15", "positive": 60, "neutral": 30, "negative": 10 },
      { "date": "2026-07-16", "positive": 68, "neutral": 22, "negative": 10 }
    ]
  }
}
```

---

### 6.11 Workflows

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows`

List workflows.

**Auth:** Required, `workflows:read`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows`

Create a workflow.

**Auth:** Required, `workflows:write`

**Request:**
```json
{
  "name": "Blog to Social Pipeline",
  "description": "When a blog post is published, repurpose it for all platforms",
  "trigger": {
    "type": "webhook",
    "config": {
      "endpoint": "/hooks/blog-published",
      "method": "POST"
    }
  },
  "steps": [
    {
      "id": "step_1",
      "type": "ai_repurpose",
      "config": {
        "inputPath": "$.body.content",
        "targetPlatforms": ["twitter", "linkedin", "facebook"],
        "brandVoiceId": "bv_abc123"
      },
      "next": "step_2"
    },
    {
      "id": "step_2",
      "type": "ai_generate_images",
      "config": {
        "inputPath": "$.steps.step_1.output"
      },
      "next": "step_3"
    },
    {
      "id": "step_3",
      "type": "create_drafts",
      "config": {
        "status": "draft"
      },
      "next": null
    }
  ],
  "errorStep": {
    "type": "notify",
    "config": {
      "channels": ["email", "in_app"],
      "recipients": ["user_2f3a1b"]
    }
  },
  "enabled": true
}
```

**Workflow step types:** `ai_generate`, `ai_repurpose`, `ai_improve`, `ai_translate`, `ai_analyze`, `ai_generate_images`, `http_request`, `mcp_call`, `create_drafts`, `schedule_post`, `publish_post`, `condition`, `delay`, `notify`, `transform_data`, `webhook_call`

**Response `201`:** Workflow object with `id`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}`

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}/activate`

Activate a workflow.

**Auth:** Required, `workflows:write`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}/deactivate`

Deactivate a workflow.

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}/executions`

List workflow executions.

**Query Parameters:** `?status=success&limit=20`

**Response `200`:**
```json
{
  "data": [
    {
      "id": "exec_abc123",
      "workflowId": "wf_xyz789",
      "status": "success",
      "triggeredBy": "webhook",
      "startedAt": "2026-07-22T10:00:00Z",
      "completedAt": "2026-07-22T10:00:45Z",
      "durationMs": 45000,
      "stepsCompleted": 3,
      "stepsTotal": 3
    }
  ]
}
```

**Execution statuses:** `pending`, `running`, `success`, `failed`, `cancelled`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}/executions/{executionId}`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/workflows/{workflowId}/executions/{executionId}/logs`

Get execution logs.

**Response `200`:**
```json
{
  "data": [
    {
      "timestamp": "2026-07-22T10:00:10Z",
      "level": "info",
      "stepId": "step_1",
      "message": "Starting AI repurpose step",
      "metadata": { "inputLength": 2500 }
    },
    {
      "timestamp": "2026-07-22T10:00:35Z",
      "level": "error",
      "stepId": "step_2",
      "message": "Image generation failed: rate limit exceeded",
      "metadata": { "retryCount": 2 }
    }
  ]
}
```

---

### 6.12 MCP (Model Context Protocol)

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/servers`

List registered MCP servers.

**Auth:** Required, `mcp:read`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/servers`

Register an MCP server.

**Auth:** Required, `mcp:write`

**Request:**
```json
{
  "name": "My Analytics Server",
  "description": "Custom analytics data source",
  "type": "custom",
  "transport": {
    "type": "sse",
    "url": "https://mcp.myanalytics.com/sse"
  },
  "authentication": {
    "type": "api_key",
    "credentials": { "apiKey": "mcp_key_xxxx" }
  },
  "scopes": ["analytics:read"],
  "tools": ["get_metrics", "get_report"],
  "resources": ["analytics://*"]
}
```

**Transport types:** `sse` (Server-Sent Events), `streamable-http`, `stdio` (local only)

**Response `201`:**
```json
{
  "data": {
    "id": "mcp_abc123",
    "name": "My Analytics Server",
    "status": "connected",
    "capabilities": {
      "tools": ["get_metrics", "get_report"],
      "resources": ["analytics://*"],
      "prompts": []
    },
    "health": {
      "status": "healthy",
      "latencyMs": 45,
      "checkedAt": "2026-07-22T12:00:00Z"
    }
  }
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/servers/{serverId}`

Get server details and health status.

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/servers/{serverId}/test`

Test connection to the MCP server.

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/servers/{serverId}`

Disconnect and remove an MCP server.

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/servers/{serverId}/reconnect`

Reconnect a disconnected server.

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/servers/{serverId}/call`

Call a tool on the MCP server.

**Auth:** Required, `mcp:write`

**Request:**
```json
{
  "tool": "get_metrics",
  "arguments": {
    "startDate": "2026-07-01",
    "endDate": "2026-07-22",
    "metrics": ["impressions", "clicks"]
  }
}
```

**Response `200`:**
```json
{
  "data": {
    "result": { ... },
    "meta": {
      "serverId": "mcp_abc123",
      "executionTimeMs": 230,
      "costCredits": 0
    }
  }
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/mcp/discover`

Discover MCP servers from the marketplace.

**Query Parameters:** `?q=analytics&category=analytics`

#### `GET /v1/mcp/marketplace`

List available MCP servers in the marketplace.

**Auth:** Not required

#### `POST /v1/mcp/marketplace/{serverId}/install`

Install a marketplace MCP server.

**Auth:** Required, `mcp:write`

---

### 6.13 Brand Voices

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/brand-voices`

List brand voices.

**Auth:** Required, `posts:read`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/brand-voices`

Create a brand voice profile.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "name": "Professional & Trustworthy",
  "description": "Used for LinkedIn and corporate blog",
  "tone": "professional",
  "guidelines": {
    "vocabulary": ["innovative", "reliable", "enterprise-grade"],
    "forbiddenWords": ["cheap", "hacky", "easy money"],
    "style": "formal",
    "emojiUsage": "minimal",
    "sentenceLength": "moderate",
    "perspective": "first_person_plural"
  },
  "examplePhrases": [
    "We deliver enterprise-grade solutions.",
    "Our platform scales with your business."
  ],
  "platformDefaults": {
    "twitter": { "style": "conversational", "emojiUsage": "moderate" },
    "linkedin": { "style": "formal", "emojiUsage": "minimal" }
  }
}
```

**Tone options:** `professional`, `conversational`, `humorous`, `inspirational`, `authoritative`, `friendly`, `luxury`, `educational`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/brand-voices/{voiceId}`

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/brand-voices/{voiceId}`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/brand-voices/{voiceId}`

---

### 6.14 Campaigns

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns`

List campaigns.

**Query Parameters:** `?status=active&startDate=...&endDate=...`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns`

Create a campaign.

**Auth:** Required, `posts:write`

**Request:**
```json
{
  "name": "Q3 Product Launch",
  "description": "Cross-platform product launch campaign",
  "goal": "brand_awareness",
  "startDate": "2026-08-01",
  "endDate": "2026-08-31",
  "budget": 50000,
  "platforms": ["twitter", "linkedin", "instagram"],
  "targetAudience": {
    "industries": ["tech", "saas"],
    "locations": ["US", "UK", "CA"],
    "ageRange": { "min": 25, "max": 45 }
  },
  "tags": ["launch", "q3"]
}
```

**Goal options:** `brand_awareness`, `engagement`, `traffic`, `leads`, `sales`, `community_growth`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns/{campaignId}`

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns/{campaignId}`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns/{campaignId}`

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns/{campaignId}/activate`

Activate a campaign.

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns/{campaignId}/pause`

Pause an active campaign.

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns/{campaignId}/analytics`

Campaign-specific analytics.

**Response `200`:**
```json
{
  "data": {
    "campaignId": "cmp_abc123",
    "period": { "start": "2026-08-01", "end": "2026-08-31" },
    "budget": { "planned": 50000, "spent": 32500 },
    "performance": {
      "impressions": 450000,
      "reach": 320000,
      "engagements": 28000,
      "clicks": 8900,
      "conversions": 450,
      "ctr": 1.98,
      "engagementRate": 6.2,
      "cpc": 3.65
    },
    "byPlatform": [...]
  }
}
```

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/campaigns/{campaignId}/calendar`

Get content calendar for a campaign.

---

### 6.15 Billing

#### `GET /v1/orgs/{orgId}/billing/plan`

Get current plan details.

**Auth:** Required, role `admin` or `owner`

**Response `200`:**
```json
{
  "data": {
    "plan": "business",
    "status": "active",
    "features": {
      "workspaces": 10,
      "postsPerMonth": 5000,
      "socialAccounts": 50,
      "teamMembers": 25,
      "aiCredits": 10000,
      "mcpServers": 10
    },
    "currentPeriod": {
      "start": "2026-07-01",
      "end": "2026-07-31"
    },
    "usage": {
      "postsUsed": 2340,
      "aiCreditsUsed": 4560,
      "storageUsed": 2560000000
    }
  }
}
```

#### `GET /v1/orgs/{orgId}/billing/plans`

List available plans with pricing.

**Auth:** Not required

#### `POST /v1/orgs/{orgId}/billing/checkout`

Create a checkout session for plan change.

**Request:**
```json
{
  "plan": "business",
  "interval": "monthly",
  "successUrl": "https://app.smos.io/billing/success",
  "cancelUrl": "https://app.smos.io/billing"
}
```

**Response `200:`**
```json
{
  "data": {
    "checkoutUrl": "https://checkout.stripe.com/session_..."
  }
}
```

#### `POST /v1/orgs/{orgId}/billing/portal`

Get customer portal URL.

**Response `200:`**
```json
{
  "data": {
    "portalUrl": "https://billing.stripe.com/portal/..."
  }
}
```

#### `GET /v1/orgs/{orgId}/billing/invoices`

List invoices.

**Query Parameters:** `?limit=10&status=paid`

#### `POST /v1/orgs/{orgId}/billing/invoices/{invoiceId}/download`

Get invoice download URL.

#### `GET /v1/orgs/{orgId}/billing/usage`

Get detailed usage breakdown.

---

### 6.16 Admin

*All admin endpoints require `admin:read` or `admin:write` scope and a user with `super_admin` role.*

#### `GET /v1/admin/users`

List all users.

**Query Parameters:** `?q=search&page=1&per_page=25`

#### `GET /v1/admin/users/{userId}`

#### `PATCH /v1/admin/users/{userId}`

Suspend, activate, or change user role.

**Request:**
```json
{
  "status": "suspended",
  "reason": "Terms of service violation"
}
```

#### `DELETE /v1/admin/users/{userId}`

Permanently delete a user.

#### `GET /v1/admin/orgs`

List all organizations.

#### `GET /v1/admin/orgs/{orgId}`

#### `PATCH /v1/admin/orgs/{orgId}`

Force-change plan or modify org-level settings.

#### `DELETE /v1/admin/orgs/{orgId}`

Force-delete an organization.

#### `GET /v1/admin/feature-flags`

List all feature flags.

**Response `200`:**
```json
{
  "data": [
    {
      "key": "ai_image_generation",
      "enabled": true,
      "orgOverrides": ["org_8d4e2c"],
      "description": "Enable AI image generation for all orgs"
    }
  ]
}
```

#### `PATCH /v1/admin/feature-flags/{key}`

Enable/disable a feature flag or set org overrides.

**Request:**
```json
{
  "enabled": false,
  "orgOverrides": ["org_abc123"]
}
```

#### `GET /v1/admin/system/health`

System health overview.

**Response `200`:**
```json
{
  "data": {
    "status": "healthy",
    "uptime": 1209600,
    "services": {
      "api": { "status": "healthy", "latencyMs": 12 },
      "database": { "status": "healthy", "connections": 45, "latencyMs": 3 },
      "redis": { "status": "healthy", "memoryUsagePercent": 62 },
      "bullmq": { "status": "healthy", "queuedJobs": 234, "activeJobs": 12 },
      "aiProviders": {
        "openai": { "status": "healthy", "latencyMs": 850 },
        "claude": { "status": "healthy", "latencyMs": 1200 },
        "gemini": { "status": "degraded", "errorRate": 0.05 }
      },
      "platformApis": {
        "twitter": { "status": "healthy", "rateLimitRemaining": 280 },
        "instagram": { "status": "healthy" }
      }
    }
  }
}
```

#### `GET /v1/admin/system/logs`

Recent system logs.

#### `GET /v1/admin/system/metrics`

System metrics (requests/min, error rates, p50/p95/p99 latency).

---

## 7. GraphQL Schema

### 7.1 Key Types

```graphql
type Query {
  # Workspace
  workspace(id: ID!): Workspace
  workspaces(orgId: ID!): [Workspace!]!

  # Posts
  post(id: ID!): Post
  posts(
    workspaceId: ID!
    status: PostStatus
    platform: Platform
    search: String
    tags: [String!]
    cursor: String
    limit: Int
  ): PostConnection!

  # Content
  contentItem(id: ID!): ContentItem
  contentItems(workspaceId: ID!, folderId: ID, cursor: String, limit: Int): ContentConnection!

  # Analytics
  analyticsOverview(workspaceId: ID!, startDate: Date!, endDate: Date!): AnalyticsOverview!
  analyticsByPlatform(workspaceId: ID!, platform: Platform!, startDate: Date!, endDate: Date!): PlatformAnalytics!
  postAnalytics(postId: ID!): PostAnalytics!

  # Accounts
  socialAccounts(workspaceId: ID!): [SocialAccount!]!
  socialAccount(id: ID!): SocialAccount

  # AI
  brandVoices(workspaceId: ID!): [BrandVoice!]!
  hashtagSuggestions(content: String!, platform: Platform!, count: Int): [HashtagSuggestion!]!

  # Workflows
  workflows(workspaceId: ID!): [Workflow!]!
  workflow(id: ID!): Workflow
  workflowExecutions(workflowId: ID!, status: ExecutionStatus, cursor: String): ExecutionConnection!

  # MCP
  mcpServers(workspaceId: ID!): [MCPServer!]!
  mcpServer(id: ID!): MCPServer
  mcpMarketplace(search: String, category: String): [MCPListing!]!

  # Campaigns
  campaigns(workspaceId: ID!): [Campaign!]!
  campaign(id: ID!): Campaign
  campaignAnalytics(campaignId: ID!): CampaignAnalytics!

  # Engagement
  comments(workspaceId: ID!, accountId: ID, status: CommentStatus, cursor: String): CommentConnection!
  comment(id: ID!): Comment
  sentimentAnalysis(workspaceId: ID!, startDate: Date!, endDate: Date!): SentimentAnalysis!

  # Billing
  billingPlan(orgId: ID!): BillingPlan!
  invoices(orgId: ID!): [Invoice!]!

  # Organization
  organization(id: ID!): Organization
  members(orgId: ID!): [Member!]!
}

type Mutation {
  # Auth
  register(input: RegisterInput!): AuthPayload!
  login(input: LoginInput!): AuthPayload!
  refreshToken(refreshToken: String!): AuthPayload!
  revokeTokens: Boolean!

  # Posts
  createPost(input: CreatePostInput!): Post!
  updatePost(id: ID!, input: UpdatePostInput!): Post!
  deletePost(id: ID!): Boolean!
  publishPost(id: ID!): Post!
  schedulePost(id: ID!, platformSchedules: [PlatformScheduleInput!]!): Post!
  approvePost(id: ID!): Post!
  cancelPost(id: ID!): Post!
  bulkCreatePosts(inputs: [CreatePostInput!]!): [Post!]!
  bulkPublishPosts(ids: [ID!]!): [Post!]!

  # AI
  generateContent(input: GenerateContentInput!): [ContentVariation!]!
  repurposeContent(input: RepurposeContentInput!): RepurposeResult!
  improveContent(input: ImproveContentInput!): ImprovedContent!
  translateContent(input: TranslateContentInput!): TranslationResult!
  analyzeContent(input: AnalyzeContentInput!): ContentAnalysis!

  # Media
  uploadMedia(file: Upload!, altText: String, folderId: ID): Media!
  deleteMedia(id: ID!): Boolean!
  optimizeMedia(id: ID!, platform: Platform!): Media!
  transformMedia(id: ID!, transformations: TransformInput!): Media!

  # Content Library
  createContentItem(input: CreateContentItemInput!): ContentItem!
  updateContentItem(id: ID!, input: UpdateContentItemInput!): ContentItem!
  deleteContentItem(id: ID!): Boolean!
  createFolder(input: CreateFolderInput!): Folder!
  updateFolder(id: ID!, input: UpdateFolderInput!): Folder!
  deleteFolder(id: ID!): Boolean!

  # Social Accounts
  connectAccount(platform: Platform!, redirectUri: String!): OAuthUrl!
  disconnectAccount(id: ID!): Boolean!
  refreshAccountToken(id: ID!): SocialAccount!

  # Engagement
  replyToComment(commentId: ID!, text: String!): Comment!
  generateDraftReply(commentId: ID!, tone: String, includeEmoji: Boolean): DraftReply!
  updateComment(id: ID!, input: UpdateCommentInput!): Comment!

  # Workflows
  createWorkflow(input: CreateWorkflowInput!): Workflow!
  updateWorkflow(id: ID!, input: UpdateWorkflowInput!): Workflow!
  deleteWorkflow(id: ID!): Boolean!
  activateWorkflow(id: ID!): Workflow!
  deactivateWorkflow(id: ID!): Workflow!
  triggerWorkflow(id: ID!, payload: JSON!): WorkflowExecution!

  # MCP
  registerMCPServer(input: RegisterMCPServerInput!): MCPServer!
  deleteMCPServer(id: ID!): Boolean!
  reconnectMCPServer(id: ID!): MCPServer!
  callMCPTool(serverId: ID!, tool: String!, arguments: JSON!): MCPCallResult!
  installMCPMarketplace(serverId: ID!): MCPServer!

  # Campaigns
  createCampaign(input: CreateCampaignInput!): Campaign!
  updateCampaign(id: ID!, input: UpdateCampaignInput!): Campaign!
  deleteCampaign(id: ID!): Boolean!
  activateCampaign(id: ID!): Campaign!
  pauseCampaign(id: ID!): Campaign!

  # Organization
  createOrganization(input: CreateOrganizationInput!): Organization!
  updateOrganization(id: ID!, input: UpdateOrganizationInput!): Organization!
  deleteOrganization(id: ID!): Boolean!
  inviteMember(orgId: ID!, email: String!, role: Role!, workspaceIds: [ID!]): Invite!
  cancelInvite(orgId: ID!, inviteId: ID!): Boolean!
  removeMember(orgId: ID!, userId: ID!): Boolean!
  changeMemberRole(orgId: ID!, userId: ID!, role: Role!): Member!
  transferOwnership(orgId: ID!, newOwnerUserId: ID!): Organization!

  # Billing
  createCheckoutSession(orgId: ID!, plan: String!, interval: BillingInterval!): CheckoutSession!
  getBillingPortal(orgId: ID!): PortalSession!

  # Brand Voices
  createBrandVoice(input: CreateBrandVoiceInput!): BrandVoice!
  updateBrandVoice(id: ID!, input: UpdateBrandVoiceInput!): BrandVoice!
  deleteBrandVoice(id: ID!): Boolean!

  # Analytics
  exportAnalytics(input: ExportAnalyticsInput!): ExportJob!
}

type Subscription {
  # Real-time publishing status
  postPublishingStatus(postId: ID!, workspaceId: ID!): PostPlatformStatus!
  postPublished(postId: ID!, workspaceId: ID!): PostPublishedEvent!

  # Real-time notifications
  notification(workspaceId: ID!): Notification!

  # Workflow execution updates
  workflowExecutionProgress(executionId: ID!): WorkflowStepEvent!
  workflowExecutionLog(executionId: ID!): WorkflowLogEntry!

  # MCP server status
  mcpServerStatus(serverId: ID!): MCPServerStatusEvent!

  # Engagement
  newComment(workspaceId: ID!, accountId: ID): Comment!
  commentUpdated(commentId: ID!): Comment!
}
```

### 7.2 Key Enums

```graphql
enum Platform {
  FACEBOOK
  INSTAGRAM
  TWITTER
  LINKEDIN
  TIKTOK
  PINTEREST
  YOUTUBE
  THREADS
  BLUESKY
  REDDIT
  TELEGRAM
  GOOGLE_BUSINESS
}

enum PostStatus {
  DRAFT
  SCHEDULED
  PUBLISHING
  PUBLISHED
  FAILED
  CANCELLED
}

enum PostPlatformStatus {
  DRAFT
  SCHEDULED
  PUBLISHING
  PUBLISHED
  FAILED
  PARTIALLY_FAILED
}

enum Tone {
  PROFESSIONAL
  CONVERSATIONAL
  HUMOROUS
  INSPIRATIONAL
  AUTHORITATIVE
  FRIENDLY
  LUXURY
  EDUCATIONAL
}

enum Role {
  OWNER
  ADMIN
  EDITOR
  VIEWER
  MCP
}

enum CommentStatus {
  PENDING
  REPLIED
  ARCHIVED
  FLAGGED
}

enum WorkflowStepType {
  AI_GENERATE
  AI_REPURPOSE
  AI_IMPROVE
  AI_TRANSLATE
  AI_ANALYZE
  AI_GENERATE_IMAGES
  HTTP_REQUEST
  MCP_CALL
  CREATE_DRAFTS
  SCHEDULE_POST
  PUBLISH_POST
  CONDITION
  DELAY
  NOTIFY
  TRANSFORM_DATA
  WEBHOOK_CALL
}

enum BillingInterval {
  MONTHLY
  ANNUAL
}
```

### 7.3 Type Definitions

```graphql
type Post {
  id: ID!
  workspaceId: ID!
  title: String
  content: PostContent!
  platforms: [PostPlatformConfig!]!
  status: PostStatus!
  tags: [String!]
  campaignId: ID
  brandVoiceId: ID
  createdBy: User!
  version: Int!
  createdAt: Date!
  updatedAt: Date!
  publishedAt: Date
  platformStatuses: [PostPlatformStatus!]!
  analytics: PostAnalytics
}

type PostContent {
  text: String
  mediaIds: [ID!]
  linkUrl: String
  pollData: PollData
}

type PostPlatformConfig {
  platform: Platform!
  accountId: ID!
  contentOverride: PostContent
  scheduledAt: Date
  status: PostPlatformStatus!
  platformPostId: String
  publishError: String
}

type SocialAccount {
  id: ID!
  platform: Platform!
  platformUserId: String!
  platformUsername: String
  platformDisplayName: String!
  avatarUrl: String
  status: AccountStatus!
  permissions: [String!]!
  expiresAt: Date
  lastSyncedAt: Date
  createdAt: Date!
}

type Workflow {
  id: ID!
  workspaceId: ID!
  name: String!
  description: String
  trigger: WorkflowTrigger!
  steps: [WorkflowStep!]!
  errorStep: WorkflowErrorStep
  enabled: Boolean!
  lastExecution: WorkflowExecution
  createdAt: Date!
  updatedAt: Date!
}

type WorkflowTrigger {
  type: WorkflowTriggerType!
  config: JSON!
}

type WorkflowStep {
  id: ID!
  type: WorkflowStepType!
  config: JSON!
  next: String
}

type WorkflowExecution {
  id: ID!
  workflowId: ID!
  status: ExecutionStatus!
  triggeredBy: String!
  input: JSON
  output: JSON
  startedAt: Date!
  completedAt: Date
  durationMs: Int
  stepsCompleted: Int!
  stepsTotal: Int!
  error: ExecutionError
  logs: [WorkflowLogEntry!]
}

type MCPServer {
  id: ID!
  name: String!
  description: String
  type: MCPServerType!
  transport: MCPTransport!
  status: MCPConnectionStatus!
  capabilities: MCPCapabilities!
  health: MCPHealth
  createdAt: Date!
  lastUsedAt: Date
}

type BrandVoice {
  id: ID!
  name: String!
  description: String
  tone: Tone!
  guidelines: VoiceGuidelines!
  examplePhrases: [String!]
  platformDefaults: JSON
  createdAt: Date!
  updatedAt: Date!
}

type Campaign {
  id: ID!
  name: String!
  description: String
  goal: CampaignGoal!
  startDate: Date!
  endDate: Date!
  budget: Float
  platforms: [Platform!]!
  status: CampaignStatus!
  tags: [String!]
  createdAt: Date!
  updatedAt: Date!
}

type Comment {
  id: ID!
  accountId: ID!
  platform: Platform!
  platformPostId: String!
  platformCommentId: String!
  authorName: String!
  authorAvatar: String
  text: String!
  mediaUrls: [String!]
  sentiment: SentimentType!
  status: CommentStatus!
  replyCount: Int!
  likeCount: Int!
  replies: [Comment!]
  createdAt: Date!
}

type AnalyticsOverview {
  summary: AnalyticsSummary!
  byPlatform: [PlatformAnalytics!]!
  trends: [DailyTrend!]!
}

type AnalyticsSummary {
  totalPosts: Int!
  totalImpressions: Int!
  totalEngagements: Int!
  totalClicks: Int!
  engagementRate: Float!
  followerGrowth: Int!
}
```

---

## 8. WebSocket Events

### 8.1 Connection

Connect to `wss://api.smos.io/ws?token={jwt}`.

The server sends a `connected` event on success:

```json
{
  "type": "connected",
  "data": {
    "connectionId": "conn_abc123",
    "userId": "user_2f3a1b",
    "workspaces": ["ws_5a7b3c"]
  }
}
```

### 8.2 Event Format

All messages follow:

```json
{
  "type": "event_type",
  "data": { ... },
  "meta": {
    "timestamp": "2026-07-22T12:00:00Z",
    "eventId": "evt_abc123"
  }
}
```

### 8.3 Event Types

#### Publishing

| Event | Description | Payload |
|---|---|---|
| `post.publishing.started` | Post publishing started | `{ postId, platform, accountId }` |
| `post.publishing.progress` | Publishing progress update | `{ postId, platform, status, progress: 0-100 }` |
| `post.publishing.completed` | Post published successfully | `{ postId, platform, platformPostId, url }` |
| `post.publishing.failed` | Post publishing failed | `{ postId, platform, error, retryCount }` |
| `post.scheduled` | Post has been scheduled | `{ postId, platform, scheduledAt }` |
| `post.cancelled` | Scheduled post cancelled | `{ postId }` |

#### Notifications

| Event | Description | Payload |
|---|---|---|
| `notification.new` | New notification | `{ id, type, title, body, actionUrl }` |
| `notification.updated` | Notification status change | `{ id, status }` |

**Notification types:** `approval_required`, `approval_granted`, `publish_failed`, `account_expired`, `workflow_failed`, `mcp_server_down`, `quota_warning`, `invite_received`, `mention_detected`

#### Workflows

| Event | Description | Payload |
|---|---|---|
| `workflow.execution.started` | Workflow execution began | `{ executionId, workflowId, triggeredBy }` |
| `workflow.execution.step` | Workflow step completed | `{ executionId, stepId, stepType, status, durationMs }` |
| `workflow.execution.completed` | Workflow execution finished | `{ executionId, status, totalDurationMs }` |
| `workflow.execution.failed` | Workflow execution failed | `{ executionId, error, failedStep }` |
| `workflow.log` | Real-time log entry | `{ executionId, timestamp, level, stepId, message }` |

#### MCP

| Event | Description | Payload |
|---|---|---|
| `mcp.server.connected` | MCP server connected | `{ serverId, name, latencyMs }` |
| `mcp.server.disconnected` | MCP server disconnected | `{ serverId, name, reason }` |
| `mcp.server.error` | MCP server error | `{ serverId, error }` |
| `mcp.tool.called` | MCP tool was called | `{ serverId, tool, durationMs }` |

#### Engagement

| Event | Description | Payload |
|---|---|---|
| `engagement.comment.new` | New comment received | `{ accountId, platform, comment }` |
| `engagement.comment.sentiment` | Comment sentiment flagged | `{ commentId, sentiment, confidence }` |
| `engagement.comment.high_priority` | High-priority comment | `{ commentId, text, reason }` |

#### Analytics

| Event | Description | Payload |
|---|---|---|
| `analytics.updated` | Analytics data refreshed | `{ platform, accountId, dateRange }` |
| `analytics.milestone` | Milestone reached | `{ type, value, platform }` |

#### Admin

| Event | Description | Payload |
|---|---|---|
| `admin.system.alert` | System alert | `{ severity, service, message }` |
| `admin.maintenance` | Maintenance notification | `{ startAt, endAt, reason }` |

### 8.4 Client-to-Server Messages

| Event | Description | Payload |
|---|---|---|
| `subscribe` | Subscribe to a channel | `{ channel: "workspace:ws_5a7b3c" }` |
| `unsubscribe` | Unsubscribe from a channel | `{ channel: "workspace:ws_5a7b3c" }` |
| `ping` | Keep-alive | `{}` |

The server responds with `pong` to keep-alive pings. If no message is received for 60 seconds, the server disconnects.

---

## 9. Webhook System

### 9.1 Overview

The platform can send outbound webhook events to user-configured endpoints. Webhooks are used for:
- Post publishing status changes
- Workflow execution results
- Analytics report completion
- Error notifications
- Comment engagement events

### 9.2 Registering Webhooks

`POST /v1/orgs/{orgId}/workspaces/{workspaceId}/webhooks`

**Request:**
```json
{
  "url": "https://example.com/webhooks/smos",
  "description": "Slack notification endpoint",
  "events": [
    "post.published",
    "post.failed",
    "workflow.completed",
    "workflow.failed"
  ],
  "secret": "whsec_my_secret_123",
  "retryConfig": {
    "maxRetries": 5,
    "backoffType": "exponential",
    "initialDelayMs": 1000
  },
  "filter": {
    "platforms": ["twitter", "linkedin"]
  },
  "headers": {
    "X-Custom-Header": "custom_value"
  }
}
```

### 9.3 Webhook Event Delivery

Each webhook call is an `HTTP POST` with:

**Headers:**
```
Content-Type: application/json
User-Agent: SMOS-Webhook/1.0
X-SMOS-Event: post.published
X-SMOS-Delivery: del_abc123
X-SMOS-Timestamp: 1689000000
X-SMOS-Signature: v1=abc123def456...
```

**Body:**
```json
{
  "event": "post.published",
  "data": {
    "postId": "post_xyz789",
    "platform": "twitter",
    "accountId": "sa_4e5f6g",
    "platformPostId": "123456789",
    "url": "https://twitter.com/user/status/123456789",
    "publishedAt": "2026-07-22T12:00:00Z"
  },
  "meta": {
    "deliveryId": "del_abc123",
    "eventId": "evt_xyz789",
    "orgId": "org_8d4e2c",
    "workspaceId": "ws_5a7b3c",
    "timestamp": "2026-07-22T12:00:00Z",
    "apiVersion": "1.0.0"
  }
}
```

### 9.4 Signature Verification

Signatures are HMAC-SHA256 of the raw request body, using the webhook secret:

```text
HMAC-SHA256(secret, body)
```

The signature is sent as `X-SMOS-Signature: v1={hex_signature}`.

**Verification example (Node.js):**
```typescript
import { createHmac, timingSafeEqual } from 'crypto';

function verifyWebhook(body: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const received = signature.replace('v1=', '');
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}
```

### 9.5 Retry Policy

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 10 seconds |
| 3 | 60 seconds |
| 4 | 5 minutes |
| 5 | 30 minutes |

After 5 failed attempts, the webhook is marked as `failing` and a notification is sent to the workspace admins. If delivery continues to fail for 24 hours, the webhook is automatically disabled.

### 9.6 Webhook Management Endpoints

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/webhooks`

List webhooks.

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/webhooks/{webhookId}`

#### `PATCH /v1/orgs/{orgId}/workspaces/{workspaceId}/webhooks/{webhookId}`

#### `DELETE /v1/orgs/{orgId}/workspaces/{workspaceId}/webhooks/{webhookId}`

#### `GET /v1/orgs/{orgId}/workspaces/{workspaceId}/webhooks/{webhookId}/deliveries`

List recent deliveries.

**Response `200`:**
```json
{
  "data": [
    {
      "id": "del_abc123",
      "event": "post.published",
      "url": "https://example.com/webhooks/smos",
      "status": "delivered",
      "httpStatus": 200,
      "durationMs": 230,
      "attempts": 1,
      "createdAt": "2026-07-22T12:00:00Z"
    }
  ]
}
```

#### `POST /v1/orgs/{orgId}/workspaces/{workspaceId}/webhooks/{webhookId}/test`

Send a test event.

### 9.7 Available Events

| Event | Description |
|---|---|
| `post.created` | Post was created |
| `post.updated` | Post was updated |
| `post.deleted` | Post was deleted |
| `post.scheduled` | Post was scheduled |
| `post.published` | Post was published successfully |
| `post.failed` | Post publishing failed |
| `post.cancelled` | Scheduled post was cancelled |
| `comment.new` | New comment received |
| `workflow.started` | Workflow execution started |
| `workflow.completed` | Workflow execution completed |
| `workflow.failed` | Workflow execution failed |
| `analytics.export.ready` | Analytics export is ready for download |
| `analytics.export.failed` | Analytics export failed |
| `account.expired` | Social account token expired |
| `account.error` | Social account encountered an error |
| `mcp.server_down` | MCP server is unreachable |

---

## 10. Platform API Integration Patterns

### 10.1 Common Architecture

Every platform adapter follows the same interface:

```typescript
interface PlatformAdapter {
  platform: Platform;
  connect(authCode: string, redirectUri: string): Promise<ConnectionResult>;
  refreshToken(refreshToken: string): Promise<TokenResult>;
  publish(account: SocialAccount, content: PlatformContent): Promise<PublishResult>;
  getAnalytics(account: SocialAccount, options: AnalyticsOptions): Promise<PlatformAnalytics>;
  getComments(account: SocialAccount, postId: string): Promise<Comment[]>;
  replyToComment(account: SocialAccount, commentId: string, text: string): Promise<Comment>;
  validateCredentials(account: SocialAccount): Promise<boolean>;
  handleRateLimit(response: PlatformResponse): Promise<number>; // returns retryAfter
}
```

### 10.2 Platform-Specific Patterns

#### Facebook (Graph API v19.0+)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 with `pages_manage_posts`, `pages_read_engagement`, `business_management` |
| Token Lifetime | 60 days (long-lived page tokens) |
| Refresh | Automatic via `GET /oauth/access_token?grant_type=fb_exchange_token` |
| Rate Limits | Per-app (200 calls/user/hour), per-page (200 calls/page/hour) |
| Error Mapping | `(#100) → VALIDATION_ERROR`, `(#4) → PLATFORM_RATE_LIMITED`, `(#10) → INSUFFICIENT_PERMISSIONS` |
| Publishing | `/{page-id}/feed` for posts, `/{page-id}/photos` for images, `/{page-id}/videos` for video |
| Scheduling | `published=false` with `scheduled_publish_time` (unix timestamp, max 75 days) |
| Queuing | Posts with `published=false` status go to Publishing Tools queue |
| Comments | `/{post-id}/comments` GET/POST, `/{comment-id}/replies` for threads |
| Webhooks | Page subscriptions for real-time comment/webhook events |

#### Instagram (Basic Display + Graph API)

| Aspect | Detail |
|---|---|
| Auth | Instagram Business Account via Facebook Login |
| Token Lifetime | 60 days (long-lived) |
| Rate Limits | 200 calls/user/hour, 200 calls/access_token/hour |
| Publishing | `/{ig-user-id}/media` (POST image/video/reel), then `/{ig-media-id}/media_publish` (POST) |
| Content Types | Single image, carousel, video, reel (stories via Instagram Graph Stories API) |
| Scheduling | Not natively supported. SMOS queues and publishes at schedule time |
| Comments | `/{ig-comment-id}/replies` for replying, sentiment analysis supported |
| Limitations | Cannot schedule carousel/reels via API — SMOS handles these via queued publishing |
| Error Mapping | `(#100) → VALIDATION_ERROR`, `(#4) → RATE_LIMITED`, API downtime = `PLATFORM_ERROR` |

#### X / Twitter (API v2, OAuth 2.0)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 PKCE with `tweet.read`, `tweet.write`, `users.read`, `offline.access` |
| Token Lifetime | 2 hours (access), no expiration (refresh) |
| Refresh | POST `https://api.twitter.com/2/oauth2/token` with `grant_type=refresh_token` |
| Rate Limits | v2: 300 POST tweets/15-min/user, 900 GET tweets/15-min/user |
| Publishing | `POST /2/tweets` with `text`, `media.media_ids`, `poll.options` |
| Threads | Chain multiple tweets via `reply.in_reply_to_tweet_id` |
| Scheduling | Not natively supported via API v2. SMOS uses internal queue |
| Media | Upload via `upload.twitter.com/1.1/media/upload.json` (still v1.1, max 5 images or 1 video) |
| Polls | Max 4 options, 5 min–7 day duration |
| Delete | `DELETE /2/tweets/{id}` |
| Streaming | `GET /2/tweets/search/stream` (filtered stream) for real-time engagement |
| Error Mapping | `duplicate-content → DUPLICATE_RESOURCE`, `429 → PLATFORM_RATE_LIMITED`, `401 → PLATFORM_AUTH_REQUIRED` |

#### LinkedIn (Marketing API v2)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 with `w_member_social`, `r_member_social`, `r_organization_social`, `w_organization_social` |
| Token Lifetime | 1 year (long-lived) |
| Rate Limits | 100,000 calls/day per user, burst of 100 calls/10 seconds |
| Publishing | `POST /rest/posts` (UGCPosts for member) or `POST /rest/organizationalEntityShare` for company |
| Content Types | Text, image, article (document), video, carousel, multi-image |
| Scheduling | Supported via `scheduledAt` timestamp |
| Media Upload | Register upload via `POST /rest/images?action=initializeUpload` then binary upload |
| Analytics | `GET /rest/organizationalEntityShareStatistics`, `GET /rest/networkSizes` |
| Error Mapping | `401 → PLATFORM_AUTH_REQUIRED`, `403 → INSUFFICIENT_PERMISSIONS`, `429 → RATE_LIMITED` |

#### TikTok (Content Posting API)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 with `user.info.basic`, `video.upload`, `video.publish` |
| Token Lifetime | 24 hours (access), indefinite with refresh |
| Refresh | POST `/oauth/token/` with `grant_type=refresh_token` |
| Rate Limits | Video upload: 10 requests/min/user, Query: 60 requests/min/user |
| Publishing | Upload video to `POST /video/upload/`, then publish via `POST /video/publish/` |
| Content Types | Video only (max 10 min, max 500MB) |
| Scheduling | Not natively supported. SMOS schedules internally |
| Media Upload | Upload video via chunked upload for files > 50MB |
| Status Callback | Register webhook URL in developer portal for posting status updates |
| Error Mapping | `token_expired → PLATFORM_AUTH_REQUIRED`, `rate_limit → PLATFORM_RATE_LIMITED` |

#### Pinterest (API v5)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 with `boards:read`, `pins:read`, `pins:write`, `boards:write` |
| Token Lifetime | No expiration with refresh token |
| Rate Limits | 1000 requests/hour per access token |
| Publishing | `POST /v5/pins` with image_url or media_source |
| Content Types | Image, video pins, Idea Pins (API limitations apply) |
| Boards | `POST /v5/boards` to create, `GET /v5/boards` to list |
| Scheduling | Not natively supported. SMOS queues pin publishing |
| Carousel | POST via `POST /v5/pins` with `media_source.media_type=MULTI_PIN` |
| Error Mapping | `429 → PLATFORM_RATE_LIMITED`, `400 → VALIDATION_ERROR` (invalid image URL) |

#### YouTube (YouTube Data API v3)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 with `https://www.googleapis.com/auth/youtube.upload`, `youtube.readonly` |
| Token Lifetime | 1 hour (Google OAuth), refresh token available |
| Rate Limits | 10,000 units/day, 1,600 queries/day per project (quota varies by operation) |
| Publishing | Resumable media upload to `POST /upload/youtube/v3/videos?uploadType=resumable` |
| Content Types | Video, shorts |
| Scheduling | Supported via `POST /youtube/v3/videos` with `status.publishAt` |
| Video Requirements | Max 256GB, max 12 hours, supported formats: MP4, MOV, AVI, WMV, FLV, MKV, WebM |
| Thumbnails | `POST /youtube/v3/thumbnails/set` |
| Comments | `POST /youtube/v3/commentThreads`, `POST /youtube/v3/comments` |
| Error Mapping | `quotaExceeded → PLATFORM_RATE_LIMITED`, `backendError → PLATFORM_ERROR` |

#### Threads (Instagram Threads API)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 via Facebook Login with `threads_basic`, `threads_content_publish` |
| Token Lifetime | 60 days (long-lived, same as Instagram) |
| Rate Limits | 200 calls/user/hour (shared with Instagram Graph API quota) |
| Publishing | `POST /{{threads-user-id}}/threads` then `POST /{{threads-media-id}}/publish` |
| Content Types | Text, single image, video (carousel status: limited) |
| Scheduling | Not natively supported. SMOS uses internal queue |
| Reply Controls | `who_can_reply` field: `PUBLIC`, `FOLLOWED`, `MENTIONED` |
| Error Mapping | Same as Instagram — inherits Graph API error structure |

#### Bluesky (AT Protocol)

| Aspect | Detail |
|---|---|
| Auth | App password (no OAuth — uses JWT from `com.atproto.server.createSession`) |
| Token Lifetime | Session JWT, refreshed via `com.atproto.server.refreshSession` |
| Rate Limits | 5000 requests/5 minutes per IP (PDS-dependent) |
| Publishing | `com.atproto.repo.createRecord` with `app.bsky.feed.post` collection |
| Content Types | Text (up to 300 chars), images (up to 4), external embeds (link cards) |
| Reposts | `app.bsky.feed.repost` record |
| Threads | Reply via `reply` object with `parent` and `root` references |
| Facets | Rich text via `app.bsky.richtext.facet` (mentions, links, hashtags, tags) |
| Feeds | Custom feeds via `app.bsky.feed.getFeed` |
| Error Mapping | `InvalidRequest → VALIDATION_ERROR`, `RateLimitExceeded → PLATFORM_RATE_LIMITED` |

#### Reddit (Reddit API v1)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 with `identity`, `edit`, `flair`, `history`, `modconfig`, `modflair`, `modlog`, `modposts`, `modwiki`, `mysubreddits`, `privatemessages`, `read`, `report`, `save`, `submit`, `subscribe`, `vote`, `wikiedit`, `wikiread` |
| Token Lifetime | 1 hour (access), permanent (refresh) |
| Rate Limits | 600 requests/10 minutes per OAuth client ID |
| Publishing | `POST /api/submit` with `kind=self` (text), `kind=link` (URL), `kind=image` (image), `kind=video` (video) |
| Content Types | Self/text post, link, image, video, gallery |
| Subreddits | Specify `sr` (subreddit) in all post submissions |
| Scheduling | Not natively supported. SMOS queues internally |
| Comments | `POST /api/comment` with `thing_id` and `text` |
| Crossposting | `POST /api/submit` with `kind= crosspost` |
| Gallery Posts | Submit multiple images via `POST /api/submit_gallery` |
| Error Mapping | `429 → PLATFORM_RATE_LIMITED`, `403 → INSUFFICIENT_PERMISSIONS`, `400 → VALIDATION_ERROR` |

#### Telegram (Bot API)

| Aspect | Detail |
|---|---|
| Auth | Bot token from BotFather (no OAuth — direct API key) |
| Token Lifetime | Permanent (until bot token is revoked) |
| Rate Limits | 30 messages/second per chat, 20 messages/minute group-wide |
| Publishing | `sendMessage`, `sendPhoto`, `sendVideo`, `sendMediaGroup`, `sendPoll` |
| Content Types | Text, image (photo), video, document, poll, media group (album), animation (GIF) |
| Features | Inline keyboards, reply markup, message threads, silent messages |
| Formatting | HTML or MarkdownV2 parse mode for rich text |
| Scheduling | Not natively supported. SMOS uses internal queue |
| File Upload | `sendDocument`, `sendPhoto`, `sendVideo` via file_id or multipart upload |
| Error Mapping | `429 → PLATFORM_RATE_LIMITED` (includes Retry-After), `400 → VALIDATION_ERROR` |

#### Google Business Profile (GBP API)

| Aspect | Detail |
|---|---|
| Auth | OAuth 2.0 with `https://www.googleapis.com/auth/business.manage` |
| Token Lifetime | 1 hour (Google OAuth), refresh token available |
| Rate Limits | 1000 queries per day per project, 10 queries per second per project |
| Publishing | `POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/localPosts` |
| Content Types | Text, image, video, offer, event, product (local posts — max 1500 chars) |
| Post Types | `STANDARD`, `EVENT`, `OFFER` |
| Scheduling | Not natively supported. SMOS queues publishing |
| Media | Upload via `mediaResource.upload` endpoint |
| Responses | `GET /v4/accounts/{accountId}/locations/{locationId}/replies` for managing GBP reviews |
| Error Mapping | `QUOTA_EXCEEDED → PLATFORM_RATE_LIMITED`, `INVALID_ARGUMENT → VALIDATION_ERROR` |

### 10.3 Cross-Platform Error Handling

```typescript
interface PlatformErrorHandler {
  mapError(platform: Platform, error: any): ApiError;
  shouldRetry(error: any): boolean;
  getRetryDelay(error: any): number;
  notifyUser(error: ApiError): void;
}
```

Standard error mapping pipeline:

1. Platform returns HTTP error.
2. Adapter catches and normalizes to `PlatformError` with platform, status, code, message.
3. `PlatformErrorHandler.mapError` converts to SMOS `ApiErrorCode`.
4. If `PLATFORM_AUTH_REQUIRED`, the system marks the account as `expired` and fires a notification.
5. If `PLATFORM_RATE_LIMITED`, the request is enqueued for retry with the platform's `Retry-After` value.
6. If `PLATFORM_ERROR` (server error), the request is retried up to 3 times with exponential backoff.

### 10.4 Token Refresh Orchestration

```
                              ┌─────────────┐
                              │  Token Store │
                              │   (Redis)    │
                              └──────┬──────┘
                                     │
    ┌────────┐    refresh needed     │
    │  API   │──────────────────────►│
    │  Call  │                       │
    │        │◄──── valid token ─────│
    └────────┘                       │
                                     │ token expired
                                     ▼
                            ┌────────────────┐
                            │ Token Refresher │
                            │  (BullMQ Job)   │
                            └───────┬────────┘
                                    │
                            ┌───────▼────────┐
                            │ Platform OAuth  │
                            │  Token Endpoint │
                            └───────┬────────┘
                                    │
                            ┌───────▼────────┐
                            │  Update Redis   │
                            │  + PostgreSQL   │
                            └────────────────┘
```
