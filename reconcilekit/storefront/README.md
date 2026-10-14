# reconcilekit-storefront (pilot)

A sibling module inside the ReconcileKit repository. Ships one Node HTTP server
(built-ins only, no framework) with two surfaces:

1. **Marketplace demo pilot** (Phase 2A–2K, primary) — a simulated
   "MarketPlace Connect" acquisition, fulfillment, and reconciliation demo:
   catalog → checkout → wallet debit → mock provider fulfillment →
   reconciliation bridge → the frozen ReconcileKit engine → customer and admin
   UI with evidence packs, receipts, notification and operator queues.
2. **Legacy Paystack acquisition surface** (Phase 2C, frozen) — the original
   business → product → order → Paystack `initialize`/`verify` flow producing
   the canonical `PaymentRecord`. It is retained and fully test-covered; its
   JSON/CSV routes are shadowed by the marketplace HTML surface when the
   marketplace deps are present (see Route surfaces).

## Scope

- Marketplace: 12 seeded categories / 24 services / gift-card + ticketing
  fulfillment, wallet (derived-balance ledger), mock providers, evidence packs,
  receipts, disputes/resolution, admin queues.
- Demo seeding: 16 scenarios (`STOREFRONT_SEED_DEMO=1`), all deterministic
  (fixed timestamp, stable token ids, idempotent replay).
- Legacy: `POST /businesses`, `POST /products`, `POST /orders`, `POST
/orders/:orderId/verify`, `GET /callback`, `GET /reconcile`,
  `GET /reconcile/merchant.csv`.
- No auth, no real payments, no real provider credentials required for the
  demo. The admin shell is a simulated operator surface (no production
  authentication).

## Configuration (environment variables; `.env` optional)

| Variable                         | Default                   | Purpose                                           |
| -------------------------------- | ------------------------- | ------------------------------------------------- |
| `STOREFRONT_PORT`                | `8787`                    | HTTP port                                         |
| `STOREFRONT_DATA_DIR`            | `<storefront>/data`       | JSONL data directory                              |
| `STOREFRONT_SEED_DEMO`           | —                         | `1`, `true`, or `yes` seeds the 16 demo scenarios |
| `STOREFRONT_PAYSTACK_SECRET_KEY` | —                         | Paystack secret (legacy surface only)             |
| `STOREFRONT_PAYSTACK_BASE_URL`   | `https://api.paystack.co` | Paystack API base                                 |
| `STOREFRONT_CALLBACK_BASE_URL`   | `http://localhost:<port>` | Base URL for the Paystack callback                |

The app itself never loads `.env`; it reads from `process.env`. `npm start`
runs under `node --env-file-if-exists=.env`, so a local `.env` (gitignored,
see `.env.example`) is injected into the environment at launch. The server
boots without any secrets; Paystack calls fail with a clear message until
`STOREFRONT_PAYSTACK_SECRET_KEY` is set (demo mode does not need it).

## Commands

```powershell
npm install
npm run typecheck
npm test
npm start          # serves the marketplace demo (no seed by default)
```

Run the seeded demo:

```powershell
$env:STOREFRONT_SEED_DEMO = "1"
npm start
```

Then open http://localhost:8787 (home → login is `demo@example.com` / demo
identity; Admin link in the header).

## Demo scenarios

The seed preloads 16 deterministic scenarios (see
`src/marketplace/demo-scenarios.ts`): `successful_airtime`, `failed_data`,
`pending_electricity`, `provider_timeout`, `duplicate_debit`,
`provider_mismatch`, `successful_gift_card`, `gift_card_fulfillment_failure`,
`cinema_ticket_success`, `bus_ticket_refund`, `airline_booking_pending`,
`payment_success_service_failure`, `payment_reversal`, `refund_pending`,
`manual_review`, and the wallet-only `wallet_funding_failure` (no marketplace
transaction page — a real 404). Each order scenario's `/transactions/<ref>`,
`/evidence`, and `/receipt` pages are asserted end-to-end by the test suite.

## Route surfaces

Customer: `/`, `/login`, `/dashboard`, `/wallet`, `/catalog`,
`/catalog/:id`, `/services/:id`, `/checkout`, `/checkout/:id`,
`/transactions`, `/transactions/:id`, `/transactions/:id/receipt`,
`/transactions/:id/evidence`, `/notifications`, `/disputes`, `/profile`.

Admin: `/admin`, `/admin/queues/<status>`, `/admin/transactions/:id`,
`/admin/transactions/:id/evidence`.

Assets: `/assets/app.css`, `/assets/app.js`.

With marketplace deps present, the legacy Paystack JSON/CSV routes (`/reconcile`,
`/reconcile/merchant.csv`, `/orders/*`, `/callback`) are shadowed and return
`404 text/html`; their behavior remains covered at the application layer
(`src/reconcile/*`, `src/paystack/*`, the verify use-case, and the API tests).

## Reconciliation bridge

`src/marketplace/reconcile-bridge.ts` feeds the frozen engine the marketplace
side:

- The only join key is the marketplace transaction id (`mk_txn_…`) on both
  sides; provider references are source attributes only, never join keys.
- Provider rows are emitted per the documented §4.4 policy (PENDING/TIMEOUT
  emits no provider row → the engine reports `MISSING_PROVIDER_RECORD` rather
  than a fabricated outcome).
- Duplicate provider responses dedupe to `MATCH` with an app-level
  `DUPLICATE_PROVIDER_RESPONSE` marker (integration DESIGN open decision #1a).

The frozen core (`src/domain`, `src/application`, adapters, CLI) is not
modified; the storefront adapts to it.

## Evidence & masking

- Gift-card codes and ticket codes are never stored or rendered in full; only
  masked previews (`GC-<token4>-****`, `TKT-<token4>-****`) appear, and the
  evidence pages state _only masked code previews are shown — full codes never
  leave the provider_.
- Evidence packs are immutable stored records; replay emits them as-is.
- Replays are store-only (no engine re-run) and idempotent.

## Layout

```
storefront/
  src/
    config.ts               env configuration
    ids.ts                  id + reference generation
    store/jsonl-store.ts    append-only JSONL store (latest-record-wins)
    paystack/               legacy Paystack client/gateway (frozen behavior)
    reconcile/              legacy expected-vs-received view + merchant CSV
    marketplace/            wallet, providers, transactions, bridge, truth,
                            evidence, receipts, resolution, seed, catalog
    ui/                     customer-pages, admin-pages, layout, client
    server.ts               all routes (marketplace + legacy tables)
    main.ts                 entry point (optional demo seed)
    domain/types.ts         legacy Business, Product, Order, PaymentRecord
  test/                     node:test suites
  data/                     local runtime data (gitignored)
```

## Testing

```powershell
npm test          # catalog, scenarios, validation, providers, wallet,
                  # bridge, truth/evidence, resolution, HTTP pages,
                  # walkthrough, legacy API/store/paystack
npm run typecheck
```

Current test baseline and standing guard: see `../docs/PHASE_3_CLOSURE.md` §5.

The Phase 2K walkthrough suite
(`test/marketplace/frontend-walkthrough.test.ts`) is the runnable contract for
the seeded HTTP surfaces. See `../docs/` for the full workshop documentation
(`PHASE_2K_FINAL_VALIDATION_AND_HANDOVER.md` is the current entry point).
