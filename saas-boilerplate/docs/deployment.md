# Deployment

## Vercel (Recommended)

1. Push your repository to GitHub
2. Import project in Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

**Build settings:**

- Framework: Next.js
- Build command: `pnpm build`
- Output directory: `apps/web/.next`

## Railway

1. Create a new project in Railway
2. Add PostgreSQL database
3. Connect your repository
4. Set environment variables
5. Deploy

## Docker

```bash
# Build the Docker image
docker build -f docker/Dockerfile -t saas-boilerplate .

# Run with PostgreSQL
docker compose -f docker/docker-compose.yml up -d
```

## Manual Deployment

```bash
# Build the application
pnpm build

# Start the production server
cd apps/web
pnpm start
```

## Environment Variables

Ensure all required environment variables are set in your production environment. See the [Environment Variables](./env.md) guide for a complete list.

## Database Migrations

```bash
# Run pending migrations
pnpm db:migrate

# Push schema changes (development only)
pnpm db:push
```
