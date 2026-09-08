/* =============================================================================
 * live-core.js — LIVE COPILOT MODE logic layer (bolt-gps-copilot)
 *
 * Advisory-only field layer used with a real driver. Pure logic: NO DOM access.
 * It orchestrates GPS, the shift state machine, field-event logging, local
 * persistence and exports, and calls the frozen economic engine (engine.js)
 * for every recommendation — no economic formulas live here.
 *
 * Loading order in the browser:  engine.js -> live-core.js -> live-ui.js.
 * Node-compatible (require('../engine.js')); injectable geolocation + storage
 * for the harness at audit/live-verify.js.
 *
 * Posture guarantees:
 *   - ECONOMIC ACTION always comes from engine.liveRecommend() (which calls the
 *     frozen copilotDecide). Nothing here decides economics.
 *   - Recommendations are timestamped BEFORE any driver action is recorded.
 *   - Actual vs SIMULATED field sessions are never mixed: a simulation feed
 *     marks the whole shift fieldMode='simulated' and is excluded from MTD and
 *     from ACTUAL exports unless the operator opts in.
 *   - No fabricated Bolt data; missing inputs are labelled MISSING, never
 *     silently treated as good data.
 * ============================================================================= */
(function (global) {
  'use strict';

  var H = (typeof require !== 'undefined') ? require('./engine.js') : global.Highlander;
  if (!H) throw new Error('live-core.js requires engine.js to be loaded first.');

  /* ------------------------------------------------------------- utilities -- */
  function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }
  function round1(x) { return Math.round(x * 10) / 10; }
  function round2(x) { return Math.round(x * 100) / 100; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function monthKey(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }
  function onlineMinutes(shift, nowMs) {
    if (!shift || !shift.startedAt) return 0;
    var endTs = (shift.status === 'ENDED' && shift.endedAt) ? shift.endedAt : nowMs;
    var on = endTs - shift.startedAt;
    var i, p;
    for (i = 0; i < (shift.paused || []).length; i++) {
      p = shift.paused[i];
      if (p.resumedAt) on -= p.resumedAt - p.pausedAt; else on -= endTs - p.pausedAt;
    }
    return Math.max(0, on);
  }

  /* ---------------------------------------------------------------- config -- */
  var DEFAULTS = {
    gpsIntervalSec: 30,
    staleAfterSec: 60,
    maxAccuracyM: 200,
    gpsTimeoutMs: 10000,
    tickSec: 30,
    persistDebounceMs: 300,
    maxGpsEvents: 400,
    monthTarget: 300000,
    shiftStartH: 6.5,
    shiftHours: 12,
    drivingSpeedKph: 8,
    rainOverride: false,
    eventOverride: false,
    includeSimulatedInExport: false
  };

  /* ================================================================ factory -- */
  function create(opts) {
    opts = opts || {};
    var config = {};
    var k;
    for (k in DEFAULTS) config[k] = DEFAULTS[k];
    for (k in opts) if (opts[k] !== undefined) config[k] = opts[k];

    var econ = H.def(config.econ || null);
    var geoProvider = opts.geolocation || (typeof global.navigator !== 'undefined' ? global.navigator.geolocation : null);

    /* ------------------------------------------------------------- state ---- */
    var state = {
      meta: { createdAt: Date.now() },
      gps: { status: 'UNSET', fix: null, lastError: null, prevFix: null },
      simActive: !!opts.simulate,
      shift: null,
      completed: null, /* set by restore() */
      offline: (typeof global.navigator !== 'undefined') ? !global.navigator.onLine : false,
      backend: null,
      lastRecTs: 0,
      rev: { gps: 0, shift: 0, ledger: 0, rec: 0, net: 0 }
    };
    if (typeof opts.simulate == 'object') config.simGps = opts.simulate; /* {lat,lng} debug seed */

    var listeners = {};
    function on(type, cb) { (listeners[type] = listeners[type] || []).push(cb); }
    function emit(type, payload) {
      var arr = listeners[type] || [], i;
      for (i = 0; i < arr.length; i++) { try { arr[i](payload); } catch (e) { /* subscriber errors never crash core */ } }
    }
    function bumped(which) { state.rev[which]++; emit('state', snapshot()); }

    /* -------------------------------------------------------- event logging -- */
    var gpsLogged = 0;
    function seqNum() { return (state.shift ? state.shift.seq || 0 : 0); }
    function pushEvent(type, payload) {
      if (!state.shift) return null;
      state.shift.seq = (state.shift.seq || 0) + 1;
      var evt = { seq: state.shift.seq, ts: Date.now(), type: type };
      var p;
      for (p in payload) if (payload[p] !== undefined && payload[p] !== null) evt[p] = payload[p];
      state.shift.events.push(evt);
      if (type === 'gps') {
        gpsLogged++;
        if (gpsLogged > config.maxGpsEvents) {
          /* thin: drop oldest gps events, keep the counters */
          var rm = 0, i;
          for (i = 0; i < state.shift.events.length && rm < gpsLogged - config.maxGpsEvents; i++) {
            if (state.shift.events[i].type === 'gps') { state.shift.events[i]._drop = true; rm++; }
          }
          state.shift.events = state.shift.events.filter(function (e) { return !e._drop; });
        }
      }
      schedulePersist();
      return evt;
    }

    /* ------------------------------------------------------------- storage -- */
    function detectBackend() {
      if (typeof global.indexedDB !== 'undefined' && global.indexedDB) return 'idb';
      if (typeof global.localStorage !== 'undefined') { try { global.localStorage.setItem('__hc_t', '1'); global.localStorage.removeItem('__hc_t'); return 'ls'; } catch (e) { return 'none'; } }
      return 'none';
    }
    function idbOpen() {
      return new Promise(function (res, rej) {
        var rq = global.indexedDB.open('highlander-live', 1);
        rq.onupgradeneeded = function () {
          var db = rq.result;
          if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv', { keyPath: 'key' });
        };
        rq.onsuccess = function () { res(rq.result); };
        rq.onerror = function () { rej(rq.error); };
      });
    }
    function idbRun(mode, fn) {
      return idbOpen().then(function (db) {
        return new Promise(function (res, rej) {
          var tx = db.transaction('kv', mode);
          var st = tx.objectStore('kv');
          fn(st);
          tx.oncomplete = function () { db.close(); res(); };
          tx.onerror = function () { db.close(); rej(tx.error); };
          tx.onabort = function () { db.close(); rej(tx.error); };
        });
      });
    }
    function idbGet(key) {
      return idbOpen().then(function (db) {
        return new Promise(function (res, rej) {
          var rq = db.transaction('kv', 'readonly').objectStore('kv').get(key);
          rq.onsuccess = function () { db.close(); res(rq.result ? rq.result.val : undefined); };
          rq.onerror = function () { db.close(); rej(rq.error); };
        });
      });
    }
    var kvGet, kvSet, kvDel;
    if (opts.inMemoryStore) {
      var mem = opts.inMemoryStore;
      kvGet = function (k) { return Promise.resolve(mem.data[k] !== undefined ? JSON.parse(mem.data[k]) : undefined); };
      kvSet = function (k, v) { mem.data[k] = JSON.stringify(v); mem.lastWrites = mem.lastWrites || []; mem.lastWrites.push(k); return Promise.resolve(); };
      kvDel = function (k) { delete mem.data[k]; return Promise.resolve(); };
      state.backend = 'memory';
    } else if (detectBackend() === 'idb') {
      kvGet = function (k) { return idbGet(k).then(function (s) { return s === undefined ? undefined : (typeof s === 'string' ? JSON.parse(s) : s); }); };
      kvSet = function (k, v) { return idbRun('readwrite', function (st) { st.put({ key: k, val: JSON.stringify(v) }); }); };
      kvDel = function (k) { return idbRun('readwrite', function (st) { st.delete(k); }); };
      state.backend = 'idb';
    } else if (detectBackend() === 'ls') {
      kvGet = function (k) { try { var raw = global.localStorage.getItem('hc:' + k); return Promise.resolve(raw ? JSON.parse(raw) : undefined); } catch (e) { return Promise.resolve(undefined); } };
      kvSet = function (k, v) { try { global.localStorage.setItem('hc:' + k, JSON.stringify(v)); } catch (e) { /* quota */ } return Promise.resolve(); };
      kvDel = function (k) { try { global.localStorage.removeItem('hc:' + k); } catch (e) { /* noop */ } return Promise.resolve(); };
      state.backend = 'ls';
    } else {
      kvGet = function () { return Promise.resolve(undefined); };
      kvSet = function () { return Promise.resolve(); };
      kvDel = function () { return Promise.resolve(); };
      state.backend = 'none';
    }

    var pendingPersist = null;
    function persistNow() {
      pendingPersist = null;
      var jobs = [kvSet('meta', { config: savedConfig(), createdAt: state.meta.createdAt })];
      if (state.shift) jobs.push(kvSet('liveShift', state.shift));
      else jobs.push(kvDel('liveShift').catch(function () { return null; }));
      if (state.completed !== null) jobs.push(kvSet('completed', state.completed));
      /* returns a promise; callers may ignore (fire-and-forget with debounce) */
      return Promise.all(jobs).catch(function () { /* offline persistence not available */ });
    }
    function schedulePersist() {
      if (pendingPersist) clearTimeout(pendingPersist);
      pendingPersist = setTimeout(persistNow, config.persistDebounceMs || 0);
    }
    function restore() {
      var keepShift = state.shift; /* in-memory override always wins */
      return Promise.all([kvGet('meta'), kvGet('liveShift'), kvGet('completed')]).then(function (rs) {
        var meta = rs[0], liveShift = rs[1], completed = rs[2];
        if (meta && meta.config) for (k in meta.config) if (config[k] !== undefined && meta.config[k] !== undefined) config[k] = meta.config[k];
        if (meta) state.meta.createdAt = meta.createdAt || state.meta.createdAt;
        state.completed = (completed && completed.length) ? completed : [];
        if (keepShift) { state.shift = keepShift; }
        else if (liveShift) {
          state.shift = liveShift;
          if (liveShift.status === 'ONLINE') {
            liveShift.status = 'PAUSED';
            liveShift.paused = liveShift.paused || [];
            liveShift.paused.push({ pausedAt: Date.now(), interrupted: true, resumedAt: null });
            pushEvent('shift_pause', { note: 'INTERRUPTED (browser closed/reloaded)' });
          } else if (liveShift.status === 'ENDED') {
            archiveShift(liveShift);
            state.shift = null;
          }
        }
        bump();
        return snapshot();
      });
    }
    function savedConfig() {
      return {
        gpsIntervalSec: config.gpsIntervalSec, staleAfterSec: config.staleAfterSec, maxAccuracyM: config.maxAccuracyM,
        tickSec: config.tickSec, rainOverride: config.rainOverride, eventOverride: config.eventOverride
      };
    }

    /* ------------------------------------------------------------- GPS ------ */
    var gpsTimer = null;
    function setGps(status, err) {
      state.gps.status = status;
      if (err) state.gps.lastError = err;
      bumped('gps');
    }
    function acceptFix(fix) {
      var prev = state.gps.fix;
      state.gps.prevFix = prev;
      state.gps.fix = fix;
      state.gps.status = 'LIVE';
      if (fix.source === 'simulated') state.gps.lastError = null;
      /* GPS event thinning: log a fix when significant (moved >100m) or on a
         slow cadence, to bound the log while keeping a usable trace. */
      var logIt = !prev || fix.source === 'simulated' ||
        H.gc({ lat: prev.lat, lng: prev.lng }, { lat: fix.lat, lng: fix.lng }) > 0.1 ||
        (fix.ts - (prev.ts || 0)) > 90000;
      if (logIt || gpsLogged === 0) pushEvent('gps', { lat: round2(fix.lat), lng: round2(fix.lng), accuracy: fix.accuracy != null ? Math.round(fix.accuracy) : null, speed: fix.speed != null ? round1(fix.speed) : null, source: fix.source });
      if (state.shift && state.shift.status === 'ONLINE' && !state.shift.gps.initial && fix.source !== 'simulated') {
        state.shift.gps.initial = fix;
      }
      bumped('gps');
    }
    function estimateSpeed(fix, prev) {
      if (fix.speed != null) return fix.speed;
      if (prev && prev.ts && fix.ts - prev.ts > 3000 && fix.ts - prev.ts < 60000) {
        var km = H.gc({ lat: prev.lat, lng: prev.lng }, { lat: fix.lat, lng: fix.lng });
        return km / (fix.ts - prev.ts) * 3600000;
      }
      return 0;
    }
    function pollNow() {
      if (!geoProvider || !geoProvider.getCurrentPosition) { setGps('UNAVAILABLE', { code: -1, message: 'Geolocation API not available on this device/browser.' }); return; }
      var priorStatus = state.gps.status;
      setGps('REQUESTING', state.gps.lastError);
      var t0 = Date.now();
      geoProvider.getCurrentPosition(function (pos) {
        if (Date.now() - t0 > config.gpsTimeoutMs * 4) return; /* result after abort */
        var c = pos.coords || {};
        var fix = {
          lat: c.latitude, lng: c.longitude, accuracy: c.accuracy != null ? c.accuracy : null,
          speed: c.speed != null ? c.speed : null, heading: c.heading != null ? c.heading : null,
          ts: Date.now(), source: 'gps'
        };
        if (config.maxAccuracyM && fix.accuracy != null && fix.accuracy > config.maxAccuracyM) {
          fix.lowAccuracy = true;
          state.gps.lastError = { code: 0, message: 'Low accuracy (' + Math.round(fix.accuracy) + 'm > ' + config.maxAccuracyM + 'm)' };
        } else {
          state.gps.lastError = null;
        }
        acceptFix(fix);
      }, function (err) {
        var code = err && (err.code !== undefined && err.code !== null) ? err.code : 0;
        if (code === 1) {
          var revoked = priorStatus === 'LIVE' || priorStatus === 'STALE';
          setGps('DENIED', { code: 1, message: 'Permission denied' + (revoked ? ' / revoked' : ''), revoked: revoked });
        } else if (code === 2) {
          setGps('UNAVAILABLE', { code: 2, message: 'Position unavailable' });
        } else { /* 3 = timeout */
          if (state.gps.fix) setGps('STALE', { code: 3, message: 'GPS timeout — showing last fix (age ' + Math.round((Date.now() - state.gps.fix.ts) / 1000) + 's)' });
          else setGps('UNAVAILABLE', { code: 3, message: 'GPS timeout — no fix yet' });
        }
      }, { enableHighAccuracy: false, timeout: config.gpsTimeoutMs, maximumAge: 0 });
    }
    function currentFix() {
      var fix = state.gps.fix;
      if (fix && state.gps.status !== 'DENIED') return fix;
      return null;
    }
    function gpsStart() {
      if (gpsTimer) return;
      pollNow();
      gpsTimer = setInterval(pollNow, config.gpsIntervalSec * 1000);
    }
    function gpsStop() { if (gpsTimer) { clearInterval(gpsTimer); gpsTimer = null; } }

    /* simulated GPS (lab/testing only) — shift becomes fieldMode='simulated' */
    function simGpsFeed(lat, lng, acc) {
      state.simActive = true;
      acceptFix({ lat: lat, lng: lng, accuracy: acc != null ? acc : 15, speed: 0, ts: Date.now(), source: 'simulated' });
    }
    function simGpsClear() { state.simActive = false; }

    /* ----------------------------------------------------------- decision ---- */
    function trailingNetForShift() { return null; /* MISSING: fuel cannot be allocated per trip from lumpy manual entries (documented limitation) */ }
    function scanZoneChips(n) {
      var fix = currentFix(), i, list = [];
      if (!fix) return list;
      for (i = 0; i < H.ZONES.length; i++) {
        list.push({ z: H.ZONES[i], d: H.gc({ lat: fix.lat, lng: fix.lng }, H.ZONES[i]) });
      }
      list.sort(function (a, b) { return a.d - b.d; });
      return list.slice(0, n || 4).map(function (r) { return r.z.n; });
    }
    function recommend(nowMs) {
      nowMs = nowMs || Date.now();
      state.lastRecTs = nowMs;
      var fix = currentFix();
      var fail = { ok: false, rec: null };
      if (!fix) { emit('notice', { code: 'NO_GPS', text: 'Waiting for a GPS fix before advising.' }); return fail; }
      if (!state.shift || state.shift.status !== 'ONLINE') { emit('notice', { code: 'NO_SHIFT', text: 'Start a shift before receiving live advice.' }); return fail; }

      var d = new Date(nowMs);
      var env = H.liveSurgeEnv(d, { rain: !!config.rainOverride, event: !!config.eventOverride });
      var hour = d.getHours() + d.getMinutes() / 60;
      var t = clamp(onlineMinutes(state.shift, nowMs) / 60000, 0, H.SHIFT_MIN - 0.01);
      var sim = {
        t: t, hour: hour, loc: { lat: fix.lat, lng: fix.lng },
        fuelSet: state.shift.currentFuelL != null, fuel: state.shift.currentFuelL
      };
      var rec = H.liveRecommend(sim, env, econ, trailingNetForShift());
      var zv = H.zoneFor({ lat: fix.lat, lng: fix.lng });
      var outside = !zv.inside;
      var kind = rec.action === 'END' ? 'END_SHIFT'
        : rec.action === 'REPOSITION' ? 'RELOCATE'
        : rec.action === 'CONSERVE' ? 'CONSERVE'
        : 'STAY';
      var displayKind = kind;
      if (kind === 'STAY' && !outside && rec.stay.evPerHr != null && rec.stay.evPerHr < 300) displayKind = 'WAIT';
      if (outside) {
        kind = 'STAY'; displayKind = 'STAY';
        rec = null; /* discard engine economics for unknown geography */
      }
      var seq = state.shift.seq || 0;
      var recId = 'R' + (seq + 1);
      var entry = {
        recId: recId, ts: nowMs, kind: displayKind,
        zone: outside ? 'UNMAPPED' : (fix.source === 'simulated' ? 'SIM-GPS' : ''),
        zoneName: outside ? 'OUTSIDE MODELED ZONES' : zv.zone.n,
        zoneDistanceKm: zv.distanceKm, insideZone: !outside,
        fixSource: fix.source, gpsStatus: state.gps.status,
        inputs: outside ? { gps: fix.source === 'simulated' ? 'SIMULATED' : 'LIVE', demand: '—', surge: '—', fuel: '—', trailing: '—', traffic: '—', boltOffer: '—' } : rec.inputs
      };
      if (outside) {
        entry.note = 'OUTSIDE MODELED ZONES — observe and stay safe. No modelled ₦/hr exists here; do not estimate earnings.';
        entry.expectedLabel = null; entry.evPerHr = null; entry.stay = { zone: '—', evPerHr: null }; entry.remainingH = round1(clamp(H.SHIFT_MIN - t, 0, H.SHIFT_MIN) / 60);
      } else {
        entry.note = rec.note;
        entry.evPerHr = rec.evPerHr;
        entry.expectedLabel = rec.evPerHr != null ? '₦' + Math.round(rec.evPerHr).toLocaleString('en-GB') + '/hr' : '—';
        entry.stay = rec.stay;
        entry.remainingH = rec.remainingH;
        entry.relocation = (rec.action === 'REPOSITION' && rec.bestReloc) ? {
          target: rec.bestReloc.zone, km: rec.bestReloc.km, min: rec.bestReloc.min,
          fuelCost: rec.bestReloc.fuelCost, netAdvantage: rec.netAdvantage, evPerHrAtTarget: rec.bestReloc.evPerHr
        } : null;
        entry.engineNote = kind === 'CONSERVE' ? (state.shift.currentFuelL != null && state.shift.currentFuelL < econ.conserveFuelL ? 'Fuel reserve (' + econ.conserveFuelL + ' L) — engine off only when safely parked.' : 'Idle guidance — engine off only when safely parked.') : null;
      }
      state.shift.recommendations.push(entry);
      pushEvent('recommendation', {
        recId: recId, kind: entry.kind, zone: entry.zoneName, note: entry.note,
        evPerHr: entry.evPerHr != null ? Math.round(entry.evPerHr) : null,
        relocationTarget: entry.relocation ? entry.relocation.target : null
      });
      bumped('rec');
      bumped('shift');
      return { ok: true, rec: entry };
    }

    /* -------------------------------------------------------------- shifts -- */
    function archiveShift(shift) {
      /* archive summary used for MTD + history (ACTUAL only contributes) */
      var sum = summaryOf(shift);
      state.completed = state.completed || [];
      state.completed.push(sum);
      if (state.completed.length > 400) state.completed = state.completed.slice(state.completed.length - 400);
      schedulePersist();
    }
    function startShift(meta) {
      meta = meta || {};
      if (state.shift && state.shift.status === 'ONLINE') return { ok: false, code: 'ALREADY_ONLINE' };
      var fix = currentFix();
      var fieldMode = state.simActive ? 'simulated' : 'actual';
      state.shift = {
        id: 'LV-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 46656).toString(36),
        status: 'ONLINE', fieldMode: fieldMode,
        startedAt: Date.now(), endedAt: null,
        paused: [], seq: 0, events: [],
        recommendations: [], actions: [], offers: [], trips: [], fuelEntries: [],
        odometerEntries: [], engineEvents: [], relocEvents: [],
        gps: { initial: (fix && fix.source === 'gps') ? fix : (meta.gpsSnapshot || fix || null), observations: 0 },
        startMeta: { odometer: meta.odometer != null ? meta.odometer : null, fuelL: meta.fuelL != null ? meta.fuelL : null },
        endMeta: {},
        currentFuelL: meta.fuelL != null ? meta.fuelL : null,
        relocInProgress: null, driving: { on: false, since: null },
        runningTotals: { gross: 0, fuelCost: 0 }
      };
      state.lastRecTs = 0;
      pushEvent('shift_start', { fieldMode: fieldMode, odometer: state.shift.startMeta.odometer, fuelL: state.shift.startMeta.fuelL });
      bump();
      return { ok: true, shift: state.shift };
    }
    function pause() {
      if (!state.shift || state.shift.status !== 'ONLINE') return { ok: false };
      state.shift.status = 'PAUSED';
      state.shift.paused.push({ pausedAt: Date.now(), resumedAt: null });
      pushEvent('shift_pause', {});
      bump();
      return { ok: true };
    }
    function resume() {
      if (!state.shift || state.shift.status !== 'PAUSED') return { ok: false };
      var last = state.shift.paused[state.shift.paused.length - 1];
      if (last && last.resumedAt == null) last.resumedAt = Date.now();
      state.shift.status = 'ONLINE';
      pushEvent('shift_resume', {});
      bump();
      return { ok: true };
    }
    function endShift(meta) {
      meta = meta || {};
      if (!state.shift) return { ok: false, code: 'NO_SHIFT' };
      var sh = state.shift;
      sh.status = 'ENDED';
      sh.endedAt = Date.now();
      var fix = currentFix();
      if (fix && fix.source === 'gps') sh.gps.final = fix;
      sh.endMeta = {
        odometer: meta.odometer != null ? meta.odometer : (sh.odometerEntries.length ? sh.odometerEntries[sh.odometerEntries.length - 1].value : null),
        fuelCost: runningFuelCost(), petrolL: null
      };
      var ld = computeLedgerInternal(sh);
      pushEvent('shift_end', { odometer: sh.endMeta.odometer, netAfterFuel: ld.netAfterFuel, gross: ld.gross, petrol: ld.petrol });
      archiveShift(sh);
      var ended = sh;
      state.shift = null;
      bump();
      return { ok: true, ledger: ld, shift: ended };
    }

    /* ------------------------------------------------------------- trips ---- */
    function currentZoneName() {
      var fix = currentFix();
      if (!fix) return null;
      return H.zoneFor({ lat: fix.lat, lng: fix.lng }).inside ? H.zoneFor({ lat: fix.lat, lng: fix.lng }).zone.n : null;
    }
    function defaultPickupKm() {
      var fix = currentFix();
      if (!fix) return 1.2;
      var z = H.zoneFor({ lat: fix.lat, lng: fix.lng });
      return H.ZONES.reduce(function (acc, zz) { return Math.min(acc, H.gc({ lat: fix.lat, lng: fix.lng }, zz)); }, 1e9);
    }
    function tripOffer(o) {
      if (!state.shift) return { ok: false, code: 'NO_SHIFT' };
      o = o || {};
      var now = Date.now();
      var paidKm = o.estKm != null ? o.estKm : (o.pickupZone && o.dropoffZone ? H.gc(pt(o.pickupZone), pt(o.dropoffZone)) : defaultPaidKmForZone(o.pickupZone));
      var pickupKm = o.pickupKm != null ? o.pickupKm : defaultPickupKm();
      var speed = H.CLASS_SPEED['intra-core'] ? (H.CLASS_SPEED['intra-core'].ff + H.CLASS_SPEED['intra-core'].pk) / 2 : 30;
      var cycleMin = o.estMin != null ? o.estMin : (paidKm / speed * 60 + 3);
      var evalOut = H.tripNetEval({ fare: o.fare || 0, pickupKm: pickupKm, paidKm: paidKm, cycleMin: cycleMin }, econ);
      var offer = {
        offerId: 'O' + ((state.shift.seq || 0) + 1), ts: now, status: 'pending', outcome: null,
        fare: o.fare != null ? o.fare : null, pickupKm: round1(pickupKm), paidKm: round1(paidKm),
        rideMin: round1(cycleMin), pickupZone: o.pickupZone || currentZoneName(), dropoffZone: o.dropoffZone || null,
        recommendation: evalOut.accept ? 'ACCEPT' : 'DECLINE',
        netEval: { net: round1(evalOut.net), netFare: round1(evalOut.netFare), fuelCost: Math.round(evalOut.fuelCost) }
      };
      state.shift.offers.push(offer);
      pushEvent('trip_offer', { offerId: offer.offerId, fare: offer.fare, pickupKm: offer.pickupKm, paidKm: offer.paidKm, rideMin: offer.rideMin, pickupZone: offer.pickupZone, dropoffZone: offer.dropoffZone, recommendation: offer.recommendation, net: offer.netEval.net });
      bump();
      return { ok: true, offer: offer };
    }
    function pt(zoneName) {
      for (var i = 0; i < H.ZONES.length; i++) if (H.ZONES[i].n === zoneName) return H.ZONES[i];
      return H.ZONES[0];
    }
    function defaultPaidKmForZone(zoneName) {
      var z = pt(zoneName);
      return H.GROUP_STAT[z.gr] ? round1(H.GROUP_STAT[z.gr].paidKm) : 8;
    }
    function tripOutcome(o) {
      if (!state.shift || !o || !o.offerId) return { ok: false };
      var offer = null, i;
      for (i = state.shift.offers.length - 1; i >= 0; i--) if (state.shift.offers[i].offerId === o.offerId) { offer = state.shift.offers[i]; break; }
      if (!offer || offer.status !== 'pending') return { ok: false, code: 'OFFER_NOT_PENDING' };
      offer.status = 'closed';
      offer.outcome = o.outcome;
      offer.outcomeTs = Date.now();
      var trip = null;
      if (o.outcome === 'accepted') {
        var fare = o.actualFare != null ? o.actualFare : (offer.fare != null ? offer.fare : 0);
        var paidKm = o.actualKm != null ? o.actualKm : offer.paidKm;
        var rideMin = o.actualMin != null ? o.actualMin : offer.rideMin;
        var pickupKm = offer.pickupKm;
        var pickupZone = o.pickupZone || offer.pickupZone || currentZoneName();
        var dropoffZone = o.dropoffZone || offer.dropoffZone || null;
        var ev = H.tripNetEval({ fare: fare, pickupKm: pickupKm, paidKm: paidKm, cycleMin: rideMin }, econ);
        trip = {
          ts: offer.ts, offerId: offer.offerId, status: 'completed',
          fare: round1(fare), commission: round1(fare * econ.comm), afterComm: round1(fare - round1(fare * econ.comm)),
          paidKm: round1(paidKm), pickupKm: round1(pickupKm), totalKm: round1(paidKm + pickupKm),
          rideMin: round1(rideMin), pickupZone: pickupZone, dropoffZone: dropoffZone,
          gross: round1(fare),
          fuelCostEst: Math.round(ev.fuelCost),
          netAfterFuel: round1(ev.net)
        };
        state.shift.trips.push(trip);
        state.shift.runningTotals.gross = round1((state.shift.runningTotals.gross || 0) + fare);
      }
      pushEvent('trip_outcome', { offerId: offer.offerId, outcome: o.outcome, actualFare: o.actualFare != null ? o.actualFare : null, actualKm: o.actualKm != null ? o.actualKm : null, actualMin: o.actualMin != null ? o.actualMin : null });
      bump();
      return { ok: true, trip: trip, outcome: o.outcome };
    }

    /* --------------------------------------------------------- driver action -- */
    function action(a) {
      if (!state.shift || !a || !a.recId) return { ok: false };
      var rec = null, i;
      for (i = state.shift.recommendations.length - 1; i >= 0; i--) if (state.shift.recommendations[i].recId === a.recId) { rec = state.shift.recommendations[i]; break; }
      if (!rec) return { ok: false, code: 'NO_REC' };
      var choice = a.choice === 'follow' ? 'follow' : 'override';
      var entry = { recId: a.recId, ts: Date.now(), choice: choice, reason: a.reason || (choice === 'override' ? 'OTHER' : null) };
      state.shift.actions.push(entry);
      pushEvent('driver_action', { recId: entry.recId, choice: entry.choice, reason: entry.reason });
      bump();
      return { ok: true, action: entry };
    }

    /* ---------------------------------------------------------- other fields -- */
    function fuel(p) {
      if (!state.shift) return { ok: false };
      p = p || {};
      var entry = { ts: Date.now(), cost: p.cost != null ? round1(p.cost) : null, litres: p.litres != null ? round1(p.litres) : null };
      state.shift.fuelEntries.push(entry);
      state.shift.runningTotals.fuelCost = round1((state.shift.runningTotals.fuelCost || 0) + (entry.cost || 0));
      if (p.setFuelL !== undefined) state.shift.currentFuelL = p.setFuelL;
      pushEvent('fuel', { cost: entry.cost, litres: entry.litres, currentFuelL: state.shift.currentFuelL });
      bump();
      return { ok: true };
    }
    function odometer(p) {
      if (!state.shift) return { ok: false };
      state.shift.odometerEntries.push({ ts: Date.now(), phase: p.phase || 'check', value: p.value });
      pushEvent('odometer', { phase: p.phase || 'check', value: p.value });
      bump();
      return { ok: true };
    }
    function engine(p) {
      if (!state.shift) return { ok: false };
      state.shift.engineEvents.push({ ts: Date.now(), state: p.state });
      pushEvent('engine', { state: p.state });
      bump();
      return { ok: true };
    }
    function relocateStart(p) {
      if (!state.shift) return { ok: false };
      state.shift.relocInProgress = { ts: Date.now(), toZone: p.toZone || currentZoneName(), km: p.km != null ? p.km : null, min: p.min != null ? p.min : null };
      pushEvent('relocate_start', { toZone: state.shift.relocInProgress.toZone, km: state.shift.relocInProgress.km, min: state.shift.relocInProgress.min });
      bump();
      return { ok: true };
    }
    function relocateComplete() {
      if (!state.shift || !state.shift.relocInProgress) return { ok: false };
      var r = state.shift.relocInProgress;
      r.completedTs = Date.now();
      state.shift.relocEvents.push(r);
      state.shift.relocInProgress = null;
      pushEvent('relocate_complete', { toZone: r.toZone, km: r.km, min: r.min });
      bump();
      return { ok: true };
    }
    function setDriving(on) {
      if (!state.shift) return { ok: false };
      if (state.shift.driving.on !== !!on) {
        state.shift.driving.on = !!on;
        state.shift.driving.since = Date.now();
        pushEvent('driving_mode', { on: !!on });
        bump();
      }
      return { ok: true };
    }

    /* --------------------------------------------------------------- ledger -- */
    function computeLedgerInternal(sh) {
      var gross = 0, i, t;
      for (i = 0; i < sh.trips.length; i++) gross += sh.trips[i].fare;
      var commission = round1(gross * econ.comm);
      var revenue = round1(gross - commission);
      var petrol = 0;
      for (i = 0; i < sh.fuelEntries.length; i++) petrol += sh.fuelEntries[i].cost || 0;
      petrol = round1(petrol);
      var net = round1(revenue - petrol);
      var paidKm = 0;
      for (i = 0; i < sh.trips.length; i++) paidKm += sh.trips[i].paidKm;
      var relocKm = 0, pickupKm = 0;
      for (i = 0; i < sh.relocEvents.length; i++) relocKm += sh.relocEvents[i].km || 0;
      for (i = 0; i < sh.trips.length; i++) pickupKm += sh.trips[i].pickupKm;
      var odoStart = null, odoEnd = null;
      for (i = 0; i < sh.odometerEntries.length; i++) { if (sh.odometerEntries[i].phase === 'start') odoStart = sh.odometerEntries[i].value; if (sh.odometerEntries[i].phase === 'end') odoEnd = sh.odometerEntries[i].value; }
      var odoTotal = (odoStart != null && odoEnd != null) ? (odoEnd - odoStart)
        : (sh.startMeta.odometer != null && sh.endMeta.odometer != null) ? (sh.endMeta.odometer - sh.startMeta.odometer)
        : null;
      var totalKm = round1((odoTotal != null && odoTotal >= 0) ? odoTotal : (paidKm + pickupKm + relocKm));
      var unpaidKm = round1(Math.max(0, totalKm - paidKm));
      var onlineMin = round1(onlineMinutes(sh, sh.endedAt || Date.now()) / 60000);
      var rideMin = 0;
      for (i = 0; i < sh.trips.length; i++) rideMin += sh.trips[i].rideMin;
      var idleMin = round1(Math.max(0, onlineMin - rideMin));
      var onlineH = onlineMin / 60;
      var ledger = {
        shiftId: sh.id, fieldMode: sh.fieldMode, status: sh.status,
        riderGross: round1(gross), boltCommission: commission, driverRevenue: revenue,
        petrolCost: petrol, netAfterFuel: net,
        totalKm: totalKm, paidKm: round1(paidKm), unpaidKm: unpaidKm,
        trips: sh.trips.length, onlineMin: onlineMin, idleMin: idleMin,
        netPerHour: onlineH > 0 ? round1(net / onlineH) : null,
        netPerKm: totalKm > 0 ? round2(net / totalKm) : null,
        fuelPerKm: totalKm > 0 ? round2(petrol / totalKm) : null,
        completeness: (odoStart != null && odoEnd != null && sh.trips.length > 0 && petrol > 0) ? 'ACTUAL' : 'PARTIAL',
        invariantOk: (Math.abs(gross - commission - revenue) <= 0.11) && (Math.abs(revenue - petrol - net) <= 0.11) && (Math.abs(totalKm - paidKm - unpaidKm) <= 0.11)
      };
      return ledger;
    }
    function computeLedger() {
      if (!state.shift) return null;
      return computeLedgerInternal(state.shift);
    }

    function mtd() {
      var now = Date.now(), key = monthKey(now);
      var act = [], i;
      for (i = 0; i < (state.completed || []).length; i++) {
        var s = state.completed[i];
        if (s.fieldMode === 'actual' && monthKey(s.endedAt) === key) act.push(s);
      }
      var netSum = 0, cnt = act.length;
      for (i = 0; i < act.length; i++) netSum += act[i].netAfterFuel;
      var lastNet = cnt ? act[act.length - 1].netAfterFuel : null;
      return {
        monthKey: key, shiftCount: cnt, actualNetSum: round1(netSum),
        paceEstimate: lastNet != null ? round1(lastNet * 26) : null,
        target: config.monthTarget,
        labels: { pace: 'PACE ESTIMATE', actual: 'ACTUAL MONTH-TO-DATE NET_AFTER_FUEL' },
        simulatedSessionsExcluded: true
      };
    }

    /* -------------------------------------------------------------- exports -- */
    function summaryOf(sh) {
      var ld = computeLedgerInternal(sh);
      return {
        shiftId: sh.id, fieldMode: sh.fieldMode, startedAt: sh.startedAt, endedAt: sh.endedAt || Date.now(),
        netAfterFuel: ld.netAfterFuel, gross: ld.riderGross, petrol: ld.petrolCost,
        trips: sh.trips.length, onlineMin: ld.onlineMin, totalKm: ld.totalKm, paidKm: ld.paidKm, unpaidKm: ld.unpaidKm,
        idleMin: ld.idleMin, invariantOk: ld.invariantOk
      };
    }
    function exportJSON() {
      if (!state.shift) return null;
      return JSON.stringify({
        schemaVersion: 1, exportedAt: new Date().toISOString(), exportKind: 'LIVE_SHIFT',
        dataKind: state.shift.fieldMode === 'simulated' ? 'SIMULATED' : 'ACTUAL',
        shift: state.shift, ledger: computeLedgerInternal(state.shift), mtd: mtd()
      }, null, 2);
    }
    function exportCSV() {
      if (!state.shift) return null;
      var cols = ['seq', 'type', 'ts', 'iso', 'zone', 'kind', 'evPerHr', 'relocTarget', 'relocKm', 'relocMin', 'fuelCost', 'netAdvantage', 'choice', 'reason', 'fare', 'pickupZone', 'dropoffZone', 'outcome', 'actualFare', 'actualKm', 'petrolCost', 'litres', 'odometer', 'engine', 'note'];
      function esc(v) { if (v == null) return ''; var s = String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
      var lines = [cols.join(',')];
      var i, e;
      for (i = 0; i < state.shift.events.length; i++) {
        e = state.shift.events[i];
        var row = [
          e.seq, e.type, e.ts, new Date(e.ts).toISOString(),
          e.zone, e.kind, e.evPerHr, e.relocationTarget, e.relocKm || (e.km != null ? e.km : null), e.relocMin || (e.min != null ? e.min : null),
          e.fuelCost, e.netAdvantage, e.choice, e.reason, e.fare, e.pickupZone, e.dropoffZone, e.outcome, e.actualFare, e.actualKm,
          e.cost, e.litres, e.odometer || e.value, e.state, e.note
        ];
        lines.push(row.map(esc).join(','));
      }
      var ld = computeLedgerInternal(state.shift);
      lines.push('');
      lines.push('# LEDGER ' + state.shift.id + ' (' + (state.shift.fieldMode === 'simulated' ? 'SIMULATED' : 'ACTUAL') + ')');
      var fields = [
        ['RIDER_GROSS', ld.riderGross], ['BOLT_COMMISSION', ld.boltCommission], ['DRIVER_REVENUE', ld.driverRevenue],
        ['PETROL_COST', ld.petrolCost], ['NET_AFTER_FUEL', ld.netAfterFuel],
        ['TOTAL_KM', ld.totalKm], ['PAID_KM', ld.paidKm], ['UNPAID_KM', ld.unpaidKm],
        ['TRIPS', ld.trips], ['ONLINE_MIN', ld.onlineMin], ['IDLE_MIN', ld.idleMin],
        ['NET_PER_HOUR', ld.netPerHour], ['NET_PER_KM', ld.netPerKm], ['FUEL_COST_PER_KM', ld.fuelPerKm],
        ['COMPLETENESS', ld.completeness], ['INVARIANT_OK', ld.invariantOk]
      ];
      for (i = 0; i < fields.length; i++) lines.push(fields[i][0] + ',' + esc(fields[i][1]));
      lines.push('MTD_MONTH_KEY,' + mtd().monthKey);
      lines.push('MTD_ACTUAL_NET_AFTER_FUEL,' + esc(mtd().actualNetSum));
      return lines.join('\n');
    }
    function wipe() {
      /* privacy: delete all locally stored shift data */
      return Promise.all([kvDel('liveShift'), kvDel('completed'), kvDel('meta')]).then(function () {
        state.shift = null; state.completed = []; bump(); return { ok: true };
      });
    }

    /* --------------------------------------------------------------- clock --- */
    function updateStaleness(nowMs) {
      var g = state.gps;
      if ((g.status === 'LIVE' || g.status === 'STALE') && g.fix && g.fix.source !== 'simulated') {
        var age = (nowMs - g.fix.ts) / 1000;
        if (age > config.staleAfterSec && g.status === 'LIVE') { g.status = 'STALE'; bumped('gps'); }
        if (age > config.staleAfterSec * 8 && g.status === 'STALE') { /* keep STALE; age shown in UI */ }
      }
    }
    function tick(nowMs) {
      nowMs = nowMs || Date.now();
      updateStaleness(nowMs);
      if (state.gps.fix && state.gps.prevFix) {
        var spd = estimateSpeed(state.gps.fix, state.gps.prevFix);
        if (state.shift && spd > config.drivingSpeedKph && !state.shift.driving.on) setDriving(true);
        if (state.shift && spd <= config.drivingSpeedKph && state.shift.driving.on) { state.shift.driving.on = false; state.shift.driving.since = Date.now(); pushEvent('driving_mode', { on: false }); bumped('shift'); }
      }
      if (state.shift && state.shift.status === 'ONLINE' && (nowMs - state.lastRecTs) >= config.tickSec * 1000 && currentFix()) {
        recommend(nowMs);
      }
      return snapshot();
    }
    function runningFuelCost() { return state.shift ? state.shift.runningTotals.fuelCost || 0 : 0; }

    function bump() {
      bumped('shift'); state.rev.ledger++; emit('ledger', ledgerSnapshot());
    }
    function ledgerSnapshot() {
      return { ledger: computeLedger(), mtd: mtd(), shiftStatus: state.shift ? state.shift.status : 'IDLE', rev: state.rev.ledger };
    }
    function snapshot() {
      var sh = state.shift;
      return {
        backend: state.backend, offline: state.offline, simActive: state.simActive,
        gps: {
          status: state.gps.status, fix: state.gps.fix, lastError: state.gps.lastError,
          ageSec: state.gps.fix ? Math.round((Date.now() - state.gps.fix.ts) / 1000) : null,
          lowAccuracy: state.gps.fix ? !!state.gps.fix.lowAccuracy : false
        },
        shift: sh ? {
          id: sh.id, status: sh.status, fieldMode: sh.fieldMode, startedAt: sh.startedAt, endedAt: sh.endedAt,
          onlineMin: Math.round(onlineMinutes(sh, Date.now()) / 6000) / 10,
          currentFuelL: sh.currentFuelL, driving: sh.driving,
          lastRec: sh.recommendations.length ? sh.recommendations[sh.recommendations.length - 1] : null,
          recsCount: sh.recommendations.length, tripsCount: sh.trips.length, offersCount: sh.offers.length,
          actionsCount: sh.actions.length, recentZones: scanZoneChips(4)
        } : null,
        ledger: computeLedger(), mtd: mtd(),
        rev: state.rev
      };
    }
    function setOffline(o) { state.offline = !!o; bumped('net'); }

    if (typeof global.navigator !== 'undefined' && global.navigator.addEventListener) {
      global.addEventListener('offline', function () { setOffline(true); });
      global.addEventListener('online', function () { setOffline(false); });
    }
    if (typeof global.document !== 'undefined' && global.document.visibilityState !== undefined) {
      global.document.addEventListener('visibilitychange', function () {
        if (global.document.hidden) { persistNow(); gpsStop(); }
        else { if (state.shift) pollNow(); gpsStart(); }
      });
      global.addEventListener('pagehide', function () { persistNow(); });
    }

    return {
      version: 1, config: config, econ: econ,
      on: on, snapshot: snapshot, tick: tick, restore: restore, wipe: wipe, flush: persistNow,
      gps: { start: gpsStart, stop: gpsStop, pollNow: pollNow, requestPermission: pollNow },
      simGps: { feed: simGpsFeed, clear: simGpsClear },
      shift: { start: startShift, pause: pause, resume: resume, end: endShift },
      rec: { recommend: recommend, tripOffer: tripOffer, tripOutcome: tripOutcome, action: action },
      field: { fuel: fuel, odometer: odometer, engine: engine, relocateStart: relocateStart, relocateComplete: relocateComplete, setDriving: setDriving },
      ledger: { compute: computeLedger, mtd: mtd },
      export: { json: exportJSON, csv: exportCSV },
      helpers: { monthKey: monthKey, zoneFor: H.zoneFor, zones: H.ZONES, currentZoneName: currentZoneName, scanZoneChips: scanZoneChips }
    };
  }

  var LiveCore = { create: create, VERSION: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = LiveCore;
  global.LiveCore = LiveCore;
})(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this));