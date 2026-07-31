# Getting Started

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16+
- Docker (optional, for local database)

## Installation

1. **Clone the repository**

```bash
git clone <repo-url> saas-boilerplate
cd saas-boilerplate
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

- `DATABASE_URL` — PostgreSQL connection string
- `AUTH_SECRET` — Random string for session encryption (run `openssl rand -base64 32`)
- OAuth provider credentials (GitHub, Google, etc.)

4. **Initialize the database**

```bash
# Generate Prisma client
pnpm db:generate

# Push schema to database
pnpm db:push

# Seed with sample data
pnpm db:seed
```

5. **Start development**

```bash
pnpm dev
```

Visit http://localhost:3000

## First Run

After seeding, you can log in with:

- **Admin:** admin@saas.com / admin123
- **User:** user@saas.com / user123
