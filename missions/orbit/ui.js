// Mission 1: Orbit — a flight-dynamics console for placing the relay satellite.
// Stages: Briefing -> Spacecraft -> Orbit design -> Capture burn -> Operations -> Debrief.
import * as O from './orbit.js';
import * as D from './data.js';
import { drawGroundTrack } from './groundtrack.js';
import { mountShell, celebrate, coachOnce } from '../../shared/shell.js';
import { getWorld, getWorldId, saveMission, isClassMode } from '../../shared/campaign.js';
import { awardRun } from '../../shared/profile.js';
import { whiskersSVG } from '../../shared/cat.js';
import { sfx, toast } from '../../shared/fx.js';

const $ = (s) => document.querySelector(s);
const world = getWorld(), wid = getWorldId();
const STAGES = ['Briefing', 'Spacecraft', 'Orbit design', 'Capture burn', 'Operations', 'Debrief'];
const S = { stage: 0, rocket: 'medium', antenna: 'dish', power: 'solarL', p: { ...D.PRESETS[wid][1].p }, preset: 1, view: '3d',
  dv: null, fuelFactor: 1, result: null, retries: 0, err: 0 };
let globe = null, timer = null;

mountShell({ base: '../../', mission: 'orbit', shortcuts: [['1–3', 'Load a real-mission orbit (design stage)'], ['G', 'Switch 3D view / ground track'], ['Space', 'Pause or play operations']] });

/* ---------- numbers ---------- */
const pick = (list, id) => list.find((x) => x.id === id);
const fmt = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const hrs = (h) => (h < 1 ? `${fmt(h * 60, 0)} min` : `${fmt(h, 2)} h`);
const pct = (x) => `${fmt(x * 100, 1)}%`;
const toGlobe = (p) => [p[0] / world.radiusKm, p[2] / world.radiusKm, -p[1] / world.radiusKm];

function design(p = S.p) {
  const rk = pick(D.ROCKETS, S.rocket), an = pick(D.ANTENNAS, S.antenna), pw = pick(D.POWER, S.power);
  const el = O.elements(p, world);
  const dvNeed = O.requiredDv(el.rp, el.ra, world.vInfKms, world.gm);
  const dry = D.BUS.massKg + an.massKg + pw.massKg;
  const prop = O.propellantKg(dry, dvNeed * 1.1); // 10% margin for trim burns
  const cap = Math.round(rk.capKg * D.PAYLOAD_FACTOR[wid]);
  const cost = rk.costM + D.BUS.costM + an.costM + pw.costM;
  return { rk, an, pw, el, dvNeed, dry, prop, wet: dry + prop, cap, cost, needW: D.BUS.powerW + an.powerW, haveW: pw.powerW };
}
const timeline = (el) => O.contactTimeline(el, world, { hours: 72 });

function checks(d, t) {
  const L = D.LIMITS[wid], c = [];
  const add = (ok, warnOnly, label, val, why) => c.push({ s: ok ? 'go' : warnOnly ? 'warn' : 'nogo', label, val, why });
  add(d.wet <= d.cap, false, 'Launch mass', `${fmt(d.wet)} / ${fmt(d.cap)} kg`, 'Satellite plus fuel must fit the rocket.');
  add(d.cost <= D.BUDGET_M, false, 'Budget', `$${d.cost}M / $${D.BUDGET_M}M`, 'Rocket and satellite parts.');
  add(d.haveW >= d.needW, false, 'Power', `${d.haveW} / ${d.needW} W`, 'Solar wings must run the antenna and computer.');
  add(S.p.periAltKm >= L.minPeri, false, 'Periapsis safety', `${fmt(Math.min(S.p.periAltKm, S.p.apoAltKm))} km ≥ ${L.minPeri} km`, wid === 'mars' ? 'Below ~120 km, Mars’s air drags you down.' : 'Must clear mountains and crater rims.');
  add(Math.max(S.p.periAltKm, S.p.apoAltKm) <= L.maxApo, false, 'Apoapsis limit', `${fmt(Math.max(S.p.periAltKm, S.p.apoAltKm))} ≤ ${fmt(L.maxApo)} km`, 'Higher than this, the Sun’s and planets’ pull make the orbit unstable.');
  add(t.coverage >= D.GOALS[wid], true, 'Contact goal', `${pct(t.coverage)} ≥ ${pct(D.GOALS[wid])}`, 'Share of time the base can talk through you.');
  add(t.avgWindowH >= 0.5, true, 'Contact length', hrs(t.avgWindowH), 'Short passes leave the rover little time to talk.');
  return c;
}

/* ---------- shared UI ---------- */
function stageBar() { $('#stages').innerHTML = STAGES.map((s, n) => `<span class="stage ${n < S.stage ? 'done' : n === S.stage ? 'now' : ''}">${n + 1} ${s}</span>`).join(''); }
const whiskers = (tips) => `<section class="panel capcom" aria-live="polite"><h3>${whiskersSVG(34)} CAPCOM Whiskers</h3><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
  <details class="small"><summary>Space words explained</summary>${D.GLOSSARY.map(([w, x]) => `<p><b>${w}:</b> ${x}</p>`).join('')}</details></section>`;
function go(n) {
  S.stage = n; clearInterval(timer); if (globe) { globe.dispose(); globe = null; }
  const m = $('#main'); m.onclick = null; m.oninput = null; m.onchange = null; document.onkeydown = null;
  render(); window.scrollTo({ top: 0 });
}
async function makeGlobe(el) {
  try { const { Globe } = await import('../../shared/globe.js'); const g = new Globe(el, { base: '../../', world, autoRotate: 0 }); g.setSite(world.site.latDeg); g.setSiteCone(world.site.latDeg); return g; }
  catch { el.innerHTML = '<p class="small muted" style="padding:20px">3D view needs an internet connection; use the ground track.</p>'; return null; }
}
const viewSwitch = () => `<div class="row small"><button data-v="3d" class="${S.view === '3d' ? 'on' : ''}">3D view</button><button data-v="gt" class="${S.view === 'gt' ? 'on' : ''}">Ground track</button><span class="muted">press G to switch</span></div>`;
const viewBoxes = () => `<div class="globe-box" id="globe" ${S.view === '3d' ? '' : 'hidden'}></div><canvas class="gt" id="gt" ${S.view === 'gt' ? '' : 'hidden'} aria-label="Ground track of the satellite on a NASA map"></canvas>`;

/* ---------- 1 Briefing ---------- */
function briefing() {
  $('#main').innerHTML = `<section class="panel stack hero"><span class="tag accent">Mission 1 of 3 · ${world.name}</span>
    <h1 class="big-title">Place the relay satellite</h1>
    <p class="lead">Your rover will land at <b>${world.site.name}</b>. From there it often can’t see Earth, so a relay satellite must pass its messages on.
    Design the orbit like a real flight-dynamics team: keep the base in contact at least <b>${pct(D.GOALS[wid])}</b> of the time, within <b>$${D.BUDGET_M}M</b>, then brake into that orbit with exactly the right burn.</p>
    <div class="statgrid">
      <div class="stat"><div class="lbl">Gravity parameter GM</div><div class="val">${fmt(world.gm, world.gm < 100 ? 2 : 0)} km³/s²</div></div>
      <div class="stat"><div class="lbl">Radius</div><div class="val">${fmt(world.radiusKm, 1)} km</div></div>
      <div class="stat"><div class="lbl">One turn (sidereal)</div><div class="val">${hrs(world.rotHours || world.dayHours)}</div></div>
      <div class="stat"><div class="lbl">Arrival speed v∞</div><div class="val">${fmt(world.vInfKms, 1)} km/s</div></div>
    </div>
    <p class="small muted">Constants from NASA/JPL. Globe and map: ${world.source}.</p>
    <div class="row"><button class="primary big" id="next">Configure the spacecraft</button></div></section>`;
  $('#side').innerHTML = whiskers(['Every choice has a cost: a bigger antenna sends more data but needs more power, mass and fuel.', 'Your orbit decides when the rover can call Earth in Mission 2.']);
  $('#next').onclick = (e) => { e.stopPropagation(); sfx.click(); go(1); };
}

/* ---------- 2 Spacecraft ---------- */
const cards = (list, key, extra) => `<div class="choice-grid">${list.map((x) => `<button class="choice ${S[key] === x.id ? 'on' : ''}" data-k="${key}" data-val="${x.id}">
  <b>${x.name}</b><span class="small muted">${x.info}</span><span class="nums">${extra(x)}</span></button>`).join('')}</div>`;
function spacecraft() {
  const d = design();
  $('#main').innerHTML = `<section class="panel stack"><h1>Configure the spacecraft</h1>
    <h2>Launch vehicle</h2>${cards(D.ROCKETS, 'rocket', (x) => `${fmt(x.capKg * D.PAYLOAD_FACTOR[wid])} kg to ${world.name} · $${x.costM}M`)}
    <h2>Antenna</h2>${cards(D.ANTENNAS, 'antenna', (x) => `${x.massKg} kg · $${x.costM}M · ${x.powerW} W · data ×${x.rate}`)}
    <h2>Power</h2>${cards(D.POWER, 'power', (x) => `${x.massKg} kg · $${x.costM}M · ${x.powerW} W`)}
    <p class="small muted">Always included: ${D.BUS.name} (${D.BUS.massKg} kg, $${D.BUS.costM}M, ${D.BUS.powerW} W). Fuel is sized later from your orbit.</p>
    <div class="row"><button id="back">Back</button><button class="primary big" id="next">Design the orbit</button></div></section>`;
  $('#side').innerHTML = `<section class="panel"><h3>Spacecraft</h3><table class="readout">
    <tr><td>Dry mass</td><td>${fmt(d.dry)} kg</td></tr><tr><td>Rocket capacity</td><td>${fmt(d.cap)} kg</td></tr>
    <tr><td>Cost</td><td>$${d.cost}M / $${D.BUDGET_M}M</td></tr><tr><td>Power</td><td>${d.haveW} W for ${d.needW} W</td></tr></table></section>`
    + whiskers([d.needW > d.haveW ? `The antenna needs ${d.needW} W but the wings give ${d.haveW} W.` : 'A bigger dish gives Mission 3 more time to send the rover’s science home.']);
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) { S[b.dataset.k] = b.dataset.val; sfx.select(); spacecraft(); }
    if (b.id === 'back') go(0);
    if (b.id === 'next') { sfx.click(); go(2); }
  };
}

/* ---------- 3 Orbit design console ---------- */
const FIELDS = [
  ['periAltKm', 'Periapsis altitude', 'km', (L) => [L.minPeri, Math.min(20000, L.maxApo)], 1],
  ['apoAltKm', 'Apoapsis altitude', 'km', (L) => [L.minPeri, L.maxApo], 1],
  ['incDeg', 'Inclination i', '°', () => [0, 180], 0.1],
  ['argpDeg', 'Argument of periapsis ω', '°', () => [0, 360], 0.1],
];
function orbitDesign() {
  const L = D.LIMITS[wid];
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><h1 style="margin:0">Orbit design</h1>${viewSwitch()}</div>
    <div class="row small">${D.PRESETS[wid].map((p, n) => `<button data-preset="${n}" class="${S.preset === n ? 'on' : ''}" title="${p.like}">${n + 1} · ${p.name}</button>`).join('')}</div>
    <p class="small muted" id="like">${S.preset != null ? `${D.PRESETS[wid][S.preset].name}: ${D.PRESETS[wid][S.preset].like}` : 'Custom orbit'}</p>
    ${viewBoxes()}
    <div class="elements">${FIELDS.map(([k, label, unit, range, step]) => { const [lo, hi] = range(L); return `<label class="el-row"><span>${label}</span>
      <input type="range" data-f="${k}" min="${lo}" max="${hi}" step="${step}" value="${S.p[k]}">
      <input type="number" data-n="${k}" min="${lo}" max="${hi}" step="${step}" value="${S.p[k]}"><em>${unit}</em></label>`; }).join('')}</div>
    <p class="small muted">ω = 90° puts the apoapsis over the south pole, 270° over the north pole. Satellites move slowest at apoapsis (Kepler’s 2nd law).</p>
    <div class="row"><button id="back">Back</button><button class="primary big" id="next">Go to capture burn</button></div></section>`;
  makeGlobe($('#globe')).then((g) => { globe = g; update(); });
  const update = () => {
    const d = design(), t = timeline(d.el), ch = checks(d, t), nogo = ch.some((c) => c.s === 'nogo');
    if (globe) {
      globe.setPlannerOrbit(O.orbitPath(d.el).map(toGlobe), toGlobe(O.periapsisPos(d.el)), toGlobe(O.apoapsisPos(d.el)));
      globe.frame(Math.max(3.2, (d.el.ra / world.radiusKm) * 2.4));
      let tSim = 0; globe.onFrame = (dt) => { tSim += dt * d.el.T / 8; globe.setSat(toGlobe(O.positionAt(d.el, tSim))); };
    }
    if (S.view === 'gt') drawGroundTrack($('#gt'), world, O.groundTrack(d.el, world, { hours: 72 }));
    const v = O.visViva;
    $('#side').innerHTML = `<section class="panel"><h3>Orbit parameters</h3><table class="readout">
      <tr><td>Semi-major axis a</td><td>${fmt(d.el.a)} km</td></tr><tr><td>Eccentricity e</td><td>${fmt(d.el.e, 4)}</td></tr>
      <tr><td>Period T</td><td>${hrs(d.el.T / 3600)}</td></tr>
      <tr><td>Speed at Pe / Ap</td><td>${fmt(v(d.el.rp, d.el.a, world.gm), 3)} / ${fmt(v(d.el.ra, d.el.a, world.gm), 3)} km/s</td></tr>
      <tr><td>Brake burn Δv</td><td>${fmt(d.dvNeed * 1000)} m/s</td></tr><tr><td>Fuel (+10% margin)</td><td>${fmt(d.prop)} kg</td></tr>
      <tr><td>Contact with base</td><td>${pct(t.coverage)}</td></tr><tr><td>Mean contact / longest gap</td><td>${hrs(t.avgWindowH)} / ${hrs(t.maxGapH)}</td></tr></table></section>
      <section class="panel"><h3>Go / no-go</h3>${ch.map((c) => `<div class="gng ${c.s}" title="${c.why}"><span>${c.s === 'go' ? 'GO' : c.s === 'warn' ? 'WARN' : 'NO-GO'}</span><b>${c.label}</b><em>${c.val}</em></div>`).join('')}</section>`
      + whiskers(orbitTips(d, t));
    $('#next').disabled = nogo;
  };
  let deb = null;
  const setField = (k, val) => {
    S.p[k] = Number(val); S.preset = null; $('#like').textContent = 'Custom orbit';
    $(`[data-f="${k}"]`).value = S.p[k]; $(`[data-n="${k}"]`).value = S.p[k];
    clearTimeout(deb); deb = setTimeout(update, 70);
  };
  $('#main').oninput = (e) => { const k = e.target.dataset.f || e.target.dataset.n; if (k && e.target.value !== '') setField(k, e.target.value); };
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.preset) { S.preset = Number(b.dataset.preset); S.p = { ...D.PRESETS[wid][S.preset].p }; sfx.select(); go(2); return; }
    if (b.dataset.v) { S.view = b.dataset.v; sfx.click(); go(2); return; }
    if (b.id === 'back') go(1);
    if (b.id === 'next') { sfx.click(); S.dv = null; S.fuelFactor = 1; S.retries = 0; go(3); }
  };
  document.onkeydown = (e) => {
    if (e.target.closest?.('input')) return;
    if (['1', '2', '3'].includes(e.key)) $(`[data-preset="${Number(e.key) - 1}"]`)?.click();
    if (e.key.toLowerCase() === 'g') $(`[data-v="${S.view === '3d' ? 'gt' : '3d'}"]`)?.click();
  };
  update();
  coachOnce('orbit2', ['This is your flight-dynamics console. Type exact values or drag the sliders, or load a real mission’s orbit.',
    'Pe and Ap mark the lowest and highest points. Satellites crawl at Ap, so put it above the base. The green cone is the sky the base can see.',
    'Every check on the Go / no-go board must be GO (or WARN) before the burn.']);
}
function orbitTips(d, t) {
  const tips = [];
  if (t.coverage < D.GOALS[wid]) tips.push(`Contact is ${pct(t.coverage)}; the goal is ${pct(D.GOALS[wid])}. Try ω = ${world.site.latDeg < 0 ? 90 : 270}° to put the apoapsis over the base, and a higher apoapsis.`);
  if (d.dvNeed > 1.5) tips.push(`A ${fmt(d.dvNeed * 1000)} m/s brake is big. Fuel grows exponentially with Δv (the rocket equation).`);
  if (d.wet > d.cap) tips.push('Too heavy for the rocket. A lower orbit needs a bigger brake, which means more fuel.');
  if (!tips.length) tips.push('Good design. There is rarely one perfect orbit: try a cheaper one that still meets the goal.');
  return tips;
}

/* ---------- 4 Capture burn planner ---------- */
function captureBurn() {
  const d = design(), el = d.el;
  const fuel = d.prop * S.fuelFactor, dvMax = O.dvAvailable(d.dry, fuel);
  if (S.dv == null) S.dv = Math.min(dvMax, Math.round(d.dvNeed * 0.85 * 1000) / 1000);
  const vHyp = O.arrivalSpeed(el.rp, world.vInfKms, world.gm);
  $('#main').innerHTML = `<section class="panel stack"><h1>Capture burn</h1>
    <p>You are falling toward ${world.id === 'moon' ? 'the Moon' : world.name} at v∞ = ${fmt(world.vInfKms, 2)} km/s. At periapsis (${fmt(el.rp - world.radiusKm)} km up) you will be moving at <b>${fmt(vHyp, 3)} km/s</b>.
    Brake too little and you fly past; too much and the orbit comes out too low. Set the burn, check the prediction, then execute.</p>
    <div class="globe-box" id="globe" style="height:min(42vh,380px)"></div>
    <div class="burnbox"><label class="el-row"><span>Brake Δv</span><input type="range" id="dvr" min="0" max="${fmt(dvMax, 3).replace(/,/g, '')}" step="0.001" value="${S.dv}">
      <input type="number" id="dvn" min="0" max="${dvMax.toFixed(3)}" step="0.001" value="${S.dv.toFixed(3)}"><em>km/s</em></label>
      <div class="row small">${[-0.01, -0.001, 0.001, 0.01].map((x) => `<button data-nudge="${x}">${x > 0 ? '+' : ''}${x * 1000} m/s</button>`).join('')}</div>
      <div class="formula mono">v<sub>after</sub> = ${fmt(vHyp, 3)} − Δv &nbsp;·&nbsp; a = 1 / (2/r<sub>p</sub> − v²/GM) &nbsp;·&nbsp; r<sub>a</sub> = 2a − r<sub>p</sub></div>
      <div id="pred" class="statgrid"></div></div>
    <div class="row"><button id="back">Back to design</button><button class="primary big launch" id="fire">Execute burn</button></div></section>`;
  makeGlobe($('#globe')).then((g) => { globe = g; if (g) { g.setPlannerOrbit(O.orbitPath(el).map(toGlobe), toGlobe(O.periapsisPos(el)), toGlobe(O.apoapsisPos(el))); g.frame(Math.max(3.2, (el.ra / world.radiusKm) * 2.4)); predict(); } });
  const predict = () => {
    const r = O.captureResult(el.rp, world.vInfKms, S.dv, world.gm, world.radiusKm);
    const fuelUsed = (d.dry + fuel) * (1 - Math.exp(-(S.dv * 1000) / (O.ISP_S * O.G0)));
    const err = r.escaped || r.crashed ? null : (r.apoKm - el.ra) / (el.ra - world.radiusKm);
    $('#pred').innerHTML = `<div class="stat ${r.escaped || r.crashed ? 'bad' : Math.abs(err) < 0.02 ? 'good' : ''}"><div class="lbl">Predicted orbit</div><div class="val">${r.escaped ? 'ESCAPE' : r.crashed ? 'IMPACT' : `${fmt(r.periAltKm)} × ${fmt(r.apoAltKm)} km`}</div></div>
      <div class="stat"><div class="lbl">Target</div><div class="val">${fmt(el.rp - world.radiusKm)} × ${fmt(el.ra - world.radiusKm)} km</div></div>
      <div class="stat ${err != null && Math.abs(err) < 0.02 ? 'good' : ''}"><div class="lbl">Apoapsis error</div><div class="val">${err == null ? '—' : `${err > 0 ? '+' : ''}${fmt(err * 100, 1)}%`}</div></div>
      <div class="stat"><div class="lbl">Fuel used / loaded</div><div class="val">${fmt(fuelUsed)} / ${fmt(fuel)} kg</div></div>`;
    if (globe && !r.escaped && !r.crashed) globe.setOrbit(O.orbitPath(O.elements({ ...S.p, periAltKm: r.periAltKm, apoAltKm: r.apoAltKm }, world)).map(toGlobe), 0xff2bd6), globe.orbit.visible = true;
    else if (globe?.orbit) globe.orbit.visible = false;
    $('#side').innerHTML = `<section class="panel"><h3>Burn data</h3><table class="readout">
      <tr><td>Speed at periapsis</td><td>${fmt(vHyp, 3)} km/s</td></tr><tr><td>Speed after burn</td><td>${fmt(vHyp - S.dv, 3)} km/s</td></tr>
      <tr><td>Escape speed there</td><td>${fmt(Math.sqrt((2 * world.gm) / el.rp), 3)} km/s</td></tr><tr><td>Δv available (fuel)</td><td>${fmt(dvMax * 1000)} m/s</td></tr>
      <tr><td>Attempts</td><td>${S.retries + 1}</td></tr></table></section>`
      + whiskers([r.escaped ? 'You are still faster than escape speed: you would fly past. Brake harder.' : r.crashed ? 'Too much! The new low point is under the surface.' : Math.abs(err) < 0.02 ? 'Within 2%: that’s a mission-grade burn.' : `The apoapsis would be ${err > 0 ? 'too high: brake a little more' : 'too low: brake a little less'}.`]);
  };
  const setDv = (v) => { S.dv = Math.max(0, Math.min(dvMax, Math.round(v * 1000) / 1000)); $('#dvr').value = S.dv; $('#dvn').value = S.dv.toFixed(3); predict(); };
  $('#main').oninput = (e) => { if (e.target.id === 'dvr' || e.target.id === 'dvn') { if (e.target.value !== '') setDv(Number(e.target.value)); } };
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nudge) { setDv(S.dv + Number(b.dataset.nudge)); sfx.click(); }
    if (b.id === 'back') go(2);
    if (b.id === 'fire') execute();
  };
  const execute = () => {
    const r = O.captureResult(el.rp, world.vInfKms, S.dv, world.gm, world.radiusKm);
    sfx.thrust();
    if (r.escaped) {
      if (S.retries >= 1) { toast('The satellite flew past and was lost.', 'bad', 5000); S.result = { lost: true }; setTimeout(() => go(5), 1200); return; }
      S.retries++; S.fuelFactor *= 0.6; S.dv = null;
      toast('Flew past! Engineers found a slow loop back, but it used 40% of your fuel. One more try.', 'bad', 6500); setTimeout(() => go(3), 900); return;
    }
    if (r.crashed) { toast('Impact: the orbit dipped below the surface.', 'bad', 5000); S.result = { lost: true }; setTimeout(() => go(5), 1200); return; }
    S.err = Math.abs(r.apoKm - el.ra) / (el.ra - world.radiusKm);
    S.result = { periAltKm: r.periAltKm, apoAltKm: r.apoAltKm };
    toast(S.err < 0.02 ? 'Burn complete: right on target!' : `Orbit achieved, ${fmt(S.err * 100, 1)}% off the planned apoapsis.`, S.err < 0.1 ? 'good' : 'info', 4500);
    setTimeout(() => go(4), 900);
  };
  predict();
}

/* ---------- 5 Operations: watch 72 hours ---------- */
function operations() {
  const p = { ...S.p, ...S.result }, el = O.elements(p, world), t = timeline(el), track = O.groundTrack(el, world, { hours: 72 });
  S.final = { p, el, t };
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><h1 style="margin:0">Operations · 72 h</h1>${viewSwitch()}</div>
    ${viewBoxes()}
    <div class="timeline" id="tlbar">${t.windows.map((w) => `<i style="left:${(w.startH / 72) * 100}%;width:${Math.max(0.3, ((w.endH - w.startH) / 72) * 100)}%"></i>`).join('')}<span class="now" id="tnow"></span></div>
    <div class="row small muted" style="justify-content:space-between"><span>0 h</span><span>24 h</span><span>48 h</span><span>72 h</span></div>
    <div class="row"><button id="pp">Pause</button>${[1, 3, 8].map((x) => `<button data-speed="${x}">${x}×</button>`).join('')}<span id="tstat" class="mono small"></span>
      <button class="primary big" id="next" style="margin-left:auto">Mission debrief</button></div></section>`;
  $('#side').innerHTML = `<section class="panel"><h3>Final orbit</h3><table class="readout">
    <tr><td>Orbit</td><td>${fmt(p.periAltKm)} × ${fmt(p.apoAltKm)} km</td></tr><tr><td>Period</td><td>${hrs(el.T / 3600)}</td></tr>
    <tr><td>Contact with base</td><td>${pct(t.coverage)}</td></tr><tr><td>Contacts in 72 h</td><td>${t.windows.length}</td></tr>
    <tr><td>Mean contact</td><td>${hrs(t.avgWindowH)}</td></tr><tr><td>Longest gap</td><td>${hrs(t.maxGapH)}</td></tr></table></section>`
    + whiskers(['Green on the timeline = the base can talk to Earth through you. The rover in Mission 2 gets exactly these windows.']);
  let h = 0, speed = 3, playing = true, last = performance.now();
  const step = () => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (playing) h = Math.min(72, h + dt * speed * (72 / 30));
    const inView = t.windows.some((w) => h >= w.startH && h < w.endH);
    if (globe) { globe.setSat(toGlobe(O.positionAt(el, h * 3600))); globe.spin.rotation.y = (2 * Math.PI * h) / (world.rotHours || world.dayHours); globe.setContact(inView); }
    if (S.view === 'gt' && $('#gt')) drawGroundTrack($('#gt'), world, track, { nowIndex: Math.min(track.length - 1, Math.round((h / 72) * (track.length - 1))) });
    const n = $('#tnow'); if (n) n.style.left = `${(h / 72) * 100}%`;
    const st = $('#tstat'); if (st) st.textContent = `T+${fmt(h, 1)} h · ${inView ? 'BASE IN CONTACT' : 'NO CONTACT'}`;
  };
  makeGlobe($('#globe')).then((g) => { globe = g; if (g) { g.setPlannerOrbit(O.orbitPath(el).map(toGlobe), toGlobe(O.periapsisPos(el)), toGlobe(O.apoapsisPos(el))); g.frame(Math.max(3.2, (el.ra / world.radiusKm) * 2.4)); } });
  clearInterval(timer); timer = setInterval(step, S.view === 'gt' ? 120 : 40);
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'pp') { playing = !playing; b.textContent = playing ? 'Pause' : 'Play'; }
    if (b.dataset.speed) speed = Number(b.dataset.speed);
    if (b.dataset.v) { S.view = b.dataset.v; go(4); }
    if (b.id === 'next') { sfx.click(); go(5); }
  };
  document.onkeydown = (e) => { if (e.key === ' ') { e.preventDefault(); $('#pp').click(); } if (e.key.toLowerCase() === 'g') $(`[data-v="${S.view === '3d' ? 'gt' : '3d'}"]`)?.click(); };
}

/* ---------- 6 Debrief ---------- */
function debrief() {
  const d = design();
  if (S.result?.lost) {
    saveMission(wid, 'orbit', { score: 5, relay: null });
    const award = awardRun({ mission: 'orbit', world: wid, score: 5, summary: 'Satellite lost during capture', badges: [], decisions: [d.rk.name, d.an.name, `Brake ${fmt(S.dv * 1000)} m/s`] });
    celebrate(award); sfx.bad();
    $('#main').innerHTML = `<section class="panel stack"><span class="tag bad">Mission lost</span><h1>The satellite was lost</h1>
      <p>The capture burn did not put the satellite into a safe orbit. Real missions model every burn many times before flying it, because there is no second chance at arrival.</p>
      <div class="row"><button class="primary big" id="again">Try the burn again</button></div></section>`;
    $('#side').innerHTML = whiskers(['Use the prediction: aim for an apoapsis error under 2%, and never below escape-speed limits.']);
    $('#again').onclick = (e) => { e.stopPropagation(); S.result = null; S.dv = null; S.fuelFactor = 1; S.retries = 0; go(3); };
    return;
  }
  const { p, t } = S.final, left = D.BUDGET_M - d.cost, margin = d.cap - d.wet;
  const items = [
    ['Contact with the base', 35, Math.round(35 * Math.min(1, t.coverage / D.GOALS[wid])), `${pct(t.coverage)} of the time (goal ${pct(D.GOALS[wid])}).`],
    ['Contact length', 10, Math.round(10 * Math.min(1, t.avgWindowH / 2)), `Mean contact ${hrs(t.avgWindowH)}, longest gap ${hrs(t.maxGapH)}.`],
    ['Capture burn accuracy', 20, Math.round(20 * Math.max(0, 1 - S.err / 0.25)) - (S.retries ? 5 : 0), `Apoapsis ${fmt(S.err * 100, 1)}% off the plan${S.retries ? ', after one fly-by' : ''}.`],
    ['Data rate', 10, Math.round((d.an.rate / 4) * 10), `${d.an.name}: data ×${d.an.rate}.`],
    ['Budget left', 10, Math.round(10 * Math.min(1, Math.max(0, left) / 40)), `$${left}M left.`],
    ['Mass margin', 15, Math.round(15 * Math.min(1, Math.max(0, margin) / (d.cap * 0.25))), `${fmt(margin)} kg spare on the rocket.`],
  ].map((x) => { x[2] = Math.max(0, x[2]); return x; });
  const score = items.reduce((a, i) => a + i[2], 0);
  const badges = [];
  if (S.err < 0.02 && !S.retries) badges.push('Bullseye burn');
  if (t.coverage >= 0.8) badges.push('Always in touch');
  if (left >= 50) badges.push('Thrifty engineer');
  if (S.preset != null) badges.push('Real-mission twin');
  const lessons = [];
  if (t.coverage < D.GOALS[wid]) lessons.push('Satellites move slowest at apoapsis (Kepler’s second law). Put it over the base with ω, and raise it, to stay in touch longer.');
  if (S.err >= 0.02) lessons.push('Vis-viva links speed and orbit size: a few metres per second of brake change the apoapsis by hundreds of kilometres. That is why real burns are planned to the metre per second.');
  if (S.retries) lessons.push('The first burn was too gentle and the satellite flew past. Below escape speed is the line between orbit and goodbye.');
  if (d.dvNeed > 1.5) lessons.push('Low orbits need a big brake, and fuel grows exponentially with Δv. That is why many relays use high, elliptical orbits.');
  if (!lessons.length) lessons.push('A mission-grade design. Could a smaller rocket or antenna still meet the goal? Engineers always look for margin.');
  const relay = { periodH: +t.cycleH.toFixed(2), windowH: +Math.min(t.avgWindowH, t.cycleH).toFixed(2), coverage: +t.coverage.toFixed(3), dataRate: d.an.rate, orbit: `${fmt(p.periAltKm)} × ${fmt(p.apoAltKm)} km` };
  saveMission(wid, 'orbit', { score, relay });
  const award = awardRun({ mission: 'orbit', world: wid, score, summary: `${relay.orbit}, ${pct(t.coverage)} contact`, badges,
    decisions: [d.rk.name, d.an.name, d.pw.name, S.preset != null ? D.PRESETS[wid][S.preset].name : `i ${p.incDeg}°, ω ${p.argpDeg}°`, `Brake ${fmt(S.dv * 1000)} m/s`] });
  celebrate(award); if (score >= 65) sfx.good(); else sfx.bad();
  const stars = score >= 85 ? 3 : score >= 60 ? 2 : score >= 35 ? 1 : 0;
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><div><span class="tag ${score >= 65 ? 'good' : 'warn'}">${score >= 65 ? 'Relay online' : 'Relay weak'}</span>
    <div class="row" style="align-items:baseline"><div class="score">${score}</div><div class="muted">/ 100</div></div></div>
    <div class="stars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="--i:${n}">★</span>`).join('')}</div></div>
    <div>${items.map(([l, m, s, w], n) => `<div class="check rise" style="--i:${n}"><span class="tag ${s >= m * 0.8 ? 'good' : s >= m * 0.4 ? 'warn' : 'bad'}">${s}/${m}</span><div><b>${l}</b><div class="small muted">${w}</div></div></div>`).join('')}</div>
    <h2>Why it went this way</h2><ul>${lessons.map((l) => `<li>${l}</li>`).join('')}</ul>
    <h2>Hand-off to Mission 2</h2><p>Your rover gets a relay contact of <b>${hrs(relay.windowH)}</b> about every <b>${hrs(relay.periodH)}</b>.</p>
    <div class="row"><a href="../rover/index.html"><button class="primary big">Next: Mission 2, the rover</button></a><button id="again">Redesign the orbit</button></div></section>`;
  $('#side').innerHTML = whiskers(['Your relay schedule is saved. Mission 2 uses it for every call home.']);
  $('#again').onclick = (e) => { e.stopPropagation(); S.result = null; S.dv = null; go(2); };
}

function render() { stageBar(); [briefing, spacecraft, orbitDesign, captureBurn, operations, debrief][S.stage](); }
render();
void isClassMode;
