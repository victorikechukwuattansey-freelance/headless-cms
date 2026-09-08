# Final Discrepancy Audit — Resolution of §6 and Uplift Validity

**Date:** 2026-08-30 · **Method:** read-only audit of `engine.js`, design doc, audit reference; CRN sensitivity Monte Carlo (n=4,000–6,000 pairs/cell, seed 31,337). No production code was modified.

---

## Resolution of §6 items

### 1. §J-8 "≈ −₦70–80k/month @ AC1.10" vs computed −₦51.9k/month → **EXPLAINED, no uplift impact**

Measured AC drag 1.04 → 1.10 on the corrected Card B model: **−₦1,317/day = −₦34.2k/month**, not −₦80k. The design's "−70–80k per audit §8" derives from the first-order audit's V6 frame ("AC understated −₦~80k/mo") stacked on a ~0 baseline. On the corrected card the drag is 2.3× smaller and the measured 1.04 baseline is already −₦17.6k/month, landing at −₦51.9k/month. The band was a conservative prior, not a measurement. The paired uplift is a within-env difference and is **independent of level**, so this item does not threaten the uplift.

### 2. "Double" RISK_PREMIUM in relocation rule → **CONFIRMED as a real deviation, economically immaterial**

Design: `₦500 flat per relocation decision` = single application. Code applies it **twice** — inside `rv` (engine.js:400) and again in the stay-gate (`rv > stayVal + riskPremium`, engine.js:403), making the effective gate 2×.

| riskPremium | ΔNET/day (CI) | month | P(Δ>0) | REPOS/d |
|---|---|---|---|---|
| 0 | +3,023 [2,960, 3,087] | +₦78.6k | 89.1% | 9.9 |
| 250 (=design single ₦500) | +3,029 | +₦78.8k | 88.5% | 9.2 |
| 500 (engine, double-applied) | +3,032 [2,968, 3,096] | +₦78.8k | 89.0% | 7.7 |
| 1000 | +3,048 | +₦79.2k | 88.7% | 6.9 |
| 2000 | +3,068 | +₦79.8k | 88.8% | 6.7 |

Relocation is ~EV-neutral in this model (km barely moves 15.7→16.2/day), so the 2× bug shifts the trigger count but changes ΔNET by **<1.5%**. Resolution: fix-worthy for fidelity; **non-material to the uplift**.

### 3. Audit cancel-credit artifact → **RESOLVED conservatively; strengthens the uplift**

`auditCancelCredit` ON (audit-literal ledger) both arms: ΔNET **+₦2,020/day** (month +₦52.5k, P 76.6%). OFF (correct ledger, engine default): **+₦3,032/day** (+₦78.8k, P 89.0%).

Because the artifact credits only **cancelled** trips and the baseline books ~2.5 more cancellations/day, the artifact inflates the *baseline* more than the copilot — it **understates** the correct-ledger uplift by ~33%. Our headline uses the correct ledger, so the +₦78.5k is the *conservative* of the two figures.

### 4. Audit charges relocation time-free; engine charges time+fuel → **CONFIRMED; this is the load-bearing assumption**

Audit baseline adds relocation km+fuel but zero incremental time (relocation overlapped idle). Engine (per design §G-3/J-4) charges real relocation time + fuel. CRN sensitivity varying only the baseline arm:

| baseline relocProb | ΔNET/day (CI) | month | P(Δ>0) |
|---|---|---|---|
| 0.00 | +531 [476, 586] | **+₦13.8k** | 60.2% |
| 0.40 | +2,081 | +₦54.1k | 81.6% |
| 0.65 (default/design) | +3,032 | **+₦78.8k** | 89.0% |
| 1.00 | +4,304 | +₦111.9k | 94.9% |

**~85% of the central uplift is the baseline paying relocation fuel+time.** The design mandates the 0.65/2.6km script, so the +₦78.5k is internally consistent with the approved experiment — but the *audit's own* finding was "relocation wrongly negative (+₦86k/mo when removed)". Under a relocation-free baseline the copilot is still better, but only +₦13.8k/month (CI excludes 0, weak).

### 5. Copilot band-END trigger structurally inactive → **CONFIRMED; zero-impact design-fidelity note**

Every shift hour 06–17 has demand band d ≥ 0.85 (hours 0–4 alone have d < 0.5); `BAND.d < 0.5 && maxEh < ₦500` can never fire during a shift. Harness F6/F10 already prove the fuel-reserve END path executes and the band path never does. It is a genuinely dead advice channel in simulation; neither arm is affected.

---

## Uplift validity: is +₦78.5k/month real?

**Central estimate (approved-design model, verified A–H):** ΔNET **+₦3,032/day, 95% CI [2,968, 3,096], month +₦78.8k, P(Δ>0) 89.0%**, reproduced at n=4k–6k (3,021–3,032). Robust across risk-premium, cancel-credit (conservative), demand 0.6–1.4× (+₦75k–84k), sample size.

**But it is a single-channel result with two load-bearing assumptions:**

- **CONSERVE engine-off is ~the entire mechanism.** `conserveIdleFrac 0.5` (conserve keeps the engine on): ΔNET **−₦174/day, month −₦4.5k, P 48.4%** — the copilot is then *slightly worse* than baseline. With both hazardous assumptions rejected (relocProb 0 + conserveIdleFrac 0.5): **−₦69.5k/month, P 6.2%**.
- **85% of the margin is the baseline's relocation cost** (§6-4). Under a relocation-free baseline the uplift is +₦13.8k/month.

Mechanism accounting: copilot makes 9.5 CONSERVE decisions/day, ~468 idle-min/day, max idle-off saving ≈ 5.9 L/day — the channel nearly saturates, i.e. the whole +₦78.5k rides on "the driver turns the engine off whenever advised".

Secondary robustness scan (both arms fair):
- demand 0.6× → +₦75.0k/mo; 1.4× → +₦84.1k/mo.
- engineOnIdleFrac 0.25 → +₦47.0k/mo; 0.75 → +₦138.0k/mo (scales with idle-burn wedge).
- l100 14 (Highlander) → +₦78.8k; 12.5 → +₦63.5k; 10 → +₦57.8k; 7 → +₦49.5k. Contrary to the design's §H intuition, value *falls* as the vehicle gets efficient (the copilot's lever is fuel waste, which shrinks).

## Verdict

**The +₦78.5k/month copilot uplift survives every pure-discrepancy correction in §6, but it is not a robust forecast — it is the design-consistent upper bound of a mechanism with one dominant channel.**

It remains valid **as the approved-design experiment** (correct ledger, CRN, all A–H checks pass). It does **not** remain valid as a plan-of-record economic claim without two field/assumption caveats:
1. The uplift is dominated (≈85%) by the **baseline being charged relocation fuel+time** that the audit's own model regarded as wrongly negative; with a relocation-free baseline the claim falls to ≈ +₦14k/month.
2. The residual margin comes **entirely from engine-off CONSERVE adherence**; without it the copilot is slightly *worse* (−₦4.5k/month).

Defensible reporting: central estimate **+₦75–79k/month** as an *upper-bound channel figure*, sensitivity band **+₦14k → +₦79k/month**, worst case ≈ −₦70k/month; label the +₦78.5k as the approved-design central result, never as a standalone forecast until (1) baseline-relocation and (2) engine-off adherence are resolved by calibration. No production code was changed by this audit.