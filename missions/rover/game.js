// Rover mission screens: Briefing, Landing site, Build, Test. Deploy and Debrief live in deploy.js / debrief.js.
import { LIMITS, objectivesFor, findObjective, scaledObjective, SLOTS, PARTS, summarize, defaultDesign, BUS } from './parts.js';
import { cells, SLOPE_TEXT, SOURCE_NOTE, useWorld, sunAt, WORLD_ID, relayInfo } from './world.js';
import { mountShell } from '../../shared/shell.js';
import { getWorldId, relaySchedule, isClassMode } from '../../shared/campaign.js';
import { getCrew } from '../../shared/profile.js';
import { WORLDS } from '../../shared/worlds.js';
import { whiskersSVG } from '../../shared/cat.js';
import { runTests, hint, GLOSSARY } from './capcom.js';
import { setupCanvas, draw, cellFromEvent } from './map.js';
import { renderDeploy, startDeploy, leaveDeploy } from './deploy.js';
import { renderDebrief } from './debrief.js';
import { sfx } from '../../shared/fx.js';

const STAGES = [['briefing', 'Briefing'], ['site', 'Landing site'], ['build', 'Build rover'], ['test', 'Test'], ['deploy', 'Deploy'], ['debrief', 'Debrief']];

// Pick the campaign world (Moon or Mars) and plug in the relay schedule from Mission 1.
const CAMPAIGN_WORLD = getWorldId();
const ROVER_OK = !!WORLDS[CAMPAIGN_WORLD].roverTarget;
const RELAY = relaySchedule(CAMPAIGN_WORLD);
useWorld(ROVER_OK ? CAMPAIGN_WORLD : 'moon', RELAY);
mountShell({ base: '../../', mission: 'rover', shortcuts: [['W A S D / arrows', 'Drive one square'], ['Click ground twice', 'Plan, then drive'], ['Space', 'Dig 2 hours'], ['F', 'Scan'], ['R', 'Rest 4 hours'], ['Enter', 'Drive the planned route'], ['Esc', 'Clear the route']] });

export const S = {
  stage: 'briefing', objectiveId: null, players: Math.max(1, getCrew().length), siteK: null, hover: null, view: 'terrain',
  design: defaultDesign(), testsRun: 0, tests: null, run: null, plan: null, event: null, eventMsg: null, result: null,
};

const $ = (sel) => document.querySelector(sel);
const main = () => $('#main');
const side = () => $('#side');
let preview = null; // 3D rover turntable on the Build screen

export function go(stage) {
  if (S.stage === 'deploy' && stage !== 'deploy') leaveDeploy();
  if (preview && stage !== 'build') { preview.dispose(); preview = null; }
  S.stage = stage; render(); window.scrollTo({ top: 0 });
}

export function meter(label, value, max, unit, opts = {}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const over = opts.lowBad ? pct < 20 : value > max;
  const near = opts.lowBad ? pct < 40 : pct > 90;
  return `<div class="meter"><div class="lbl"><span>${label}</span><b>${opts.text ?? `${Math.round(value)} / ${max} ${unit}`}</b></div>
    <div class="bar"><i class="${over ? 'bad' : near ? 'warn' : ''}" style="width:${pct}%"></i></div></div>`;
}

function stageBar() {
  const idx = STAGES.findIndex(([id]) => id === S.stage);
  $('#stages').innerHTML = STAGES.map(([id, label], n) =>
    `<span class="stage ${n < idx ? 'done' : n === idx ? 'now' : ''}" ${n === idx ? 'aria-current="step"' : ''}>${n + 1} ${label}</span>`).join('');
}

export function capcomPanel(tips) {
  return `<section class="panel capcom" aria-live="polite"><h3>${whiskersSVG(36)} CAPCOM Whiskers</h3>
    <ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
    <details class="small" style="margin-top:8px"><summary>Space words explained</summary>
    ${GLOSSARY.map(([w, d]) => `<p><b>${w}:</b> ${d}</p>`).join('')}</details></section>`;
}

function budgetPanel() {
  const sum = summarize(S.design);
  const obj = S.objectiveId && scaledObjective(findObjective(S.objectiveId), isClassMode());
  return `<section class="panel" id="budget"><h3>Mission budget</h3>
    ${meter('Mass on the lander', sum.massKg, LIMITS.landerCapacityKg, 'kg')}
    ${meter('Money', sum.costM + S.testsRun * LIMITS.testCostM, LIMITS.budgetM, '$M')}
    ${meter('Solar power', sum.solarW, 600, 'W', { text: `${sum.solarW} W solar${sum.rtgW ? ` + ${sum.rtgW} W RTG` : ''}` })}
    ${meter('Battery', sum.batteryWh, 5000, 'Wh', { text: `${(sum.batteryWh / 1000).toFixed(1)} kWh` })}
    ${obj ? `<p class="small muted">Objective: <b>${obj.title}</b>, ${obj.target} ${obj.unit}</p>` : ''}
    </section>`;
}

/* ---------- 1 Briefing ---------- */
function briefing() {
  const mars = WORLD_ID === 'mars', days = isClassMode() ? 7 : 14, r = relayInfo();
  main().innerHTML = `<section class="panel stack hero">
    ${ROVER_OK ? '' : `<p class="lastline bad">${WORLDS[CAMPAIGN_WORLD].name} is an orbit-only challenge, so this rover mission runs on the Moon.</p>`}
    <div><span class="tag accent">Mission 2 of 3 · ${mars ? 'Mars bonus campaign' : 'Excavation and rover'}</span>
    <h1 class="big-title">${mars ? 'Operation Jezero' : 'Operation Regolith'}</h1>
    <p class="lead">${mars
      ? `Billions of years ago a river flowed into Jezero crater. Its delta may hold signs of ancient life, and NASA’s Perseverance rover is collecting rock samples there now. Design a rover, land in the crater and core the most interesting rocks in <b>${days} days</b>.`
      : `Artemis astronauts will need water to drink, air to breathe and rocket fuel. Near the Moon’s south pole, ice hides in craters that have not seen sunlight for billions of years. Design a rover, land it on the rim of <b>Shackleton crater</b> and dig before the <b>${days}-day</b> lunar daylight runs out.`}</p>
    <p class="small muted">${mars ? 'The map is Jezero crater from NASA Mars Trek (heights approximate).' : 'The 3D terrain is real: height and slope from NASA’s Lunar Reconnaissance Orbiter laser altimeter (LOLA).'}</p>
    <p class="lastline ${RELAY.assumed ? '' : 'good'}">${RELAY.assumed ? `No relay satellite flown yet: you get a standard relay (${r.windowH} h of contact every ${r.periodH} h). Fly Mission 1 first to design your own.` : `Your relay from Mission 1: ${r.windowH.toFixed(1)} h of contact about every ${r.periodH.toFixed(1)} h.`}</p></div>
    <h2>Choose your objective</h2>
    <div class="grid">${objectivesFor(WORLD_ID).map((o) => `<button class="card obj ${S.objectiveId === o.id ? 'selected' : ''}" data-obj="${o.id}" aria-pressed="${S.objectiveId === o.id}">
      <span class="tag ${o.level === 'Easy' ? 'good' : o.level === 'Medium' ? 'warn' : 'bad'}">${o.level}</span>
      <h3 style="margin-top:8px">${o.title}</h3><p class="small">${o.goal}</p>${isClassMode() ? '<p class="small muted">Class mode: half the target.</p>' : ''}</button>`).join('')}</div>
    <h2>Crew</h2>
    <div class="row">${[1, 2, 3, 4].map((n) => `<button data-players="${n}" class="${S.players === n ? 'primary' : ''}" aria-pressed="${S.players === n}">${n} player${n > 1 ? 's' : ''}</button>`).join('')}</div>
    <p class="small muted">${S.players > 1 ? 'Team mode: each part of the rover is owned by a role (Mission lead, Engineer, Scientist, Comms). Pass the laptop and agree together before launch.' : 'Solo: you play every role.'}</p>
    <div class="row"><button class="primary big" id="next" ${S.objectiveId ? '' : 'disabled'}>Choose a landing site</button></div></section>`;
  side().innerHTML = capcomPanel(hint('briefing', {}));
  main().onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.obj) { S.objectiveId = b.dataset.obj; sfx.select(); briefing(); }
    if (b.dataset.players) { S.players = Number(b.dataset.players); sfx.click(); briefing(); }
    if (b.id === 'next') { sfx.click(); go('site'); }
  };
}

/* ---------- 2 Landing site ---------- */
function mapControls() {
  return `<div class="row small" role="group" aria-label="Map view">
    ${[['terrain', 'Terrain'], ['slope', 'NASA slope map'], ['sun', 'Sunlight']].map(([v, l]) => `<button data-view="${v}" class="${S.view === v ? 'primary' : ''}" aria-pressed="${S.view === v}">${l}</button>`).join('')}</div>`;
}
export function legend() {
  if (WORLD_ID === 'mars') return `<div class="legend"><span><i style="background:rgba(70,194,138,.6)"></i>Safe to land</span>
    <span><i style="border:2px solid #7fdcff"></i>River delta (best samples)</span><span><i style="background:#ffd166"></i>Crater rim</span>
    <span><i style="background:#fff"></i>Sampled</span></div><p class="small muted" style="margin-top:6px">${SOURCE_NOTE}</p>`;
  return `<div class="legend"><span><i style="background:rgba(70,194,138,.6)"></i>Safe to land (&lt;10°)</span>
    <span><i style="border:2px solid #7fdcff"></i>Cold trap (may hold ice)</span><span><i style="background:rgba(20,40,110,.9)"></i>Shackleton crater, never lit</span>
    <span><i style="background:#ffd166"></i>Planned route</span></div><p class="small muted" style="margin-top:6px">${SOURCE_NOTE}</p>`;
}

/** A safe landing square close to what the objective needs (a keyboard-friendly alternative to clicking the map). */
function suggestSite() {
  const obj = findObjective(S.objectiveId), mars = WORLD_ID === 'mars';
  const kinds = mars ? (obj?.needKinds?.includes('delta') ? ['delta'] : []) : obj?.id === 'dark' ? ['floor'] : obj?.id === 'ice' ? ['trap'] : [];
  const goals = kinds.length ? cells.filter((c) => kinds.includes(c.kind)) : [];
  const mid = (cells.length ? Math.sqrt(cells.length) : 48) / 2;
  let best = null, bestScore = -Infinity;
  for (const c of cells) {
    if (c.slope !== 0 || c.kind !== 'plain') continue;
    const near = goals.length ? Math.min(...goals.map((g) => Math.hypot(g.i - c.i, g.j - c.j))) : mars ? Math.hypot(c.i - mid, c.j - mid) : 0;
    const score = (mars ? 0 : c.sun * 15) - near;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function site() {
  const c = S.siteK != null ? cells[S.siteK] : null;
  main().innerHTML = `<section class="panel stack"><div><h1>Pick a landing site</h1>
    <p>${WORLD_ID === 'mars' ? 'Click a green square, or press Suggest a safe site. The river delta (blue outlines) and the crater rim (gold dots) hold the most valuable rocks.' : 'Click a green square, or press Suggest a safe site. Landers tip over on slopes above about 10°. Ice is in the blue-outlined cold traps and in the dark crater.'}</p></div>
    ${mapControls()}<div class="mapwrap"><canvas id="map" aria-label="Map of the landing area"></canvas><div class="tip" id="tip" hidden></div></div>${legend()}
    <div class="row"><button id="back">Back</button><button id="suggest" title="Pick a safe square near what your objective needs">Suggest a safe site</button><button class="primary" id="next" ${c ? '' : 'disabled'}>Build the rover</button>
    <span class="small muted">${c ? `Selected: slope ${SLOPE_TEXT[c.slope]}${WORLD_ID === 'mars' ? '' : `, sunlight ${Math.round(sunAt(c, 0) * 100)}%, ${c.elev >= 150 ? 'Earth in view' : 'no direct Earth view'}`}` : 'No site yet'}</span></div></section>`;
  const canvas = $('#map');
  const redraw = () => draw(canvas, { view: S.view, mode: 'site', siteK: S.siteK, hover: S.hover });
  setupCanvas(canvas, redraw); redraw();
  canvas.onmousemove = (e) => {
    const h = cellFromEvent(canvas, e);
    const tip = $('#tip');
    if (h) {
      const ok = h.slope === 0 && h.kind === 'plain';
      tip.innerHTML = `<b>${ok ? 'Safe to land' : 'Not safe to land'}</b><br>Slope ${SLOPE_TEXT[h.slope]}${WORLD_ID === 'mars' ? ` · ${h.kind === 'plain' ? 'open plain' : h.kind}` : ` · Sun ${Math.round(sunAt(h, 0) * 100)}%<br>${h.elev >= 150 ? 'Earth in view' : 'No direct Earth view'}`}`;
      const r = canvas.getBoundingClientRect();
      tip.style.left = `${Math.max(4, Math.min(r.width - 200, e.clientX - r.left + 14))}px`; tip.style.top = `${e.clientY - r.top + 10}px`; tip.hidden = false;
    }
    if (h === S.hover) return;
    S.hover = h; redraw(); side().innerHTML = capcomPanel(hint('site', { cell: h }));
  };
  canvas.onmouseleave = () => { $('#tip').hidden = true; };
  canvas.onclick = (e) => {
    const h = cellFromEvent(canvas, e);
    if (h && h.slope === 0 && h.kind === 'plain') { S.siteK = h.k; S.tests = null; sfx.select(); site(); }
    else { sfx.bad(); side().innerHTML = capcomPanel(['That spot is too steep or in permanent darkness for a lander. Pick a green square.', ...hint('site', { cell: h })]); }
  };
  main().onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.view) { S.view = b.dataset.view; site(); }
    if (b.id === 'back') go('briefing');
    if (b.id === 'suggest') { const best = suggestSite(); if (best) { S.siteK = best.k; S.tests = null; sfx.select(); site(); $('#next')?.focus(); } }
    if (b.id === 'next') { sfx.click(); go('build'); }
  };
  side().innerHTML = capcomPanel(hint('site', { cell: c }));
}

/* ---------- 3 Build ---------- */
function delta(slot, p) {
  const cur = PARTS[slot].find((x) => x.id === S.design[slot]);
  if (cur.id === p.id) return '<span class="tag accent">Fitted</span>';
  const dm = p.massKg - cur.massKg, dc = p.costM - cur.costM;
  const f = (v, u, pre = '') => (v ? `<span class="tag ${v > 0 ? 'bad' : 'good'}">${v > 0 ? '+' : '−'}${pre}${Math.abs(v)}${u}</span>` : '');
  return f(dm, ' kg') + f(dc, 'M', '$');
}

function partCards(slot) {
  return PARTS[slot.id].map((p) => `<label class="pcard ${S.design[slot.id] === p.id ? 'on' : ''}">
    <input type="radio" name="${slot.id}" value="${p.id}" ${S.design[slot.id] === p.id ? 'checked' : ''}>
    <b>${p.name}</b><span class="small muted">${p.info}</span>
    <span class="nums">${p.massKg} kg · $${p.costM}M${p.digW ? ` · ${p.digW} W · ${p.rateKgH} kg/h` : ''}${p.driveW ? ` · ${p.driveW} W · climbs ${['up to 10°', 'up to 15°', 'up to 20°', 'any slope'][p.maxSlope]}` : ''}${p.heaterW ? ` · heaters ${p.heaterW} W` : ''}</span>
    <span class="deltas">${delta(slot.id, p)}</span></label>`).join('');
}

function buildSide() {
  const sum = summarize(S.design);
  $('#budget-wrap').innerHTML = budgetPanel();
  $('#cap-wrap').innerHTML = capcomPanel(hint('build', { sum, objective: findObjective(S.objectiveId) }));
}

function build() {
  main().innerHTML = `<section class="panel stack"><div><h1>Build your rover</h1>
    <p>Every part costs mass, money and power. There is no single right answer, only trade-offs.</p>
    <p class="small muted">Always included: ${BUS.name} (${BUS.massKg} kg, $${BUS.costM}M).</p></div>
    ${SLOTS.map((slot) => `<fieldset class="slot" data-slot="${slot.id}"><legend class="row"><h2 style="margin:0">${slot.label}</h2>
      ${S.players > 1 ? `<span class="tag accent">${slot.role}</span>` : ''}</legend>
      <div class="pgrid" id="slot-${slot.id}">${partCards(slot)}</div></fieldset>`).join('')}
    <div class="row"><button id="back">Back</button><button class="primary big" id="next">Run test campaign ($${LIMITS.testCostM}M)</button></div></section>`;
  side().innerHTML = `<section class="panel preview-panel"><h3>Your rover</h3><div id="preview" class="preview"></div>
    <p class="small muted">Not to scale. It updates as you pick parts.</p></section><div id="budget-wrap"></div><div id="cap-wrap"></div>`;
  buildSide();
  import('./scene3d.js').then(({ RoverPreview }) => {
    if (S.stage !== 'build') return;
    preview = new RoverPreview($('#preview')); preview.setDesign(S.design);
  }).catch(() => { $('#preview').innerHTML = '<p class="small muted">3D preview needs an internet connection.</p>'; });
  main().onchange = (e) => {
    if (!e.target.name) return;
    const slotId = e.target.name;
    S.design[slotId] = e.target.value; S.tests = null; sfx.select();
    for (const slot of SLOTS) $(`#slot-${slot.id}`).innerHTML = partCards(slot);
    $(`#slot-${slotId} input:checked`)?.focus(); // keep keyboard users in the group they were using
    buildSide();
    if (preview) preview.setDesign(S.design);
  };
  main().onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'back') go('site');
    if (b.id === 'next') {
      sfx.click(); S.testsRun++;
      S.tests = runTests(summarize(S.design), findObjective(S.objectiveId), S.siteK); go('test');
    }
  };
}

/* ---------- 4 Test ---------- */
function test() {
  const fails = S.tests.filter((t) => t.status === 'fail').length;
  const warns = S.tests.filter((t) => t.status === 'warn').length;
  main().innerHTML = `<section class="panel stack"><div><h1>Test campaign ${S.testsRun}</h1>
    <p>Engineers shook, froze and drove your rover on Earth. Finding a problem here is cheap. Finding it on the Moon ends the mission.</p></div>
    <div>${S.tests.map((t, n) => `<div class="check rise" style="--i:${n}"><span class="tag ${t.status === 'pass' ? 'good' : t.status}">${t.status.toUpperCase()}</span>
      <div><b>${t.title}</b><div class="small muted">${t.why}</div></div></div>`).join('')}</div>
    <p>${fails ? `<span class="tag bad">${fails} blocker${fails > 1 ? 's' : ''}</span> Fix these before launch.` : warns ? `<span class="tag warn">${warns} warning${warns > 1 ? 's' : ''}</span> You can launch, but these are risks.` : '<span class="tag good">Ready</span> All checks passed.'}</p>
    <div class="row"><button id="back">Change the design</button><button class="primary big launch" id="launch" ${fails ? 'disabled' : ''}>Launch and land</button></div></section>`;
  side().innerHTML = budgetPanel() + capcomPanel([fails ? 'Blockers mean the mission cannot fly. Go back and change parts.' : 'Warnings are risks, not rules. Real missions launch with known risks and plan around them.']);
  if (fails) sfx.bad(); else sfx.good();
  main().onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'back') go('build');
    if (b.id === 'launch') { startDeploy(); go('deploy'); }
  };
}

export function render() {
  stageBar();
  ({ briefing, site, build, test, deploy: () => renderDeploy(capcomPanel), debrief: () => renderDebrief(capcomPanel) })[S.stage]();
}

render();
