/* =============================================================================
 * live-ui.js — Live Copilot Mode UI (bolt-gps-copilot)
 *
 * Binds the phone-first page (live.html) to live-core.js. ALL economic numbers
 * come from live-core / engine — no formulas are duplicated here. Advisory only:
 * nothing in this file decides economics, it only shows the recommendation and
 * records the driver's actions (rec-before-action ordering is enforced in core).
 *
 * Modes:
 *   normal        — real GPS via navigator.geolocation
 *   #sim=1        — lab/simulation GPS feed; sessions auto-flagged SIMULATED and
 *                   excluded from MTD + ACTUAL exports
 * ============================================================================= */
(function () {
  'use strict';

  if (typeof LiveCore === 'undefined') { document.body && (document.body.innerHTML = 'live-core.js failed to load before live-ui.js'); return; }

  var $ = function (id) { return document.getElementById(id); };
  var sim = window.location.hash.indexOf('sim=1') >= 0;
  var core = LiveCore.create({
    geolocation: sim ? null : (window.navigator.geolocation || null)
  });

  var ui = {
    values: { fare: '', fuel: '', odo: '' },
    pickupZone: null, dropoffZone: null, litres: 5,
    startFuelL: null,
    lastOfferId: null,
    acted: new Set(),
    _barCtx: '', _heroCtx: '',
    lastEvalHtml: '', _evalCtx: ''
  };

  /* ------------------------------------------------------------- toasts -- */
  var toasts = $('toasts');
  function toast(msg, ms) {
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    toasts.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 3600);
  }

  /* ----------------------------------------------------------- helpers -- */
  function money(n) {
    if (n == null || isNaN(n)) return '—';
    return Math.round(n).toLocaleString('en-GB');
  }
  function fmtTime(ts) {
    var d = new Date(ts);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  /* ------------------------------------------------------------- keypads -- */
  function buildPad(padId, target) {
    var pad = $(padId); if (!pad) return;
    pad.innerHTML = '';
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', '⌫'].forEach(function (k) {
      var b = document.createElement('button');
      b.className = 'key btn'; b.type = 'button'; b.textContent = k;
      b.setAttribute('data-key', k);
      b.addEventListener('click', function () {
        var v = ui.values[target] || '';
        if (k === 'CLR') ui.values[target] = '';
        else if (k === '⌫') ui.values[target] = v.slice(0, -1);
        else if ((v + k).length <= 9) ui.values[target] = v + k;
        paintMoney(target);
      });
      pad.appendChild(b);
    });
  }
  function paintMoney(target) {
    var v = ui.values[target] || '';
    var num = v === '' ? 0 : parseInt(v, 10);
    if (target === 'fare') { $('fare-val').textContent = money(num); }
    else if (target === 'fuel') { $('fuel-cost-val').textContent = money(num); }
    else { $('odo-val').textContent = num.toLocaleString('en-GB'); }
  }

  /* ----------------------------------------------------- hold-guard -- */
  var HOLD = {};
  function initHold() {
    ['btn-end', 'btn-wipe'].forEach(function (id) {
      var b = $(id); if (!b) return;
      b.dataset.orig = b.textContent;
      b.addEventListener('click', function () {
        if (b.classList.contains('armed')) {
          b.classList.remove('armed');
          b.textContent = b.dataset.orig;
          if (HOLD[id]) HOLD[id]();
        } else {
          b.classList.add('armed');
          b.textContent = 'TAP AGAIN TO CONFIRM';
          setTimeout(function () {
            if (b.classList.contains('armed')) { b.classList.remove('armed'); b.textContent = b.dataset.orig; }
          }, 3000);
        }
      });
    });
  }
  function disarm(id) { var b = $(id); if (b) { b.classList.remove('armed'); b.textContent = b.dataset.orig; } }

  /* ------------------------------------------------------- zone chips -- */
  function zoneChipsEl(container, selected, onPick, extra) {
    var el = $(container); el.innerHTML = '';
    var zones = core.helpers.zones || [];
    zones.forEach(function (z) {
      var c = document.createElement('button');
      c.className = 'chip' + (selected === z.n ? ' on' : '');
      c.type = 'button'; c.textContent = z.n;
      c.addEventListener('click', function () { onPick(z.n); });
      el.appendChild(c);
    });
  }

  /* --------------------------------------------------------------- radar -- */
  function drawRadar(s) {
    var svg = $('radar');
    var fixed = s.gps.fix;
    var cLat = fixed ? fixed.lat : null;
    var cLng = fixed ? fixed.lng : null;
    var zones = core.helpers.zones || [];
    var S = 640; /* degrees->px scale, tuned below */
    var center = 150;
    if (cLat == null) { cLat = zones.length ? zones[0].lat : 9.0; cLng = zones.length ? zones[0].lng : 7.4; }
    var cos = Math.cos(cLat * Math.PI / 180) || 0.98;
    /* pick scale so all zones fit in the 300px box */
    var span = 0;
    zones.forEach(function (z) {
      var dx = (z.lng - cLng) * cos, dy = (cLat - z.lat);
      span = Math.max(span, Math.abs(dx), Math.abs(dy));
    });
    S = (span > 0.001) ? 265 / span : 265 / 0.1;

    var html = '';
    /* grid rings */
    for (var r = 1; r <= 5; r++) html += '<circle cx="150" cy="150" r="' + (30 * r) + '" fill="none" stroke="#22304a" stroke-width="0.6"/>';
    html += '<line x1="0" y1="150" x2="300" y2="150" stroke="#22304a" stroke-width="0.5"/>';
    html += '<line x1="150" y1="0" x2="150" y2="300" stroke="#22304a" stroke-width="0.5"/>';

    /* zones */
    var me = null, i;
    if (fixed) { try { me = core.helpers.zoneFor({ lat: fixed.lat, lng: fixed.lng }); } catch (e) { me = null; } }
    var home = core.helpers.zoneFor({ lat: cLat, lng: cLng });
    for (i = 0; i < zones.length; i++) {
      var z = zones[i];
      var x = 150 + (z.lng - cLng) * cos * S;
      var y = 150 + (cLat - z.lat) * S;
      var isMe = me && me.inside && me.zone.n === z.n;
      var isHome = home && home.inside && home.zone.n === z.n && !isMe;
      html += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (isMe ? 8 : 5) + '" fill="' + (isMe ? '#37d67a' : isHome ? '#5aa2ff' : '#22304a') + '" opacity="0.9"/>';
      html += '<text x="' + (x + 7).toFixed(1) + '" y="' + (y - 3).toFixed(1) + '" font-size="7.5" fill="' + (isMe ? '#37d67a' : '#8b96b0') + '">' + z.n + '</text>';
    }
    if (fixed && me) {
      html += '<circle cx="150" cy="150" r="10" fill="none" stroke="#37d67a" stroke-width="1.2" />';
      html += '<circle cx="150" cy="150" r="2.4" fill="#e8edf7" />';
      html += '<text x="150" y="168" font-size="8" fill="#37d67a" text-anchor="middle">YOU ' + (me.inside ? me.zone.n : 'OFF-MAP') + '</text>';
      if (!me.inside) html += '<text x="150" y="180" font-size="7" fill="#ffb454" text-anchor="middle">no modelled ₦/hr here</text>';
    }
    svg.innerHTML = html;

    $('radar-center').textContent = fixed ? (fixed.accuracy != null ? 'Fix ±' + Math.round(fixed.accuracy) + 'm' : 'Fix') + ' · ' + (fixed.source === 'simulated' ? 'SIM' : 'GPS') : 'No fix yet';
    var near = core.helpers.scanZoneChips(3) || [];
    $('radar-near').textContent = near.length ? 'Near: ' + near.join(' · ') : '—';
  }

  /* ---------------------------------------------------------------- pills -- */
  function paintPills(s) {
    var g = s.gps.status || 'UNSET';
    var el = $('pill-gps');
    el.className = 'pill';
    if (g === 'LIVE') { el.className += ' ok'; el.textContent = 'GPS LIVE'; }
    else if (g === 'STALE') { el.className += ' warn'; el.textContent = 'GPS STALE'; }
    else if (g === 'DENIED') { el.className += ' bad'; el.textContent = 'LOCATION OFF'; }
    else if (g === 'UNAVAILABLE') { el.className += ' bad'; el.textContent = 'NO GPS'; }
    else if (g === 'REQUESTING') { el.className += ' warn'; el.textContent = 'LOCATING…'; }
    else if (g === 'UNSET') { el.className += ' warn'; el.textContent = 'GPS …'; }
    if (s.gps.lowAccuracy && s.gps.status === 'LIVE') { el.textContent += ' ±WAIT'; }

    var m = $('pill-mode');
    m.className = 'pill' + (s.simActive ? ' sim' : '');
    m.textContent = s.simActive ? 'SIMULATED' : 'ACTUAL';

    var nt = $('pill-net');
    nt.className = 'pill'; nt.textContent = s.offline ? 'OFFLINE' : 'ONLINE';
    if (!s.offline) nt.className += ' ok';
    else nt.className += ' warn';
  }

  /* ---------------------------------------------------------------- hero -- */
  var KIND_META = {
    'STAY':      { label: 'STAY IN ZONE',        cls: 'stay' },
    'WAIT':      { label: 'WAIT HERE',           cls: 'stay' },
    'RELOCATE':  { label: 'RELOCATE',            cls: '' },
    'CONSERVE':  { label: 'CONSERVE FUEL',       cls: 'keep' },
    'END_SHIFT': { label: 'END SHIFT',           cls: 'keep' }
  };
  function renderHero(s) {
    var rec = s.shift && s.shift.lastRec;
    if (!rec) {
      $('rec-kind').textContent = s.shift && s.shift.status !== 'ONLINE' ? 'OFFLINE' : '—';
      $('rec-kind').className = 'kind';
      $('rec-line').className = 'line not-yet';
      $('rec-line').textContent = s.shift ? (s.shift.status === 'PAUSED' ? 'Shift is paused — resume for live advice.' : 'Waiting for the first advice…') : 'No live advice yet. Start a shift and a GPS fix appears here.';
      $('rec-pay').innerHTML = '';
      $('rec-meta').textContent = '';
      $('rec-note').hidden = true;
      $('rec-target').hidden = true;
      $('hero-actions').innerHTML = '';
      ui._heroCtx = 'none-' + (s.shift ? s.shift.status : 'idle');
      return;
    }
    var meta = KIND_META[rec.kind] || KIND_META.STAY;
    $('rec-kind').textContent = meta.label;
    $('rec-kind').className = 'kind ' + meta.cls;
    $('rec-line').className = 'line';
    $('rec-line').textContent = rec.zoneName;
    var pay = rec.evPerHr;
    if (pay != null && !isNaN(pay)) {
      $('rec-pay').innerHTML = '₦' + money(rec.evPerHr) + '<span class="tag">expected /hr</span>';
    } else {
      $('rec-pay').innerHTML = '<span class="tag" style="font-size:14px;">no modelled ₦/hr</span>';
    }
    var bits = [];
    if (rec.remainingH != null) bits.push(rec.remainingH + 'h left');
    if (rec.zoneDistanceKm != null && !rec.insideZone) bits.push(rec.zoneDistanceKm + ' km from ' + rec.zoneName + ' centre');
    if (rec.fixSource) bits.push(rec.fixSource === 'simulated' ? 'SIM GPS' : 'GPS');
    $('rec-meta').textContent = bits.join(' · ');
    $('rec-note').hidden = false;
    $('rec-note').textContent = rec.note || '';
    if (rec.relocation) {
      $('rec-target').hidden = false;
      $('rec-target').textContent = 'Head to ' + rec.relocation.target + ' (~' + rec.relocation.km + ' km, ' + rec.relocation.min + ' min, ₦' + money(rec.relocation.fuelCost) + ' fuel) — net gain ₦' + money(rec.relocation.netAdvantage) + ' vs staying put.';
    } else { $('rec-target').hidden = true; }
    renderHeroActions(rec);
  }
  function renderHeroActions(rec) {
    var box = $('hero-actions');
    box.innerHTML = '';
    var acted = ui.acted.has(rec.recId);
    if (acted) {
      var d = document.createElement('div');
      d.className = 'small mut';
      d.textContent = 'Driver action logged for ' + rec.recId + '.';
      box.appendChild(d);
      ui._heroCtx = rec.recId; return;
    }
    var bF = document.createElement('button');
    bF.className = 'btn primary'; bF.type = 'button'; bF.textContent = 'FOLLOW';
    bF.addEventListener('click', function () { core.rec.action({ recId: rec.recId, choice: 'follow' }); ui.acted.add(rec.recId); toast('Followed ' + rec.recId); renderHeroActions(rec); });
    var bO = document.createElement('button');
    bO.className = 'btn'; bO.type = 'button'; bO.textContent = 'OVERRIDE';
    bO.addEventListener('click', function () {
      if ($('override-chips')) { $('override-chips').remove(); return; }
      var w = document.createElement('div');
      w.id = 'override-chips';
      w.className = 'chips';
      w.style.marginTop = '8px';
      ['CUSTOMER_CALL', 'FUEL_STATION', 'TOILET', 'TRAFFIC', 'OTHER'].forEach(function (r) {
        var c = document.createElement('button');
        c.className = 'chip'; c.type = 'button'; c.textContent = r;
        c.addEventListener('click', function () {
          core.rec.action({ recId: rec.recId, choice: 'override', reason: r });
          ui.acted.add(rec.recId);
          toast('Override logged (' + r + ')');
          renderHeroActions(rec);
        });
        w.appendChild(c);
      });
      box.parentNode.insertBefore(w, box.nextSibling);
    });
    box.appendChild(bF);
    box.appendChild(bO);
    ui._heroCtx = rec.recId;
  }

  /* -------------------------------------------------------------- shift -- */
  function renderShift(s) {
    var el = $('shift-status');
    var sh = s.shift;
    if (!sh) {
      el.className = 'shift-status idle'; el.textContent = 'IDLE — NOT ONLINE';
      $('btn-start').hidden = false; $('btn-pause').hidden = true; $('btn-resume').hidden = true; $('btn-end').hidden = true;
      $('start-fields').hidden = false;
    } else if (sh.status === 'ONLINE') {
      el.className = 'shift-status on';
      el.textContent = (sh.fieldMode === 'simulated' ? 'ONLINE · SIMULATED' : 'ONLINE') + (sh.driving.on ? ' · MOVING' : '');
      $('btn-start').hidden = true; $('btn-pause').hidden = false; $('btn-resume').hidden = true; $('btn-end').hidden = false;
      $('start-fields').hidden = true;
    } else if (sh.status === 'PAUSED') {
      el.className = 'shift-status pause'; el.textContent = 'PAUSED';
      $('btn-start').hidden = true; $('btn-pause').hidden = true; $('btn-resume').hidden = false; $('btn-end').hidden = false;
      $('start-fields').hidden = true;
    }
    var facts = $('shift-facts');
    facts.innerHTML = '';
    var rows = [];
    if (sh) {
      rows.push(['time on', sh.onlineMin + ' min']);
      rows.push(['trips', sh.tripsCount]);
      rows.push(['offers', sh.offersCount]);
      rows.push(['fuel left', sh.currentFuelL != null ? sh.currentFuelL + ' L' : 'MISSING']);
      rows.push(['acs', sh.actionsCount]);
    } else rows.push(['status', 'offline — no shift']);
    rows.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'fact';
      d.innerHTML = '<span class="mut">' + r[0].toUpperCase() + '</span><b>' + r[1] + '</b>';
      facts.appendChild(d);
    });
    if (s.ledger) {
      facts.appendChild(factRow('net', '₦' + money(s.ledger.netAfterFuel)));
      facts.appendChild(factRow('gross', '₦' + money(s.ledger.riderGross)));
      facts.appendChild(factRow('fuel', '₦' + money(s.ledger.petrolCost)));
    }
  }
  function factRow(k, v) { var d = document.createElement('div'); d.className = 'fact'; d.innerHTML = '<span class="mut">' + k.toUpperCase() + '</span><b>' + v + '</b>'; return d; }

  /* --------------------------------------------------------------- bar -- */
  function renderBar(s) {
    var ctx;
    if (!s.shift) ctx = 'idle';
    else if (s.shift.status === 'ONLINE') ctx = 'on';
    else ctx = 'pause';
    if (ui._barCtx === ctx) return;
    ui._barCtx = ctx;
    var bar = $('actionbar'); bar.innerHTML = '';
    function B(label, cls, fn) {
      var b = document.createElement('button');
      b.className = 'btn ' + (cls || ''); b.type = 'button'; b.textContent = label;
      b.addEventListener('click', fn);
      bar.appendChild(b); return b;
    }
    if (ctx === 'idle') {
      B('START SHIFT', 'primary', startShift);
    } else if (ctx === 'on') {
      B('REC', '', function () { core.rec.recommend(Date.now()); });
      B('PAUSE', 'warn', function () { core.shift.pause(); });
    } else {
      B('REC', '', function () { core.rec.recommend(Date.now()); });
      B('RESUME', 'warn', function () { core.shift.resume(); });
      B('END', 'danger', doEnd);
    }
  }
  function doEnd() {
    disarm('btn-end');
    var r = core.shift.end();
    if (r.ok) { toast('Shift ended — ledger archived' + (r.ledger.completeness === 'PARTIAL' ? ' (PARTIAL data)' : '')); }
    else toast('Could not end shift');
  }

  /* ---------------------------------------------------------------- trip -- */
  var lastEval = null;
  function renderTrip(s) {
    if (!ui.pickupZone) { var cz = core.helpers.currentZoneName(); ui.pickupZone = cz || null; }
    if ($('pickup-chips').childNodes.length === 0) {
      zoneChipsEl('pickup-chips', ui.pickupZone, function (z) { ui.pickupZone = z; renderTrip(s); });
      zoneChipsEl('dropoff-chips', ui.dropoffZone, function (z) { ui.dropoffZone = z; renderTrip(s); });
    }
    var ev = $('trip-eval');
    if (lastEval) {
      var key = lastEval.offerId + '|' + ui.values.fare;
      if (ui._evalCtx !== key) {
        ui._evalCtx = key;
        ev.hidden = false;
        ev.className = 'eval ' + (lastEval.recommendation === 'ACCEPT' ? 'accept' : 'decline');
        var net = lastEval.netEval ? lastEval.netEval.net : 0;
        ev.innerHTML = '';
        ev.appendChild(txt('<span class="rec-badge">' + lastEval.recommendation + '</span> — net ≈ ₦' + money(net) + (lastEval.netEval ? ' · fuel ≈ ₦' + money(lastEval.netEval.fuelCost) : '')));
        var rw = document.createElement('div');
        rw.className = 'row'; rw.style.marginTop = '8px';
        var bA = document.createElement('button'); bA.className = 'btn' + (lastEval.recommendation === 'ACCEPT' ? ' primary' : ''); bA.type = 'button'; bA.textContent = 'ACCEPT RIDE';
        bA.addEventListener('click', function () {
          core.rec.tripOutcome({ offerId: lastEval.offerId, outcome: 'accepted' });
          lastEval = null; ui._evalCtx = ''; ev.hidden = true; ui.values.fare = ''; paintMoney('fare');
          toast('Accepted — trip recorded');
        });
        var bD = document.createElement('button'); bD.className = 'btn' + (lastEval.recommendation === 'DECLINE' ? ' danger' : ''); bD.type = 'button'; bD.textContent = 'DECLINE';
        bD.addEventListener('click', function () {
          core.rec.tripOutcome({ offerId: lastEval.offerId, outcome: 'declined' });
          lastEval = null; ui._evalCtx = ''; ev.hidden = true; ui.values.fare = ''; paintMoney('fare');
          toast('Declined — logged');
        });
        rw.appendChild(bA); rw.appendChild(bD);
        ev.appendChild(rw);
      }
    }
  }
  function txt(h) { var d = document.createElement('div'); d.innerHTML = h; return d; }

  /* ---------------------------------------------------------------- mtd -- */
  function renderMtd(s) {
    var m = s.mtd || {};
    var box = $('mtd-facts');
    box.innerHTML = '';
    box.appendChild(factRow('sessions', m.shiftCount || 0));
    box.appendChild(factRow('net ₦ (actual)', '₦' + money(m.actualNetSum)));
    box.appendChild(factRow('pace est.', '₦' + money(m.paceEstimate)));
    box.appendChild(factRow('target', '₦' + money(m.target)));
  }

  /* --------------------------------------------------------- driving ----- */
  function renderDriving(s) {
    var ov = $('drive-overlay');
    var driving = !!(s.shift && s.shift.driving && s.shift.driving.on);
    if (driving && !ui._driveDismissed) ov.classList.add('show');
    else ov.classList.remove('show');
    if (!driving) ui._driveDismissed = false;
  }

  /* -------------------------------------------------------------- main ---- */
  function render(s) {
    s = s || core.snapshot();
    paintPills(s);
    renderHero(s);
    renderShift(s);
    renderBar(s);
    renderTrip(s);
    renderMtd(s);
    drawRadar(s);
    $('raw-state').textContent = JSON.stringify(s, null, 1);
  }

  function startShift() {
    var fuelL = ui.startFuelL;
    var r = core.shift.start({ fuelL: fuelL });
    if (!r.ok) { toast('Could not start shift'); return; }
    toast('Shift started (field: ' + r.shift.fieldMode + ')' + (fuelL == null ? ' — fuel MISSING' : ''));
  }

  function attach() {
    /* keypads */
    buildPad('fare-pad', 'fare');
    buildPad('fuel-pad', 'fuel');
    buildPad('odo-pad', 'odo');
    initHold();

    $('trip-clear').addEventListener('click', function () { ui.values.fare = ''; paintMoney('fare'); lastEval = null; ui._evalCtx = ''; $('trip-eval').hidden = true; });

    /* fuel litres chips */
    [5, 10, 15, 20].forEach(function (L) {
      var c = document.createElement('button');
      c.className = 'chip' + (ui.litres === L ? ' on' : '');
      c.type = 'button'; c.textContent = L + ' L';
      c.addEventListener('click', function () { ui.litres = L; rebuildFuelChips(); });
      $('fuel-litres-chips').appendChild(c);
    });
    function rebuildFuelChips() {
      [].forEach.call($('fuel-litres-chips').children, function (c, i) { c.className = 'chip' + ([5, 10, 15, 20][i] === ui.litres ? ' on' : ''); });
    }

    /* start fuel level stepper */
    function paintFuelLevel() { $('start-fuel-level').textContent = ui.startFuelL == null ? '—' : String(ui.startFuelL); }
    $('fuel-level-plus').addEventListener('click', function () { ui.startFuelL = (ui.startFuelL == null ? 15 : ui.startFuelL) + 5; paintFuelLevel(); });
    $('fuel-level-minus').addEventListener('click', function () { if (ui.startFuelL != null) ui.startFuelL = Math.max(0, ui.startFuelL - 5); paintFuelLevel(); });

    $('btn-start').addEventListener('click', startShift);
    $('btn-pause').addEventListener('click', function () { core.shift.pause(); });
    $('btn-resume').addEventListener('click', function () { core.shift.resume(); });

    HOLD['btn-end'] = doEnd;

    $('btn-offer').addEventListener('click', function () {
      var fareV = parseInt(ui.values.fare || '0', 10);
      if (!fareV) { toast('Enter a rider fare first'); return; }
      var o = core.rec.tripOffer({
        fare: fareV,
        pickupZone: ui.pickupZone || undefined,
        dropoffZone: ui.dropoffZone || undefined
      });
      if (!o.ok) { toast('Could not evaluate offer'); return; }
      lastEval = o.offer;
      ui._evalCtx = '';
      renderTrip(core.snapshot());
    });

    $('btn-fuel-save').addEventListener('click', function () {
      var cost = parseInt(ui.values.fuel || '0', 10);
      if (!cost) { toast('Enter fuel cost (₦)'); return; }
      core.field.fuel({ cost: cost, litres: ui.litres });
      ui.values.fuel = ''; paintMoney('fuel');
      toast('Fuel ₦' + money(cost) + ' logged');
    });

    $('btn-odo-start').addEventListener('click', function () {
      var v = parseInt(ui.values.odo || '0', 10);
      if (!v) { toast('Enter odometer value'); return; }
      core.field.odometer({ phase: 'start', value: v });
      toast('Odometer start ' + v + ' km logged');
    });
    $('btn-odo-end').addEventListener('click', function () {
      var v = parseInt(ui.values.odo || '0', 10);
      if (!v) { toast('Enter odometer value'); return; }
      core.field.odometer({ phase: 'end', value: v });
      toast('Odometer end ' + v + ' km logged');
    });

    $('btn-recs').addEventListener('click', function () { core.rec.recommend(Date.now()); });
    $('btn-reload').addEventListener('click', function () { render(); toast('Refreshed'); });

    $('btn-export-json').addEventListener('click', function () { exportFile('json'); });
    $('btn-export-csv').addEventListener('click', function () { exportFile('csv'); });
    $('btn-export-mtd').addEventListener('click', function () {
      var payload = JSON.stringify({ mtd: core.ledger.mtd(), ledger: core.ledger.compute() }, null, 1);
      download('live-mtd-snapshot.json', payload);
      toast('MTD snapshot downloaded');
    });
    HOLD['btn-wipe'] = function () {
      core.wipe().then(function () { disarm('btn-wipe'); toast('All local live data erased'); render(); });
    };
    $('btn-parked').addEventListener('click', function () { ui._driveDismissed = true; $('drive-overlay').classList.remove('show'); });
  }

  function exportFile(kind) {
    var s = core.snapshot();
    if (!s.shift) { toast('No active shift to export — start one first'); return; }
    if (kind === 'json') {
      var j = core.export.json();
      if (j) download('live-shift-' + s.shift.id + '.json', j);
    } else {
      var c = core.export.csv();
      if (c) download('live-shift-' + s.shift.id + '.csv', c);
    }
    toast('Exported (' + (s.shift.fieldMode === 'simulated' ? 'SIMULATED' : 'ACTUAL') + ')');
  }
  function download(name, content) {
    var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  /* --------------------------------------------------------- sim feed ---- */
  function startSimFeed() {
    var idx = 0;
    var zones = core.helpers.zones || [];
    var lastRecAt = 0;
    toast('SIMULATED GPS FEED active — sessions flagged SIMULATED, excluded from MTD');
    function step() {
      var z = zones[idx % zones.length];
      core.simGps.feed(z.lat + (Math.random() - 0.5) * 0.01, z.lng + (Math.random() - 0.5) * 0.01, 15);
      idx++;
      var s = core.snapshot();
      var now = Date.now();
      if (s.shift && now - lastRecAt >= 30000) { lastRecAt = now; core.rec.recommend(now); }
    }
    step();
    setInterval(step, 4500);
  }

  /* ------------------------------------------------------------ boot ----- */
  function boot() {
    core.on('state', function (s) { render(s); });
    core.on('ledger', function () { render(core.snapshot()); });
    core.on('notice', function (n) { if (n && n.text) toast(n.text, 6000); });

    core.restore().then(function (s) {
      render(s);
      attach();
      if (sim) { startSimFeed(); }
      else { core.gps.start(); }
      /* safety: browser may revoke/grant permission at runtime */
      if (!sim) document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') { core.gps.start(); core.tick(Date.now()); }
      });
    });

    setInterval(function () { core.tick(Date.now()); }, 2000);
    setInterval(function () { if (document.visibilityState === 'visible') core.flush(); }, 15000);
    document.addEventListener('pagehide', function () { core.flush(); });
  }

  boot();
})();