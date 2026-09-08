# FALSIFICATION AUDIT — Bolt GPS Copilot (Abuja): can a 2005 Toyota Highlander take home ₦300,000/month?

**Scope:** Independent economic falsification of the `bolt-gps-copilot` (v2, `index.html`) hypothesis that a Bolt driver in Abuja working 12h × 26 days can take home ≥ ₦300,000/month in a 2005 Toyota Highlander.
**Controlled quantity (as instructed):** `NET_AFTER_FUEL = rider gross fares − Bolt commission − petrol`. Maintenance and ownership costs are excluded from pass/fail but disclosed in §14.
**Verdict (see §2):** **D — UNLIKELY.** Under the corrected, calibrated model the 2005 Highlander cannot earn a positive NET_AFTER_FUEL at August-2026 petrol prices; `P(month ≥ ₦300,000) ≈ 0.0%` under every parameter combination inside the vehicle's feasible envelope.
**Constraint respected:** the application (`bolt-gps-copilot/index.html`) was NOT modified. All evidence was produced by additive scripts in `bolt-gps-copilot/audit/` (`monte-carlo.js`, `app-model.js`) and external research.

---

## 1. The question and the controlled quantity

- **Question:** "Can a Bolt driver in Abuja realistically take home ≥ ₦300,000/month after Bolt commission and petrol, working 26 days/month, in a 2005 Toyota Highlander?"
- **Controlled quantity (PASS/FAIL basis):** `NET_AFTER_FUEL = RIDER_GROSS_FARES − BOLT_COMMISSION − PETROL_COST`. This is NOT economic profit (maintenance, insurance, car payment, tyre/brake wear, data, A/C service, fines, drive/download fees are excluded and disclosed in §14).
- **Ledger lines tracked (all baselines, every simulated day):**
  - `RIDER_GROSS_FARES` (what the rider pays before any deductions)
  - `BOLT_COMMISSION` (= 20% of gross, official Bolt NGA driver guide)
  - `DRIVER_REV_AFTER_COMMISSION` = gross × (1 − commission)
  - `PETROL_COST` = litres × ₦1,299/L (AA Abuja, NNPC price after 2026-08-04 cut)
  - `NET_AFTER_FUEL` = after-commission − petrol
  - operating metrics: `TOTAL_KM`, `PAID_KM`, `UNPAID_KM` (pickup + repositioning), `LITRES_USED` (driving + idle), `₦/ONLINE-HOUR`, trips/day
- **Day target:** mathematical ₦11,538.46 (₦300k ÷ 26); operational ₦12,000/day as used by the app.

## 2. Executive verdict (requested format)

> **VERDICT: D — UNLIKELY.**
> A reasonable, calibrated model places the probability of a 2005 Highlander driver achieving `NET_AFTER_FUEL ≥ ₦300,000/month` in Abuja (26 × 12h workdays, August-2026 prices) at **≈ 0%**. Mean daily NET_AFTER_FUEL is **−₦15,300 (± ~₦2,200)**, i.e. the driver loses on average **≈ ₦398,000/month**. The root cause is structural, not behavioural: the vehicle's city fuel cost (~₦250 per total km at 14 L/100 km, ₦1,299/L) is **more than double** the post-commission revenue (~₦123 per total km). Break-even petrol for this vehicle is **~₦640/L**; today's price is ₦1,299. Even at a physically impossible 4 L/100 km, `P(month ≥ ₦300,000)` remains 0%.
> The application's own claim (~₦269k–315k/month "pace") is a model artifact: a flat fare of up to ~₦4,300 per trip that is ~2.8× the real distance-based Abuja fare, an omitted 20% commission, and a forced loop that embeds the Airport boost. Merely adding the omitted commission drops the app's own model to ~₦81k/month.

## 3. External evidence and assumption registry

| # | Parameter | Value used | Source | Confidence | Range |
|---|-----------|-----------|--------|-----------|-------|
| E1 | Bolt commission | 20% | bolt.eu/en-ng/driver/guide/commissions | VERIFIED (official) | 20–25% (driver reports) |
| E2 | Abuja booking fee | 2.5% of fare | bigswich.com 04-2026 | PLAUSIBLE | 0–2.5% |
| E3 | Abuja base fare | ₦350 | bolt.eu/en-ng/blog/how-much-is-a-bolt-ride (2023) + bigswich 04-2026 (identical) | VERIFIED (unchanged across 3 sources 2023→2026) | ₦300–350 |
| E4 | Abuja per-km | ₦88 | same | VERIFIED | ₦85–88 |
| E5 | Abuja per-minute | ₦10 | same | VERIFIED | ₦10–12 |
| E6 | Abuja minimum fare | ₦700 | same | VERIFIED | ₦450–700 |
| E7 | Surge multipliers | 1.0–1.7 by band; 1.15 rain; 1.55 events | transportlog.com.ng 2026 (Bolt 1.2–2.5×) | PLAUSIBLE | 1.0–2.5 |
| E8 | Petrol, Abuja Aug 2026 | ₦1,299/L | NNPC cut 2026-08-04 (was ₦1,335) | VERIFIED | ₦1,230–1,335 |
| E9 | 2005 Highlander city fuel econ | 14.0 L/100 km (base), ε[12.5,16.5] | Fuelly 19.26 MPG combined (12.2 L/100 km, 143 vehicles / 14,406 fuel-ups); EPA V6 17/23; city ≈ 13.8–14.7 | VERIFIED as an estimate | 12.5–16.5 |
| E10 | Highlander idle burn | 1.5 L/hr (engine-on half of idle time) | engineering estimate for 3.3L V6 | WEAK | 1.2–1.8 |
| E11 | A/C factor | +4% | typical hot-climate | WEAK | 0–6% |
| E12 | Abuja trip mix | 36% retail/mall, 35% hospitality, 29% business/ent. | independent.ng 2026-04 (ride-hailing data) | VERIFIED for mix emphasis | — |
| E13 | Airport road distance | 31–42 km city↔airport | rome2rio (31.7 km / 37 min); mytransfers (41.2 km); distancesfrom (43–45 km) | VERIFIED (spread noted) | 32–41 |
| E14 | City geometry | great-circle × 1.28 road factor | computed from coordinates | VERIFIED method | 1.1–1.4 |
| E15 | Traffic | peak speed ×0.62; morning corridor 28–35 min | AfroSAFE 2025 (Nyanya–Abuja); NJEAS 2024 (Karu Bridge) | PLAUSIBLE | ×0.55–0.7 |
| E16 | Cancellations | 6% of accepted trips | industry typical | WEAK | 4–10% |
| E17 | Workdays/month | 26 | user's operating assumption (app goal wiring) | user-specified | — |

**INSUFFICIENT EXTERNAL DATA (declared):** no published Abuja-specific mean trip-distance/demand-per-hour dataset located; Lagos earnings figures (E-benchmarks, §7) used as behavioural cross-check only, not as Abuja demand data. All such quantities are stochastic parameters with stated ranges, not assumed "true" values.

## 4. Parameter truth table for the app (`index.html`)

| App constant | Value | Audit classification | Reality |
|---|---|---|---|
| `FC` fuel price | ₦1,370/L | WRONG (minor) | ₦1,299/L (Aug 2026) |
| `SF` start fuel | 70 L | ARBITRARY | bank-account fuel, not tank |
| `BF` base fare | ₦3,000 | **INVALID** — flat fare | Abuja: ₦350 + ₦88/km + ₦10/min, min ₦700 |
| fare pipeline | `3000 × boost × 1.15(rain) × 1.15(peak)` | **INVALID** — no distance, no time | distance/time-based; `₦4,343` avg per-trip vs real `~₦1,528` |
| commission | **none in code** | **MATERIAL OMISSION** | −20% official |
| fuel | flat −2 L success / −0.6 L fail | INVALID — not km- or time-linked | depends on km driven + idle time |
| time | 1 "ride" = 1 hour, max 12/day | INVALID | trip time = pickup + ride + dwell; 10–14 trips/12h realistic |
| `LOOP` fixed CBD→Wuse 2→Maitama→Airport | forced relocation every trip | **DANGEROUS** — embeds Airport boost on every 4th trip | airport ≈ 5% of real trips, not 25% |
| boost 0.90–1.45 | surrogate | PLAUSIBLE | surge 1.0–2.5 dynamic |
| `rc` ride chance | calibrated 0.15–0.92 | PLAUSIBLE (proxy) | — |
| goal wiring | ₦12,000/day net; pace = net×26 | CORRECT INTENT | uses app-net (no commission) |
| rain toggle | +15% | PLAUSIBLE | ✓ |

## 5. Ledger trace — what `S.ear` actually means

Walking one "Ride" click in `index.html` (lines 325–330):
- `rc = min(0.97, max(0.15, (peak ? (hi ? .92 : .72) : (hi ? .68 : .4)) + rain.12 + weekend(-.08)))`
- On success: `S.ear += round(BF * z.boost * (rain?1.15:1) * (peak?1.15:1))` — **₦3,000 × 0.90–1.45 × 1.0–1.32**. Absolute y-anchor: **no deduction of any kind**. `S.ear` is therefore **RIDER_GROSS_FARES (Option A: rider-facing gross)**.
- Navigation: `S.loc = rnd(next LOOP zone)`; fuel: `S.fuel -= 2.0` success, `−0.6` miss; `S.hr += 1` (one ride per simulated hour).
- "Net" displayed anywhere = `S.ear − (SF − S.fuel) × FC` = **gross − flat fuel only**. There is no commission, no deadhead, no idle, no time-of-day scaling of fuel, no maintenance anywhere in the ledger.
- Consequence: the app's headline "net" is overstated by ≥ commission (20%) plus the fuel under-pricing (2 L/trip flat ≈ half the V6 real burn for the same km) plus a fare that is ~2.8× reality. These three errors compound to roughly a **3–4× overstatement** of take-home.

## 6. Corrected model (independent harness `audit/monte-carlo.js`)

- **Money:** `fare = max(₦700, ₦350 + 88×km + 10×min) × surge ≈ ₦1,528 mean`; commission 20%.
- **Fuel:** litres = `(paid + pickup + repositioned km)/100 × L_per_100km × 1.04(AC)` + `idle_hours × 0.5 × 1.5 L/hr`; petrol = litres × ₦1,299.
- **Time ledger:** 12h online; requests ~Poisson by hour-band demand; acceptance-limited; convoy time = pickup + dwell + ride + post-dwell; max 3 trips/hour slot; cancellations 6%.
- **15-zone Abuja geometry** with real coordinates; demand weights from E12 (mail/hotel/business emphasis); OD classes: intra-core / mall / cross / commute / suburban / satellite / airport.
- **Baselines:** A random (random hours, no repositioning, accepts ≤4.5 km); B experienced heuristic (06:30 start, repositions during idle, ≤3.4 km); C = GPS Copilot (B + demand-positioning, best pickup radius ≤3.0 km, band-aware repositioning).
- **Calibration target:** trips/day 12–16 at 12h (Lagos reference); all stochastic parameters in §3 with stated ranges.

## 7. Calibration vs real-world benchmarks

| Metric | Real-world reference | App model | Corrected model (C) |
|---|---|---|---|
| Trips/day (10–12h) | 12–16 (Lagos, transportlog 2026) | 8.3 | 12.0 |
| Gross/day | ₦22–30k (Lagos 10h) | ₦36.2k | ₦18.3k |
| Net/day after fuel, own car | ₦11.5–15.5k (Lagos, compact car, 25% comm) | ₦10.4k (no comm) | **−₦15.3k** |
| ₦/trip | ₦1,600–1,900 | **₦4,343** | ₦1,528 |

The app's per-trip fare is the single largest calibration failure (2.8× over).

## 8. Headline results — daily distribution (10,000 days, each baseline)

`NET_AFTER_FUEL`, ₦/day

| Baseline | mean | P5 | P25 | P50 | P75 | P95 |
|---|---|---|---|---|---|---|
| A (random) | −11,860 | −16,053 | −13,285 | −11,718 | −10,388 | −8,131 |
| B (heuristic) | −15,621 | −20,763 | −17,454 | −15,559 | −13,720 | −11,038 |
| C (GPS Copilot) | −15,302 | −20,474 | −17,175 | −15,213 | −13,383 | −10,633 |

Means/day (C): gross ₦18,329 · after-commission ₦14,663 · petrol −₦29,966 · **net −₦15,302** · 119 total km · 12.0 trips · 7.6 h idle.
Per-total-km economics (C, base): after-commission **₦123/km** vs fuel **₦250/km** → **−₦127/km**.

## 9. Monthly distribution (10,000 × 26-workday months)

| Baseline | mean | P5 | P50 | P95 |
|---|---|---|---|---|
| A | −308,421 | −329,322 | −308,297 | −287,298 |
| B | −404,782 | −430,311 | −404,883 | −378,843 |
| C | −397,809 | −424,543 | −397,745 | −371,762 |

## 10. Threshold probabilities (NET_AFTER_FUEL)

| Threshold (₦) | A | B | C |
|---|---|---|---|
| day ≥ 8,000 | 0.0% | 0.0% | 0.0% |
| day ≥ 10,000 | 0.0% | 0.0% | 0.0% |
| day ≥ 11,538 | 0.0% | 0.0% | 0.0% |
| day ≥ 12,000 | 0.0% | 0.0% | 0.0% |
| day ≥ 15,000 | 0.0% | 0.0% | 0.0% |
| month ≥ 200k | 0.0% | 0.0% | 0.0% |
| month ≥ 300k | 0.0% | 0.0% | **0.0%** |
| month ≥ 350k / 400k | 0.0% | 0.0% | 0.0% |

## 11. Downside / stress tests (C daily sequence, 10,000 days)

- P(any day ≥ target): 0.0% → **"consecutive misses / recovery" degenerate**: the driver is below target every day the model admits. Max consecutive sub-target streak = 10,000. `P(next day also below | today below) = 100%`.
- Worst 7-day rolling window: **−₦146,884** (≈ −₦20,983/day).
- P10 single-day net: −₦19,131.
- Stress via combined scenarios: all three baselines negative in every tail (P95 of monthly C = −₦371,762), i.e. even the *best 5%* of months are strongly negative.

## 12. Highlander fuel-economy scenarios + sustainability envelope (C)

| Scenario (L/100 km) | Monthly mean | P50 | P95 | P(≥300k) |
|---|---|---|---|---|
| optimistic 12.5 | −332,697 | −333,053 | −312,118 | 0.0000 |
| base 14.0 | −395,571 | −396,011 | −373,851 | 0.0000 |
| harsh 16.5 | −500,576 | −500,522 | −474,138 | 0.0000 |

- **Break-even petrol price** (C, mean conditions): **₦639/L**. Current market: ₦1,299/L.
- **Sustainable L/100 km** (zero net, mean conditions, incl. idle): **9.5**. Sustaining ₦12k/day NET requires fuel ≤ ₦3,125/day → at 23.2 L/day → **petrol ≤ ₦135/L** (pre-2023 subsidy era) — categorically outside 2026 prices.

## 13. Reverse-solve — what must be true for P(month ≥ ₦300k) ≈ 0.5?

Given the current fare table and commission (2005 Highlander, 12h, 26d): impossible by vehicle physics at ₦1,299/L (needs ≥ +100% fares, or ≥ ~20 trips/day of the current mix at current fares, or petrol ≤ ~₦500–640/L). One of the following must hold:
1. **Petrol ≤ ~₦640/L** (structural break — not realistically controllable by the driver), or
2. **Fare-per-km ≈ +100%** (i.e., a fare table not in existence today), or
3. **Vehicle ≤ ~6 L/100 km combined AND fares at the optimistic surge end** — still yields mean day only ≈ +₦1k at 4 L/100 km (P(≥300k)=0 under the model), so even a hyper-efficient car is marginal; realistically an **electric or hybrid at sub-₦1k/L-equivalent running cost** plus higher utilisation.
4. **Same car, fewer workdays is strictly worse** (fixed negative daily expectation).

## 14. False-positive analysis — why the app currently reports a green

The app's "pace" is a cascade of favourable assumptions, each individually plausible, three of which are false:
1. **Fare level** (dominant): flat ₦3,000×boost vs distance-based ₦88/km ⇒ 2.8× overstatement of gross per trip.
2. **Commission = 0** (omission): −20% of gross. Re-running the app's own trip/fuel structure with 20% commission drops its month pace from ≈ **₦269k → ₦81k**.
3. **Loop embeds the Airport boost**: the fixed loop forces relocation to the Airport zone every 4th trip (25% of trips at 1.45× — ~5× the real airport share); removing the loop in the app's own model drops net from ₦10.4k → ₦4.2k/day.
4. Fuel = flat 2 L/trip, no idle/deadhead: about half the real V6 burn for the same km.
No single parameter is absurd; the *compound* is what is absurd — a textbook multiple-favourable-factors coincidence. Real-world falsifier: in the last data available (Uber 2026 benchmark, net ₦11.5–15.5k/day with a **compact car** at 25% commission), the 2005 Highlander nets far below zero at today's petrol because its fuel-per-total-km doubles its possible revenue-per-km.

## 15. Live validation protocol (pre-registered)

To confirm or refute live (est. 10–14 driving days, ~₦0 incremental cost beyond fuel):
- Record per day: trips, paid km, total km, litres (full-tank method), rider-paid gross per trip (from app screenshots), payout, pickup minutes, idle time, rain/events.
- Compute NET_AFTER_FUEL per day; also log maintenance/tyres/brakes/parking.
- **Pre-registered pass (target holds):** ≥60% of ≥10 working days show NET_AFTER_FUEL ≥ ₦11,538 with ≤2 consecutive misses in the last 10 days.
- **Pre-registered fail:** 60% or fewer days ≥ ₦11,538 — plus a hard tripwire: any day with NET_AFTER_FUEL < −₦5,000 is economic evidence against continuing in THIS vehicle at THIS price level regardless of streaks.
- Report vs model percentile: the model predicts live mean ≈ −₦15,300/day (P5 −₦20,474 · P95 −₦10,633); live data outside [−₦20k, −₦10k] triggers model review.

## 16. Confidence and known limitations

- Confidence in the **verdict direction is HIGH**: the gap is 2:1 against the vehicle (fuel vs revenue per km), and the verdict is unchanged across the full sensitivity envelope (every P(≥300k)=0, month mean −₦256k to −₦819k across all sweeps). Tipping it would require re-pricing fares ~+100% or petrol ≤₦640/L.
- Residual INSUFFICIENT DATA (all directionally neutral, all tuned conservatively): Abuja-specific trip-distance distribution; exact 2026 Abuja surge distribution; real v5 Highlander idle burn; per-zone demand densities. None of these can flip the 2:1 structural gap.
- The monthly numbers are i.i.d. month batches (26 fresh days). Inter-day persistence (bad weeks clustering, vehicle breakdowns, account/rating events) would make real-world outcomes **worse**, not better. Consumption covariance and petrol-price drift are not modelled.
- No maintenance/ownership cost is inside the controlled quantity (per instructions) but it means the real operating result is even lower; and note the job must self-fund tyres/brakes/service/insurance from this NET figure.

## 17. Sensitivity (monthly mean, baseline C; 2,400 months per point)

| Variation | Month mean (₦) | P(≥300k) |
|---|---|---|
| base | −397,672 | 0.000 |
| commission 22.5% | −410,306 | 0.000 |
| commission 25% | −421,814 | 0.000 |
| petrol ₦1,000 | −218,262 | 0.000 |
| petrol ₦1,120 | −290,268 | 0.000 |
| petrol ₦1,500 | −518,785 | 0.000 |
| petrol ₦2,000 | −818,879 | 0.000 |
| shift 10h / 14h | −349,511 / −441,559 | 0.000 |
| demand +20% / −20% | −404,816 / −385,790 | 0.000 |
| surge −20% / +20% | −474,278 / −320,815 | 0.000 |
| L/100 km 12.5 / 16.5 | −302,161 / −424,008 | 0.000 |
| airport share ×1.5 | −326,201 | 0.000 |
| accepted-pickup 3.5 km | −321,740 | 0.000 |

**Binding constraints ranked:** (1) petrol per total-km vs post-commission revenue per total-km (unit economics); (2) surge level; (3) vehicle efficiency; (4) commission; (5) utilisation/trips. Demand is essentially non-binding at these fares because fuel cost per km exceeds revenue per km regardless.

## 18. The app's own claim reconciled (10,000 days, exact replication)

| App variant | Gross/day | "Net"/day | Month pace | P(day ≥ 0) |
|---|---|---|---|---|
| fixed loop (v2) | ₦36,161 | ₦10,355 | ₦269,232 | 98.7% |
| no loop | ₦26,748 | ₦4,164 | ₦108,273 | 87.1% |
| fixed loop + the omitted 20% commission | ₦36,161 | ₦3,123 | ₦81,196 | ~63% |

vs **corrected C model of the same 12h shift**: gross ₦18,329 · net −₦15,302/day · month −₦397,809. The gap between "app says ₦269k+" and "corrected says −₦398k" is entirely explained by the §14 cascade (fare level + commission + loop + fuel).

## 19. Model changes to present (NOT applied — awaiting approval)

Proposed rework of `bolt-gps-copilot/index.html` (only after the audit is accepted):
1. Replace the flat fare with the Abuja distance/time table (₦350 + ₦88/km + ₦10/min, min ₦700) computed from zone-to-zone road distances; drop `BF=3000`.
2. Add a settlement ledger: gross → −20% commission → fuel (real km + idle at selectable L/100km) → `NET_AFTER_FUEL`; make the goal bar track NET_AFTER_FUEL, not gross-minus-flat-fuel.
3. Make fuel a function of km driven and time (idle), not a flat 2 L/0.6 L; surface L/100km and petrol price as model inputs with defaults 14.0 and ₦1,299.
4. Replace "1 ride = 1 hour" with a time-consuming trip model (pickup + ride + dwell) so trip counts reflect the 12h day realistically.
5. Replace the fixed `LOOP` with a demand-driven zone recommendation (the existing `score()` ranking) and make it a *suggestion*, not a teleport; remove the forced Airport rotation (or make airport share a parameter default ~5%).
6. Add transparent monthly P&L per the ledger and a red "unsustainable" warning when NET_AFTER_FUEL < 0 on the trailing 7 days.
7. Keep the interaction model but treat the map/reroute as advisory.

## 20. Recommendation

- **For the 2005 Highlander: do not run this as the driver's only vehicle for a Bolt income target at ₦1,299/L petrol.** The corrected expectation is −₦300…−₦400k/month NET_AFTER_FUEL; even optimistic assumptions keep the target at P=0%.
- Realistic alternative paths to a ₦300k-month: (a) a ≤7 L/100 km vehicle (compact sedan / hybrid) — still marginal under the model (mean positive only below ~5 L/100 km); (b) electrified vehicle with sub-₦1k/L running cost; (c) revisit the target once petrol ≤ ~₦640/L; (d) multi-app + private/airport contract mix to lift Net fare/km above the fuel breakpoint (possible only for an efficient car).
- The GPS Copilot itself is directionally sound as a **positioning/demand tool**; its economics layer must be the corrected ledger (§19) so it never again reports a green outcome that the unit economics cannot support.
- Use §15's pre-registered protocol for any live test. **Recommend parking the ≥₦300k/month claim for the Highlander and re-scoping the demonstration to (i) correct economics and (ii) a vehicle-appropriate target.**

---
*Evidence files: `audit/monte-carlo.js` (corrected model, 10k days + 10k months + scenarios + sensitivity + reverse-solve), `audit/app-model.js` (application replication), outputs in `audit/results-run*.txt`. Application file `index.html` unchanged.*