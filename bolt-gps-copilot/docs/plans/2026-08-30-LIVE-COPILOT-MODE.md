# Live Copilot Mode — Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a distinct, phone-first LIVE COPILOT operating mode to `bolt-gps-copilot` — a real-world advisory layer on top of the frozen, validated economics engine — fully usable from a smartphone browser, offline-tolerant, log-first, and causally auditable (recommendation timestamped *before* driver action).

**Architecture:** Three-layer separation preserving the frozen simulation:
- `engine.js` — economic source of truth (frozen). Gets **additive-only** pure helpers that re-use existing primitives.
- `live-core.js` — Live Mode logic: GPS service state machine, shift state machine, decision orchestration (calls `engine.copilotDecide` directly), field event logger, local persistence, exports. No DOM, Node-testable.
- `live.html` + `live-ui.js` — mobile-first renderer. No economic formulas.
- `index.html` — simulation console. Untouched except one link to Live Mode.
- `manifest.webmanifest` + `sw.js` — optional PWA installability + offline app shell.

**Tech Stack:** Vanilla JS (no build step, no frameworks — matches existing single-file posture and §25 mobile performance). IndexedDB (localStorage fallback) for persistence. Existing `mulberry32`/engine math. No third-party libs in the Live UI; the SVG zone map is local (no tile network dependency).

**Frozen constraints (must not be broken):**
- `RIDER_GROSS − BOLT_COMMISSION = DRIVER_REVENUE_AFTER_COMMISSION`
- `DRIVER_REVENUE_AFTER_COMMISSION − PETROL_COST = NET_AFTER_FUEL`
- `TOTAL_KM = PAID_KM + UNPAID_KM`; relocation consumes time + fuel + km.
- ₦300,000/month = reference benchmark only, never an optimisation objective; no pace-as-evidence.
- No fabricated Bolt demand; no teleport; no hidden commission; no double-counted Copilot benefit.
- Simulated and live data never mixed; every Live-Managed session explicitly tagged ACTUAL vs SIMULATED.

---

## Global Constraints

- Do NOT redesign economics. Do NOT retune assumptions. Do NOT touch the ₦300k target. Do NOT start the 30-day validation.
- Do NOT modify simulation behavior in `engine.js` except purely additive exports (prove via `node audit/engine-verify.js` remaining **43 PASS / 0 FAIL**).
- Live recommentions must be timestamped before any driver action; actions timestamped; actuals recorded separately.
- Recommendation vocabulary: ACCEPT, DECLINE, STAY, WAIT, RELOCATE, CONSERVE, END SHIFT. No new economic behavior unless documented.
- Advisory only. No Bolt app automation/scraping/overlay. No analytics SDKs. No external requests from the Live UI.
- Phone-first: ≥44px targets, no horizontal scroll at 320px, no dense tables on primary screen, glanceable hero, one-handed bottom action bar.
- Working files: `C:\Users\1040 G8\Documents\jarvis-demo\bolt-gps-copilot\`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `engine.js` | MODIFY (additive) | `liveSurgeEnv`, `relocationAnalysis`, `liveRecommend`, `tripNetEval`, `zoneFor` + exports. Nothing else changes. |
| `live-core.js` | CREATE | GPS service, shift state machine, decision orchestration, event logger, IndexedDB/localStorage persistence, ledger, MTD, exports. Pure logic, no DOM. |
| `audit/live-verify.js` | CREATE | Node harness (GPS states, decisions, ordering, ledger invariants, persistence roundtrip, recovery, exports). |
| `live.html` | CREATE | Phone-first live screen; PWA manifest link; SVG zone map; loads engine.js + live-core.js + live-ui.js. |
| `live-ui.js` | CREATE | DOM renderer + interactions for live.html; driving/stopped mode; no economics. |
| `manifest.webmanifest` | CREATE | PWA manifest (name, icons, standalone, theme). |
| `sw.js` | CREATE | App-shell offline cache; registration guarded (fails silently on `file://`). |
| `icons/icon-192.png`, `icons/icon-512.png` | CREATE | Generated locally (no network). |
| `index.html` | MODIFY (one link) | Nav link "LIVE COPILOT → live.html" in toolbar. Simulation console otherwise untouched. |
| `docs/IMPLEMENTATION-REPORT.md` | MODIFY (append) | Live Copilot Mode section. |
| `docs/plans/2026-08-30-LIVE-COPILOT-MODE.md` | CREATE | This plan. |

---

## Engine.js additive exports (interfaces)

All new functions live in a new section after the existing API block. They only re-use existing primitives (`nearestZone`, `gc`, `netPerHour`, `surgeEstimate`, `surgeMult`, `fareAmount`, `estCycle`, `copilotDecide`, `ECON`).

- `liveSurgeEnv(date, opts)` → `{ dow, rain, event }` — MODELED environment inputs for real time (rain/event default `false`, overridable in Live diagnostics).
- `zoneFor(loc)` → `{ zone, distanceKm, radiusKm, inside }` — nearest modeled zone + whether inside its radius (`radiusKm = 0.7 × zone.w`).
- `relocationAnalysis(sim, econ)` where `sim = { t, hour, loc, surge }` → `{ curZone, curEh, stayVal, remMin, maxEh, best }`. Best = `{ z, eh, dkm, tReloc, fuelReloc, rv }` with `rv = eh*(remMin-tReloc) − fuelReloc − riskPremium`.
- `liveRecommend(sim, env, econ, trailingNet)` → enriched recommendation calling the **frozen `copilotDecide`** for the action (single source of truth), plus display details from `relocationAnalysis`. Returns `{ action, zone, evPerHr, stay:{zone,evPerHr}, remainingH, relocationKm/min/fuelCost, netAdvantage, bestReloc, note, inputs }`.
- `tripNetEval({fare, pickupKm, paidKm, cycleMin}, econ)` → `{ netFare, driveL, idleL, fuelCost, net, accept }` — mirrors the sim's per-trip gate math (engine.js:510-514) for ACCEPT/DECLINE.

**Consistency guarantee (tested):** for a grid of `(sim, env, econ)`, `liveRecommend().action` must map identically to `copilotDecide().action` (`REPOSITION` ↔ `RELOCATE`, fuel/trailing branches pass-through).

---

## live-core.js interfaces

IIFE exposing `LiveCore` (CommonJS `module.exports` + `globalThis.LiveCore`), constructor `LiveCore.create(opts)`.

**GPS service** (injectable `opts.geolocation` provider for tests):
- `gps.state`: `UNSET → REQUESTING → LIVE | STALE | DENIED | UNAVAILABLE`.
- Polling cadence `gpsIntervalSec` (default 30, configurable), `getCurrentPosition` (not `watchPosition`) using `enableHighAccuracy:false`, timeout 10s, maxAge 0.
- Stale after `staleAfterSec` (default 60) with age displayed; low accuracy (`> maxAccuracyM=200`) fix rejected; pause on `visibilitychange` hidden, immediate fix on visible.
- `gps.request()`, `gps.start()`, `gps.stop()`, `gps.pollNow()`, `gps.onChange`, `gps.lastFix = {lat,lng,accuracy,ts,speed,heading,source}`.
- Handles granted / denied / revoked / unavailable / timeout / unsupported / low-accuracy. Never pretends a stale fix is current.

**Simulated GPS feed** (lab/testing only — explicitly tagged, never counts as ACTUAL):
- `simGps.feed(lat,lng)` sets a fix tagged `source:'simulated'`; whole session flagged `fieldMode:'simulated'`; excluded from MTD and from ACTUAL export by default.

**Shift state machine**: `state ∈ IDLE | ONLINE | PAUSED | ENDED`.
- `start({odometer?, fuelL?})` captures ts, initial GPS, optional odo/fuel.
- `pause() / resume()`, `end({odometer?, fuelCost?, notes?})` captures final ts, GPS, odo, fuel; computes final ledger.

**Recording** (all timestamped; recommendations recorded BEFORE actions):
- `recommend(now)` → computes rec via `engine.liveRecommend`, assigns `recId`, pushes `recommendation` event.
- `tripOffer({fare, pickupZone?, dropoffZone?, estKm?, estMin?})` → evaluates via `engine.tripNetEval` → writes `trip_offer` event (BEFORE accept/decline) with `recId` from a recommendation.
- `tripOutcome({outcome, actualFare?, actualKm?, actualMin?, pickupZone, dropoffZone})` → closes pending offer; on `accepted` adds to `shifts.trips[]` + ledger.
- `action({recId, choice:'follow'|'override', reason})` → `driver_action` event (reason from chips: SAFETY/TRAFFIC/PERSONAL/BOLT REQUEST/GPS ERROR/OTHER — no typing required).
- `fuel({cost, litres?})`, `odometer({value, phase})`, `engine({state})`, `relocate({toZone, km, min})`, `relocateComplete()`, `consume({litres})` (manual fuel-state updates so CONSERVE/END fuel branches can trigger).
- Recent-zone dropdowns built from `engine.ZONES` sorted by distance from current fix (no long address typing).

**Ledger** (`ledger.compute()`) — only from RECORDED actuals:
- `RIDER_GROSS`, `BOLT_COMMISSION = round1(0.20×gross)`, `DRIVER_REVENUE`, `PETROL_COST`, `NET_AFTER_FUEL`, `NET/HR`, `NET/KM`, `FUEL ₦/KM`, `TOTAL_KM`, `UNPAID_KM`, `TRIPS`, `IDLE_MIN`, `ONLINE_MIN`, `upper:`/`lower:` label `ACTUAL` vs `PARTIAL`.
- Invariants asserted with the same tolerances as engine (`|g−c−r|≤0.05`, `|r−p−n|≤0.05`, km identity).

**MTD** (`mtd.compute()`) — only from completed ACTUAL shifts in the current calendar month; `paceEstimate` labelled `PACE ESTIMATE`; `actualNetSum` labelled `ACTUAL MONTH-TO-DATE NET_AFTER_FUEL`. Simulated sessions excluded.

**Persistence** (`store`): IndexedDB (DB `highlander-live`, store `kv`) with localStorage fallback; debounced (300ms) whole-shift snapshot + append event log; flush on `pagehide`/`visibilitychange`. `restore()` on load: finds latest shift; status `ONLINE` at last write → resumed as `PAUSED` flag `interrupted:true` (documented limitation: background-suspend may lose buffered writes; snapshot after every event mitigates). `store.wipe()` = delete all local shift data (privacy).

**Exports**: `exportJSON()` (full shift + events + ledger + meta, labeled `ACTUAL`/`SIMULATED`), `exportCSV()` (flat rows: header + per-event + ledger summary + `NET_AFTER_FUEL`).

---

## live.html / live-ui.js (phone-first)

- No external requests: no CDN, no web fonts, no tile map → works offline (except GPS which requires the browser/device).
- `100dvh` layout + `env(safe-area-inset-*)`; sticky header `statusbar`, scrollable `main`, sticky bottom `actionbar`. Handles address-bar resize + orientation via dvh + flex (`resize`/`visualViewport` listeners recompute `--app-h`).
- Hero recommendation card: giant action label + reason + expected ₦/hr + relocation detail + confidence. High contrast; can't be missed. Color-coded: STAY/ACCEPT green, RELOCATE blue, WAIT amber, CONSERVE amber, END SHIFT red.
- Status pills: `GPS LIVE/SEARCHING/DENIED/STALE(age)`, `OFFLINE`, `MODE: LIVE`, shift timer.
- Action bar (thumb-zone): context buttons `START SHIFT`, `FOLLOW`, `OVERRIDE`, `RECORD TRIP`, `PAUSE/RESUME`, `ENGINE OFF`, `END SHIFT`. Destructive actions use press-and-hold (~400ms) guard with visual progress to prevent accidental presses.
- `FOLLOW`/`OVERRIDE` → optionally pick reason chips (no typing).
- Trip capture: large numeric keypad for fare, recent-zone chips for pickup/dropoff; outcomes (accepted/declined/cancelled/no-show) as big buttons.
- **Driving mode**: auto-suggested from GPS (speed>8 km/h or position delta) and/or toggled; suppresses secondary content + input; hero becomes the only prominent element; tap `STOPPED` to interact. Never requires interaction while moving.
- SVG "zone radar" map (local): modeled zone centroids + current location + relocation target; supporting context only.
- Diagnostics `<details>`: data-quality tags (`GPS: LIVE`, `Demand: MODELED`, `Surge: MODELED`, `Fuel: CONFIGURED/MISSING`, `Traffic: MODELED`, `Bolt offer: MANUAL`), raw GPS coords, config.
- `#sim=1` URL flag → lab simulation feed (SIMULATED GPS) for testing the full pipeline without a device; session flagged SIMULATED.

---

## Task breakdown

### T1: engine.js additive live exports
Add `liveSurgeEnv`, `zoneFor`, `relocationAnalysis`, `liveRecommend`, `tripNetEval` + export keys after the API block. Delete/alter nothing.
**Verify:** `node --check engine.js`; `node audit/engine-verify.js` → still 43 PASS / 0 FAIL.

### T2: live-core.js
Implement the interfaces above, no DOM.
**Verify:** `node --check live-core.js`.

### T3: audit/live-verify.js
Node harness with injected fake geolocation + fake storage. Covers: GPS states (LIVE/STALE/DENIED/unavailable/low-accuracy + stale age), zone mapping + outside-zones fallback (STAY, no fabricated earnings), `liveRecommend`↔`copilotDecide` agreement grid (STAY/CONSERVE/END/RELOCATE), rec-before-action ordering, ledger invariants after fixture data, persistence round-trip + interrupted-recovery, MTD (SIMULATED excluded), JSON/CSV export shape.
**Verify:** `node audit/live-verify.js` → 0 FAIL.

### T4: live.html + live-ui.js
Phone-first UI + renderer. SVG zone map.
**Verify:** served over local http; browser check at 320/360/390/430 — no horizontal scroll, hero visible, ≥44px targets, controls reachable, driving mode suppresses input.

### T5: PWA + link
`manifest.webmanifest`, `sw.js` (guarded registration + offline shell), generated icons, one nav link in `index.html`.
**Verify:** manifest parses; SW registers on http://localhost (not file://); navigation link works.

### T6: Regression + browser E2E
Playwright: `index.html` run-1 shift + small paired CRN unchanged output shape; `live.html#sim=1` full flow (start shift → GPS sim feed → recommendation → follow/override → trip offer → outcome → fuel → pause/resume → end shift → JSON/CSV export → battery of refresh recovery), at the four widths + landscape.

### T7: IMPLEMENTATION-REPORT.md
Append Live Copilot Mode section (files, architecture, workflow, GPS behavior, offline, persistence, recommendation logic, mobile UX decisions, field-data schema, tests + results, known limitations, not-implemented, phone operating instructions).

---

## Test matrix (spec §30)

| Scenario | Where verified |
|---|---|
| GPS granted / denied / stale / unavailable / low accuracy | live-verify (fake geo) + live-ui diagnostics |
| outside modeled zones → STAY/OBSERVE, no fabricated ₦ | live-verify zoneFor |
| recommendation follow/override, rec<action ordering | live-verify + UI |
| shift start/end, pause/resume | live-verify + UI flow |
| trip logging, offer vs outcome | live-verify + UI |
| relocation, conserve, engine-off logging | live-verify decision grid + UI |
| fuel/gross entry, commission, NET_AFTER_FUEL invariants | live-verify ledger |
| refresh / reload recovery | live-verify + Playwright refresh |
| JSON & CSV export | live-verify + Playwright download |
| simulation regression + paired CRN regression | engine-verify 43/43 + Playwright index.html |
| 320/360/390/430 + portrait/landscape | Playwright viewport sweep |

---

## Known limitations (documented, not hidden)

- Real GPS cannot be exercised in this lab environment (no device sensor); the tests use an injected fake geolocator and the `#sim=1` SIMULATED feed. Field GPS permission flow must be smoke-tested on a real phone.
- Fuel is manual-entry only (no fuel sensor); when missing it is tagged `MISSING` and fuel-triggered CONSERVE/END are disabled (data fed as 60 L).
- Trailing-window NET (fuel-allocated) is not computable from lumpy manual fuel entries, so the trailing-NET CONSERVE trigger is disabled in Live (`trailing=null` → passed as 0 → branch inert) and labelled MISSING.
- Background suspension may drop the last few buffered writes before `pagehide`; every event is snapshotted immediately so loss is bounded to un-flushed tails.
- PWA offline caching requires http(s) (localhost or any static host); on `file://` the SW cannot register and the app still works online.