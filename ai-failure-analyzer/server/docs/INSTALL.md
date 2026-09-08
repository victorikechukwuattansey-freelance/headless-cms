# Installation Guide

## Prerequisites

- **Node.js 20+** (developed on v24)
- **Docker Desktop** (for the bundled PostgreSQL container)

## 1. Install dependencies

```powershell
npm install
```

## 2. Start PostgreSQL

```powershell
docker compose up -d
```

This starts `postgres:16-alpine` with:

| Setting | Value |
|---|---|
| Host | `localhost` |
| Port | `5433` |
| Database | `ai_failure_analyzer` |
| User / Password | `analyzer` / `analyzer` |

Stop it with `docker compose down`. Data persists in the `analyzer_pgdata` volume.

## 3. Configure environment

`npm install` already created `.env` from `.env.example`. If your Postgres runs elsewhere, edit `DATABASE_URL`:

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/ai_failure_analyzer?schema=public"
```

## 4. Create the schema

```powershell
npx prisma migrate dev
```

Creates the `Report`, `ReportStep`, and `Evidence` tables.

## 5. (Optional) Seed example data

```powershell
npm run db:seed
```

Inserts 2 example reports (infinite loop + API failure) so the history page isn't empty.

## 6. Run

```powershell
npm run dev          # development (hot reload) → http://localhost:3001
npm run build        # production build
npm start            # run the built server
```

## 7. Run tests

```powershell
npm test
```

Requires the Postgres container to be up (integration tests write and clean up their own reports).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `failed to connect to the docker API` | Start Docker Desktop and wait for the engine to be ready |
| `PrismaClientInitializationError` | Check the container: `docker compose ps`; restart with `docker compose up -d` |
| Port 5433 in use | Change the port mapping in `docker-compose.yml` and update `DATABASE_URL` |
| Port 3001 in use | Set `PORT` in `.env` |
