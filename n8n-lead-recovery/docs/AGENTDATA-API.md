# AgentData Domain-Search API (H.4-rev)

Reference for the **AgentData** contact-enrichment integration in Enrichment V1.
Scope: the `domainSearch()` wire contract implemented by
`src/enrichment-contact-client.js` and consumed by
`src/enrichment-contact.js`.

> **Probe status: PENDING.** No live request has been made yet. The shape below
> is the **assumed** contract encoded in the client and covered by the test
> suite; it must be confirmed against the provider's real endpoint once an
> `AGENTDATA_API_KEY` is supplied (one probe, `stripe.com`, key redacted,
> recorded here). Any mismatch is a code change first, then a re-baseline.

## Endpoint (assumed)

```
GET {AGENTDATA_BASE_URL}/api/v1/lookup
  ?domain=<bare domain, lowercased>
  &min_confidence=90
  &verification_status=valid,catch-all
Authorization: Bearer <AGENTDATA_API_KEY>
```

- **Base URL:** `https://agentdata.run` (constant `AGENTDATA_BASE_URL` in the
  client).
- **Auth:** `Authorization: Bearer <key>`; the key is read from
  `process.env.AGENTDATA_API_KEY` by the runner-only client and is **never**
  embedded in the shipped workflow, logged, or leaked in error messages.
- **Pacing:** one in-flight request per client; a pure `paceDelayFor(lastCallAt,
  now, minPacingMs)` enforces a 200 ms minimum between starts (first call
  immediate, injected `sleep`/`clock` keep the module testable and hermetic).

## Success response (assumed)

```json
{
  "domain": "stripe.com",
  "min_confidence": 90,
  "emails": [
    {
      "email": "jane.doe@stripe.com",
      "confidence": 98,
      "verification_status": "valid",
      "first_name": "Jane",
      "last_name": "Doe",
      "position": "Operations Manager"
    }
  ]
}
```

The client parses `body.emails` (tolerating a top-level array as well) and
**normalizes each entry to the canonical `domainSearch` item**:

- `email` (from `item.email`, else `item.value`)
- `confidence` (from `item.confidence`, else `item.score`)
- `verification_status` — mapped to one of `valid`, `unverified`, or
  `catch-all`; a `catch-all` value is rewritten to `valid` at the wire so the
  engine can stay strict on `'valid'`
- `first_name`, `last_name`, `position` (when present)

The client drops any item with no usable `email` and returns its items in the
provider's order (best-first is a provider guarantee, not re-sorted by us).

## Error model

The client **throws**; the engine reads `.fatal`, `.reason`, `.status`:

| Condition                                   | Behavior |
| ------------------------------------------- | -------- |
| 401 / 403                                   | fatal throw, **no retry** (`reason: "AgentData: invalid API key"` / `"forbidden"`, `status` set) |
| 429 / 5xx / transport failure / response-out | retry with delays `[500, 1500, 4500]` (injectable), then non-fatal throw |
| 200 with empty `emails`                     | `{ emails: [], source, creditsUsed: 0 }`; engine records `no_emails_found`, charges **1** credit |
| other 4xx (e.g. 404)                        | `{ emails: [], source, creditsUsed: 0 }` (no retry, **0** credits) |
| status-0 bodyless / unparsable              | non-fatal throw `AgentData: unknown response` (`.status` left unset) |

Fatal throws halt the batch (every remaining lead failed); non-fatal throws
defer just the current lead.

## Credit semantics

- A successful hit charges the provider's units reported by the response when
  present (`creditsUsed`), else **1**.
- A 200-empty (`no_emails_found`) is an executed lookup: **1** credit.
- A negative/absent-value 4xx empty is treated as **not executed**: 0 credits.

## Runner access only

`process.env` reads are confined to the runner-only client
(`src/enrichment-contact-client.js`). Neither the engine
(`src/enrichment-contact.js`) nor the embedded mirror
(`src/embedded-enrichment-contact.js`) may read environment variables, the
clock, or random sources — the shipped workflow is fed seams (`provider`,
`agentdataResults`, `agentdataFailures`) instead.

## Verification

- `node --test tests/enrichment-contact-client.test.js` — wire contract, pacing,
  retry, fatal/empty matrix (42 tests).
- `node --test tests/enrichment-contact-engine.test.js` — engine consumption of
  AgentData fixtures 020–026 (26 tests).
- `node --test tests/enrichment-workflow-build.test.js` — shipped-workflow chain
  parity, including `provider_runs.agentdata` and `::agentdata` lineage.