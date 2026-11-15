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
import * as P from './plan.js';
import * as A from './advisor.js';
import { treeHTML } from '../../shared/tree.js';
import { aiNote } from '../../shared/llm.js';
import { mountViewer } from '../../shared/models.js';
import * as B from './bay.js';
import { findInstrument, instrumentSpecs } from './instruments.js';
import { renderMatrix } from '../../shared/matrix.js';
import { matrixSpec, debriefTree } from './report.js';
import { info } from '../../shared/explain.js';
import { registerOrbitTutorial } from './tutorial-steps.js';

const $ = (s) => document.querySelector(s);
const world = getWorld(), wid = getWorldId();
const STAGES = ['Briefing', 'Spacecraft', 'Orbit design', 'Capture burn', 'Operations', 'Debrief'];
const S = { profile: 'relay', instrument: 'none', shield: 'standard', layer: 'imagery', stage: 0, rocket: 'medium', antenna: 'dish', power: 'solarL', p: { ...D.PRESETS[wid][1].p }, preset: 1, view: '3d',
  dv: null, fuelFactor: 1, result: null, retries: 0, err: 0 };
let globe = null, timer = null, gen = 0, mvs = [];
const killMv = () => { mvs.forEach((v) => v.dispose()); mvs = []; };
// Real NASA models for each choice (shared/models.js). The satellite is assembled from NASA's Satellite Kit parts.
const REAL_ORBITER = { moon: 'lro', mars: 'mro', mercury: 'messenger', ceres: 'dawn', vesta: 'dawn' };
const ROCKET_MODEL = { small: 'jupiter-c', medium: 'atlas', heavy: 'saturn-v' };

mountShell({ base: '../../', mission: 'orbit', shortcuts: [['1–3', 'Load a real-mission orbit (design stage)'], ['G', 'Switch 3D view / ground track'], ['Space', 'Pause or play operations']] });

/* ---------- numbers ---------- */
const fmt = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const hrs = (h) => (h < 1 ? `${fmt(h * 60, 0)} min` : `${fmt(h, 2)} h`);
const pct = (x) => `${fmt(x * 100, 1)}%`;
const toGlobe = (p) => [p[0] / world.radiusKm, p[2] / world.radiusKm, -p[1] / world.radiusKm];

function design(p = S.p) {
  return P.designMetrics({ rocket: S.rocket, antenna: S.antenna, power: S.power, instrument: S.instrument, shield: S.shield, p }, world, wid);
}
const science = (d) => (d.ins.kind === 'none' ? null : instrumentSpecs(d.ins, d.el, world, { antennaRate: d.an.rate }));
const timeline = (el) => O.contactTimeline(el, world, { hours: 72 });

function checks(d, t) {
  const L = D.LIMITS[wid], c = [];
  const add = (ok, warnOnly, label, val, why) => c.push({ s: ok ? 'go' : warnOnly ? 'warn' : 'nogo', label, val, why });
  add(d.wet <= d.cap, false, 'Launch mass', `${fmt(d.wet)} / ${fmt(d.cap)} kg`, 'Satellite plus fuel must fit the rocket.');
  add(d.cost <= D.BUDGET_M, false, 'Budget', `$${d.cost}M / $${D.BUDGET_M}M`, 'Rocket and satellite parts.');
  add(d.haveW >= d.needW, false, 'Power', `${d.haveW} / ${d.needW} W`, 'Solar wings must run the antenna and computer.');
  const low = Math.min(S.p.periAltKm, S.p.apoAltKm);
  add(low >= L.minPeri, false, 'Periapsis safety', `${fmt(low)} km ≥ ${L.minPeri} km`, wid === 'mars' ? 'Below ~120 km, Mars’s air drags you down.' : 'Must clear mountains and crater rims.');
  add(Math.max(S.p.periAltKm, S.p.apoAltKm) <= L.maxApo, false, 'Apoapsis limit', `${fmt(Math.max(S.p.periAltKm, S.p.apoAltKm))} ≤ ${fmt(L.maxApo)} km`, 'Higher than this, the Sun’s and planets’ pull make the orbit unstable.');
  add(t.coverage >= D.GOALS[wid], true, 'Contact goal', `${pct(t.coverage)} ≥ ${pct(D.GOALS[wid])}`, 'Share of time the base can talk through you.');
  add(t.avgWindowH >= 0.5, true, 'Contact length', hrs(t.avgWindowH), 'Short passes leave the rover little time to talk.');
  const sp = science(d);
  if (sp) add(sp.goalMet, true, 'Science detail', `${B.sizeText(sp.gsdM)} ≤ ${B.sizeText(sp.goalGsdM)}`, 'Pixel size at the lowest point must be as small as the science job needs.');
  if (sp) add(sp.latReach >= Math.abs(world.site.latDeg), true, 'Sees the base', `${fmt(sp.latReach)}° ≥ ${fmt(Math.abs(world.site.latDeg))}°`, 'The orbit must tilt enough for the instrument to see the landing site.');
  return c;
}

/* ---------- shared UI ---------- */
function stageBar() { $('#stages').innerHTML = STAGES.map((s, n) => `<span class="stage ${n < S.stage ? 'done' : n === S.stage ? 'now' : ''}">${n + 1} ${s}</span>`).join(''); }
const whiskers = (tips) => `<section class="panel capcom" aria-live="polite"><h3>${whiskersSVG(34)} CAPCOM Whiskers</h3><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
  <details class="small"><summary>Space words explained</summary>${D.GLOSSARY.map(([w, x]) => `<p><b>${w}:</b> ${x}</p>`).join('')}</details></section>`;
function go(n) {
  S.stage = n; gen++; clearInterval(timer); killMv(); if (globe) { globe.dispose(); globe = null; }
  const m = $('#main'); m.onclick = null; m.oninput = null; m.onchange = null; document.onkeydown = null;
  render(); window.scrollTo({ top: 0 });
}
async function makeGlobe(el) {
  const my = gen;
  try {
    const { Globe } = await import('../../shared/globe.js');
    if (my !== gen || !el.isConnected) return null; // the player already moved to another stage
    const g = new Globe(el, { base: '../../', world, autoRotate: 0 }); g.setSite(world.site.latDeg); g.setSiteCone(world.site.latDeg); if (S.layer === 'topo') g.setWorld(world, 'topo'); return g;
  }
  catch { el.innerHTML = '<p class="small muted" style="padding:20px">3D view needs an internet connection; use the ground track.</p>'; return null; }
}
document.addEventListener('click', (e) => { // map layer toggle (works on every stage that shows the globe)
  const b = e.target.closest('[data-layer]'); if (!b) return;
  S.layer = b.dataset.layer; if (globe) globe.setWorld(world, S.layer);
  document.querySelectorAll('[data-layer]').forEach((x) => { x.dataset.layer = S.layer === 'topo' ? 'imagery' : 'topo'; x.textContent = S.layer === 'topo' ? 'Show imagery' : 'Show elevation'; });
});
const viewSwitch = () => `<div class="row small"><button data-v="3d" class="${S.view === '3d' ? 'on' : ''}">3D view</button><button data-v="gt" class="${S.view === 'gt' ? 'on' : ''}">Ground track</button><span class="muted">press G to switch</span>${world.textureTopo ? `<button data-layer="${S.layer === 'topo' ? 'imagery' : 'topo'}" title="Switch the globe between NASA imagery and laser-altimeter elevation">${S.layer === 'topo' ? 'Show imagery' : 'Show elevation'}</button>` : ''}</div>`;
const viewBoxes = () => `<div class="globe-box" id="globe" ${S.view === '3d' ? '' : 'hidden'}></div><canvas class="gt" id="gt" ${S.view === 'gt' ? '' : 'hidden'} aria-label="Ground track of the satellite on a NASA map"></canvas>`;

/* ---------- 1 Briefing ---------- */
function briefing() {
  const goal = pct(D.GOALS[wid]);
  $('#main').innerHTML = `<section class="panel stack hero"><span class="tag accent">Mission 1 of 3 · ${world.name}</span>
    <h1 class="big-title">Place the relay satellite</h1>
    <p class="lead">Your rover will land at <b>${world.site.name}</b>. From there Earth sits low on the horizon or below it, so the rover can’t call home directly.
    A <b>relay satellite</b> must carry its messages. You design it like a real flight-dynamics team: keep the base in contact at least <b>${goal}</b> of the time, within <b>$${D.BUDGET_M}M</b>, then brake into orbit with exactly the right burn.</p>
    <h2>Step 1 · What is your satellite for?${info('Choose the satellite’s job. Every option is a relay; two also carry a real NASA-style science instrument, which makes the design harder but more valuable.')}</h2>
    ${B.profileCardsHTML(S.profile, wid)}
    <div id="brieftree">${B.briefTree(world, wid, S.profile)}</div>
    <div class="statgrid">
      <div class="stat"><div class="lbl">Gravity parameter GM</div><div class="val">${fmt(world.gm, world.gm < 100 ? 2 : 0)} km³/s²</div></div>
      <div class="stat"><div class="lbl">Radius</div><div class="val">${fmt(world.radiusKm, 1)} km</div></div>
      <div class="stat"><div class="lbl">One turn (sidereal)</div><div class="val">${hrs(world.rotHours || world.dayHours)}</div></div>
      <div class="stat"><div class="lbl">Arrival speed v∞</div><div class="val">${fmt(world.vInfKms, 1)} km/s</div></div>
    </div>
    <p class="small muted">Constants from NASA/JPL. Globe and map: ${world.source}.</p>
    <div class="row"><button class="primary big" id="next">Build the satellite</button></div></section>`;
  $('#side').innerHTML = whiskers(['Start by choosing the satellite’s job. Hover or tap anything with a dotted line or an <b>i</b> to see what it means.', 'Your orbit decides when the rover can call Earth in Mission 2.']);
  $('#side').insertAdjacentHTML('beforeend', '<section class="panel" id="mv-real"></section>');
  mvs.push(mountViewer($('#mv-real'), [REAL_ORBITER[wid], 'tdrs'], { title: 'Real NASA spacecraft like yours', height: 210 }));
  $('#main').onclick = (e) => {
    const pb = e.target.closest('[data-profile]');
    if (pb) {
      S.profile = pb.dataset.profile; S.instrument = B.insForProfile(S.profile, wid); sfx.select();
      document.querySelectorAll('[data-profile]').forEach((b) => { const on = b === pb; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
      $('#brieftree').innerHTML = B.briefTree(world, wid, S.profile);
      return;
    }
    if (e.target.closest('#next')) { sfx.click(); go(1); }
  };
}

/* ---------- 2 Spacecraft: assembly bay ---------- */
function spacecraft() {
  killMv();
  const d = design(), insList = B.instrumentList(wid), prof = B.profileOf(S.profile);
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><h1 style="margin:0">Assembly bay</h1><span class="tag accent" id="proftag">${prof.icon} ${prof.name}</span></div>
    <div class="bay"><div id="bay3d" class="bay3d"></div>
      <div class="bay-side"><h2>What each choice causes${info('Every part changes mass, power and cost. Mass needs fuel, and fuel needs a rocket that can lift it all. Watch the chains update as you click.')}</h2>
      <div id="chains">${B.chainsHTML(d)}</div>${B.deltaHTML(null, d)}</div></div>
    ${B.choiceSection('Launch vehicle', 'rocket', D.ROCKETS, 'rocket', S.rocket, (x) => `${fmt(x.capKg * D.PAYLOAD_FACTOR[wid])} kg to ${world.name} · $${x.costM}M`)}
    ${B.choiceSection('Antenna', 'antenna', D.ANTENNAS, 'antenna', S.antenna, (x) => `${x.massKg} kg · $${x.costM}M · ${x.powerW} W · data ×${x.rate}`)}
    ${B.choiceSection('Solar power', 'power', D.POWER, 'power', S.power, (x) => `${x.massKg} kg · $${x.costM}M · makes ${x.powerW} W`)}
    ${B.choiceSection('Science instrument', 'instrument', insList, 'instrument', S.instrument, (x) => (x.kind === 'none' ? '0 kg · $0M · 0 W' : `${x.massKg} kg · $${x.costM}M · ${x.powerW} W`), (x) => `${x.info}${x.kind !== 'none' ? ` Modelled on ${x.ref}.` : ''}`)}
    ${B.choiceSection('Radiation shielding', 'shield', D.SHIELDS, 'shield', S.shield, (x) => `${x.massKg} kg · ${x.costM < 0 ? '−' : ''}$${Math.abs(x.costM)}M · storm reset ${Math.round(x.hit * 100)}%`)}
    <p class="small muted">Always included: ${D.BUS.name} (${D.BUS.massKg} kg, $${D.BUS.costM}M, ${D.BUS.powerW} W). Fuel is sized from your orbit in the next step.</p>
    <div class="row"><button id="back">Back</button><button class="primary big" id="next">Design the orbit</button></div></section>`;
  const sideHTML = (dd) => whiskers([dd.needW > dd.haveW ? `The parts need ${dd.needW} W but the wings make ${dd.haveW} W: pick larger wings or a smaller antenna.`
    : dd.wet > dd.cap ? `Too heavy: ${fmt(dd.wet)} kg on a rocket that lifts ${fmt(dd.cap)} kg.` : dd.cost > D.BUDGET_M ? `Over budget by $${dd.cost - D.BUDGET_M}M.`
      : dd.ins.kind !== 'none' ? `The ${dd.ins.name.toLowerCase()} wants a LOW orbit; the relay wants a HIGH one. You’ll balance that next.` : 'A bigger dish gives Mission 3 more time to send the rover’s science home.']);
  $('#side').innerHTML = `<div id="sc-tips">${sideHTML(d)}</div><section class="panel" id="mv-rk"></section>`;
  const satEntry = () => ({ key: 'sat', files: B.satFiles(S), name: 'Your relay satellite', kind: 'NASA Satellite Kit',
    fact: `${D.ANTENNAS.find((x) => x.id === S.antenna).name}, ${D.POWER.find((x) => x.id === S.power).name.toLowerCase()}, ${D.SHIELDS.find((x) => x.id === S.shield).name.toLowerCase()}${S.instrument !== 'none' ? `, ${findInstrument(wid, S.instrument).name.toLowerCase()}` : ''}. Every choice changes the model.` });
  const bay = mountViewer($('#bay3d'), [satEntry()], { height: 300 }); mvs.push(bay);
  const rk = mountViewer($('#mv-rk'), D.ROCKETS.map((r) => ROCKET_MODEL[r.id]), { title: 'Launch vehicles (real NASA rockets)', height: 220 }); mvs.push(rk);
  rk.select(ROCKET_MODEL[S.rocket]);
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) {
      const prev = design(); S[b.dataset.k] = b.dataset.val; sfx.select();
      if (b.dataset.k === 'instrument') {
        S.profile = S.instrument === 'none' ? 'relay' : (Object.entries(D.PROFILE_INS).find(([, m]) => m[wid] === S.instrument)?.[0] || S.profile);
        const pf = B.profileOf(S.profile); $('#proftag').textContent = `${pf.icon} ${pf.name}`;
      }
      const nd = design();
      document.querySelectorAll(`[data-k="${b.dataset.k}"]`).forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
      $('#chains').innerHTML = B.chainsHTML(nd);
      $('#delta').outerHTML = B.deltaHTML(prev, nd, b.querySelector('b').textContent);
      $('#chains').querySelectorAll('.cc-box').forEach((x) => x.classList.add('flash'));
      $('#sc-tips').innerHTML = sideHTML(nd);
      if (b.dataset.k === 'rocket') rk.select(ROCKET_MODEL[S.rocket]); else bay.update('sat', satEntry());
      return;
    }
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
    <div id="analyst"><p class="small muted">The mission analyst is calculating designs…</p></div>
    ${viewBoxes()}
    <div class="elements">${FIELDS.map(([k, label, unit, range, step]) => { const [lo, hi] = range(L); return `<label class="el-row"><span data-no-tip>${label}${info(D.TIPS[k])}</span>
      <input type="range" data-f="${k}" min="${lo}" max="${hi}" step="${step}" value="${S.p[k]}">
      <input type="number" data-n="${k}" min="${lo}" max="${hi}" step="${step}" value="${S.p[k]}"><em>${unit}</em></label>`; }).join('')}</div>
    <p class="small muted">ω = 90° puts the apoapsis over the south pole, 270° over the north pole. Satellites move slowest at apoapsis (Kepler’s 2nd law).</p>
    <div class="row"><button id="back">Back</button><button class="primary big" id="next">Go to capture burn</button></div></section>`;
  if (S.view === '3d') makeGlobe($('#globe')).then((g) => { if (g) { globe = g; update(); } });
  const update = () => {
    if (S.stage !== 2) return;
    const d = design(), t = timeline(d.el), ch = checks(d, t), nogo = ch.some((c) => c.s === 'nogo'), sp = science(d);
    if (globe) {
      globe.setPlannerOrbit(O.orbitPath(d.el).map(toGlobe), toGlobe(O.periapsisPos(d.el)), toGlobe(O.apoapsisPos(d.el)));
      globe.frame(Math.max(3.2, (d.el.ra / world.radiusKm) * 2.4));
      let tSim = 0; globe.onFrame = (dt) => { tSim += dt * d.el.T / 8; globe.setSat(toGlobe(O.positionAt(d.el, tSim))); };
    }
    if (S.view === 'gt') drawGroundTrack($('#gt'), world, O.groundTrack(d.el, world, { hours: 72 }));
    const v = O.visViva;
    $('#side').innerHTML = `<section class="panel"><h3>Orbit parameters</h3><table class="readout">
      <tr><td data-tip="${D.TIPS.a}">Semi-major axis a</td><td>${fmt(d.el.a)} km</td></tr><tr><td data-tip="${D.TIPS.e}">Eccentricity e</td><td>${fmt(d.el.e, 4)}</td></tr>
      <tr><td data-tip="${D.TIPS.T}">Period T</td><td>${hrs(d.el.T / 3600)}</td></tr>
      <tr><td data-tip="${D.TIPS.speed}">Speed at Pe / Ap</td><td>${fmt(v(d.el.rp, d.el.a, world.gm), 3)} / ${fmt(v(d.el.ra, d.el.a, world.gm), 3)} km/s</td></tr>
      <tr><td data-tip="${D.TIPS.dv}">Brake burn Δv</td><td>${fmt(d.dvNeed * 1000)} m/s</td></tr><tr><td data-tip="${D.TIPS.fuel}">Fuel (+10% margin)</td><td>${fmt(d.prop)} kg</td></tr>
      <tr><td data-tip="${D.TIPS.coverage}">Contact with base</td><td>${pct(t.coverage)}</td></tr><tr><td data-tip="${D.TIPS.window}">Mean contact / longest gap</td><td>${hrs(t.avgWindowH)} / ${hrs(t.maxGapH)}</td></tr></table></section>
      ${B.scienceHTML(d.ins, sp)}
      <section class="panel"><h3>Go / no-go</h3>${ch.map((c) => `<div class="gng ${c.s}" data-tip="${c.why}"><span>${c.s === 'go' ? 'GO' : c.s === 'warn' ? 'WARN' : 'NO-GO'}</span><b>${c.label}</b><em>${c.val}</em></div>`).join('')}</section>`
      + whiskers(orbitTips(d, t, sp));
    if (sp) B.paintCamera($('#camview'), `../../${world.texture}`, sp.gsdM / sp.goalGsdM);
    $('#next').disabled = nogo;
  };
  let deb = null;
  const setField = (k, val, from) => {
    const [lo, hi] = FIELDS.find((f) => f[0] === k)[3](L);
    S.p[k] = Math.min(hi, Math.max(lo, Number(val))); S.preset = null; $('#like').textContent = 'Custom orbit';
    document.querySelectorAll('[data-preset]').forEach((b) => b.classList.remove('on'));
    if (from !== 'f') $(`[data-f="${k}"]`).value = S.p[k];
    if (from !== 'n') $(`[data-n="${k}"]`).value = S.p[k]; // never rewrite the box being typed in (it eats decimals)
    clearTimeout(deb); deb = setTimeout(update, 70);
  };
  $('#main').oninput = (e) => {
    const f = e.target.dataset.f, n = e.target.dataset.n, k = f || n;
    if (k && e.target.value !== '' && Number.isFinite(Number(e.target.value))) setField(k, e.target.value, f ? 'f' : 'n');
  };
  $('#main').onchange = (e) => { const k = e.target.dataset.n; if (k) e.target.value = S.p[k]; };
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.design) {
      const c = (S.analyst || []).find((x) => x.id === b.dataset.design);
      if (c) { Object.assign(S, { rocket: c.design.rocket, antenna: c.design.antenna, power: c.design.power, p: { ...c.design.p }, preset: null }); sfx.select(); toast(`Loaded the “${c.title}” design. Change anything you like.`, 'good', 3000); go(2); }
      return;
    }
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
  setTimeout(() => { // the search takes a moment the first time, so let the console appear first
    if (S.stage !== 2 || !$('#analyst')) return;
    const { choices, relaxed } = A.designChoices(world, wid, { instrument: S.instrument, shield: S.shield });
    S.analyst = choices;
    if (!choices.length) { $('#analyst').innerHTML = ''; return; }
    const opts = choices.map((c) => ({ id: c.id, title: c.title, recommended: c.recommended, summary: c.summary, branches: c.branches, button: 'Load this design',
      expected: `Predicted: ${fmt(c.metrics.dvMs)} m/s brake, ${fmt(c.metrics.fuelKg)} kg fuel, ${fmt(c.metrics.wetKg)} of ${fmt(c.metrics.capKg)} kg on the rocket.` }));
    $('#analyst').innerHTML = `<details class="analyst" open><summary><b>Mission analyst</b>: ${choices.length} designs, calculated before you decide</summary>
      ${treeHTML({ question: 'Which design do you want to start from?', options: opts, attr: 'design',
        note: relaxed ? 'No design reaches the contact goal on this world, so these are the best that can still fly.' : 'Each one passes every go / no-go check. You still fly the capture burn yourself, and you can change anything after loading it.' })}</details>`;
    aiNote($('#analyst .analyst'), 'orbit-design', choices.map((c) => [c.title + (c.recommended ? ' (analyst pick)' : ''),
      `cost $${c.metrics.cost}M, contact ${pct(c.metrics.coverage)}, brake ${c.metrics.dvMs} m/s, score ${c.metrics.scoreOnTarget} on target or ${c.metrics.scoreOff} if the burn is 12% off`]));
  }, 40);
  coachOnce('orbit2', ['This is your flight-dynamics console. Type exact values or drag the sliders, or load a real mission’s orbit.',
    'Pe and Ap mark the lowest and highest points. Satellites crawl at Ap, so put it above the base. The green cone is the sky the base can see.',
    'Every check on the Go / no-go board must be GO (or WARN) before the burn.']);
}
function orbitTips(d, t, sp) {
  const tips = [];
  if (sp && !sp.goalMet) tips.push(`The ${d.ins.name.toLowerCase()} sees ${B.sizeText(sp.gsdM)} pixels but needs ${B.sizeText(sp.goalGsdM)}: lower the periapsis. That is the trade-off: a low orbit means shorter relay passes.`);
  if (sp && sp.latReach < Math.abs(world.site.latDeg)) tips.push(`The instrument only reaches ${fmt(sp.latReach)}° latitude, but the base is at ${fmt(Math.abs(world.site.latDeg), 1)}°: raise the inclination toward 90°.`);
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
  makeGlobe($('#globe')).then((g) => { if (!g) return; globe = g; { g.setPlannerOrbit(O.orbitPath(el).map(toGlobe), toGlobe(O.periapsisPos(el)), toGlobe(O.apoapsisPos(el))); g.frame(Math.max(3.2, (el.ra / world.radiusKm) * 2.4)); predict(); } });
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
  if (!S.keepOps || !S.ops) S.ops = { h: 0, speed: 3, playing: true, ev: { h: 20 + Math.random() * 30, state: 'pending', hit: Math.random() < design().sh.hit, durH: 0 } };
  S.keepOps = false;
  const ops = S.ops, ev = ops.ev;
  let te = t; // timeline after any outage
  const applyOutage = (startH, durH) => {
    te = O.withOutage(t, startH, durH);
    const dtH = 72 / Math.max(1, track.length - 1);
    track.forEach((pt, k) => { if (k * dtH >= startH && k * dtH < startH + durH) pt.inView = false; });
  };
  if (ev.state === 'done' && ev.durH) applyOutage(ev.h, ev.durH);
  S.final = { p, el, t, te, event: ev.state === 'done' ? { choice: ev.choice, hit: ev.choice === 'ride' && ev.hit, durH: ev.durH, lostH: te.outage?.lostH || 0 } : null };
  const bars = () => `${te.windows.map((w) => `<i style="left:${(w.startH / 72) * 100}%;width:${Math.max(0.3, ((w.endH - w.startH) / 72) * 100)}%"></i>`).join('')}${te.outage ? `<i class="out" title="Outage" style="left:${(te.outage.startH / 72) * 100}%;width:${((te.outage.endH - te.outage.startH) / 72) * 100}%"></i>` : ''}<span class="now" id="tnow"></span>`;
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><h1 style="margin:0">Operations · 72 h</h1>${viewSwitch()}</div>
    ${viewBoxes()}
    <div class="timeline" id="tlbar" role="img" aria-label="Contact windows over 72 hours">${bars()}</div>
    <div class="row small muted" style="justify-content:space-between"><span>0 h</span><span>24 h</span><span>48 h</span><span>72 h</span></div>
    <div id="evbox" aria-live="assertive"></div>
    <div class="row"><button id="pp" ${ev.state === 'open' ? 'disabled' : ''}>${ops.playing ? 'Pause' : 'Play'}</button>${[1, 3, 8].map((x) => `<button data-speed="${x}" class="${ops.speed === x ? 'on' : ''}">${x}×</button>`).join('')}<span id="tstat" class="mono small"></span>
      <button class="primary big" id="next" style="margin-left:auto" ${ev.state === 'done' ? '' : 'disabled title="Available once you have handled the event"'}>Mission debrief</button></div></section>`;
  function readout() {
    return `<table class="readout">
    <tr><td>Orbit</td><td>${fmt(p.periAltKm)} × ${fmt(p.apoAltKm)} km</td></tr><tr><td>Period</td><td>${hrs(el.T / 3600)}</td></tr>
    <tr><td>Contact with base</td><td>${pct(te.coverage)}</td></tr><tr><td>Contacts in 72 h</td><td>${te.windows.length}</td></tr>
    <tr><td>Mean contact</td><td>${hrs(te.avgWindowH)}</td></tr><tr><td>Longest gap</td><td>${hrs(te.maxGapH)}</td></tr></table>`;
  }
  $('#side').innerHTML = `<section class="panel"><h3>Final orbit</h3>${readout()}</section>`
    + whiskers(['Green on the timeline = the base can talk to Earth through you. Red = an outage. The rover in Mission 2 gets these windows.']);
  const showEvent = () => {
    sfx.alarm(); $('#pp').disabled = true;
    const f = A.stormForecast(t, ev.h, design(), wid, { err: S.err, retries: S.retries, science: science(design()) });
    $('#evbox').innerHTML = `<section class="event-box" role="alert"><span class="tag warn">Event · T+${fmt(ev.h, 1)} h</span>
      <h3>Solar storm warning</h3>
      <p>A burst of charged particles from the Sun will reach ${world.name} within the hour. Radiation can reset a satellite’s computer, and a reset takes ground control a long time to fix. The analyst has already calculated what each order would cost on <em>your</em> orbit.</p>
      ${treeHTML({ question: 'What do you order?', options: A.stormOptions(f), attr: 'ev', note: 'Computed from this orbit’s real contact windows. “Analyst pick” has the better expected score; a gamble can still go either way.' })}</section>`;
    const e = f.expected;
    aiNote($('#evbox .event-box'), 'storm', [
      ['Safe mode', `${f.safe.lostH.toFixed(1)} h of contact lost for sure, score ${f.before} to ${f.safe.score}`],
      ['Keep transmitting', `${Math.round(f.hit * 100)}% chance of losing ${f.reset.lostH.toFixed(1)} h (score ${f.reset.score}), otherwise nothing lost`],
      ['Expected score', `safe mode ${e.safeScore.toFixed(1)}, keep transmitting ${e.rideScore.toFixed(1)}`]]);
  };
  const resolveEvent = (choice) => {
    ev.choice = choice; ev.state = 'done';
    ev.durH = choice === 'safe' ? D.STORM.safeH : ev.hit ? D.STORM.resetH : 0;
    if (ev.durH) applyOutage(ev.h, ev.durH);
    const lost = te.outage?.lostH || 0;
    S.final.te = te; S.final.event = { choice, hit: choice === 'ride' && ev.hit, durH: ev.durH, lostH: lost };
    const lostTxt = lost > 0 ? `${fmt(lost, 1)} h of contact lost` : 'no contact was due in that time, so nothing was lost';
    const [kind, title, text] = choice === 'safe' ? ['good', 'Safe mode: storm survived', `Antenna off for ${D.STORM.safeH} h: ${lostTxt}. The satellite is unharmed.`]
      : ev.hit ? ['bad', 'The storm reset the computer', `Ground control needed ${D.STORM.resetH} h to recover it: ${lostTxt}. A gamble that usually works can still cost more.`]
      : ['info', 'You got away with it', 'No reset this time. Operators call that luck, not a plan.'];
    $('#evbox').innerHTML = `<section class="event-box ${kind}" role="status"><b>${title}</b><span class="small">${text}</span></section>`;
    $('#tlbar').innerHTML = bars();
    if (kind === 'bad') sfx.bad(); else sfx.good();
    $('#pp').disabled = false; $('#next').disabled = false; $('#next').removeAttribute('title');
    ops.playing = true; $('#pp').textContent = 'Pause';
    $('#side').querySelector('.readout').outerHTML = readout();
  };
  let last = performance.now();
  const step = () => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (ops.playing) ops.h = Math.min(72, ops.h + dt * ops.speed * (72 / 30));
    const h = ops.h;
    if (ev.state === 'pending' && h >= ev.h) { ev.state = 'open'; ops.playing = false; showEvent(); }
    const inView = te.windows.some((w) => h >= w.startH && h < w.endH);
    if (globe) { globe.setSat(toGlobe(O.positionAt(el, h * 3600))); globe.spin.rotation.y = (2 * Math.PI * h) / (world.rotHours || world.dayHours); globe.setContact(inView); }
    if (S.view === 'gt' && $('#gt')) drawGroundTrack($('#gt'), world, track, { nowIndex: Math.min(track.length - 1, Math.round((h / 72) * (track.length - 1))) });
    const n = $('#tnow'); if (n) n.style.left = `${(h / 72) * 100}%`;
    const st = $('#tstat'); if (st) st.textContent = `T+${fmt(h, 1)} h · ${inView ? 'BASE IN CONTACT' : 'NO CONTACT'}`;
  };
  if (S.view === '3d') makeGlobe($('#globe')).then((g) => { if (!g) return; globe = g; { g.setPlannerOrbit(O.orbitPath(el).map(toGlobe), toGlobe(O.periapsisPos(el)), toGlobe(O.apoapsisPos(el))); g.frame(Math.max(3.2, (el.ra / world.radiusKm) * 2.4)); } });
  clearInterval(timer); timer = setInterval(step, S.view === 'gt' ? 120 : 40);
  if (ev.state === 'open') showEvent();
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (e.detail > 0 && b.dataset.ev == null) b.blur(); // after a mouse click, Space goes back to play/pause
    if (b.dataset.ev && ev.state === 'open') resolveEvent(b.dataset.ev);
    if (b.id === 'pp' && ev.state !== 'open') { ops.playing = !ops.playing; b.textContent = ops.playing ? 'Pause' : 'Play'; }
    if (b.dataset.speed) { ops.speed = Number(b.dataset.speed); document.querySelectorAll('[data-speed]').forEach((x) => x.classList.toggle('on', x === b)); }
    if (b.dataset.v) { S.view = b.dataset.v; S.keepOps = true; go(4); }
    if (b.id === 'next' && !b.disabled) { sfx.click(); go(5); }
  };
  document.onkeydown = (e) => {
    if (e.target.closest?.('input')) return;
    if (e.key === ' ' && !e.target.closest?.('button,a')) { e.preventDefault(); $('#pp').click(); }
    if (e.key.toLowerCase() === 'g') $(`[data-v="${S.view === '3d' ? 'gt' : '3d'}"]`)?.click();
  };
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
  const { p, el, t: nominal, te, event } = S.final, t = te || nominal, sp = science({ ...d, el }), left = D.BUDGET_M - d.cost, margin = d.cap - d.wet;
  const why = [`${pct(t.coverage)} of the time (goal ${pct(D.GOALS[wid])}).`, `Mean contact ${hrs(t.avgWindowH)}, longest gap ${hrs(t.maxGapH)}.`,
    `Apoapsis ${fmt(S.err * 100, 1)}% off the plan${S.retries ? ', after one fly-by' : ''}.`, sp ? `${d.ins.name}: ${B.sizeText(sp.gsdM)} pixels (goal ${B.sizeText(sp.goalGsdM)}), ${fmt(sp.returnFraction * 100)}% of its data sent home.` : `${d.an.name}: data ×${d.an.rate}.`, `$${left}M left.`, `${fmt(margin)} kg spare on the rocket.`];
  const parts = P.scoreParts(d, t, { err: S.err, retries: S.retries, science: sp }, wid);
  const items = parts.map((x, n) => [x.label, x.max, x.score, why[n]]);
  const score = P.totalScore(parts);
  const badges = [];
  if (S.err < 0.02 && !S.retries) badges.push('Bullseye burn');
  if (t.coverage >= 0.8) badges.push('Always in touch');
  if (left >= 50) badges.push('Thrifty engineer');
  if (S.preset != null) badges.push('Real-mission twin');
  if (sp?.goalMet && t.coverage >= D.GOALS[wid]) badges.push('Science and relay');
  const lessons = [];
  if (t.coverage < D.GOALS[wid]) lessons.push('Satellites move slowest at apoapsis (Kepler’s second law). Put it over the base with ω, and raise it, to stay in touch longer.');
  if (S.err >= 0.02) lessons.push('Vis-viva links speed and orbit size: a few metres per second of brake change the apoapsis by hundreds of kilometres. That is why real burns are planned to the metre per second.');
  if (S.retries) lessons.push('The first burn was too gentle and the satellite flew past. Below escape speed is the line between orbit and goodbye.');
  if (d.dvNeed > 1.5) lessons.push('Low orbits need a big brake, and fuel grows exponentially with Δv. That is why many relays use high, elliptical orbits.');
  if (event?.choice === 'safe') lessons.push(`In the solar storm you chose safe mode: ${event.lostH > 0 ? `${fmt(event.lostH, 1)} h of contact lost` : 'no contact was due'}, but no risk. Operators often accept a small known loss to avoid a big unknown one.`);
  if (event?.hit) lessons.push(`You kept transmitting and the storm reset the computer: ${event.durH} h of outage, longer than safe mode would have cost. A choice that works most of the time can still be the worse choice. That is risk management.`);
  if (event?.choice === 'ride' && !event.hit) lessons.push('You kept transmitting through the storm and got away with it. Next time, ask what a reset would cost, not only how likely it is.');
  if (sp && !sp.goalMet) lessons.push(`Your ${d.ins.name.toLowerCase()} needed ${B.sizeText(sp.goalGsdM)} pixels but saw ${B.sizeText(sp.gsdM)}. Pixel size grows with height, so science wants a low orbit while a relay wants a high one: real teams often fly two satellites.`);
  if (!lessons.length) lessons.push('A mission-grade design. Could a smaller rocket or antenna still meet the goal? Engineers always look for margin.');
  // The rover keeps the orbit's regular schedule; only the overall coverage reflects the storm outage.
  const relay = { periodH: +nominal.cycleH.toFixed(2), windowH: +Math.min(nominal.avgWindowH, nominal.cycleH).toFixed(2), coverage: +t.coverage.toFixed(3), dataRate: d.an.rate, orbit: `${fmt(p.periAltKm)} × ${fmt(p.apoAltKm)} km` };
  saveMission(wid, 'orbit', { score, relay, profile: B.profileOf(S.profile).name, instrument: d.ins.kind === 'none' ? null : d.ins.name, gsdM: sp ? +sp.gsdM.toFixed(2) : null, goalMet: sp ? sp.goalMet : null, decisions: [d.rk.name, d.an.name, d.pw.name, d.sh.name, `Brake ${fmt(S.dv * 1000)} m/s`, event ? (event.choice === 'safe' ? 'Storm: safe mode' : 'Storm: kept transmitting') : null].filter(Boolean) });
  const award = awardRun({ mission: 'orbit', world: wid, score, summary: `${relay.orbit}, ${pct(t.coverage)} contact`, badges,
    decisions: [d.rk.name, d.an.name, d.pw.name, S.preset != null ? D.PRESETS[wid][S.preset].name : `i ${p.incDeg}°, ω ${p.argpDeg}°`, `Brake ${fmt(S.dv * 1000)} m/s`, event ? (event.choice === 'safe' ? 'Storm: safe mode' : 'Storm: kept transmitting') : null].filter(Boolean) });
  celebrate(award); if (score >= 65) sfx.good(); else sfx.bad();
  const run = { d, t, p, err: S.err, retries: S.retries, dv: S.dv, event, sp, wid, world, periodH: el.T / 3600 };
  const stars = score >= 85 ? 3 : score >= 60 ? 2 : score >= 35 ? 1 : 0;
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><div><span class="tag ${score >= 65 ? 'good' : 'warn'}">${score >= 65 ? 'Relay online' : 'Relay weak'}</span>
    <div class="row" style="align-items:baseline"><div class="score">${score}</div><div class="muted">/ 100</div></div></div>
    <div class="stars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="--i:${n}">★</span>`).join('')}</div></div>
    <div>${items.map(([l, m, s, w], n) => `<div class="check rise" style="--i:${n}"><span class="tag ${s >= m * 0.8 ? 'good' : s >= m * 0.4 ? 'warn' : 'bad'}">${s}/${m}</span><div><b>${l}</b><div class="small muted">${w}</div></div></div>`).join('')}</div>
    <div id="whytree">${debriefTree(run, score)}</div>
    <div id="matrix"></div>
    <h2>Lessons</h2><ul>${lessons.map((l) => `<li>${l}</li>`).join('')}</ul>
    <h2>Hand-off to Mission 2</h2><p>Your rover gets a relay contact of <b>${hrs(relay.windowH)}</b> about every <b>${hrs(relay.periodH)}</b>.</p>
    <div class="row"><a href="../rover/index.html"><button class="primary big">Next: Mission 2, the rover</button></a><button id="again">Redesign the orbit</button></div></section>`;
  renderMatrix($('#matrix'), matrixSpec(run));
  $('#side').innerHTML = whiskers(['Your relay schedule is saved. Mission 2 uses it for every call home.', 'Tap a row in the table to see the formula behind it.']) + '<section class="panel" id="mv-final"></section>';
  mvs.push(mountViewer($('#mv-final'), [{ key: 'sat', files: B.satFiles(S), name: 'Your satellite, in orbit', kind: relay.orbit, fact: `${pct(t.coverage)} contact with the base. ${sp ? `${d.ins.name}: ${B.sizeText(sp.gsdM)} pixels.` : 'Pure relay.'}` }], { title: 'The satellite you flew', height: 200 }));
  $('#again').onclick = (e) => { e.stopPropagation(); S.result = null; S.dv = null; go(2); };
}

function render() { stageBar(); [briefing, spacecraft, orbitDesign, captureBurn, operations, debrief][S.stage](); }
render();
registerOrbitTutorial(() => STAGES[S.stage]);
void isClassMode;
