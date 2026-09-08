/* =============================================================================
 * audit/engine-verify.js — Verification harness for bolt-gps-copilot/engine.js
 * Implements the design's verification checks A–H. Node-only runner:
 *     node audit/engine-verify.js
 * Exits 0 on pass, 1 on any failed assertion.
 * ============================================================================= */
'use strict';

const E = require('../engine.js');
const chalk = (m, x) => console.log(m);

const PASS = [], FAIL = [];
function check(name, cond, detail) {
  if (cond) { PASS.push(name); console.log('  [PASS] ' + name + (detail ? ' — ' + detail : '')); }
  else { FAIL.push(name); console.log('  [FAIL] ' + name + (detail ? ' — ' + detail : '')); }
}
function section(t) { console.log('\n=== ' + t + ' ==='); }

/* ----------------------------------------------------------------- A --------- */
section('A. Syntax + module contract');
{
  check('A1 engine loads as CommonJS module', typeof E.simShift === 'function');
  check('A2 exposes API surface', ['ECON','ZONES','BAND','OD','PREF','CLASS_SPEED','CARD_B','buildEnv',
    'runMode','simShift','simPaired','checkLedger','reconcileAudit','netPerHour','copilotDecide','fareAmount',
    'summarizeShiftSet','summarizePairs','percentile','bootstrapCI'].every(k => k in E));
  check('A3 global export for file://-safe browser use', typeof global.Highlander === 'object');
  check('A4 SHIFT_MIN equals ECON.shiftHours*60', E.SHIFT_MIN === 720);
}

/* ----------------------------------------------------------------- B --------- */
section('B. Baseline @AC1.04 reproduces audited ~N0/day baseline');
{
  const r = E.reconcileAudit(3000);
  const lit = E.reconcileAudit(3000, { econ: { auditCancelCredit: true } });
  const t = { ride: r.rideH * 60, pick: r.pickupH * 60, dwell: r.dwellH * 60, idle: r.idleH * 60, reloc: r.relocH * 60 };
  console.log('  engine mean/day: net=%s  gross=%s  litres=%s  trips=%s  idleH=%s', r.netMean.toFixed(0), r.gross.toFixed(0), r.litres.toFixed(2), r.trips.toFixed(2), r.idleH.toFixed(2));
  console.log('  engine time budget: ride=%s pick=%s dwell=%s idle=%s reloc=%s (audit: idle=452.6, reloc time-free)', t.ride.toFixed(1), t.pick.toFixed(1), t.dwell.toFixed(1), t.idle.toFixed(1), t.reloc.toFixed(1));
  check('B1 time budget reproduces audit (ride~169.5, pick~64.4, dwell~33.6, idle+reloc~452.6)', Math.abs(t.ride - 169.5) <= 3 && Math.abs(t.pick - 64.4) <= 2 && Math.abs(t.dwell - 33.6) <= 1.5 && Math.abs(t.idle + t.reloc - 452.6) <= 5);
  check('B2 correct-ledger gross = audit-literal gross - cancel-credit (200 < d < 4000/d)', (() => { const d = lit.gross - r.gross; return d > 200 && d < 4000; })());
  check('B3 trips within 1 of audited 12.0', Math.abs(r.trips - 12.0) <= 1);
  check('B4 litres within 1.5 of audited 23.1', Math.abs(r.litres - 23.1) <= 1.5);
  check('B5 break-even reconciled with documented deltas (net between -1200 and +1200/d)', r.netMean > -1200 && r.netMean < 1200);
  console.log('  audit-literal (cancel-credit on): net/day=%s gross/day=%s', lit.netMean.toFixed(0), lit.gross.toFixed(0));
  check('B6 audit-literal gross matches audit within 1%', Math.abs(lit.gross - 37883) / 37883 <= 0.01);
  check('B7 all reconciliated ledgers pass invariants', r.allInvariantOk);
}

/* ----------------------------------------------------------------- C --------- */
section('C. Production baseline @AC1.10');
{
  const r = E.reconcileAudit(2000, { econ: { acFactor: 1.10 } });
  console.log('  AC1.10 baseline mean/day: net=%s [p5=%s p50=%s p95=%s] month=%s', r.netMean.toFixed(0), r.netP5.toFixed(0), r.netP50.toFixed(0), r.netP95.toFixed(0), r.monthMean.toFixed(0));
  check('C1 invariances hold', r.allInvariantOk);
  check('C2 plain baseline never exceeds shift (onlineH<=12h+eps)', r.onlineH <= 12.01);
  check('C3 month mean computed as day*26', Math.abs(r.monthMean - r.netMean * 26) < 0.1);
}

/* ----------------------------------------------------------------- D --------- */
section('D. Copilot sim @AC1.10');
{
  const L = E.simShift('COPILOT', 987654);
  check('D1 ledger invariant', L.invariantOk);
  check('D2 onlineMin within shift', L.onlineMin <= 720 + 0.1);
  check('D3 decision log populated', L.DecisionLog.length > 0);
  check('D4 endCause is valid', ['SHIFT_COMPLETE','COPILOT_END'].includes(L.endCause));
}

/* ----------------------------------------------------------------- E --------- */
section('E. Paired CRN experiment (baseline vs Copilot, shared environment)');
{
  const P = E.simPaired(2026, 1000);
  console.log('  mean delta NET/day = %s  (95%% CI [%s, %s])  month delta = %s  P(delta>0)=%s', P.meanDelta.toFixed(0), P.ci95.lo.toFixed(0), P.ci95.hi.toFixed(0), P.monthDelta.toFixed(0), P.pDeltaPositive.toFixed(3));
  console.log('  mean deltas: fuel = %s L/day, unpaidKm = %s, idleH = %s, trips = %s', P.meanDeltaFuelL.toFixed(2), P.meanDeltaUnpaidKm.toFixed(2), P.meanDeltaIdleH.toFixed(2), P.meanDeltaTrips.toFixed(2));
  check('E1 paired n correct', P.n === 1000);
  check('E2 CRN: same seed -> identical exogenous env (offers, dow/rain/event, startLoc)', (() => { const a = E.buildEnv(123, E.def()); const b = E.buildEnv(123, E.def()); return a.dow === b.dow && a.rain === b.rain && a.event === b.event && a.offerCount === b.offerCount && a.startLoc.lat === b.startLoc.lat && a.startLoc.lng === b.startLoc.lng; })());
  check('E3 CRN: per-offer streams deterministic from (env.seed, offerIdx)', (() => { const a = E.offerRng(E.buildEnv(55, E.def()), 4)(); const b = E.offerRng(E.buildEnv(55, E.def()), 4)(); return a === b; })());
  check('E4 both summaries pass invariants', P.baseSummary.allInvariantOk && P.copilotSummary.allInvariantOk);
  check('E5 baseline values internally stable (trips within [6,22] per day mean)', P.baseSummary.trips > 6 && P.baseSummary.trips < 22);
  check('E6 confidence interval finite and sane', isFinite(P.ci95.lo) && isFinite(P.ci95.hi) && P.ci95.lo < P.ci95.hi);
}

/* ----------------------------------------------------------------- F --------- */
section('F. Determinism + edge cases');
{
  const a = E.simShift('BASELINE', 777);
  const b = E.simShift('BASELINE', 777);
  check('F1 same seed -> identical ledger', a.NET_AFTER_FUEL === b.NET_AFTER_FUEL && a.trips === b.trips && a.onlineMin === b.onlineMin);
  check('F2 same seed -> identical ride trace', a.rides.length === b.rides.length && a.rides.every((x, i) => x.netAfterFuel === b.rides[i].netAfterFuel));

  const zero = E.simShift('BASELINE', 11, { econ: { demandMult: 0 } });
  check('F3 zero-demand day: no trips, net negative, ledger balanced', zero.trips === 0 && zero.NET_AFTER_FUEL < 0 && zero.invariantOk && zero.onlineMin <= 720.1);

  const rainEnv = E.buildEnv(42, E.def({ rainP: 1, eventP: 0 }));
  check('F4 force-rain env flag honours rainP=1', rainEnv.rain === true);
  const evEnv = E.buildEnv(43, E.def({ rainP: 0, eventP: 1 }));
  check('F5 force-event env flag honours eventP=1', evEnv.event === true);

  const lowFuel = E.simShift('COPILOT', 99, { econ: { startFuelL: 7, endShiftFuelL: 8 } });
  check('F6 copilot ends early on fuel reserve', lowFuel.endCause === 'COPILOT_END' && lowFuel.onlineMin < 720);

  const short = E.simShift('BASELINE', 501, { econ: { shiftHours: 4 } });
  check('F7 custom shift length respected', short.onlineMin <= 240.1 && short.invariantOk);

  const post = E.simShift('COPILOT', 502, { econ: { trailOnly: undefined } });
  void post;
  check('F8 no trip ever starts outside shift window', (() => {
    for (let s = 1; s <= 200; s++) { const L = E.simShift('BASELINE', s); for (const r of L.rides) if (r.ts > 720.1) return false; }
    return true;
  })());

  let sawAirport = 0;
  for (let s = 0; s < 2500; s++) { const L = E.simShift('BASELINE', 70000 + s); for (const r of L.rides) if (r.dropoffZone === 'Airport' || r.pickupZone === 'Airport') { sawAirport++; break; } }
  check('F9 airport trips occur under OD model (saw ' + sawAirport + ' days)', sawAirport > 0);

  let sawEnd = 0;
  for (let s = 0; s < 300; s++) { const L = E.simShift('COPILOT', 100000 + s); if (L.endCause === 'COPILOT_END') sawEnd++; }
  console.log('  copilot early-END occurrence: ' + sawEnd + '/300 days (default econ)');
  /* Structurally: the design's "extremely low band" trigger requires BAND.d < 0.5,
     but every shift hour (06-18) has d >= 0.5, so it cannot fire; fuel-reserve END
     needs fuel < 8L, unreachable from 60L start. F6 proves the END path executes. */
  check('F10 default-econ copilot completes shift (END triggers structurally inactive, see F6 for path)', sawEnd === 0);
}

/* ----------------------------------------------------------------- G --------- */
section('G. Ledger unit tests');
{
  const mk = (o) => Object.assign({ RIDER_GROSS_FARES: 30000, BOLT_COMMISSION: 6000, DRIVER_REVENUE_AFTER_COMMISSION: 24000, PETROL_COST: 23000, NET_AFTER_FUEL: 1000, PAID_KM: 90, PICKUP_KM: 20, RELOCATION_KM: 15, OTHER_UNPAID_KM: 5, UNPAID_KM: 40, TOTAL_KM: 130, PICKUP_MIN: 60, RIDE_MIN: 170, DWELL_MIN: 40, IDLE_MIN: 420, RELOCATION_MIN: 30, onlineMin: 720 }, o);
  check('G1 balanced ledger passes', E.checkLedger(mk({})));
  check('G2 money mismatch caught', !E.checkLedger(mk({ NET_AFTER_FUEL: 999 })));
  check('G3 km mismatch caught', !E.checkLedger(mk({ TOTAL_KM: 129 })));
  check('G4 time mismatch caught', !E.checkLedger(mk({ onlineMin: 718 })));
  const { round1 } = { round1: (x) => Math.round(x * 10) / 10 };
  check('G5 fare min-price clamp enforced', E.fareAmount(0.5, 5, 1.0, E.def()) >= 1495 - 1e-9);
  check('G6 fare formula (card B) exact', E.fareAmount(10, 20, 1.0, E.def()) === Math.max(1495, 884 + 152 * 10 + 25 * 20) * 1.0);
}

/* ----------------------------------------------------------------- H --------- */
section('H. Target-discovery statistics (>=21 production baseline shifts)');
{
  const N = 21;
  const ledgers = [];
  for (let i = 0; i < N; i++) ledgers.push(E.simShift('BASELINE', 500000 + i));
  const nets = ledgers.map(L => L.NET_AFTER_FUEL);
  const p = (q) => E.percentile(nets, q);
  console.log('  n=%d  mean=%s  median=%s  p5=%s  p95=%s  min=%s  max=%s',
    N, E.mean(nets).toFixed(0), p(0.5).toFixed(0), p(0.05).toFixed(0), p(0.95).toFixed(0), Math.min(...nets).toFixed(0), Math.max(...nets).toFixed(0));
  console.log('  NOTE: month projection = day-mean x 26 is a labelled estimate only; ACTUAL accumulated MTD is shown separately in UI.');
  check('H1 produced >=21 shift samples', ledgers.length >= 21);
  check('H2 percentile ordering sane', p(0.05) <= p(0.5) && p(0.5) <= p(0.95));
  check('H3 monthly P(>=300k) illustrated (projected, expected ~0%)', (() => { const m = E.mean(nets) * 26; const sd = E.stdev(nets) * Math.sqrt(26); const z = (300000 - m) / sd; const P = 1 - 0.5 * (1 + erf(z / Math.SQRT2)); return P < 0.05; })());
}

function erf(x) { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return s * y; }

/* ------------------------------------------------------------------ report -- */
section('RESULT');
console.log('  PASS=%d  FAIL=%d', PASS.length, FAIL.length);
if (FAIL.length) { console.log('\nFAILED: ' + FAIL.join(', ')); process.exit(1); }
console.log('\nAll verification checks passed.');
process.exit(0);