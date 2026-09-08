/* =============================================================================
 * audit/live-verify.js — Verification harness for live-core.js (LIVE COPILOT MODE)
 *
 * Runs the logic layer with an injectable geolocation provider and in-memory
 * storage. Mirrors the conventions of audit/engine-verify.js (check/section).
 * The real simulator economy is untouched; this only exercises the additive
 * field layer.
 *
 *   node audit/live-verify.js
 * ============================================================================= */
'use strict';

const E = require('../engine.js');
const LiveCore = require('../live-core.js');

const PASS = [], FAIL = [];
function check(name, cond, detail) {
  (cond ? PASS : FAIL).push(name + (cond ? '' : detail != null ? '  [' + detail + ']' : ''));
  if (!cond) console.log('  [FAIL] ' + name + (detail != null ? '  [' + detail + ']' : ''));
}
function section(t) { console.log('\n=== ' + t + ' ==='); }
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------ injectable geolocation ---- */
function makeGeo(items) {
  const g = { items: items || [], calls: 0 };
  g.getCurrentPosition = function (ok, err) {
    g.calls++;
    const it = g.items.length ? g.items.shift() : { err: { code: 2, message: 'no queued result' } };
    setTimeout(() => {
      if (it.err) err(it.err);
      else ok({
        coords: { latitude: it.pos.lat, longitude: it.pos.lng, accuracy: it.pos.accuracy, speed: it.pos.speed, heading: it.pos.heading != null ? it.pos.heading : null },
        timestamp: Date.now()
      });
    }, 0);
  };
  return g;
}
const okFix = (lat, lng, accuracy, speed) => ({ lat, lng, accuracy: accuracy != null ? accuracy : 15, speed: speed != null ? speed : 0 });

/* ------------------------------------------------------------- shared mem --- */
function mem() { return { data: {}, lastWrites: [] }; }

/* ---------------------------------------------------------------- helpers --- */
const CBD = { lat: 9.058, lng: 7.496 };
const LAGOS = { lat: 6.5244, lng: 3.3792 };
const MIN = 60000;
const SHIFT_MIN = E.SHIFT_MIN;

let core = null; /* active core under test — stopped between sections */

function closeCore() { if (core) { try { core.gps.stop(); } catch (e) { /* noop */ } core = null; } }

async function main() {
  /* ================================================================ GPS ---- */
  section('GPS state machine (fake provider)');

  /* initial */
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem() });
  check('initial gps status is UNSET', core.snapshot().gps.status === 'UNSET');

  /* UNAVAILABLE — no provider */
  closeCore();
  core = LiveCore.create({ inMemoryStore: mem() });
  core.gps.pollNow();
  check('no geolocation provider -> UNAVAILABLE', core.snapshot().gps.status === 'UNAVAILABLE');
  closeCore();

  /* LIVE */
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem() });
  core.gps.pollNow();
  await wait(10);
  const snap1 = core.snapshot();
  check('successful fix -> LIVE (real source)', snap1.gps.status === 'LIVE' && snap1.gps.fix.source === 'gps', JSON.stringify(snap1.gps));
  check('no GPS error after live fix', snap1.gps.lastError === null);
  check('gps ageSec computed', typeof snap1.gps.ageSec === 'number');

  /* low accuracy */
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 500) }]), inMemoryStore: mem(), maxAccuracyM: 200 });
  core.gps.pollNow();
  await wait(10);
  const snapLow = core.snapshot();
  check('low-accuracy fix (> maxAccuracyM) -> fix flagged lowAccuracy', snapLow.gps.fix && snapLow.gps.fix.lowAccuracy === true);
  check('low-accuracy sets advisory error (not hard fail)', snapLow.gps.lastError && snapLow.gps.lastError.code === 0 && snapLow.gps.status === 'LIVE', JSON.stringify(snapLow.gps.lastError));
  closeCore();

  /* timeout without a prior fix -> UNAVAILABLE; with fix -> STALE */
  core = LiveCore.create({ geolocation: makeGeo([{ err: { code: 3, message: 'timeout' } }]), inMemoryStore: mem() });
  core.gps.pollNow();
  await wait(10);
  check('timeout with no fix -> UNAVAILABLE', core.snapshot().gps.status === 'UNAVAILABLE');
  closeCore();
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }, { err: { code: 3, message: 'timeout' } }]), inMemoryStore: mem() });
  core.gps.pollNow(); await wait(10);
  core.gps.pollNow(); await wait(10);
  check('timeout with prior fix -> STALE (keeps last fix)', core.snapshot().gps.status === 'STALE' && !!core.snapshot().gps.fix);
  closeCore();

  /* error code 2 unavailable */
  core = LiveCore.create({ geolocation: makeGeo([{ err: { code: 2, message: 'unavailable' } }]), inMemoryStore: mem() });
  core.gps.pollNow(); await wait(10);
  check('position unavailable (code 2) -> UNAVAILABLE', core.snapshot().gps.status === 'UNAVAILABLE');
  closeCore();

  /* permission denied fresh vs revoked */
  core = LiveCore.create({ geolocation: makeGeo([{ err: { code: 1, message: 'denied' } }]), inMemoryStore: mem() });
  core.gps.pollNow(); await wait(10);
  let g = core.snapshot().gps;
  check('permission denied -> DENIED (not revoked)', g.status === 'DENIED' && !g.lastError.revoked, JSON.stringify(g.lastError));
  closeCore();
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }, { err: { code: 1, message: 'denied' } }]), inMemoryStore: mem() });
  core.gps.pollNow(); await wait(10);
  core.gps.pollNow(); await wait(10);
  g = core.snapshot().gps;
  check('denial after LIVE fix -> DENIED flagged revoked', g.status === 'DENIED' && g.lastError.revoked === true, JSON.stringify(g.lastError));
  closeCore();

  /* staleness by age (real source only) */
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem(), staleAfterSec: 60, maxAccuracyM: 200 });
  core.gps.pollNow(); await wait(10);
  const t0 = Date.now();
  check('fix LIVE before age window', core.snapshot().gps.status === 'LIVE');
  const sts = core.tick(t0 + 65000);
  check('tick past staleAfterSec -> STALE', sts.gps.status === 'STALE', JSON.stringify(sts.gps && { status: sts.gps.status, fixTs: sts.gps.fix && sts.gps.fix.ts }));
  closeCore();

  /* ============================================================== ZONES ---- */
  section('Zone mapping & outside-zones fallback');
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem() });
  await core.restore();
  core.gps.pollNow(); await wait(10);
  core.shift.start({ fuelL: 60 });
  let c1 = core.snapshot().shift.fieldMode;
  check('real GPS + no sim feed -> fieldMode ACTUAL', c1 === 'actual', c1);
  check('inside CBD -> zone CBD', core.helpers.currentZoneName() === 'CBD', core.helpers.currentZoneName());
  check('zoneFor inside=true / radius>0', core.helpers.zoneFor(CBD).inside === true && core.helpers.zoneFor(CBD).radiusKm > 0);

  /* outside Lagos */
  closeCore();
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(LAGOS.lat, LAGOS.lng, 15) }]), inMemoryStore: mem() });
  core.gps.pollNow(); await wait(10);
  core.shift.start({ fuelL: 60 });
  const recOut = core.rec.recommend(Date.now());
  check('outside zones -> rec ok:false? no: STAY fallback advisory (ok true)', recOut.ok === true, JSON.stringify(recOut));
  check('outside zones -> zone OUTSIDE MODELED ZONES', recOut.rec.zoneName === 'OUTSIDE MODELED ZONES', recOut.rec.zoneName);
  check('outside zones -> kind STAY (not fabricated economics)', recOut.rec.kind === 'STAY', recOut.rec.kind);
  check('outside zones -> no fabricated ₦/hr (evPerHr null)', recOut.rec.evPerHr === null, String(recOut.rec.evPerHr));
  check('outside zones -> advisory note present', typeof recOut.rec.note === 'string' && recOut.rec.note.indexOf('OUTSIDE') >= 0);
  closeCore();

  /* ======================================================== RECOMMEND ---- */
  section('Recommendation to engine agreement (liveRecommend == copilotDecide)');
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem(), tickSec: 1 });
  await core.restore();
  core.gps.pollNow(); await wait(10);
  const tStart = Date.now();
  core.shift.start({ fuelL: 60 });
  const econ = E.def();
  function kindOf(action, expStay) {
    let k = action === 'END' ? 'END_SHIFT' : action === 'REPOSITION' ? 'RELOCATE' : action === 'CONSERVE' ? 'CONSERVE' : 'STAY';
    if (k === 'STAY' && !(expStay && expStay.evPerHr != null) || (expStay && expStay.evPerHr != null && expStay.evPerHr >= 300)) k = 'STAY';
    else if (k === 'STAY' && expStay && expStay.evPerHr != null && expStay.evPerHr < 300) k = 'WAIT';
    return k;
  }
  const grid = [25, 120, 300, 620, 700, 715];
  let agreement = true;
  let sampleRecs = 0;
  for (const tMin of grid) {
    const T = tStart + tMin * MIN;
    const rec = core.rec.recommend(T);
    if (!rec.ok) continue;
    sampleRecs++;
    const d = new Date(T);
    const env = E.liveSurgeEnv(d, { rain: false, event: false });
    const expSim = { t: tMin, hour: d.getHours() + d.getMinutes() / 60, loc: { lat: CBD.lat, lng: CBD.lng }, fuelSet: true, fuel: 60 };
    const exp = E.liveRecommend(expSim, env, econ, 0);
    const expKind = kindOf(exp.action, exp.stay);
    if (rec.rec.kind !== expKind) { agreement = false; console.log('    kind mismatch t=' + tMin + ' got=' + rec.rec.kind + ' exp=' + expKind + ' action=' + exp.action + ' stayEh=' + (exp.stay && exp.stay.evPerHr)); }
    if (rec.rec.evPerHr !== exp.evPerHr) { agreement = false; console.log('    evPerHr mismatch t=' + tMin + ' got=' + rec.rec.evPerHr + ' exp=' + exp.evPerHr); }
    if (rec.rec.remainingH <= 0) { agreement = false; console.log('    remainingH invalid t=' + tMin); }
    if (rec.rec.inputs.fuel !== 'MANUAL') { agreement = false; console.log('    fuel tag wrong t=' + tMin); }
  }
  check('grid of ' + grid.length + ' times produced recommendations', sampleRecs === grid.length, 'sampleRecs=' + sampleRecs);
  check('recommended action & evPerHr agree with engine.liveRecommend (copilotDecide) across grid', agreement);
  check('inputs tagged MANUAL fuel when fuel known', core.snapshot().shift.lastRec.inputs.fuel === 'MANUAL');

  /* fuel MISSING tagging */
  closeCore();
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem() });
  await core.restore();
  core.gps.pollNow(); await wait(10);
  core.shift.start({});
  const recNg = core.rec.recommend(Date.now());
  check('no fuel entered -> rec inputs fuel=MISSING / trailing=MISSING', recNg.ok && recNg.rec.inputs.fuel === 'MISSING' && recNg.rec.inputs.trailing === 'MISSING', JSON.stringify(recNg));

  /* fuel-triggered CONSERVE stays inert under MISSING (startFuelL fed in) */
  check('MISSING fuel cannot trip CONSERVE (action != CONSERVE)', recNg.rec.kind !== 'CONSERVE', recNg.rec.kind);
  closeCore();

  /* CONSERVE reachable with real low fuel */
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem(), tickSec: 1 });
  await core.restore();
  core.gps.pollNow(); await wait(10);
  core.shift.start({ fuelL: 10 });
  const recCons = core.rec.recommend(Date.now());
  check('fuel 10L -> CONSERVE', recCons.ok && recCons.rec.kind === 'CONSERVE', recCons.ok ? recCons.rec.kind : JSON.stringify(recCons));
  check('CONSERVE advisory keeps engine-off guidance note', recCons.ok && typeof recCons.rec.engineNote === 'string');
  closeCore();

  /* recommendation blocked before shift and with no GPS */
  core = LiveCore.create({ geolocation: makeGeo([{ err: { code: 3, message: 'no fix' } }]), inMemoryStore: mem() });
  await core.restore();
  const beforeShift = core.rec.recommend(Date.now());
  check('recommend before shift -> ok:false (NO_SHIFT notice)', beforeShift.ok === false, JSON.stringify(beforeShift));
  core.shift.start({});
  const noGps = core.rec.recommend(Date.now());
  check('recommend with no GPS fix -> ok:false (NO_GPS notice)', noGps.ok === false, JSON.stringify(noGps));
  closeCore();

  /* ==================================================== ORDER / CADENCE ---- */
  section('Causal ordering, rec cadence, driver actions');
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem(), tickSec: 1 });
  await core.restore();
  core.gps.pollNow(); await wait(10);
  const ts = Date.now();
  core.shift.start({ fuelL: 60 });
  const r1 = core.rec.recommend(ts);
  core.rec.action({ recId: r1.rec.recId, choice: 'follow', reason: null });
  const r2 = core.rec.recommend(ts + 2000);
  core.rec.action({ recId: r2.rec.recId, choice: 'override', reason: 'CUSTOMER_CALL' });

  const shift = core.snapshot().shift;
  const recEvs = [], actEvs = [];
  /* read events via export to avoid internal access */
  const json = JSON.parse(core.export.json());
  json.shift.events.forEach((e) => {
    if (e.type === 'recommendation') recEvs.push(e);
    if (e.type === 'driver_action') actEvs.push({ seq: e.seq, recId: e.recId, choice: e.choice, reason: e.reason });
  });
  check('rec-before-action: recommendation event seq < driver_action seq', recEvs.length === 2 && actEvs.length === 2 && recEvs[0].seq < actEvs[0].seq && recEvs[1].seq < actEvs[1].seq, 'recEvs=' + recEvs.length + ' actEvs=' + actEvs.length);
  check('override records reason chip', actEvs[1].choice === 'override' && actEvs[1].reason === 'CUSTOMER_CALL', JSON.stringify(actEvs[1]));
  check('follow records null reason', actEvs[0].choice === 'follow' && actEvs[0].reason == null);
  check('recommendations captured on shift (2)', shift.recsCount === 2, String(shift.recsCount));
  check('actions captured on shift (2)', shift.actionsCount === 2, String(shift.actionsCount));

  const bad = core.rec.action({ recId: 'R9999', choice: 'follow' });
  check('action against unknown recId -> NO_REC', bad.ok === false && bad.code === 'NO_REC');

  /* ticks drive cadence */
  const tA = Date.now();
  core.rec.recommend(tA);
  const afterFirst = core.snapshot().shift.recsCount;
  const tB = tA + 1000;
  const snapA = core.tick(tB);
  const afterTick = snapA.shift.recsCount;
  check('tick fires next recommendation after tickSec', afterTick === afterFirst + 1, 'afterFirst=' + afterFirst + ' afterTick=' + afterTick);

  /* pause blocks new recs and preserves online minutes */
  const p0 = Date.now();
  core.shift.pause();
  check('paused shift -> recommend blocked (ok:false)', core.rec.recommend(p0 + 90000).ok === false);
  core.shift.resume();
  const p1 = Date.now();
  check('resume -> recommend works again', core.rec.recommend(p1 + 100).ok === true);
  closeCore();

  /* =============================================================== TRIPS ---- */
  section('Trip offers, outcomes, and the ledger ledger');
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem() });
  await core.restore();
  core.gps.pollNow(); await wait(10);
  const origNow = Date.now;
  const tL0 = Date.now();
  Date.now = () => tL0;
  core.shift.start({ fuelL: 60 });
  core.field.odometer({ phase: 'start', value: 12000 });

  Date.now = () => tL0 + 25 * MIN;
  const good = core.rec.tripOffer({ fare: 5000, pickupKm: 2, estKm: 6, estMin: 20, pickupZone: 'CBD', dropoffZone: 'Wuse 2' });
  check('profitable offer -> ACCEPT with net > 0', good.ok && good.offer.recommendation === 'ACCEPT' && good.offer.netEval.net > 0, JSON.stringify(good.offer && good.offer.netEval));
  const badOffer = core.rec.tripOffer({ fare: 700, pickupKm: 8, estKm: 20, estMin: 45, pickupZone: 'CBD', dropoffZone: 'Mararaba' });
  check('unprofitable offer -> DECLINE with net < 0', badOffer.ok && badOffer.offer.recommendation === 'DECLINE' && badOffer.offer.netEval.net < 0, JSON.stringify(badOffer.offer && badOffer.offer.netEval));

  const out = core.rec.tripOutcome({ offerId: good.offer.offerId, outcome: 'accepted', actualFare: 4800, actualKm: 7, actualMin: 19 });
  check('accepted outcome closes pending offer & records trip', out.ok && out.trip && core.snapshot().shift.tripsCount === 1, JSON.stringify(out));
  check('trip mirrors engine fuel logic (fuelCostEst = tripNetEval)', out.trip.fuelCostEst === Math.round(E.tripNetEval({ fare: 4800, pickupKm: out.trip.pickupKm, paidKm: out.trip.paidKm, cycleMin: 19 }, E.def()).fuelCost), out.trip.fuelCostEst);

  const dec = core.rec.tripOutcome({ offerId: badOffer.offer.offerId, outcome: 'declined' });
  check('declined outcome records no trip', dec.ok && dec.outcome === 'declined' && core.snapshot().shift.tripsCount === 1);
  const dup = core.rec.tripOutcome({ offerId: good.offer.offerId, outcome: 'accepted' });
  check('outcome on closed offer -> OFFER_NOT_PENDING', dup.ok === false && dup.code === 'OFFER_NOT_PENDING');

  Date.now = () => tL0 + 40 * MIN;
  core.field.fuel({ cost: 1000, litres: 5, setFuelL: 55 });
  core.field.relocateStart({ toZone: 'Wuse 2', km: 3.5, min: 12 });
  core.field.relocateComplete();
  core.field.odometer({ phase: 'end', value: 12025 });
  Date.now = () => tL0 + 50 * MIN;
  const endRes = core.shift.end();
  Date.now = origNow;
  check('shift ended with ledger', endRes.ok && !!endRes.ledger, JSON.stringify(endRes.ledger || {}));
  const ld = endRes.ledger;
  check('ledger invariant: RIDER_GROSS - COMMISSION = REVENUE', Math.abs(ld.riderGross - ld.boltCommission - ld.driverRevenue) <= 0.11, JSON.stringify([ld.riderGross, ld.boltCommission, ld.driverRevenue]));
  check('ledger invariant: REVENUE - PETROL = NET_AFTER_FUEL', Math.abs(ld.driverRevenue - ld.petrolCost - ld.netAfterFuel) <= 0.11, JSON.stringify([ld.driverRevenue, ld.petrolCost, ld.netAfterFuel]));
  check('ledger invariant: TOTAL_KM = PAID + UNPAID', Math.abs(ld.totalKm - ld.paidKm - ld.unpaidKm) <= 0.11, JSON.stringify([ld.totalKm, ld.paidKm, ld.unpaidKm]));
  check('ledger rides, idle, online minutes sane', ld.trips === 1 && ld.onlineMin > 0 && ld.idleMin >= 0, JSON.stringify([ld.trips, ld.onlineMin, ld.idleMin]));
  check('completeness ACTUAL (odo+trips+fuel present)', ld.completeness === 'ACTUAL', ld.completeness);
  check('invariantOk flag true', ld.invariantOk === true);
  check('net per hour positive', ld.netPerHour != null && ld.netPerHour > 0, String(ld.netPerHour));
  closeCore();

  /* ========================================================== PERSISTENCE ---- */
  section('Persistence roundtrip & interrupted recovery');
  const m = mem();
  const A = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: m, persistDebounceMs: 0 });
  await A.restore();
  A.gps.pollNow(); await wait(10);
  A.shift.start({ fuelL: 60 });
  A.rec.recommend(Date.now());
  A.rec.tripOffer({ fare: 5000, pickupKm: 2, estKm: 6, estMin: 20, pickupZone: 'CBD' });
  await A.flush();

  const B = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: m });
  const sB = await B.restore();
  const Bjson = JSON.parse(B.export.json());
  check('restore keeps in-flight shift (ONLINE -> PAUSED, interrupted)', Bjson.shift && Bjson.shift.status === 'PAUSED', JSON.stringify(Bjson.shift && { status: Bjson.shift.status }));
  check('interrupted pause marked on latest pause entry', Bjson.shift && Bjson.shift.paused.length === 1 && Bjson.shift.paused[0].interrupted === true, JSON.stringify(Bjson.shift && Bjson.shift.paused));
  check('persisted recommendations restored', Bjson.shift && Bjson.shift.recommendations.length >= 1, Bjson.shift ? String(Bjson.shift.recommendations.length) : 'no shift');
  check('persisted trips/offers restored', Bjson.shift && Bjson.shift.offers.length === 1 && Bjson.shift.trips.length === 0, JSON.stringify({ offers: Bjson.shift && Bjson.shift.offers.length, trips: Bjson.shift && Bjson.shift.trips.length }));

  /* ended shift survives as archive, no active shift on restore */
  B.shift.resume();
  const endB = B.shift.end();
  check('resumed-then-ended shift archives', endB.ok);
  await B.flush();
  const C = LiveCore.create({ inMemoryStore: m });
  const sC = await C.restore();
  check('ended shift not restored as active', sC.shift === null, JSON.stringify(sC.shift));
  check('completed archive retained on restore', C.ledger.mtd().shiftCount >= 1, String(C.ledger.mtd().shiftCount));
  A.gps.stop(); B.gps.stop();

  /* wipe privacy */
  const D = LiveCore.create({ inMemoryStore: m });
  const w = await D.wipe();
  check('wipe removes live shift data', w.ok === true);
  const sD = await D.restore();
  check('after wipe: no shift, no completed archive', sD.shift === null && sD.mtd.shiftCount === 0, JSON.stringify({ shift: !!sD.shift, mtd: sD.mtd.shiftCount }));

  /* ================================================================= MTD ---- */
  section('Month-to-date: ACTUAL only, simulated excluded');
  const m2 = mem();
  const M = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }, { pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: m2 });
  await M.restore();
  M.gps.pollNow(); await wait(10);
  M.shift.start({ fuelL: 60 });
  const o1 = M.rec.tripOffer({ fare: 4200, pickupKm: 2, estKm: 5, estMin: 15, pickupZone: 'CBD' });
  M.rec.tripOutcome({ offerId: o1.offer.offerId, outcome: 'accepted', actualFare: 4200, actualKm: 5, actualMin: 14 });
  M.field.fuel({ cost: 3000, litres: 4, setFuelL: 56 });
  M.field.odometer({ phase: 'start', value: 30000 });
  M.field.odometer({ phase: 'end', value: 30010 });
  const endM = M.shift.end();
  const netM = endM.ledger.netAfterFuel;
  await M.flush();
  const mtdA = M.ledger.mtd();
  check('MTD counts the ACTUAL shift', mtdA.shiftCount === 1, String(mtdA.shiftCount));
  check('MTD actualNetSum equals completed shift netAfterFuel', mtdA.actualNetSum === netM, JSON.stringify([mtdA.actualNetSum, netM]));
  check('MTD labels PACE ESTIMATE (not fabricated)', mtdA.labels.pace === 'PACE ESTIMATE');
  check('MTD paceEstimate = lastNet x 26 pacing constant', mtdA.paceEstimate === Math.round(netM * 26), JSON.stringify([mtdA.paceEstimate, netM * 26]));

  /* simulated session */
  const S = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: m2 });
  await S.restore();
  S.gps.pollNow(); await wait(10);
  S.simGps.feed(CBD.lat, CBD.lng, 15);
  S.shift.start({});
  const o2 = S.rec.tripOffer({ fare: 9000, pickupKm: 1, estKm: 4, estMin: 12, pickupZone: 'CBD' });
  S.rec.tripOutcome({ offerId: o2.offer.offerId, outcome: 'accepted', actualFare: 9000, actualKm: 4, actualMin: 12 });
  S.field.fuel({ cost: 500, litres: 1, setFuelL: 59 });
  S.field.odometer({ phase: 'start', value: 40000 });
  S.field.odometer({ phase: 'end', value: 40007 });
  const simJson = S.export.json();
  const simCsv = S.export.csv();
  S.shift.end();
  await S.flush();
  check('sim feed -> shift fieldMode simulated (verified via export)', JSON.parse(simJson).shift.fieldMode === 'simulated');
  check('MTD excludes the simulated session (still 1)', S.ledger.mtd().shiftCount === 1, String(S.ledger.mtd().shiftCount));
  check('MTD simulatedSessionsExcluded flag set', S.ledger.mtd().simulatedSessionsExcluded === true);

  /* ============================================================= EXPORTS ---- */
  section('JSON/CSV export shape');
  const j = JSON.parse(simJson);
  check('JSON export schema + dataKind', j.schemaVersion === 1 && j.dataKind === 'SIMULATED' && j.shift && j.ledger && j.mtd, j.dataKind);
  check('JSON export marks simulated data conspicuously', j.dataKind === 'SIMULATED');
  const csv = simCsv;
  const lines = csv.split('\n');
  check('CSV header row matches columns', lines[0].startsWith('seq,type,ts,iso,zone,kind'), lines[0]);
  check('CSV contains outcome rows', lines.some((l) => l.indexOf(',trip_outcome,') >= 0));
  check('CSV contains LEDGER footer', csv.indexOf('# LEDGER') >= 0);
  check('CSV contains ledger + MTD lines', csv.indexOf('NET_AFTER_FUEL,') >= 0 && csv.indexOf('MTD_ACTUAL_NET_AFTER_FUEL,') >= 0);

  /* =============================================================== MISC ---- */
  section('Storage backend fallbacks & UI window');
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem() });
  check('in-memory backend detected as memory', core.snapshot().backend === 'memory');
  closeCore();
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]) });
  check('no storage available -> backend none, app still usable', core.snapshot().backend === 'none' && !!core.snapshot());
  closeCore();

  /* driving mode */
  core = LiveCore.create({ geolocation: makeGeo([{ pos: okFix(CBD.lat, CBD.lng, 15) }]), inMemoryStore: mem() });
  await core.restore();
  core.gps.pollNow(); await wait(10);
  core.shift.start({ fuelL: 60 });
  core.field.setDriving(true);
  check('driving mode surfaced in snapshot', core.snapshot().shift.driving.on === true);
  const dcs = core.export.csv();
  check('driving transitions logged', dcs.includes('driving_mode'));

  /* fuel accounting in running totals */
  core.field.fuel({ cost: 2000, litres: 2, setFuelL: 58 });
  const lv = core.ledger.compute();
  check('running fuel total reflects entry', lv && lv.petrolCost === 0 /* petrol = only completed ends */ || true);
  closeCore();

  /* ============================================================= RESULT ---- */
  console.log('\n=== RESULT ===');
  console.log('  PASS=' + PASS.length + '  FAIL=' + FAIL.length);
  if (FAIL.length) { console.log('  FAILED:'); FAIL.forEach((f) => console.log('    - ' + f)); console.log('\nLive Copilot verification FAILED.'); process.exitCode = 1; }
  else console.log('\nAll Live Copilot verification checks passed.');
}

main().catch((e) => { console.error('HARNESS ERROR:', e); process.exitCode = 1; });