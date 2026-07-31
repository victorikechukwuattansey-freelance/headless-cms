# Frontend Architecture — AI Social Media OS

**Status:** Draft v1.0  
**Last Updated:** 2026-07-22  
**Owner:** Staff Engineer  

---

## 1. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | Next.js 14+ (App Router) | SSR/SSG/ISR, RSC streaming, middleware, server actions |
| UI Library | React 18 | Concurrent features, Suspense boundaries, `use` hook |
| Language | TypeScript 5.6 (strict mode) | Full-stack type safety with shared Zod schemas |
| Styling | Tailwind CSS v4 | Utility-first, JIT compilation, zero-runtime CSS |
| Component Library | shadcn/ui | Unstyled primitives + Radix, composable, tree-shakeable |
| Server State | TanStack React Query v5 | Caching, dedup, optimistic updates, infinite queries |
| Client State | Zustand v5 | Minimal boilerplate, middleware (persist, immer, devtools) |
| Forms | react-hook-form + zod | Performant uncontrolled forms, schema validation |
| Routing | Next.js App Router (file-based) | Nested layouts, loading/error boundaries, parallel routes |
| Real-Time | WebSocket (GraphQL subscriptions via `graphql-ws`) | Live engagement feed, notification stream |
| GraphQL Client | urql (or Apollo Client) | Document caching, subscriptions, exchanges |
| Bundle Analyzer | @next/bundle-analyzer | Visual bundle insights |
| Testing | Vitest + Playwright | Unit (Vitest), component (testing-library), e2e (Playwright) |
| PWA | next-pwa + Service Worker | Offline support, push notifications |
| i18n | next-intl | File-based translations, ICU syntax, RTL |

---

## 2. Directory Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── (auth)/                   # Auth route group (no sidebar)
│   │   ├── login/
│   │   ├── register/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── mfa/
│   │       ├── setup/
│   │       └── verify/
│   ├── (dashboard)/              # Dashboard route group (sidebar layout)
│   │   ├── (overview)/           # Overview default route
│   │   ├── planner/              # Content calendar / planner
│   │   ├── composer/             # Post composer (create/edit)
│   │   ├── posts/                # Post library / list
│   │   │   ├── [postId]/         # Single post detail
│   │   │   └── analytics/        # Post-level analytics
│   │   ├── accounts/             # Connected social accounts
│   │   ├── content/              # Content library / media
│   │   ├── analytics/            # Dashboard analytics
│   │   │   ├── overview/
│   │   │   ├── reports/
│   │   │   └── audience/
│   │   ├── engagement/           # Engagement inbox / comments
│   │   ├── ai/                   # AI generation tools
│   │   │   ├── generate/
│   │   │   ├── brand-voice/
│   │   │   └── templates/
│   │   ├── automation/           # Workflow builder
│   │   │   ├── workflows/
│   │   │   └── triggers/
│   │   ├── campaigns/            # Campaign management
│   │   ├── settings/             # Org / user settings
│   │   │   ├── general/
│   │   │   ├── team/
│   │   │   ├── billing/
│   │   │   ├── api-keys/
│   │   │   └── notifications/
│   │   └── admin/                # Admin panel (superadmin)
│   │       ├── users/
│   │       ├── orgs/
│   │       ├── feature-flags/
│   │       └── system/
│   ├── (public)/                 # Public route group (marketing)
│   │   ├── page.tsx              # Landing page
│   │   ├── pricing/
│   │   ├── changelog/
│   │   └── status/
│   ├── loading.tsx               # Root loading boundary
│   ├── error.tsx                 # Root error boundary
│   ├── global-error.tsx          # Root global error boundary
│   ├── not-found.tsx             # Custom 404
│   └── layout.tsx                # Root layout (fonts, providers)
│
├── components/                   # Shared UI components (atomic design)
│   ├── ui/                       # shadcn/ui primitives (button, input, dialog, etc.)
│   ├── atoms/                    # Smallest composable units (Icon, Badge, Spinner)
│   ├── molecules/                # Combinations of atoms (SearchBar, DatePicker, MediaThumbnail)
│   ├── organisms/                # Feature-specific sections (PostCard, AnalyticsChart, ComposerToolbar)
│   ├── templates/                # Layout templates (DashboardShell, AuthShell, PublicShell)
│   ├── shared/                   # Cross-feature shared components (DataTable, ConfirmDialog, EmptyState)
│   └── providers/                # React context providers
│       ├── query-provider.tsx
│       ├── auth-provider.tsx
│       ├── theme-provider.tsx
│       ├── websocket-provider.tsx
│       └── intl-provider.tsx
│
├── features/                     # Feature modules (domain-driven)
│   ├── auth/
│   │   ├── actions.ts            # Server actions (login, register, logout)
│   │   ├── hooks.ts              # useAuth, useLogin, useMFA
│   │   ├── schemas.ts            # Zod schemas for validation
│   │   ├── types.ts              # Feature-specific types
│   │   └── components/
│   │       ├── login-form.tsx
│   │       ├── register-form.tsx
│   │       ├── oauth-button.tsx
│   │       └── mfa-dialog.tsx
│   ├── posts/
│   │   ├── api/                  # Post-related API functions (React Query)
│   │   ├── hooks/                # usePosts, usePost, usePublish, useSchedule
│   │   ├── schemas/
│   │   ├── components/
│   │   │   ├── post-card.tsx
│   │   │   ├── post-list.tsx
│   │   │   ├── post-status-badge.tsx
│   │   │   ├── post-actions.tsx
│   │   │   └── post-composer/
│   │   │       ├── index.tsx
│   │   │       ├── content-editor.tsx
│   │   │       ├── media-attacher.tsx
│   │   │       ├── platform-selector.tsx
│   │   │       ├── schedule-picker.tsx
│   │   │       └── ai-assist-panel.tsx
│   │   └── stores/               # Zustand stores for post composer
│   │       └── composer-store.ts
│   ├── analytics/
│   ├── accounts/
│   ├── content/
│   ├── ai/
│   ├── automation/
│   ├── campaigns/
│   ├── engagement/
│   ├── settings/
│   └── admin/
│
├── lib/                          # Shared utilities
│   ├── api/                      # GraphQL/REST client setup
│   │   ├── client.ts             # urql/Apollo client instance
│   │   ├── fetcher.ts            # REST fetch wrapper with auth
│   │   └── subscriptions.ts      # WebSocket subscription client
│   ├── auth/                     # Auth utilities
│   │   ├── token.ts              # Token storage, refresh logic
│   │   └── middleware.ts         # Next.js middleware for route protection
│   ├── utils/                    # General utilities
│   │   ├── cn.ts                 # clsx + tailwind-merge
│   │   ├── date.ts               # Date formatting (date-fns)
│   │   ├── format.ts             # Number, currency, percentage formatting
│   │   ├── media.ts              # Media URL helpers, CDN transforms
│   │   └── platform.ts           # Social platform enums, icons, labels
│   ├── hooks/                    # Shared hooks
│   │   ├── use-debounce.ts
│   │   ├── use-intersection-observer.ts
│   │   ├── use-local-storage.ts
│   │   └── use-media-query.ts
│   └── validations/              # Shared Zod schemas (mirrors backend)
│       ├── post.ts
│       ├── auth.ts
│       └── common.ts
│
├── stores/                       # Zustand stores (global client state)
│   ├── auth-store.ts             # Auth state (user, token, org)
│   ├── ui-store.ts               # Sidebar, modals, toasts
│   ├── preferences-store.ts      # User preferences (theme, locale)
│   └── workflow-store.ts         # Active workflow builder state
│
├── styles/                       # Global styles
│   ├── globals.css               # Tailwind directives, CSS variables
│   └── fonts.ts                  # Font loading config
│
├── messages/                     # i18n translation files
│   ├── en.json
│   ├── es.json
│   ├── fr.json
│   ├── de.json
│   ├── ja.json
│   └── pt-BR.json
│
├── public/                       # Static assets
│   ├── icons/
│   ├── images/
│   └── manifests/
│
└── middleware.ts                 # Next.js middleware (auth, i18n, tenant)
```

---

## 3. Route Design

### 3.1 Route Groups & Layouts

```
┌─ (auth) ─────────────────────────────────────────────┐
│  Layout: Full-screen centered card, no sidebar        │
│  Routes: /login, /register, /forgot-password,         │
│          /reset-password, /mfa/setup, /mfa/verify     │
└──────────────────────────────────────────────────────┘

┌─ (dashboard) ────────────────────────────────────────┐
│  Layout: Sidebar + top nav + workspace               │
│  ┌─ (overview) ─────────────────────────────────┐   │
│  │  Default redirect: / → /overview              │   │
│  │  /overview                                    │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /planner ───────────────────────────────────┐   │
│  │  Content calendar (month/week/day views)      │   │
│  │  /planner → calendar view                     │   │
│  │  /planner/draft → draft queue                  │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /composer ──────────────────────────────────┐   │
│  │  Post creation / editing                      │   │
│  │  /composer → new post                        │   │
│  │  /composer/[postId] → edit existing          │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /posts ─────────────────────────────────────┐   │
│  │  Post library                                 │   │
│  │  /posts → list (drafts, published, failed)    │   │
│  │  /posts/[postId] → detail + engagement       │   │
│  │  /posts/[postId]/analytics → per-post stats   │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /accounts ──────────────────────────────────┐   │
│  │  Connected social account management          │   │
│  │  /accounts → grid + connect button           │   │
│  │  /accounts/connect → OAuth flow redirect     │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /content ───────────────────────────────────┐   │
│  │  Content / media library                      │   │
│  │  /content → grid/list view                    │   │
│  │  /content/[mediaId] → detail                 │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /analytics ────────────────────────────────┐   │
│  │  /analytics → dashboard overview            │   │
│  │  /analytics/reports → custom reports         │   │
│  │  /analytics/audience → audience insights     │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /engagement ───────────────────────────────┐   │
│  │  /engagement → inbox (comments, mentions)    │   │
│  │  /engagement/[postId] → per-post stream     │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /ai ───────────────────────────────────────┐   │
│  │  /ai/generate → AI content generator        │   │
│  │  /ai/brand-voice → brand voice management   │   │
│  │  /ai/templates → prompt templates           │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /automation ───────────────────────────────┐   │
│  │  /automation → workflow list                │   │
│  │  /automation/new → workflow builder          │   │
│  │  /automation/[workflowId] → edit/logs       │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /campaigns ────────────────────────────────┐   │
│  │  /campaigns → campaign list                 │   │
│  │  /campaigns/new → create                    │   │
│  │  /campaigns/[campaignId] → detail/analytics │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /settings ────────────────────────────────┐   │
│  │  Nested layout with tab navigation          │   │
│  │  /settings/general                          │   │
│  │  /settings/team                             │   │
│  │  /settings/billing                          │   │
│  │  /settings/api-keys                         │   │
│  │  /settings/notifications                    │   │
│  └───────────────────────────────────────────────┘   │
│  ┌─ /admin ───────────────────────────────────┐   │
│  │  (superadmin only, separate check)          │   │
│  │  /admin/users                              │   │
│  │  /admin/orgs                               │   │
│  │  /admin/feature-flags                      │   │
│  │  /admin/system                             │   │
│  └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘

┌─ (public) ──────────────────────────────────────────┐
│  Layout: Marketing header/footer, no auth            │
│  Routes: / → landing, /pricing, /changelog, /status  │
└──────────────────────────────────────────────────────┘
```

### 3.2 Route Pattern Conventions

| Pattern | Usage |
|---|---|
| `(auth)` | Route group — no layout inheritance from parent |
| `(dashboard)` | Route group — shared sidebar + top nav layout |
| `(public)` | Route group — marketing layout |
| `[param]` | Dynamic segment — `postId`, `workflowId`, `campaignId` |
| `[...catchAll]` | Catch-all — admin sub-routes |
| `@modal` | Parallel route — modals overlaid on current page |
| `_private` | Private directory — not routable |
| `loading.tsx` | Per-segment loading UI (Suspense boundary) |
| `error.tsx` | Per-segment error boundary |

---

## 4. State Management

### 4.1 State Tier Distribution

```
┌──────────────────────────────────────────────────────────┐
│                    URL State (Next.js)                    │
│  Search params, path params                              │
│  Source of truth for: page, sort, filter, search query    │
├──────────────────────────────────────────────────────────┤
│              Server State (React Query)                   │
│  API data, cache, background refetch                     │
│  Source of truth for: posts, analytics, accounts, etc.    │
├──────────────────────────────────────────────────────────┤
│              Client State (Zustand)                       │
│  UI state, auth state, preferences                       │
│  Source of truth for: sidebar, theme, active org          │
├──────────────────────────────────────────────────────────┤
│              Form State (react-hook-form)                 │
│  Controlled inputs, validation, dirty tracking           │
│  Source of truth for: composer, settings, workflow builder│
└──────────────────────────────────────────────────────────┘
```

### 4.2 React Query Configuration

```typescript
// lib/api/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,         // 30s before background refetch
      gcTime: 5 * 60_000,        // 5min in cache
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false, // Dashboard users: manual refresh
      refetchOnMount: false,       // Use cached data if available
    },
    mutations: {
      retry: 0,                   // Do not retry mutations
    },
  },
});
```

### 4.3 Zustand Store Examples

**Auth Store:**
```typescript
interface AuthState {
  user: User | null;
  org: Organization | null;
  accessToken: string | null;
  isAuthenticated: boolean;

  login: (credentials: LoginInput) => Promise<void>;
  logout: () => void;
  setOrg: (org: Organization) => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      org: null,
      accessToken: null,
      isAuthenticated: false,

      login: async (credentials) => {
        const result = await authApi.login(credentials);
        set({
          user: result.user,
          accessToken: result.accessToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({ user: null, accessToken: null, isAuthenticated: false });
        queryClient.clear();
      },

      refreshToken: async () => {
        const newToken = await authApi.refresh();
        set({ accessToken: newToken });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, org: state.org }),
    }
  )
);
```

**Composer Store (Post Composer):**
```typescript
interface ComposerState {
  post: DraftPost;
  isDirty: boolean;
  lastSaved: Date | null;
  autoSaveTimer: NodeJS.Timeout | null;

  setContent: (content: string) => void;
  addMedia: (media: MediaItem) => void;
  removeMedia: (mediaId: string) => void;
  setPlatformAccounts: (accounts: string[]) => void;
  setSchedule: (date: Date | null) => void;
  saveDraft: () => Promise<void>;
  reset: () => void;
}

export const useComposerStore = create<ComposerState>()(
  // No persist — too large; auto-save to server instead
  (set, get) => ({
    post: createEmptyDraft(),
    isDirty: false,
    lastSaved: null,
    autoSaveTimer: null,

    setContent: (content) => {
      set((state) => ({
        post: { ...state.post, content },
        isDirty: true,
      }));
      get().scheduleAutoSave();
    },

    scheduleAutoSave: () => {
      const timer = get().autoSaveTimer;
      if (timer) clearTimeout(timer);
      const newTimer = setTimeout(() => get().saveDraft(), 5000);
      set({ autoSaveTimer: newTimer });
    },

    saveDraft: async () => {
      const { post } = get();
      await postsApi.saveDraft(post);
      set({ isDirty: false, lastSaved: new Date() });
    },

    reset: () => set({ post: createEmptyDraft(), isDirty: false, lastSaved: null }),
  })
);
```

### 4.4 URL State Pattern

```typescript
// hooks/use-url-filters.ts
export function useUrlFilters<T extends Record<string, string | undefined>>(
  defaults: T
) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const param = searchParams.get(key);
      if (param !== null) result[key as keyof T] = param as T[keyof T];
    }
    return result;
  }, [searchParams, defaults]);

  const setFilters = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === defaults[key as keyof T]) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, defaults]
  );

  return { filters, setFilters };
}
```

---

## 5. Data Fetching Strategy

### 5.1 Rendering Strategy Decision Matrix

| Use Case | Strategy | Why |
|---|---|---|
| Landing page, pricing | Static (SSG) + ISR (revalidate: 3600) | Content rarely changes, SEO-critical |
| Blog, changelog | ISR with on-demand revalidation | Content changes periodically |
| Dashboard overview | SSR (dynamic, no cache) | Fresh data, user-specific |
| Post detail page | SSR with React Query hydation | Fresh data + cached interactions |
| Settings page | Client-side fetch (CSR) | User-specific, no SEO needed |
| Analytics reports | SSR with streaming | Large queries, progressive rendering |
| AI generation results | Client-side fetch (CSR) | Real-time, loading states |
| Post composer | CSR with optimistic saves | Drafts saved locally, auto-sync |

### 5.2 Server-Side Data Fetching (SSR)

```typescript
// app/(dashboard)/posts/page.tsx
export default async function PostsPage() {
  const { accessToken } = useAuthStore.getState();

  // Fetch on server, hydrate into React Query
  const { dehydratedState } = await getDehydratedState(queryClient, async () => {
    await queryClient.prefetchQuery({
      queryKey: ['posts', { page: 1, status: 'all' }],
      queryFn: () => postsApi.list({ page: 1 }),
    });
  });

  return (
    <HydrationBoundary state={dehydratedState}>
      <PostListPage />
    </HydrationBoundary>
  );
}
```

### 5.3 Client-Side Fetching with React Query

```typescript
// features/posts/hooks/use-posts.ts
export function usePosts(filters: PostFilters) {
  return useInfiniteQuery({
    queryKey: ['posts', filters],
    queryFn: async ({ pageParam = 0 }) => {
      return postsApi.list({ ...filters, cursor: pageParam });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
  });
}
```

### 5.4 Optimistic Updates

```typescript
// features/posts/hooks/use-publish-post.ts
export function usePublishPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postId: string) => postsApi.publish(postId),

    onMutate: async (postId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['posts'] });

      // Snapshot previous value
      const previousPosts = queryClient.getQueryData(['posts']);

      // Optimistically update post status
      queryClient.setQueryData(['posts'], (old: any) => ({
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          items: page.items.map((post: any) =>
            post.id === postId
              ? { ...post, status: 'publishing', publishedAt: new Date().toISOString() }
              : post
          ),
        })),
      }));

      return { previousPosts };
    },

    onError: (_err, _postId, context) => {
      // Rollback on error
      queryClient.setQueryData(['posts'], context?.previousPosts);
    },

    onSettled: () => {
      // Refetch to reconcile
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}
```

---

## 6. Authentication Flow

### 6.1 Middleware Protection

```typescript
// middleware.ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/public|public|login|register|forgot-password|reset-password).*)',
  ],
};

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value;
  const pathname = request.nextUrl.pathname;

  // Public pages — skip auth check
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // No token — redirect to login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate token (check expiry, decode)
  const payload = await verifyToken(token);
  if (!payload || payload.exp < Date.now() / 1000) {
    // Try refresh
    const refreshed = await attemptTokenRefresh(request);
    if (!refreshed) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Tenant isolation: set x-tenant-id header for API calls
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', payload.tenantId);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}
```

### 6.2 Token Refresh Flow

```typescript
// lib/auth/token.ts
export class TokenManager {
  private static refreshPromise: Promise<boolean> | null = null;

  static async getValidToken(): Promise<string | null> {
    const { accessToken } = useAuthStore.getState();

    if (!accessToken) return null;
    if (!this.isTokenExpired(accessToken)) return accessToken;

    // Deduplicate concurrent refresh calls
    if (!this.refreshPromise) {
      this.refreshPromise = this.performRefresh();
    }

    const success = await this.refreshPromise;
    this.refreshPromise = null;
    return success ? useAuthStore.getState().accessToken : null;
  }

  private static async performRefresh(): Promise<boolean> {
    try {
      const { refreshToken } = useAuthStore.getState();
      const result = await authApi.refresh({ refreshToken });
      useAuthStore.getState().setTokens(result.accessToken, result.refreshToken);
      return true;
    } catch {
      useAuthStore.getState().logout();
      return false;
    }
  }

  private static isTokenExpired(token: string): boolean {
    const payload = jwtDecode(token);
    return payload.exp * 1000 < Date.now() + 30_000; // 30s buffer
  }
}
```

### 6.3 Redirect Logic

| Event | From | To |
|---|---|---|
| Not authenticated | `/dashboard/*`, `/settings/*`, `/admin/*` | `/login?redirect=<path>` |
| Authenticated | `/login`, `/register` | `/overview` |
| MFA required | `/login` (after password) | `/mfa/verify` |
| MFA not set up | `/settings` | `/mfa/setup` |
| No org selected | `/overview` | `/org/select` |
| Plan expired | `/dashboard/*` | `/settings/billing` |
| Admin not admin | `/admin/*` | `/overview` |

---

## 7. Real-Time Updates

### 7.1 WebSocket Architecture

```
┌──────────────┐        ┌───────────────────────┐        ┌──────────────┐
│  Next.js App  │  WS    │  API Gateway (NestJS)  │  WS    │  Redis       │
│  urql client  │<──────>│  WebSocket Gateway      │<──────>│  Pub/Sub      │
│  graphql-ws   │        │  graphql-ws server      │        │              │
└──────────────┘        └───────────────────────┘        └──────────────┘
```

### 7.2 Subscription Setup

```typescript
// lib/api/subscriptions.ts
export const subscriptionClient = createClient({
  url: process.env.NEXT_PUBLIC_WS_URL!,
  connectionParams: async () => {
    const token = await TokenManager.getValidToken();
    return { authorization: `Bearer ${token}` };
  },
  retryAttempts: 5,
  retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  shouldRetry: () => true,
});

// GraphQL subscription example
export const NOTIFICATION_SUBSCRIPTION = `
  subscription OnNotificationReceived {
    notificationReceived {
      id
      type
      title
      body
      data
      createdAt
    }
  }
`;
```

### 7.3 Subscription Hook

```typescript
// features/notifications/hooks/use-notification-stream.ts
export function useNotificationStream() {
  const addNotification = useNotificationStore((s) => s.addNotification);

  useEffect(() => {
    const { unsubscribe } = subscriptionClient
      .execute({ query: NOTIFICATION_SUBSCRIPTION })
      .subscribe({
        next: (result) => {
          if (result.data?.notificationReceived) {
            addNotification(result.data.notificationReceived);

            // Show toast for non-silent notifications
            const n = result.data.notificationReceived;
            if (n.type !== 'silent') {
              toast(n.title, { description: n.body });
            }

            // Play sound for priority notifications
            if (['post_failed', 'mention_alert'].includes(n.type)) {
              playNotificationSound();
            }
          }
        },
        error: (err) => console.error('Subscription error:', err),
      });

    return () => unsubscribe();
  }, [addNotification]);
}
```

### 7.4 Optimistic UI with Subscriptions

```typescript
// For engagement: new comment appears in real-time
export function useEngagementStream(postId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const { unsubscribe } = subscriptionClient
      .execute({
        query: ENGAGEMENT_SUBSCRIPTION,
        variables: { postId },
      })
      .subscribe({
        next: (result) => {
          if (result.data?.engagementReceived) {
            // Optimistically add to cache
            queryClient.setQueryData(
              ['engagement', postId],
              (old: any) => ({
                ...old,
                items: [result.data.engagementReceived, ...old.items],
                totalCount: old.totalCount + 1,
              })
            );
          }
        },
      });

    return () => unsubscribe();
  }, [postId, queryClient]);
}
```

---

## 8. Component Architecture

### 8.1 Atomic Design Hierarchy

```
atoms/        molecules/        organisms/        templates/        pages/
 Button        SearchBar         PostCard          DashboardShell   PostsPage
 Input         DatePicker        PostList          AuthShell        ComposerPage
 Badge         MediaThumbnail    AnalyticsChart    PublicShell      SettingsPage
 Label         FileUploader      ComposerToolbar   AdminShell
 Icon          PlatformIcon      AccountCard
 Spinner       StatusBadge       CampaignCard
 Avatar        FilterBar         WorkflowBuilder
                                  ContentCalendar
                                  EngagementInbox
                                  AIGeneratorPanel
```

### 8.2 Composition Patterns

**Compound Component (Tabs):**
```typescript
// components/ui/tabs.tsx
<Tabs defaultValue="content">
  <TabsList>
    <TabsTrigger value="content">Content</TabsTrigger>
    <TabsTrigger value="preview">Preview</TabsTrigger>
    <TabsTrigger value="settings">Settings</TabsTrigger>
  </TabsList>
  <TabsContent value="content">
    <ContentEditor />
  </TabsContent>
  <TabsContent value="preview">
    <PostPreview platforms={selectedPlatforms} />
  </TabsContent>
  <TabsContent value="settings">
    <PublishSettings />
  </TabsContent>
</Tabs>
```

**Render Props (DataTable):**
```typescript
<DataTable
  columns={postColumns}
  data={posts}
  renderActions={(post) => (
    <PostActions post={post} onPublish={handlePublish} onEdit={handleEdit} />
  )}
  renderEmpty={<EmptyState icon={PostIcon} message="No posts yet" />}
/>
```

### 8.3 Server & Client Component Boundaries

```typescript
// Server Component (default in App Router)
// app/(dashboard)/posts/page.tsx
export default async function PostsPage() {
  // Fetch on server, pass data as props
  const posts = await fetchPosts();

  return (
    <div>
      <PageHeader title="Posts" actions={<NewPostButton />} />
      <PostFilters />
      <PostList posts={posts} /> {/* Client component */}
    </div>
  );
}

// Client Component
// features/posts/components/post-list.tsx
'use client';

export function PostList({ posts }: { posts: Post[] }) {
  const { data, fetchNextPage } = usePosts({ initial: posts });

  return (
    <div>
      {data.pages.map((page) =>
        page.items.map((post) => <PostCard key={post.id} post={post} />)
      )}
      <InfiniteScroll onLoadMore={fetchNextPage} />
    </div>
  );
}
```

---

## 9. Performance Strategy

### 9.1 Code Splitting

```typescript
// Dynamic imports for heavy components
const ComposerPage = dynamic(() => import('@/features/posts/components/post-composer'), {
  loading: () => <ComposerSkeleton />,
  ssr: false, // No SSR needed for editor
});

const AnalyticsDashboard = dynamic(
  () => import('@/features/analytics/components/dashboard'),
  { loading: () => <AnalyticsSkeleton /> }
);

const WorkflowBuilder = dynamic(
  () => import('@/features/automation/components/workflow-builder'),
  { loading: () => <BuilderSkeleton />, ssr: false }
);
```

### 9.2 Image Optimization

```typescript
// Next.js Image with CDN transforms
<Image
  src={cdnUrl(media.path, { width: 800, format: 'webp', quality: 80 })}
  alt={media.altText}
  width={800}
  height={450}
  placeholder="blur"
  blurDataURL={media.placeholderBase64}
  priority={media.isHero}
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
/>
```

### 9.3 Bundle Analysis Targets

| Bundle | Target Size | Strategy |
|---|---|---|
| Initial JS (critical path) | < 100 KB gzip | Code splitting, tree shaking, RSC |
| Dashboard page | < 150 KB gzip | Dynamic import for charts, calendar |
| Composer page | < 200 KB gzip | Lazy load AI panel, media editor |
| Analytics page | < 250 KB gzip | Lazy load chart libraries (recharts) |
| Workflow builder | < 200 KB gzip | Lazy load drag-and-drop library |

### 9.4 Virtualization

```typescript
// features/posts/components/post-list.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

export function PostListVirtualized({ posts }: { posts: Post[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // average row height
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[800px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <PostCard post={posts[virtualItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 9.5 Lazy Loading Priority

| Element | Strategy | Trigger |
|---|---|---|
| Charts / analytics | Dynamic import | Scroll into view |
| AI generation panel | Dynamic import | Click "Generate" |
| Media editor / cropper | Dynamic import | Click "Edit media" |
| Calendar (month view) | Dynamic import | Tab switch to planner |
| Workflow builder (canvas) | Dynamic import | Click "New workflow" |
| Emoji picker | Dynamic import | Focus on content editor |
| Markdown preview | Dynamic import (low pri) | Post hover |
| Export (CSV/PDF) | Dynamic import | Click "Export" |

---

## 10. Error Boundaries

### 10.1 Per-Feature Error Boundaries

```typescript
// components/shared/error-boundary.tsx
'use client';

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  children: ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to Sentry
    captureException(error, { extra: { componentStack: errorInfo.componentStack } });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <ErrorFallback
            error={this.state.error}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        )
      );
    }
    return this.props.children;
  }
}

// Usage in layout:
<ErrorBoundary fallback={<PostsErrorFallback />}>
  <PostList />
</ErrorBoundary>
```

### 10.2 Error Fallback Hierarchy

| Level | Boundary Location | Fallback UI |
|---|---|---|
| Global | `app/error.tsx` | Full-page error with retry + contact support |
| Layout | `app/(dashboard)/error.tsx` | Sidebar intact, content area shows error |
| Feature | `features/posts/components/post-list.tsx` | Card-level error with dismiss/retry |
| Widget | Analytics chart | Chart area shows "Failed to load" with retry button |
| Component | Single post card | Card shows "Post unavailable" with no crash |

### 10.3 Error Reporting

```typescript
// lib/utils/error-reporting.ts
export function handleClientError(error: unknown, context?: Record<string, unknown>) {
  // Skip user-aborted errors (navigation, cancelled requests)
  if (error instanceof DOMException && error.name === 'AbortError') return;
  if (isCancelledError(error)) return;

  const enriched = {
    ...context,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
  };

  captureException(error, { extra: enriched });
}
```

---

## 11. Form Handling

### 11.1 Complex Form Patterns

**Post Composer (multi-step, multi-platform):**
```typescript
// features/posts/schemas/composer-schema.ts
export const composerSchema = z.object({
  content: z.string().min(1, 'Content is required').max(5000),
  platforms: z.array(z.enum(PLATFORMS)).min(1, 'Select at least one platform'),
  media: z.array(mediaSchema).max(10).optional(),
  scheduledAt: z.date().optional().nullable(),
  isDraft: z.boolean().default(true),
  tags: z.array(z.string()).max(30).optional(),
  link: z.string().url().optional().or(z.literal('')),
  // Platform-specific overrides
  platformOverrides: z.record(
    z.enum(PLATFORMS),
    z.object({
      content: z.string().max(5000).optional(),
      media: z.array(mediaSchema).optional(),
    })
  ).optional(),
});

// Composer page with react-hook-form + zod resolver
export function PostComposer({ postId }: { postId?: string }) {
  const form = useForm<ComposerSchema>({
    resolver: zodResolver(composerSchema),
    defaultValues: async () => {
      if (postId) return postsApi.getDraft(postId);
      return { content: '', platforms: [], media: [], isDraft: true };
    },
  });

  const { isDirty, autoSave } = useComposerAutoSave(form);
  const { fields: mediaFields, append, remove } = useFieldArray({
    control: form.control,
    name: 'media',
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handlePublish)}>
        <PostContentEditor control={form.control} />
        <PlatformSelector control={form.control} />
        <MediaAttacher fields={mediaFields} onAdd={append} onRemove={remove} />
        <SchedulePicker control={form.control} />
        <AIAssistPanel content={form.watch('content')} platforms={form.watch('platforms')} />
      </form>
    </Form>
  );
}
```

### 11.2 Auto-Save

```typescript
// features/posts/hooks/use-composer-auto-save.ts
export function useComposerAutoSave(form: UseFormReturn<ComposerSchema>) {
  const lastSaved = useRef<string>('');
  const saveTimeout = useRef<NodeJS.Timeout>();

  // Auto-save every 5 seconds when dirty
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!form.formState.isDirty) return;

      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const serialized = JSON.stringify(values);
        if (serialized === lastSaved.current) return;

        await postsApi.saveDraft(values as ComposerSchema);
        lastSaved.current = serialized;
        form.reset({ ...values } as ComposerSchema);
      }, 5000);
    });

    return () => subscription.unsubscribe();
  }, [form]);

  // Warn before leave if unsaved
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (form.formState.isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [form.formState.isDirty]);

  return { isDirty: form.formState.isDirty };
}
```

### 11.3 Draft Recovery

```typescript
// features/posts/hooks/use-draft-recovery.ts
export function useDraftRecovery(postId?: string) {
  const recoveryKey = `draft:${postId || 'new'}`;

  useEffect(() => {
    // Check for recovered draft on mount
    const recoveryDraft = localStorage.getItem(recoveryKey);
    if (recoveryDraft && postId) {
      // Server already has latest — skip
      return;
    }
    if (recoveryDraft && !postId) {
      // Recovered unsaved draft — prompt user
      showRecoveryDialog(recoveryDraft);
    }
  }, [recoveryKey, postId]);

  const saveRecoveryDraft = debounce((data: ComposerSchema) => {
    localStorage.setItem(recoveryKey, JSON.stringify(data));
  }, 2000);

  const clearRecoveryDraft = () => {
    localStorage.removeItem(recoveryKey);
  };
}
```

---

## 12. File Upload

### 12.1 Chunked Upload Flow

```
1. User selects file
       │
       ▼
2. Initialize upload
   POST /media/init
   → { uploadId, chunkSize: 5MB, totalChunks: 12 }
       │
       ▼
3. For each chunk (parallel, max 3 concurrent):
   PUT /media/chunk/{uploadId}/{chunkIndex}
   → { chunkIndex, etag }
   Progress callback updates Zustand upload store
       │
       ▼
4. Complete upload
   POST /media/complete/{uploadId}
   → { mediaId, url, thumbnails }
       │
       ▼
5. Cancel/resume:
   - Cancel: POST /media/cancel/{uploadId}
   - Resume: GET /media/status/{uploadId} → missing chunks → retry
```

### 12.2 Upload Component

```typescript
// features/content/hooks/use-chunked-upload.ts
export function useChunkedUpload() {
  const { addUpload, updateProgress, removeUpload } = useUploadStore();

  const upload = useCallback(async (file: File): Promise<MediaResult> => {
    const uploadId = crypto.randomUUID();
    const chunkSize = 5 * 1024 * 1024; // 5MB
    const totalChunks = Math.ceil(file.size / chunkSize);

    addUpload({ uploadId, fileName: file.name, progress: 0, status: 'initializing' });

    // Initialize
    const { uploadUrl } = await mediaApi.initUpload({
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      totalChunks,
    });

    // Upload chunks
    const chunkPromises = Array.from({ length: totalChunks }, (_, i) => {
      const start = i * chunkSize;
      const chunk = file.slice(start, start + chunkSize);

      return async () => {
        const etag = await mediaApi.uploadChunk(uploadUrl, i, chunk);
        updateProgress(uploadId, Math.round(((i + 1) / totalChunks) * 80));
        return { chunkIndex: i, etag };
      };
    });

    // 3 concurrent
    const results = await pMap(chunkPromises, (fn) => fn(), { concurrency: 3 });

    // Complete
    updateProgress(uploadId, 90);
    const media = await mediaApi.completeUpload(uploadUrl, results);
    updateProgress(uploadId, 100);
    removeUpload(uploadId);

    return media;
  }, [addUpload, updateProgress, removeUpload]);

  return { upload };
}
```

### 12.3 Progress Tracking

```typescript
// stores/upload-store.ts
interface UploadItem {
  uploadId: string;
  fileName: string;
  progress: number;
  status: 'initializing' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}

interface UploadStore {
  uploads: UploadItem[];
  addUpload: (item: UploadItem) => void;
  updateProgress: (uploadId: string, progress: number) => void;
  setStatus: (uploadId: string, status: UploadItem['status']) => void;
  removeUpload: (uploadId: string) => void;
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: [],
  addUpload: (item) => set((state) => ({ uploads: [...state.uploads, item] })),
  updateProgress: (id, progress) =>
    set((state) => ({
      uploads: state.uploads.map((u) => (u.uploadId === id ? { ...u, progress } : u)),
    })),
  setStatus: (id, status) =>
    set((state) => ({
      uploads: state.uploads.map((u) => (u.uploadId === id ? { ...u, status } : u)),
    })),
  removeUpload: (id) =>
    set((state) => ({ uploads: state.uploads.filter((u) => u.uploadId !== id) })),
}));
```

---

## 13. Internationalization

### 13.1 Configuration

```typescript
// i18n.config.ts
export const i18n = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'fr', 'de', 'ja', 'pt-BR', 'zh-CN', 'ko', 'ar', 'hi'],
  localeDetection: true,
} as const;

export type Locale = (typeof i18n.locales)[number];
```

### 13.2 Translation File Structure

```json
// messages/en.json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "Something went wrong",
    "retry": "Retry",
    "noResults": "No results found"
  },
  "nav": {
    "overview": "Overview",
    "planner": "Content Planner",
    "composer": "Composer",
    "posts": "Posts",
    "analytics": "Analytics",
    "engagement": "Engagement",
    "content": "Content Library",
    "ai": "AI Studio",
    "automation": "Automation",
    "campaigns": "Campaigns",
    "settings": "Settings",
    "admin": "Admin"
  },
  "posts": {
    "createPost": "Create Post",
    "editPost": "Edit Post",
    "publish": "Publish",
    "schedule": "Schedule",
    "saveDraft": "Save Draft",
    "status_draft": "Draft",
    "status_scheduled": "Scheduled",
    "status_publishing": "Publishing...",
    "status_published": "Published",
    "status_failed": "Failed",
    "selectPlatform": "Select platforms to publish to",
    "contentPlaceholder": "What do you want to share?",
    "charCount": "{count}/{limit} characters"
  },
  "analytics": {
    "overview": "Analytics Overview",
    "followers": "Followers",
    "engagement": "Engagement Rate",
    "impressions": "Impressions",
    "clicks": "Clicks",
    "bestTime": "Best time to post",
    "topPosts": "Top performing posts",
    "comparePeriod": "Compare period"
  }
}
```

### 13.3 RTL Support

```typescript
// components/providers/theme-provider.tsx
export function ThemeProvider({ children, locale }: Props) {
  const direction = isRTL(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction}>
      <body className={cn(direction === 'rtl' && 'rtl')}>
        {children}
      </body>
    </html>
  );
}

// Tailwind RTL utilities
// rtl: Prefix for RTL-specific styles
<div className="flex rtl:flex-row-reverse">
  <span className="ml-2 rtl:mr-2 rtl:ml-0">{text}</span>
</div>
```

---

## 14. PWA Support

### 14.1 Service Worker

```typescript
// public/sw.js
const CACHE_NAME = 'social-os-v1';
const STATIC_ASSETS = [
  '/',
  '/overview',
  '/offline',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Install: cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

// Fetch: network first, fallback to cache, then offline page
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/offline').then((r) => r || caches.match('/'))
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

### 14.2 Push Notifications

```typescript
// lib/push-notifications.ts
export async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return; // Push not supported
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_KEY!),
  });

  // Send subscription to backend
  await notificationApi.savePushSubscription(subscription);
}

// Handle foreground push messages
export function useForegroundPushHandler() {
  useEffect(() => {
    const handler = (event: PushEvent) => {
      const data = event.data?.json();
      if (data && document.visibilityState === 'visible') {
        // Show in-app notification instead of system toast
        useNotificationStore.getState().addNotification(data);
      }
    };

    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);
}
```

### 14.3 Offline Experience

| Feature | Offline Behavior |
|---|---|
| Posts list | Cache from last visit, show stale data with "Offline" indicator |
| Post composer | Fully functional — saved to IndexedDB, syncs on reconnect |
| Analytics dashboard | Show cached snapshot, disable refresh button |
| Content library | Thumbnails from cache, full-size on demand |
| Settings | Editable — queued for sync |
| Engagement inbox | Cached from last fetch, real-time stream paused |
| AI generation | Disabled — requires network |
| Workflow builder | Disabled — requires network |

---

## Appendix: Key Dependencies

```json
{
  "next": "^14.2.0",
  "react": "^18.3.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^5.0.0",
  "react-hook-form": "^7.52.0",
  "@hookform/resolvers": "^3.9.0",
  "zod": "^3.23.0",
  "tailwindcss": "^4.0.0",
  "recharts": "^2.12.0",
  "@tanstack/react-virtual": "^3.10.0",
  "date-fns": "^3.6.0",
  "lucide-react": "^0.400.0",
  "next-intl": "^3.21.0",
  "urql": "^4.1.0",
  "graphql-ws": "^5.16.0",
  "clsx": "^2.1.0",
  "tailwind-merge": "^2.5.0",
  "p-map": "^7.0.0",
  "next-pwa": "^5.6.0",
  "@sentry/nextjs": "^8.0.0"
}
```
