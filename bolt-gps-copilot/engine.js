/* =============================================================================
 * engine.js — Highlander economic validation core (design: HIGHLANDER-VALIDATION-DESIGN.md)
 *
 * Pure, dependency-free, Node-compatible. No DOM, no globals.
 *   - ECON (immutable-ish config), ZONES/BAND/OD/PREF/CLASS_SPEED, fare cards
 *   - minute-accounted discrete-event shift (no teleports, no forced trips)
 *   - NET_AFTER_FUEL ledger with enforced invariants
 *   - Baseline policy (fixed audited script) and Copilot policy (EV-based)
 *   - simShift(mode, seed), simPaired(seed, n) with Common Random Numbers
 *   - invariant checker, statistics helpers
 * Loaded by index.html BEFORE the UI script, and require()able by Node runners.
 * ============================================================================= */
(function (global) {
  'use strict';

  /* ------------------------------------------------------------------ RNG --- */
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function round1(x) { return Math.round(x * 10) / 10; }
  function randN(rng, mu, sd, lo, hi) {
    var u = Math.max(1e-12, rng()), v = rng();
    var t = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return clamp(mu + sd * t, lo, hi);
  }
  function subSeed(seed, idx) { return ((seed >>> 0) ^ Math.imul(idx + 1, 0x9E3779B1)) >>> 0; }

  /* ----------------------------------------------------------------- geo ---- */
  function gc(a, b) {
    var R = 6371, dLng = (b.lng - a.lng) * Math.PI / 180,
      la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180,
      h = Math.sin((la2 - la1) / 2) * Math.sin((la2 - la1) / 2) +
          Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function moveToward(from, to, travelKm) {
    var d = gc(from, to);
    if (d <= 1e-6) return { lat: from.lat, lng: from.lng };
    var f = Math.min(1, travelKm / d);
    return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f };
  }
  function distKm(a, b) { return gc(a, b); }

  /* ------------------------------------------------------- Abuja zone model -- */
  var ZONES = [
    { n: 'CBD',       lat: 9.058,  lng: 7.496, w: 1.00, gr: 'core' },
    { n: 'Wuse 2',    lat: 9.077,  lng: 7.463, w: 1.25, gr: 'core' },
    { n: 'Wuse 1',    lat: 9.070,  lng: 7.490, w: 1.10, gr: 'core' },
    { n: 'Maitama',   lat: 9.083,  lng: 7.525, w: 1.05, gr: 'core' },
    { n: 'Asokoro',   lat: 9.075,  lng: 7.495, w: 0.95, gr: 'core' },
    { n: 'Garki',     lat: 9.040,  lng: 7.490, w: 1.15, gr: 'core' },
    { n: 'Jabi',      lat: 9.067,  lng: 7.414, w: 1.30, gr: 'mall' },
    { n: 'Utako',     lat: 9.060,  lng: 7.440, w: 0.90, gr: 'core' },
    { n: 'Gwarinpa',  lat: 9.100,  lng: 7.420, w: 1.05, gr: 'sub' },
    { n: 'Kubwa',     lat: 9.120,  lng: 7.320, w: 0.80, gr: 'sub' },
    { n: 'Lugbe',     lat: 8.990,  lng: 7.380, w: 0.60, gr: 'sat' },
    { n: 'Nyanya',    lat: 8.940,  lng: 7.530, w: 0.70, gr: 'sat' },
    { n: 'Mararaba',  lat: 8.910,  lng: 7.560, w: 0.50, gr: 'sat' },
    { n: 'Lokogoma',  lat: 9.000,  lng: 7.520, w: 0.70, gr: 'sub' },
    { n: 'Airport',   lat: 9.007,  lng: 7.263, w: 0.75, gr: 'air' }
  ];
  var BAND = {
    '0': { d: 0.35, s: 1.00 }, '1': { d: 0.28, s: 1.00 }, '2': { d: 0.22, s: 1.00 }, '3': { d: 0.18, s: 1.00 }, '4': { d: 0.22, s: 1.00 },
    '5': { d: 0.45, s: 1.05 }, '6': { d: 0.85, s: 1.10 }, '7': { d: 1.25, s: 1.20 }, '8': { d: 1.40, s: 1.30 }, '9': { d: 1.25, s: 1.25 },
    '10': { d: 1.05, s: 1.05 }, '11': { d: 1.00, s: 1.00 }, '12': { d: 1.05, s: 1.00 }, '13': { d: 1.05, s: 1.00 }, '14': { d: 1.10, s: 1.05 }, '15': { d: 1.30, s: 1.15 },
    '16': { d: 1.55, s: 1.30 }, '17': { d: 1.75, s: 1.45 }, '18': { d: 1.70, s: 1.50 }, '19': { d: 1.50, s: 1.45 }, '20': { d: 1.30, s: 1.35 },
    '21': { d: 1.15, s: 1.25 }, '22': { d: 1.00, s: 1.20 }, '23': { d: 0.80, s: 1.15 }
  };
  var OD = {
    core: [{ t: 'intra-core', k: 3.0, m: 14, w: 30 }, { t: 'mall', k: 5.0, m: 16, w: 14 }, { t: 'cross', k: 6.5, m: 22, w: 26 }, { t: 'sub', k: 13, m: 32, w: 18 }, { t: 'sat', k: 18, m: 42, w: 7 }, { t: 'air', k: 32, m: 48, w: 5 }],
    mall: [{ t: 'intra-core', k: 4.5, m: 15, w: 40 }, { t: 'mall', k: 4.0, m: 12, w: 12 }, { t: 'core-return', k: 5.5, m: 18, w: 30 }, { t: 'sub', k: 12, m: 30, w: 12 }, { t: 'air', k: 33, m: 50, w: 6 }],
    sub: [{ t: 'commute', k: 11, m: 30, w: 55 }, { t: 'sub', k: 7, m: 24, w: 20 }, { t: 'mall', k: 8, m: 25, w: 12 }, { t: 'private', k: 3.0, m: 12, w: 13 }],
    sat: [{ t: 'commute', k: 16, m: 42, w: 65 }, { t: 'sat', k: 8, m: 26, w: 18 }, { t: 'mall', k: 12, m: 32, w: 12 }, { t: 'private', k: 4, m: 14, w: 5 }],
    air: [{ t: 'air', k: 31, m: 46, w: 100 }]
  };
  var PREF = {
    'intra-core': ['core'], 'mall': ['core', 'mall'], 'cross': ['core'], 'sub': ['sub'], 'sat': ['sat'],
    'commute': ['core'], 'private': ['core', 'sub'], 'core-return': ['core'], 'air': ['air']
  };
  var CLASS_SPEED = {
    'intra-core': { ff: 30, pk: 20 }, 'mall': { ff: 32, pk: 21 }, 'cross': { ff: 34, pk: 21 }, 'sub': { ff: 42, pk: 26 },
    'sat': { ff: 48, pk: 30 }, 'air': { ff: 55, pk: 38 }, 'core-return': { ff: 32, pk: 21 }, 'commute': { ff: 44, pk: 27 }, 'private': { ff: 28, pk: 19 }
  };

  /* ------------------------------------------------------------- fare cards -- */
  function FareCard(label, base, perKm, perMin, minFare) {
    return { label: label, base: base, perKm: perKm, perMin: perMin, minFare: minFare };
  }
  var CARD_A = FareCard('A 2023-like', 350, 88, 10, 700);
  var CARD_B = FareCard('B 2024 (30-Aug-2024)', 884, 152, 25, 1495);
  var CARD_C = FareCard('C 2024+15%', 1017, 175, 29, 1720);

  /* ------------------------------------------------------------------ ECON --- */
  /* Production default: acFactor = 1.10 (design J-8). The 1.04 value is used ONLY
     inside reconcileAudit() to reproduce the historical second-order result. */
  var ECON = {
    comm: 0.20,
    fuelPrice: 1299,
    shiftHours: 12,
    shiftStart: 6.5,
    startFuelL: 60,
    baseHourlyRate: 1.30,
    capture: 1.07,
    acceptRadius: 3.0,
    relocKm: 2.6,
    relocProb: 0.65,
    jitterDeg: 0.004,
    dwellOnSite: 1.2,
    dwellPostTrip: 1.6,
    pickupPrepMin: 1.5,
    cancelP: 0.06,
    rainP: 0.12,
    rainSurge: 1.15,
    eventP: 0.02,
    eventSurge: 1.55,
    weekendNightSurge: 1.15,
    l100: 14.0,
    l100SdRatio: 0.10,
    l100LowerRatio: 0.90,
    l100UpperRatio: 1.18,
    acFactor: 1.10,
    idleLPerHr: 1.5,
    engineOnIdleFrac: 0.5,
    surgeJitter: 0.10,
    airportShareFrac: 0.045,
    peakWindow: [[6, 10], [16, 21]],
    fareCard: CARD_B,
    surgeMult: 1.0,
    demandMult: 1.0,
    unpaidFactor: 1.0,
    maxTripsPerHour: 3,
    copilotTickMin: 30,
    relocationSpeed: 20,
    riskPremium: 500,
    endShiftThreshold: 500,
    conserveFuelL: 15,
    endShiftFuelL: 8,
    trailingWindowH: 3,
    conserveIdleFrac: 0.0,
    estateRadiusKm: 3.5,
    auditCancelCredit: false,
    marketDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  };
  var SHIFT_MIN = ECON.shiftHours * 60;

  function def(o) {
    var out = {};
    var k;
    for (k in ECON) out[k] = ECON[k];
    if (o) for (k in o) if (o[k] !== undefined) out[k] = o[k];
    out.fareCard = (o && o.fareCard) || CARD_B;
    return out;
  }

  /* group-level expected trip geometry (model-derived, deterministic — ESTIMATED) */
  var GROUP_STAT = {};
  (function () {
    for (var g in OD) {
      var rows = OD[g], sw = 0, sk = 0, sm = 0, sv = 0;
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i], sp = CLASS_SPEED[r.t] ? (CLASS_SPEED[r.t].ff + CLASS_SPEED[r.t].pk) / 2 : 25;
        sw += r.w; sk += r.w * r.k; sm += r.w * r.m; sv += r.w * sp;
      }
      GROUP_STAT[g] = { paidKm: sk / sw, rideMin: sm / sw, speed: sv / sw };
    }
  })();

  /* --------------------------------------------------------------- helpers ---- */
  function isPeak(h, econ) {
    for (var i = 0; i < econ.peakWindow.length; i++) {
      var a = econ.peakWindow[i][0], b = econ.peakWindow[i][1];
      if (h >= a && h < b) return true;
    }
    return false;
  }
  function nearestZone(loc) {
    var b = ZONES[0], m = 1e9, z, d;
    for (var i = 0; i < ZONES.length; i++) { z = ZONES[i]; d = gc(loc, z); if (d < m) { m = d; b = z; } }
    return b;
  }
  function drawOrigin(driver, econ, rng) {
    var J = econ.jitterDeg, p, z, i, d, md;
    if (rng() < 0.72) {
      var theta = rng() * 2 * Math.PI;
      var r = 0.4 + rng() * 1.4;
      p = { lat: driver.lat + Math.cos(theta) * (r / 111), lng: driver.lng + Math.sin(theta) * (r / 111) / Math.cos(driver.lat * Math.PI / 180) };
      z = ZONES[0]; md = 1e9;
      for (i = 0; i < ZONES.length; i++) { d = gc(p, ZONES[i]); if (d < md) { md = d; z = ZONES[i]; } }
      return { z: z, px: p };
    }
    var list = [], sum = 0;
    for (i = 0; i < ZONES.length; i++) { z = ZONES[i]; d = gc(driver, z); var w = z.w * Math.exp(-d / 5); list.push({ z: z, w: w }); sum += w; }
    var rr = rng() * sum;
    for (i = 0; i < list.length; i++) { rr -= list[i].w; if (rr <= 0) return { z: list[i].z, px: { lat: list[i].z.lat + (rng() - 0.5) * 2 * J, lng: list[i].z.lng + (rng() - 0.5) * 2 * J } }; }
    return { z: ZONES[0], px: { lat: ZONES[0].lat, lng: ZONES[0].lng } };
  }
  function drawDest(gr, econ, rng) {
    var list = OD[gr] || OD.core, sum = 0, i, x;
    var airScale = (econ.airportShareFrac || 0.06) / 0.06;
    for (i = 0; i < list.length; i++) { x = list[i]; sum += x.w * (x.t === 'air' ? airScale : 1); }
    var r = rng() * sum;
    for (i = 0; i < list.length; i++) { x = list[i]; r -= x.w * (x.t === 'air' ? airScale : 1); if (r <= 0) return x; }
    return list[list.length - 1];
  }
  function destFor(originPt, gr, cls, rng) {
    var prefs = PREF[cls.t] || ['core'];
    var kLo = cls.k * 0.35, kHi = cls.k * 1.7, cands = [], i, z, d;
    for (i = 0; i < ZONES.length; i++) {
      z = ZONES[i]; d = gc(originPt, z) * 1.08;
      if (d < kLo || d > kHi) continue;
      cands.push({ z: z, d: d, c: (prefs.indexOf(z.gr) >= 0 ? 2 : 1) * z.w });
    }
    if (!cands.length) for (i = 0; i < ZONES.length; i++) { z = ZONES[i]; cands.push({ z: z, d: gc(originPt, z) * 1.08, c: z.w }); }
    var sum = 0; for (i = 0; i < cands.length; i++) sum += cands[i].c;
    var r = rng() * sum;
    for (i = 0; i < cands.length; i++) { r -= cands[i].c; if (r <= 0) return cands[i]; }
    return cands[cands.length - 1];
  }
  function surgeMult(h, dow, rain, event, econ, jitterDraw) {
    var b = BAND[Math.floor(h)].s * econ.surgeMult;
    if (event) b *= econ.eventSurge;
    if (rain) b *= econ.rainSurge;
    if ((dow === 0 || dow === 6) && h >= 21) b *= econ.weekendNightSurge;
    return b * (1 + (jitterDraw || 0) * econ.surgeJitter);
  }
  function fareAmount(paidKm, rideMin, surge, econ) {
    var fc = econ.fareCard;
    return Math.max(fc.minFare, fc.base + fc.perKm * paidKm + fc.perMin * rideMin) * surge;
  }

  /* ------------------------------------------------------- environment (CRN) -- */
  function buildEnv(seed, econ) {
    var rng = mulberry32(seed >>> 0);
    var dow = Math.floor(rng() * 7);
    var rain = rng() < econ.rainP;
    var event = rng() < econ.eventP;
    var l100 = randN(rng, econ.l100, econ.l100 * econ.l100SdRatio, econ.l100 * econ.l100LowerRatio, econ.l100 * econ.l100UpperRatio);
    var z0 = ZONES[Math.floor(rng() * 5)];
    var startLoc = { lat: z0.lat + (rng() - 0.5) * 0.02, lng: z0.lng + (rng() - 0.5) * 0.02 };
    var offers = [], idx = 0, h, frac, rate, nReq, j;
    for (h = 6; h <= 17; h++) {
      frac = 1;
      rate = econ.baseHourlyRate * BAND[h].d * econ.capture * econ.demandMult * frac;
      nReq = Math.floor(-Math.log(1 - Math.max(1e-12, rng())) * rate) + (rng() < (rate % 1) ? 1 : 0);
      for (j = 0; j < nReq; j++) { offers.push({ hour: h, idx: idx }); idx++; }
    }
    return { seed: seed >>> 0, dow: dow, rain: rain, event: event, l100: l100, startLoc: startLoc, offers: offers };
  }
  function offersByHour(env) {
    var map = {};
    for (var i = 0; i < env.offers.length; i++) {
      var o = env.offers[i];
      if (!map[o.hour]) map[o.hour] = [];
      map[o.hour].push(o);
    }
    return map;
  }
  function offerRng(env, idx) { return mulberry32(subSeed(env.seed, idx)); }

  /* ------------------------------------------------------- copilot estimators -- */
  function demandShare(z, driver) {
    return z.w * Math.exp(-gc(driver, z) / 7.0);
  }
  function zoneOfferRate(z, driver, hour, econ) {
    var sum = 0, i;
    for (i = 0; i < ZONES.length; i++) sum += demandShare(ZONES[i], driver);
    var share = sum > 0 ? demandShare(z, driver) / sum : 0;
    return econ.baseHourlyRate * BAND[Math.floor(hour)].d * econ.capture * econ.demandMult * share;
  }
  function estPickupKm(z) {
    return 1.2 + 1.2 * (1 - clamp(z.w / 1.30, 0.5, 1.0));
  }
  function estCycle(z, driver, hour, econ, surge) {
    var st = GROUP_STAT[z.gr] || GROUP_STAT.core;
    var pickKm = estPickupKm(z);
    var pickMin = (pickKm / Math.max(20, st.speed * 0.75)) * 60 + econ.pickupPrepMin;
    var cycleMin = pickMin + st.rideMin + econ.dwellOnSite + econ.dwellPostTrip;
    var fare = fareAmount(st.paidKm, st.rideMin, surge, econ);
    var netFare = fare * (1 - econ.comm);
    var driveL = (st.paidKm + pickKm) / 100 * econ.l100 * econ.acFactor;
    var idleL = cycleMin / 60 * econ.idleLPerHr * econ.engineOnIdleFrac;
    var fuelCost = (driveL + idleL) * econ.fuelPrice;
    return { cycleMin: cycleMin, netFare: netFare, fuelCost: fuelCost, net: netFare - fuelCost };
  }
  function netPerHour(z, driver, hour, econ, surge) {
    var rate = zoneOfferRate(z, driver, hour, econ);
    var c = estCycle(z, driver, hour, econ, surge);
    var cycPerHour = clamp(rate, 0, econ.maxTripsPerHour);
    var filledMin = cycPerHour * c.cycleMin;
    var idleUnfilledH = clamp((60 - filledMin) / 60, 0, 1);
    var idleCost = idleUnfilledH * econ.idleLPerHr * econ.engineOnIdleFrac * econ.fuelPrice;
    return cycPerHour * c.net - idleCost;
  }
  function surgeEstimate(hour, env, econ) {
    return surgeMult(hour, env.dow, env.rain, env.event, econ, 0);
  }

  /* ------------------------------------------------------------- ledger ------ */
  function newLedger(mode, env, econ, seed) {
    return {
      date: 'SIM-' + (seed >>> 0), shiftId: mode + '-' + (seed >>> 0), mode: mode,
      seed: seed >>> 0, startH: 6, endH: 18,
      onlineMin: 0,
      RIDER_GROSS_FARES: 0, BOLT_COMMISSION: 0, DRIVER_REVENUE_AFTER_COMMISSION: 0,
      PETROL_COST: 0, NET_AFTER_FUEL: 0,
      TOTAL_LITRES: 0, LITRES_DRIVING: 0, LITRES_IDLE: 0,
      PAID_KM: 0, PICKUP_KM: 0, RELOCATION_KM: 0, OTHER_UNPAID_KM: 0, UNPAID_KM: 0, TOTAL_KM: 0,
      PICKUP_MIN: 0, RIDE_MIN: 0, DWELL_MIN: 0, IDLE_MIN: 0, RELOCATION_MIN: 0,
      trips: 0, declinedOffers: 0, cancellations: 0,
      surgeShocks: { dow: env.dow, rain: env.rain, event: env.event, l100: env.l100 },
      offersByHour: {},
      DecisionLog: [], rides: [],
      invariantOk: false, endCause: 'SHIFT_COMPLETE'
    };
  }
  function finalizeLedger(L, econ, fuelAcc) {
    L.BOLT_COMMISSION = round1(L.RIDER_GROSS_FARES * econ.comm);
    L.DRIVER_REVENUE_AFTER_COMMISSION = L.RIDER_GROSS_FARES - L.BOLT_COMMISSION;
    L.UNPAID_KM = L.PICKUP_KM + L.RELOCATION_KM + L.OTHER_UNPAID_KM;
    L.TOTAL_KM = L.PAID_KM + L.UNPAID_KM;
    L.LITRES_DRIVING = L.TOTAL_KM / 100 * econ.l100 * econ.acFactor;
    L.LITRES_IDLE = fuelAcc.idleLitres;
    L.TOTAL_LITRES = L.LITRES_DRIVING + L.LITRES_IDLE;
    L.PETROL_COST = L.TOTAL_LITRES * econ.fuelPrice;
    L.NET_AFTER_FUEL = L.DRIVER_REVENUE_AFTER_COMMISSION - L.PETROL_COST;
    L.invariantOk = checkLedger(L);
    return L;
  }
  function checkLedger(L) {
    var ok = true;
    var g = L.RIDER_GROSS_FARES, c = L.BOLT_COMMISSION, r = L.DRIVER_REVENUE_AFTER_COMMISSION, p = L.PETROL_COST, n = L.NET_AFTER_FUEL;
    if (Math.abs(g - c - r) > 0.05) ok = false;
    if (Math.abs(r - p - n) > 0.05) ok = false;
    var kmSum = L.PAID_KM + L.PICKUP_KM + L.RELOCATION_KM + L.OTHER_UNPAID_KM;
    if (Math.abs(kmSum - L.TOTAL_KM) > 1e-6) ok = false;
    if (Math.abs((L.PAID_KM + L.UNPAID_KM) - L.TOTAL_KM) > 1e-6) ok = false;
    var tm = L.PICKUP_MIN + L.RIDE_MIN + L.DWELL_MIN + L.IDLE_MIN + L.RELOCATION_MIN;
    if (Math.abs(tm - L.onlineMin) > 1.0) ok = false;
    return ok;
  }
  function tidyDecision(d) {
    return {
      t: Math.round(d.t), kind: d.kind, zone: d.zone || null,
      evPerHr: Math.round(d.evPerHr), relocationKm: round1(d.relocationKm || 0),
      relocationMin: round1(d.relocationMin || 0), fuelCost: Math.round(d.fuelCost || 0), note: d.note || ''
    };
  }

  /* ------------------------------------------------------------- baseline ---- */
  function baselineIdleAction(sim, env, econ, sRng) {
    return { action: 'none' };
  }
  function baselineRelocation(driver, econ, sRng) {
    var top = ZONES.slice().sort(function (a, b) { return b.w - a.w; }).slice(0, 3);
    var target = top[Math.floor(sRng() * 3)];
    return target;
  }

  /* ------------------------------------------------------- copilot decision -- */
  function copilotDecide(sim, env, econ, trailing3hNet) {
    var hour = sim.hour, surge = surgeEstimate(hour, env, econ);
    var remMin = SHIFT_MIN - sim.t;
    var curZ = nearestZone(sim.loc);
    var curEh = netPerHour(curZ, sim.loc, hour, econ, surge);
    var decision = { action: 'STAY', zone: curZ.n, evPerHr: curEh, relocationKm: 0, relocationMin: 0, fuelCost: 0, note: 'stay' };

    if (sim.fuel < econ.endShiftFuelL) {
      decision.action = 'END'; decision.zone = curZ.n; decision.note = 'fuel reserve (' + econ.endShiftFuelL + ' L)';
      return decision;
    }
    if (sim.fuel < econ.conserveFuelL) {
      decision.action = 'CONSERVE'; decision.zone = curZ.n; decision.note = 'fuel reserve (' + econ.conserveFuelL + ' L)';
      return decision;
    }
    if (trailing3hNet < 0 && curEh < 0) {
      decision.action = 'CONSERVE'; decision.note = 'trailing 3h NET negative + next-hour EV negative';
      return decision;
    }
    var maxEh = -Infinity, z, i;
    for (i = 0; i < ZONES.length; i++) { maxEh = Math.max(maxEh, netPerHour(ZONES[i], sim.loc, hour, econ, surge)); }
    if (BAND[Math.floor(hour)].d < 0.5 && maxEh < econ.endShiftThreshold) {
      decision.action = 'END'; decision.note = 'extremely low demand band + all zones below ' + econ.endShiftThreshold + ' NGN/h';
      return decision;
    }
    var stayVal = curEh * remMin;
    var best = null, bestV = -Infinity;
    for (i = 0; i < ZONES.length; i++) {
      z = ZONES[i];
      var dkm = gc(sim.loc, z);
      var tReloc = dkm / econ.relocationSpeed * 60;
      var fuelReloc = dkm / 100 * econ.l100 * econ.acFactor * econ.fuelPrice;
      var eh = netPerHour(z, sim.loc, hour, econ, surge);
      var rv = eh * (remMin - tReloc) - fuelReloc - econ.riskPremium;
      if (rv > bestV) { bestV = rv; best = { z: z, eh: eh, tReloc: tReloc, fuelReloc: fuelReloc, rv: rv, dkm: dkm }; }
    }
    if (best && best.rv > stayVal + econ.riskPremium) {
      decision.action = 'REPOSITION'; decision.zone = best.z.n; decision.evPerHr = best.eh;
      decision.relocationKm = best.dkm; decision.relocationMin = best.tReloc; decision.fuelCost = best.fuelReloc;
      decision.note = 'reloc value > stay value + premium';
    }
    return decision;
  }

  /* ------------------------------------------------------------- sim core ---- */
  function emptyFuelAcc() { return { idleLitres: 0 }; }

  function runMode(mode, env, econ, strategySeed, optsForRun) {
    var SHIFT = econ.shiftHours * 60;
    var sRng = mulberry32(strategySeed >>> 0);
    var L = newLedger(mode, env, econ, env.seed);
    var offers = offersByHour(env);
    var driver = { lat: env.startLoc.lat, lng: env.startLoc.lng };
    var t = 0;
    var fuel = econ.startFuelL;
    var tripsInHour = 0;
    var lastTick = -Infinity;
    var conserveActive = false;
    var fuelAcc = emptyFuelAcc();
    var grossSoFar = 0, drivingKmSoFar = 0, idleLitresSoFar = 0;
    var cumNetStart = [0];
    var Ldrv = L;

    function curNet() {
      return grossSoFar * (1 - econ.comm) - (drivingKmSoFar / 100 * econ.l100 * econ.acFactor + idleLitresSoFar) * econ.fuelPrice;
    }
    function idleFrac() { return conserveActive ? econ.conserveIdleFrac : econ.engineOnIdleFrac; }
    function burnDrive(km) {
      var lit = km / 100 * econ.l100 * econ.acFactor;
      fuel -= lit; drivingKmSoFar += km; return lit;
    }
    function burnIdle(min) {
      var lit = min / 60 * idleFrac() * econ.idleLPerHr;
      fuel -= lit; idleLitresSoFar += lit; fuelAcc.idleLitres += lit; return lit;
    }

    function doRelocation(target, maxKm) {
      var d = gc(driver, target);
      var travelKm = Math.min(maxKm, d);
      if (travelKm <= 0.02) return 0;
      var relocMin = travelKm / econ.relocationSpeed * 60;
      var remShift = SHIFT - t;
      var remIdle = Math.max(0, blockEnd - t);
      var usableMin = Math.min(remShift, remIdle);
      var byTimeKm = usableMin / 60 * econ.relocationSpeed;
      travelKm = Math.min(travelKm, byTimeKm);
      if (travelKm <= 0.02) return 0;
      relocMin = travelKm / econ.relocationSpeed * 60;
      driver = moveToward(driver, target, travelKm);
      Ldrv.RELOCATION_KM += travelKm;
      Ldrv.RELOCATION_MIN += relocMin;
      burnDrive(travelKm);
      t += relocMin;
      return relocMin;
    }

    function logDecision(dec) {
      var entry = { t: t, kind: dec.action.toUpperCase(), zone: dec.zone || null, evPerHr: dec.evPerHr || 0, relocationKm: dec.relocationKm || 0, relocationMin: dec.relocationMin || 0, fuelCost: dec.fuelCost || 0, note: dec.note || '' };
      Ldrv.DecisionLog.push(tidyDecision(entry));
      return entry;
    }

    var blockEnd;
    var h, outerDone = false;
    for (h = 6; h <= 17 && !outerDone; h++) {
      blockEnd = (h - 5) * 60;
      if (t >= SHIFT - 1e-9) break;
      cumNetStart.push(curNet());
      tripsInHour = 0;
      Ldrv.offersByHour[h] = (offers[h] || []).length;

      /* copilot tick at block start */
      if (mode === 'COPILOT' && t - lastTick + 1e-9 >= econ.copilotTickMin) {
        lastTick = t;
        var dec0 = copilotDecide({ t: t, hour: h, loc: driver, fuel: fuel }, env, econ, curNet() - (cumNetStart[Math.max(0, cumNetStart.length - 1 - econ.trailingWindowH)] || 0));
        logDecision(dec0);
        conserveActive = (dec0.action === 'CONSERVE');
        if (dec0.action === 'END') { Ldrv.endCause = 'COPILOT_END'; outerDone = true; break; }
      }

      /* offer batch for this hour */
      var olist = offers[h] || [], oi, off;
      for (oi = 0; oi < olist.length; oi++) {
        if (t >= blockEnd - 1e-9) break;
        if (tripsInHour >= econ.maxTripsPerHour) break;
        off = olist[oi];
        var rng = offerRng(env, off.idx);
        var o = drawOrigin(driver, econ, rng);
        var pickKm = Math.max(0.4, gc(driver, o.px) * 1.25 * econ.unpaidFactor);
        if (pickKm > econ.acceptRadius) { Ldrv.declinedOffers++; continue; }
        var cls = drawDest(o.z.gr, econ, rng);
        var dst = destFor(o.px, o.z.gr, cls, rng);
        var pkNow = isPeak(h, econ);
        var spd = CLASS_SPEED[cls.t] ? CLASS_SPEED[cls.t][pkNow ? 'pk' : 'ff'] : 30;
        var paidKm = Math.max(1.2, dst.d * (0.92 + rng() * 0.12));
        var rideMin = (paidKm / spd) * 60;
        var pickMin = (pickKm / Math.max(20, spd * 0.75)) * 60 + econ.pickupPrepMin;
        var used = pickMin + econ.dwellOnSite + rideMin + econ.dwellPostTrip;
        if (used > blockEnd - t || t + used > SHIFT - 1e-9) break;
        var surge = surgeMult(h, env.dow, env.rain, env.event, econ, rng());
        var fare = fareAmount(paidKm, rideMin, surge, econ);

        /* copilot trip-level gate: accept only if expected cycle net > 0 */
        if (mode === 'COPILOT') {
          var netFare = fare * (1 - econ.comm);
          var driveLit = (paidKm + pickKm) / 100 * econ.l100 * econ.acFactor;
          var idleLit = used / 60 * econ.idleLPerHr * econ.engineOnIdleFrac;
          var netCycle = netFare - (driveLit + idleLit) * econ.fuelPrice;
          if (netCycle <= 0) {
            logDecision({ action: 'DECLINE', zone: nearestZone(driver).n, evPerHr: netPerHour(nearestZone(driver), driver, h, econ, surgeEstimate(h, env, econ)), relocationKm: 0, relocationMin: 0, fuelCost: 0, note: 'est. cycle net <= 0' });
            continue;
          }
        }

        var cancelled = rng() < econ.cancelP;
        if (cancelled) {
          if (econ.auditCancelCredit) { grossSoFar += fare; Ldrv.RIDER_GROSS_FARES += fare; }
          Ldrv.cancellations++;
          Ldrv.PICKUP_KM += pickKm;
          Ldrv.PICKUP_MIN += pickMin;
          burnDrive(pickKm);
          t += pickMin;
          continue;
        }
        grossSoFar += fare;
        Ldrv.RIDER_GROSS_FARES += fare;
        Ldrv.trips++;
        Ldrv.PAID_KM += paidKm;
        Ldrv.PICKUP_KM += pickKm;
        Ldrv.RIDE_MIN += rideMin;
        Ldrv.PICKUP_MIN += pickMin;
        Ldrv.DWELL_MIN += econ.dwellOnSite + econ.dwellPostTrip;
        burnDrive(pickKm + paidKm);
        t += used;
        tripsInHour++;
        driver = { lat: dst.z.lat + (rng() - 0.5) * 0.01, lng: dst.z.lng + (rng() - 0.5) * 0.01 };
        var tripFare = fareAmount(paidKm, rideMin, surge, econ);
        Ldrv.rides.push({
          ts: Math.round(t), pickupZone: o.z.n, dropoffZone: dst.z.n,
          paidKm: round1(paidKm), pickupKm: round1(pickKm), rideMin: round1(rideMin),
          pickupMin: round1(pickMin), dwellMin: round1(econ.dwellOnSite + econ.dwellPostTrip),
          fareGross: round1(tripFare), commission: round1(tripFare * econ.comm),
          afterComm: round1(tripFare - round1(tripFare * econ.comm)),
          fuelCost: Math.round((paidKm + pickKm) / 100 * econ.l100 * econ.acFactor * econ.fuelPrice),
          netAfterFuel: round1(tripFare - round1(tripFare * econ.comm) - Math.round((paidKm + pickKm) / 100 * econ.l100 * econ.acFactor * econ.fuelPrice)),
          offeredBy: mode === 'COPILOT' ? 'copilot' : 'env'
        });

        /* copilot tick after trip */
        if (mode === 'COPILOT' && t - lastTick + 1e-9 >= econ.copilotTickMin) {
          lastTick = t;
          var dec1 = copilotDecide({ t: t, hour: h, loc: driver, fuel: fuel }, env, econ, curNet() - (cumNetStart[Math.max(0, cumNetStart.length - 1 - econ.trailingWindowH)] || 0));
          logDecision(dec1);
          conserveActive = (dec1.action === 'CONSERVE');
          if (dec1.action === 'END') { Ldrv.endCause = 'COPILOT_END'; outerDone = true; break; }
        }
      }
      if (outerDone) break;

      /* idle + relocation segment for the rest of the block */
      if (blockEnd - t > 0.001) {
        if (mode === 'BASELINE') {
          if (blockEnd - t >= 15 && sRng() < econ.relocProb) {
            var target = baselineRelocation(driver, econ, sRng);
            var rMin = doRelocation(target, econ.relocKm * econ.unpaidFactor);
            logDecision({ action: 'REPOSITION', zone: target.n, evPerHr: 0, relocationKm: rMin / 60 * econ.relocationSpeed, relocationMin: rMin, fuelCost: rMin / 60 * econ.relocationSpeed / 100 * econ.l100 * econ.acFactor * econ.fuelPrice, note: 'baseline script relocation' });
          }
          var idleMin = Math.max(0, blockEnd - t);
          if (idleMin > 0.001) { burnIdle(idleMin); Ldrv.IDLE_MIN += idleMin; t += idleMin; }
          t = Math.min(blockEnd, t);
        } else {
          /* copilot: tick when eligible, then burn up to tickMin of idle; repeat */
          var idleGuard = 0;
          while (t < blockEnd - 0.001 && !outerDone && idleGuard++ < 120) {
            if (t - lastTick >= econ.copilotTickMin - 0.001) {
              lastTick = t;
              var dec2 = copilotDecide({ t: t, hour: h, loc: driver, fuel: fuel }, env, econ, curNet() - (cumNetStart[Math.max(0, cumNetStart.length - 1 - econ.trailingWindowH)] || 0));
              logDecision(dec2);
              conserveActive = (dec2.action === 'CONSERVE');
              if (dec2.action === 'END') { Ldrv.endCause = 'COPILOT_END'; outerDone = true; break; }
              if (dec2.action === 'REPOSITION') {
                var tz = null, i2;
                for (i2 = 0; i2 < ZONES.length; i2++) if (ZONES[i2].n === dec2.zone) tz = ZONES[i2];
                if (tz) doRelocation(tz, gc(driver, tz));
              }
              if (outerDone) break;
            }
            var chunk = Math.min(econ.copilotTickMin, blockEnd - t);
            if (chunk <= 0.001) break;
            burnIdle(chunk); Ldrv.IDLE_MIN += chunk; t += chunk;
          }
        }
      }
    }

    Ldrv.onlineMin = Math.round(t * 10) / 10;
    Ldrv.endCause = Ldrv.endCause || 'SHIFT_COMPLETE';
    finalizeLedger(Ldrv, econ, fuelAcc);
    if (optsForRun && optsForRun.verbose) {
      Ldrv.traceFuel = { startFuelL: econ.startFuelL, endFuelL: round1(fuel) };
    }
    return Ldrv;
  }

  /* ------------------------------------------------------------------ API ---- */
  function simShift(mode, seed, opts) {
    var econ = def((opts && opts.econ) || null);
    var s = (seed == null ? 1 : seed) >>> 0;
    var env = buildEnv(s, econ);
    var stratSeed = opts && opts.strategySeed != null ? (opts.strategySeed >>> 0) : ((s ^ 0xA5A5A5A5) >>> 0);
    return runMode(mode === 'COPILOT' ? 'COPILOT' : 'BASELINE', env, econ, stratSeed, opts);
  }
  function baselineShift(seed, opts) { return simShift('BASELINE', seed, opts); }
  function copilotShift(seed, opts) { return simShift('COPILOT', seed, opts); }

  function simPaired(seed, n, opts) {
    var econ = def((opts && opts.econ) || null);
    var rng = mulberry32(seed >>> 0);
    var pairs = [], i;
    for (i = 0; i < n; i++) {
      var si = (rng() * 4294967296) >>> 0;
      var env = buildEnv(si, econ);
      var bSeed = ((si ^ 0xB1E5) >>> 0), cSeed = ((si ^ 0xC11) >>> 0);
      var B = runMode('BASELINE', env, econ, bSeed, null);
      var C = runMode('COPILOT', env, econ, cSeed, null);
      pairs.push({
        seed: si,
        base: B, copilot: C,
        deltaNet: C.NET_AFTER_FUEL - B.NET_AFTER_FUEL,
        deltaFuelL: C.TOTAL_LITRES - B.TOTAL_LITRES,
        deltaUnpaidKm: C.UNPAID_KM - B.UNPAID_KM,
        deltaIdleH: C.IDLE_MIN / 60 - B.IDLE_MIN / 60,
        deltaTrips: C.trips - B.trips,
        deltaGross: C.RIDER_GROSS_FARES - B.RIDER_GROSS_FARES,
        deltaPaidKm: C.PAID_KM - B.PAID_KM
      });
    }
    return summarizePairs(pairs);
  }

  function mean(arr) { var s = 0, i; for (i = 0; i < arr.length; i++) s += arr[i]; return arr.length ? s / arr.length : 0; }
  function stdev(arr) { var m = mean(arr), s2 = 0, i; for (i = 0; i < arr.length; i++) s2 += (arr[i] - m) * (arr[i] - m); return arr.length > 1 ? Math.sqrt(s2 / (arr.length - 1)) : 0; }
  function percentile(arr, p) {
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var idx = Math.min(a.length - 1, Math.floor(p * a.length));
    return a[idx];
  }
  function summarizeShiftSet(ledgers) {
    var nets = ledgers.map(function (l) { return l.NET_AFTER_FUEL; });
    var agg = function (k) { return mean(ledgers.map(function (l) { return l[k]; })); };
    var kmP = agg('PAID_KM'), kmU = agg('UNPAID_KM');
    return {
      n: ledgers.length,
      netMean: mean(nets), netSd: stdev(nets), netP5: percentile(nets, 0.05), netP50: percentile(nets, 0.5), netP95: percentile(nets, 0.95),
      gross: agg('RIDER_GROSS_FARES'), commission: agg('BOLT_COMMISSION'), afterComm: agg('DRIVER_REVENUE_AFTER_COMMISSION'),
      petrol: agg('PETROL_COST'), litres: agg('TOTAL_LITRES'), litresDriving: agg('LITRES_DRIVING'), litresIdle: agg('LITRES_IDLE'),
      trips: agg('trips'), paidKm: kmP, unpaidKm: kmU, totalKm: kmP + kmU,
      idleH: agg('IDLE_MIN') / 60, rideH: agg('RIDE_MIN') / 60, pickupH: agg('PICKUP_MIN') / 60, dwellH: agg('DWELL_MIN') / 60, relocH: agg('RELOCATION_MIN') / 60,
      onlineH: agg('onlineMin') / 60,
      relocKm: agg('RELOCATION_KM'), cancellations: agg('cancellations'), declined: agg('declinedOffers'),
      allInvariantOk: ledgers.every(function (l) { return l.invariantOk; }),
      monthMean: mean(nets) * 26
    };
  }
  function bootstrapCI(arr, nResamples, pLo, pHi, rngSeed) {
    var rng = mulberry32(rngSeed >>> 0), res = [], i, j;
    for (i = 0; i < nResamples; i++) {
      var s = 0;
      for (j = 0; j < arr.length; j++) s += arr[Math.floor(rng() * arr.length)];
      res.push(s / arr.length);
    }
    res.sort(function (a, b) { return a - b; });
    return { lo: percentile(res, pLo), hi: percentile(res, pHi) };
  }
  function summarizePairs(pairsObj) {
    var deltas = pairsObj.map(function (p) { return p.deltaNet; });
    var fuelD = pairsObj.map(function (p) { return p.deltaFuelL; });
    var ukD = pairsObj.map(function (p) { return p.deltaUnpaidKm; });
    var idleD = pairsObj.map(function (p) { return p.deltaIdleH; });
    var tripD = pairsObj.map(function (p) { return p.deltaTrips; });
    var m = mean(deltas), sd = stdev(deltas), n = deltas.length;
    var se = sd / Math.sqrt(n);
    var ci = { lo: m - 1.96 * se, hi: m + 1.96 * se };
    var boot = bootstrapCI(deltas, 2000, 0.025, 0.975, 12345);
    var positive = deltas.filter(function (v) { return v > 0; }).length / n;
    var base = mean(pairsObj.map(function (p) { return p.base.NET_AFTER_FUEL; }));
    var cop = mean(pairsObj.map(function (p) { return p.copilot.NET_AFTER_FUEL; }));
    return {
      n: n, pairs: pairsObj,
      meanDelta: m, sdDelta: sd, ci95: ci, bootstrap95: boot,
      pDeltaPositive: positive, signTestPosNeg: { pos: positive, neg: deltas.filter(function (v) { return v < 0; }).length / n, zero: deltas.filter(function (v) { return v === 0; }).length / n },
      monthDelta: m * 26, monthDeltaCI: { lo: ci.lo * 26, hi: ci.hi * 26 },
      baseMeanNet: base, copilotMeanNet: cop,
      meanDeltaFuelL: mean(fuelD), meanDeltaUnpaidKm: mean(ukD), meanDeltaIdleH: mean(idleD), meanDeltaTrips: mean(tripD),
      baseSummary: summarizeShiftSet(pairsObj.map(function (p) { return p.base; })),
      copilotSummary: summarizeShiftSet(pairsObj.map(function (p) { return p.copilot; }))
    };
  }

  /* --------------------------------------------------- reconciliation (audit) - */
  /* Reproduces the historical second-order audit's "~N0/day" baseline at
     acFactor = 1.04 and its documented parameters (card B, 14 L/100km ...).
     Production default stays 1.10; this mode is for audit comparison only. */
  function reconcileAudit(ndays, opts) {
    var econ = def(Object.assign({ acFactor: 1.04 }, (opts && opts.econ) || null));
    var ledgers = [];
    for (var i = 0; i < ndays; i++) {
      var s = (opts && opts.seedBase != null ? opts.seedBase + i : 424242 + i) >>> 0;
      var env = buildEnv(s, econ);
      var strat = ((s ^ 0xB1E5) >>> 0);
      ledgers.push(runMode('BASELINE', env, econ, strat, null));
    }
    return summarizeShiftSet(ledgers);
  }

  /* paid/unpaid reconciliation helpers */
  function totalsFor(ledger) {
    return {
      paidKm: ledger.PAID_KM, unpaidKm: ledger.UNPAID_KM, totalKm: ledger.TOTAL_KM,
      afterComm: ledger.DRIVER_REVENUE_AFTER_COMMISSION, petrol: ledger.PETROL_COST, net: ledger.NET_AFTER_FUEL,
      litres: ledger.TOTAL_LITRES, trips: ledger.trips, idleMin: ledger.IDLE_MIN
    };
  }

  /* ----------------------------------------------------- live-mode helpers ----- */
  /* LIVE COPILOT MODE additions. Additive only: these re-use the frozen economic
     primitives above (surgeMult / netPerHour / copilotDecide / gc / ECON) and
     change nothing in the simulation paths. The recommendation ACTION always
     comes from copilotDecide() — liveRecommend() only enriches the display. */
  function liveSurgeEnv(date, opts) {
    var d = date || new Date();
    return { dow: d.getDay(), rain: !!(opts && opts.rain), event: !!(opts && opts.event) };
  }
  function zoneFor(loc) {
    var z = nearestZone(loc);
    var d = gc(loc, z);
    var radiusKm = 0.7 * z.w;
    return { zone: z, distanceKm: round1(d), radiusKm: round1(radiusKm), inside: d <= radiusKm * 1.05 };
  }
  function relocationAnalysis(sim, econ) {
    var hour = sim.hour, surge = sim.surge;
    var remMin = Math.max(0, SHIFT_MIN - sim.t);
    var curZ = nearestZone(sim.loc);
    var curEh = netPerHour(curZ, sim.loc, hour, econ, surge);
    var stayVal = curEh * remMin;
    var maxEh = -Infinity, best = null, bestV = -Infinity, i, z;
    for (i = 0; i < ZONES.length; i++) {
      z = ZONES[i];
      var eh = netPerHour(z, sim.loc, hour, econ, surge);
      if (eh > maxEh) maxEh = eh;
      var dkm = gc(sim.loc, z);
      var tReloc = dkm / econ.relocationSpeed * 60;
      var fuelReloc = dkm / 100 * econ.l100 * econ.acFactor * econ.fuelPrice;
      var rv = eh * (remMin - tReloc) - fuelReloc - econ.riskPremium;
      if (rv > bestV) { bestV = rv; best = { z: z, eh: eh, dkm: dkm, tReloc: tReloc, fuelReloc: fuelReloc, rv: rv }; }
    }
    return { curZone: curZ, curEh: curEh, stayVal: stayVal, remMin: remMin, maxEh: maxEh, best: best };
  }
  function liveRecommend(sim, env, econ, trailingNet) {
    var fuelKnown = !!(sim.fuelSet && typeof sim.fuel === 'number');
    var fuelPass = fuelKnown ? sim.fuel : econ.startFuelL;
    /* ACTION = frozen copilotDecide; fuel unknown stays out of the fuel branches. */
    var dec = copilotDecide({ t: sim.t, hour: sim.hour, loc: sim.loc, fuel: fuelPass }, env, econ, trailingNet == null ? 0 : trailingNet);
    var surge = surgeEstimate(sim.hour, env, econ);
    var ra = relocationAnalysis({ t: sim.t, hour: sim.hour, loc: sim.loc, surge: surge }, econ);
    var inputs = {
      gps: 'LIVE', demand: 'MODELED', surge: 'MODELED', traffic: 'MODELED',
      fuel: fuelKnown ? 'MANUAL' : 'MISSING', trailing: trailingNet == null ? 'MISSING' : 'OBSERVED', boltOffer: 'MANUAL'
    };
    var rec = {
      action: dec.action, zone: dec.zone, note: dec.note, inputs: inputs,
      evPerHr: dec.evPerHr,
      stay: { zone: ra.curZone.n, evPerHr: round1(ra.curEh) },
      remainingH: round1(ra.remMin / 60),
      relocationKm: dec.relocationKm, relocationMin: dec.relocationMin, fuelCost: dec.fuelCost,
      bestReloc: null, netAdvantage: 0
    };
    if (dec.action === 'REPOSITION' && ra.best) {
      rec.bestReloc = { zone: ra.best.z.n, evPerHr: Math.round(ra.best.eh), km: round1(ra.best.dkm), min: round1(ra.best.tReloc), fuelCost: Math.round(ra.best.fuelReloc) };
      rec.netAdvantage = Math.round(ra.best.rv - ra.stayVal);
    }
    return rec;
  }
  function tripNetEval(p, econ) {
    var netFare = p.fare * (1 - econ.comm);
    var driveL = (p.paidKm + p.pickupKm) / 100 * econ.l100 * econ.acFactor;
    var idleL = (p.cycleMin || 0) / 60 * econ.idleLPerHr * econ.engineOnIdleFrac;
    var fuelCost = (driveL + idleL) * econ.fuelPrice;
    return { netFare: netFare, driveL: driveL, idleL: idleL, fuelCost: fuelCost, net: netFare - fuelCost, accept: netFare - fuelCost > 0 };
  }

  var Engine = {
    mulberry32: mulberry32, clamp: clamp, gc: gc, randN: randN,
    ECON: ECON, SHIFT_MIN: SHIFT_MIN,
    ZONES: ZONES, BAND: BAND, OD: OD, PREF: PREF, CLASS_SPEED: CLASS_SPEED, GROUP_STAT: GROUP_STAT,
    CARD_A: CARD_A, CARD_B: CARD_B, CARD_C: CARD_C, FareCard: FareCard,
    def: def, isPeak: isPeak, nearestZone: nearestZone,
    buildEnv: buildEnv, offersByHour: offersByHour, offerRng: offerRng, subSeed: subSeed,
    drawOrigin: drawOrigin, drawDest: drawDest, destFor: destFor, surgeMult: surgeMult, fareAmount: fareAmount, moveToward: moveToward,
    zoneOfferRate: zoneOfferRate, estCycle: estCycle, netPerHour: netPerHour, surgeEstimate: surgeEstimate, copilotDecide: copilotDecide,
    runMode: runMode, simShift: simShift, baselineShift: baselineShift, copilotShift: copilotShift,
    simPaired: simPaired, summarizeShiftSet: summarizeShiftSet, summarizePairs: summarizePairs,
    checkLedger: checkLedger, finalizeLedger: finalizeLedger, reconcileAudit: reconcileAudit,
    mean: mean, stdev: stdev, percentile: percentile, bootstrapCI: bootstrapCI,
    totalsFor: totalsFor,
    liveSurgeEnv: liveSurgeEnv, zoneFor: zoneFor, relocationAnalysis: relocationAnalysis,
    liveRecommend: liveRecommend, tripNetEval: tripNetEval
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  global.Highlander = Engine;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));