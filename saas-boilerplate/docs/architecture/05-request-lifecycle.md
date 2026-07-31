# Request Lifecycle

## Incoming Request Pipeline

```text
┌──────────────┐
│  Client       │
│  Request      │
└──────┬───────┘
       │
┌──────▼───────┐
│  Edge / CDN   │  Vercel Edge Network / Cloudflare
│  • Caching    │
│  • Geo-routing│
└──────┬───────┘
       │
┌──────▼───────┐
│  Middleware   │  Next.js Middleware (edge)
│  • Rate limit │
│  • Session    │
│  • Org ctx    │
│  • Redirects  │
└──────┬───────┘
       │
       ├── Public route ──► Page render (RSC)
       │
       └── Protected route
               │
        ┌──────▼───────┐
        │ Auth Check    │  AuthService.getSession()
        │ • Valid?      │
        │ • Expired?    │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │ Authorization │  PermissionService
        │ • Role check  │
        │ • Permission  │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │ Validation    │  Zod schema validation
        │ • Params      │
        │ • Body        │
        │ • Query       │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │ App Service   │  Application Layer
        │ • Orchestrate │
        │ • Compose     │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │ Domain Logic  │  Domain Layer
        │ • Business    │
        │ • Rules       │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │ Infrastructure│  Prisma / Adapters
        │ • DB queries  │
        │ • Ext APIs    │
        └──────┬───────┘
               │
        ┌──────▼───────┐
        │ Response      │
        │ • JSON / RSC  │
        │ • Error fmt   │
        └──────────────┘
```

## Route Categorization

| Type      | Path Prefix                              | Auth                          | Caching Strategy                 |
| --------- | ---------------------------------------- | ----------------------------- | -------------------------------- |
| Public    | `/`, `/pricing`, `/blog`                 | None                          | CDN + ISR                        |
| Auth      | `/login`, `/register`, `/reset-password` | Redirect if authed            | No cache                         |
| Dashboard | `/dashboard`                             | Required                      | Private + Stale-while-revalidate |
| API       | `/api/*`                                 | Required (Session or API Key) | Per-endpoint                     |
| Webhook   | `/api/webhooks/*`                        | Signature verification        | No cache                         |
| Admin     | `/admin`                                 | Required + Admin role         | Private                          |
| Static    | `/public/*`                              | None                          | CDN + immutable                  |

## Error Response Format

```typescript
interface ApiError {
  code: string; // Machine-readable: "INVALID_INPUT"
  message: string; // Human-readable
  details?: unknown; // Validation errors, etc.
  requestId?: string; // Correlation ID
}
```

HTTP status codes follow RFC standards: 200, 201, 204, 400, 401, 403, 404, 409, 422, 429, 500.
