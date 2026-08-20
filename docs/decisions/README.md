# docs/decisions — Decision Log

Running, chronological log of decisions made in this workspace. Formal architecture decisions graduate to an ADR in `ADR/` (or the owning project's `docs/adr/`); this log keeps the informal history.

## Format

Every entry records the four fields from the JARVIS Decision Logger:

```markdown
## YYYY-MM-DD — <Short title>

- **Decision:** <what was decided>
- **Reason:** <why>
- **Expected consequence:** <what should happen as a result>
```

## Log

## 2026-08-20 — Activity audit feed shipped

- **Decision:** Shipped an ADMIN-only `GET /audit-events` API (org-scoped, newest-first, `type`/`limit`/`offset` filters) plus an `/activity` dashboard page rendering all 17 `DomainAuditEvent` types as human-readable sentences with lead links (deals/bookings/agents have no detail routes, so plain short ids). Per the spec, no actor tracking, no entity-name enrichment.
- **Reason:** `DomainAuditEvent` was written by every domain action but had no read path — the audit trail existed yet was unreadable to admins.
- **Expected consequence:** Admins can review the live audit trail from the web UI; the OpenAPI `AuditEventType` enum (3 copies: OpenAPI, api-client, web) must be kept in sync manually when event types change.

## 2026-08-02 — Blaise Crest conversion pages (landing / waitlist / promo)

- **Decision:** Added 7 conversion-focused pages to the Blaise Crest static site — `/waitlist/` (Google Form via `WAITLIST_FORM` build constant), segment landings `/for-restaurants/`, `/for-offices/`, `/for-home/`, and promo pages `/promos/ramadan/`, `/promos/launch/`, `/promos/referral/`. Hand-authored HTML pages reusing `{{header}}/{{footer}}` partials; per-page metadata registry in `build.mjs` (canonical/OG/JSON-LD) extended; promos carry `Product`+`Offer` JSON-LD with placeholder codes/dates for client confirmation. Promo codes, offer dates, and the Google Form URL are placeholders in `build.mjs` constants.
- **Reason:** Client brief covers campaigns, expansion/app waitlist, and business-segment targeting; approach A (hand-authored, no template engine) matches the existing architecture and keeps client content edits simple.
- **Expected consequence:** New URLs appear in `sitemap.xml` automatically; reachable via footer link columns, homepage promo banner, and services cross-links; client must supply real Google Form URL + promo codes before launch.

## 2026-08-01 — AI Operating System structure (adapted)

- **Decision:** Scaffolded `ADR/` as a registry + template (ADRs stay in owning projects, e.g. `saas-boilerplate/docs/adr/`), plus `docs/ai/`, `docs/onboarding/`, `docs/decisions/`. Rejected the full 12-rule-file + per-package AGENTS.md proposal.
- **Reason:** The proposed generic monorepo AI OS duplicated the existing constitution–vault model (AGENTS.md + Brain `_system/` manuals), was premature for a workspace without a product codebase, and ignored opencode.json/.opencode. ADRs were already correctly homed inside saas-boilerplate.
- **Expected consequence:** Single authority for rules (AGENTS.md + vault); new ADRs register at `ADR/README.md`; informal decisions log here and graduate to ADRs when formalized.
