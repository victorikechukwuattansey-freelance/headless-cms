# BillPoint Parity Matrix

## Evidence Policy

BillPoint is treated only as a competitive baseline. This repository does not contain verified BillPoint reference material, screenshots, feature documentation, API documentation, or product research.

Because no verified BillPoint reference material is present in the repository, this matrix does not assert that BillPoint has or lacks any specific capability. Where BillPoint-specific evidence is absent, the classification is `UNKNOWN - REQUIRES RESEARCH`.

No BillPoint APIs are called. No BillPoint pages are scraped. No BillPoint branding or UI is copied.

## Classification Meanings

- `MATCH`: verified baseline capability exists and the MVP intentionally covers it.
- `EXCEED`: verified baseline capability exists and the MVP intentionally goes beyond it.
- `NOT REQUIRED FOR MVP`: verified baseline capability exists but is intentionally out of MVP scope.
- `FUTURE`: verified baseline capability exists or is strategically relevant, but belongs after the validation MVP.
- `UNKNOWN - REQUIRES RESEARCH`: capability cannot be verified from repository/provided reference material.

## Conservative Matrix

| Capability Area           | Capability To Compare                 | BillPoint Evidence In Repository | Classification              | MVP Product Stance                                                                                         |
| ------------------------- | ------------------------------------- | -------------------------------: | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Service/catalog breadth   | Airtime                               |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as core VTU category                                                                                |
| Service/catalog breadth   | Mobile data                           |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as core VTU category                                                                                |
| Service/catalog breadth   | Electricity                           |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as core bill-payment category                                                                       |
| Service/catalog breadth   | Cable TV / Pay TV                     |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as core bill-payment category                                                                       |
| Service/catalog breadth   | Internet subscriptions                |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as core bill-payment category                                                                       |
| Service/catalog breadth   | Education payments or pins            |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP where appropriate as mock service                                                                   |
| Digital goods             | Gift cards                            |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as first-class digital-goods flow                                                                   |
| Digital goods             | Digital vouchers                      |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP through generic digital product provider adapter                                                    |
| Ticketing                 | Cinema tickets                        |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP with mock search, availability, reservation, and issuance                                           |
| Ticketing                 | Event tickets                         |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP with mock search, availability, reservation, and issuance                                           |
| Ticketing                 | Bus/transport tickets                 |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP with mock routes, passenger info, and ticket issuance                                               |
| Ticketing                 | Airline tickets                       |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP with mock availability and customer/passenger flow                                                  |
| Wallet                    | Wallet funding                        |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as mock funding only                                                                                |
| Wallet                    | Wallet balance                        |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as simulated balance only                                                                           |
| Wallet                    | Wallet debit                          |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as simulated ledger event                                                                           |
| Wallet                    | Pending debit                         |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as simulated ledger state                                                                           |
| Wallet                    | Duplicate debit handling              |                             None | UNKNOWN - REQUIRES RESEARCH | MVP should exceed ordinary marketplace expectations through explicit duplicate-debit scenario and evidence |
| Payments                  | Payment authorization                 |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as mock authorization                                                                               |
| Payments                  | Payment confirmation                  |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as mock confirmation plus ReconcileKit determination                                                |
| Payments                  | Payment failure                       |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP with explainable failure timeline                                                                   |
| Payments                  | Reversal                              |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as simulated reversal status and evidence                                                           |
| Payments                  | Refund initiated/pending/completed    |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as simulated refund workflow and tracker                                                            |
| Payments                  | Settlement states                     |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as simulated settlement status and mismatch scenarios                                               |
| Transaction history       | Customer transaction list             |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP                                                                                                     |
| Transaction details       | Status detail page                    |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP with ReconcileKit-backed truth, timeline, evidence, and next action                                 |
| Receipts                  | Receipt generation/view               |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP with simulated receipt and evidence fields                                                          |
| Evidence                  | Provider response visibility          |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP and expected to exceed baseline through structured evidence pack                                    |
| Evidence                  | Internal reconciliation determination |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP and expected to exceed baseline                                                                     |
| Timeline                  | User-facing transaction timeline      |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP and expected to exceed baseline                                                                     |
| Support/dispute           | Dispute/support flow                  |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as simulated dispute intake and resolution state                                                    |
| Support/dispute           | Manual review state                   |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP and visible in admin operations                                                                     |
| Notifications             | Transaction notifications             |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as in-app mock notifications                                                                        |
| Account                   | Authentication shell                  |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as local/demo shell, not production auth                                                            |
| Account                   | Profile/settings                      |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as demo profile/settings                                                                            |
| Admin/operations          | Internal operations dashboard         |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP for validation; likely beyond consumer baseline                                                     |
| Provider health           | Provider latency/failure visibility   |                             None | UNKNOWN - REQUIRES RESEARCH | In MVP as mock metrics and scenario evidence                                                               |
| Compliance-gated services | Betting/gaming                        |                             None | UNKNOWN - REQUIRES RESEARCH | Future/compliance-gated only; no real implementation                                                       |

## MVP Differentiation Matrix

These are not verified BillPoint comparisons. They are MVP design positions based on the product vision.

| Product Dimension        | MVP Direction                                                                                                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Catalog breadth          | Broad mock catalog across VTU, bill payment, digital goods, ticketing, wallet/payment, and future compliance-gated categories |
| Transaction transparency | Strongly differentiated: timeline, evidence pack, ReconcileKit outcome, money-at-risk explanation, next action                |
| Dispute experience       | Strongly differentiated in MVP: support/dispute state is tied to evidence and reconciliation result                           |
| Refund/reversal tracking | Strongly differentiated in MVP as visible simulated lifecycle                                                                 |
| Admin resolution         | Strongly differentiated through unresolved, mismatch, duplicate, provider-latency, refund, reversal, and manual-review queues |
| Real integrations        | Not a goal for MVP except existing Paystack pilot code remains available and clearly separated                                |

## Required Research Before Claiming Parity

Before making public claims about BillPoint parity, collect current verified evidence from allowed public sources and document exact dates and sources for:

- Service categories.
- Wallet features.
- Payment flows.
- Transaction history and receipt behavior.
- Support/dispute workflow.
- Refund/reversal behavior.
- Gift card coverage.
- Ticketing coverage.
- Account features.
- Notification features.
- Any compliance-gated offerings.

Until that research is complete, all BillPoint-specific claims remain `UNKNOWN - REQUIRES RESEARCH`.
