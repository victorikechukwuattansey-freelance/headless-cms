# Environment Variables

## Provider Selection

These env vars select which adapter implementation each service uses:

| Variable             | Values                       | Description             |
| -------------------- | ---------------------------- | ----------------------- |
| `AUTH_PROVIDER`      | `nextauth`, `supabase`       | Authentication provider |
| `BILLING_PROVIDER`   | `stripe`, `lemon-squeezy`    | Payment provider        |
| `STORAGE_PROVIDER`   | `s3`, `uploadthing`          | File storage provider   |
| `ANALYTICS_PROVIDER` | `posthog`, `plausible`, `ga` | Analytics provider      |

## Required

| Variable       | Description                  |
| -------------- | ---------------------------- |
| `DATABASE_URL` | PostgreSQL connection string |

## Authentication

| Variable                | Description                           |
| ----------------------- | ------------------------------------- |
| `AUTH_SECRET`           | Session encryption key (min 32 chars) |
| `AUTH_GITHUB_ID`        | GitHub OAuth App client ID            |
| `AUTH_GITHUB_SECRET`    | GitHub OAuth App secret               |
| `AUTH_GOOGLE_ID`        | Google OAuth client ID                |
| `AUTH_GOOGLE_SECRET`    | Google OAuth client secret            |
| `AUTH_DISCORD_ID`       | Discord application ID                |
| `AUTH_DISCORD_SECRET`   | Discord application secret            |
| `AUTH_MICROSOFT_ID`     | Microsoft Entra ID client ID          |
| `AUTH_MICROSOFT_SECRET` | Microsoft Entra ID secret             |

## Payments

### Stripe

| Variable                             | Description                       |
| ------------------------------------ | --------------------------------- |
| `STRIPE_SECRET_KEY`                  | Stripe secret key                 |
| `STRIPE_WEBHOOK_SECRET`              | Stripe webhook signing secret     |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key            |
| `STRIPE_STARTER_PRICE_ID`            | Stripe price ID for Starter plan  |
| `STRIPE_PRO_PRICE_ID`                | Stripe price ID for Pro plan      |
| `STRIPE_BUSINESS_PRICE_ID`           | Stripe price ID for Business plan |

### Lemon Squeezy

| Variable                            | Description             |
| ----------------------------------- | ----------------------- |
| `LEMON_SQUEEZY_API_KEY`             | Lemon Squeezy API key   |
| `LEMON_SQUEEZY_STORE_ID`            | Lemon Squeezy store ID  |
| `LEMON_SQUEEZY_WEBHOOK_SECRET`      | Webhook signing secret  |
| `LEMON_SQUEEZY_STARTER_VARIANT_ID`  | Variant ID for Starter  |
| `LEMON_SQUEEZY_PRO_VARIANT_ID`      | Variant ID for Pro      |
| `LEMON_SQUEEZY_BUSINESS_VARIANT_ID` | Variant ID for Business |

## Email

| Variable            | Description          |
| ------------------- | -------------------- |
| `RESEND_API_KEY`    | Resend API key       |
| `RESEND_FROM_EMAIL` | Sender email address |

## Storage

### AWS S3

| Variable                | Description    |
| ----------------------- | -------------- |
| `AWS_ACCESS_KEY_ID`     | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION`            | AWS region     |
| `AWS_BUCKET_NAME`       | S3 bucket name |

### UploadThing

| Variable             | Description        |
| -------------------- | ------------------ |
| `UPLOADTHING_SECRET` | UploadThing secret |
| `UPLOADTHING_APP_ID` | UploadThing app ID |

## Analytics

### PostHog

| Variable                   | Description         |
| -------------------------- | ------------------- |
| `NEXT_PUBLIC_POSTHOG_KEY`  | PostHog project key |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host URL    |

### Plausible

| Variable                       | Description                |
| ------------------------------ | -------------------------- |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | Plausible analytics domain |

### Google Analytics

| Variable            | Description                     |
| ------------------- | ------------------------------- |
| `NEXT_PUBLIC_GA_ID` | Google Analytics measurement ID |
