# Contributing

## Development Workflow

1. Create a feature branch
2. Make changes
3. Run `pnpm typecheck` (all 14 packages must pass)
4. Run `pnpm lint`
5. Create a pull request

## Code Style

- TypeScript strict mode
- No `any` types (use `unknown` if necessary)
- Server Components by default, Client Components only for interactivity
- Feature-based file organization
- Reusable components in `@saas/ui` package
- All external services follow Interface → Adapter → Factory pattern

## Commands

```bash
# Development
pnpm dev                  # Start all apps in dev mode
pnpm lint                 # Run ESLint
pnpm typecheck            # Run TypeScript checks (14 packages)
pnpm test                 # Run tests

# Database
pnpm db:generate          # Generate Prisma client
pnpm db:push              # Push schema to database
pnpm db:migrate           # Run migrations
pnpm db:seed              # Seed database
pnpm db:studio            # Open Prisma Studio

# Building
pnpm build                # Build all packages and apps
pnpm clean                # Clean build artifacts

# Formatting
pnpm format               # Format code with Prettier
```

## Project Structure

```
apps/
  web/                    # Next.js 15 application

packages/
  auth/                   # Authentication (interface + adapters + factory)
  payments/               # Billing (interface + adapters + factory)
  storage/                # File storage (interface + adapters + factory)
  analytics/              # Analytics (interface + adapters + factory)
  notifications/          # Notifications (channels + service)
  database/               # Prisma schema, client, seeds
  api/                    # API utilities (pagination, rate limiting)
  config/                 # Shared configuration (env, plans)
  emails/                 # React Email templates
  feature-flags/          # Feature flag system
  types/                  # Shared TypeScript types
  ui/                     # shadcn/ui components
  utils/                  # Utility functions
```

## Adding New Environments (recommended)

### Add env var to config package

```bash
packages/config/src/index.ts  # Add to getEnv() return type
packages/config/src/env.ts    # Add to Zod schema
```

### Add env var to documentation

```bash
docs/env.md                   # Document the variable
```

## Adding a New Provider Adapter

1. Check the service interface in the package's main export
2. Create `packages/<service>/src/adapters/<provider>/index.ts`
3. Implement the interface
4. Add the adapter to the factory
5. Add the env var to `packages/config`
6. Update `docs/env.md`

## Testing

- Write unit tests for utility functions and business logic
- Write integration tests for API routes
- Write E2E tests for critical user flows
- Run `pnpm test` before submitting a PR

## Documentation

- Keep `docs/api.md` in sync when adding/modifying routes
- Keep `docs/env.md` in sync when adding env vars
- Add ADRs for significant architectural decisions to `docs/adr/`
- Update `README.md` feature list when adding capabilities
