// Mission 1: Orbit. Place the relay satellite that links the landing site with Earth.
// Stages: Briefing -> Build -> Orbit -> Test -> Launch -> Debrief.
import * as O from './orbit.js';
import * as D from './data.js';
import { mountShell, celebrate, coachOnce } from '../../shared/shell.js';
import { getWorld, getWorldId, saveMission, isClassMode } from '../../shared/campaign.js';
import { awardRun } from '../../shared/profile.js';
import { whiskersSVG } from '../../shared/cat.js';
import { sfx, toast } from '../../shared/fx.js';

const $ = (s) => document.querySelector(s);
const world = getWorld(), wid = getWorldId();
const STAGES = ['Briefing', 'Build', 'Orbit', 'Test', 'Launch', 'Debrief'];
const S = { stage: 0, rocket: 'medium', antenna: 'dish', power: 'solarL', p: { ...D.PRESETS[wid][1].p }, preset: 1, tests: 0, err: null, result: null };
let globe = null, timer = null;

mountShell({ base: '../../', mission: 'orbit', shortcuts: [['Space', 'Fire the capture burn (Launch stage)'], ['1–3', 'Pick an orbit preset (Orbit stage)']] });

/* ---------- derived numbers ---------- */
const pick = (list, id) => list.find((x) => x.id === id);
function design() {
  const rk = pick(D.ROCKETS, S.rocket), an = pick(D.ANTENNAS, S.antenna), pw = pick(D.POWER, S.power);
  const el = O.elements(S.p, world);
  const dv = O.captureBurn(el, world.vInfKms);
  const dry = D.BUS.massKg + an.massKg + pw.massKg;
  const prop = O.propellantKg(dry, dv * 1.1); // 10% margin for corrections
  const wet = dry + prop, cap = Math.round(rk.capKg * D.PAYLOAD_FACTOR[wid]);
  const cost = rk.costM + D.BUS.costM + an.costM + pw.costM + S.tests * 3;
  const needW = D.BUS.powerW + an.powerW;
  return { rk, an, pw, el, dv, dry, prop, wet, cap, cost, needW, haveW: pw.powerW };
}
const tl = (el) => O.contactTimeline(el, world, { hours: 72 });
const pct = (x) => `${Math.round(x * 100)}%`;
const hrs = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);

/* ---------- shared bits ---------- */
function stageBar() {
  $('#stages').innerHTML = STAGES.map((s, n) => `<span class="stage ${n < S.stage ? 'done' : n === S.stage ? 'now' : ''}">${n + 1} ${s}</span>`).join('');
}
function whiskers(tips) {
  return `<section class="panel capcom" aria-live="polite"><h3>${whiskersSVG(36)} CAPCOM Whiskers</h3><ul>${tips.map((t) => `<li>${t}</li>`).join('')}</ul>
    <details class="small"><summary>Space words explained</summary>${D.GLOSSARY.map(([w, d]) => `<p><b>${w}:</b> ${d}</p>`).join('')}</details></section>`;
}
function meter(label, v, max, text, lowBad = false) {
  const p = Math.max(0, Math.min(100, (v / max) * 100));
  const bad = lowBad ? p < 25 : v > max, warn = lowBad ? p < 50 : p > 90;
  return `<div class="meter"><div class="lbl"><span>${label}</span><b>${text}</b></div><div class="bar"><i class="${bad ? 'bad' : warn ? 'warn' : ''}" style="width:${p}%"></i></div></div>`;
}
function budgetPanel(d, t) {
  return `<section class="panel"><h3>Mission budget</h3>
    ${meter('Mass on the rocket', d.wet, d.cap, `${Math.round(d.wet)} / ${d.cap} kg`)}
    ${meter('Money', d.cost, D.BUDGET_M, `$${d.cost}M / $${D.BUDGET_M}M`)}
    ${meter('Power', d.needW, d.haveW, `${d.needW} / ${d.haveW} W`)}
    ${t ? meter('Contact with the base', t.coverage, 1, `${pct(t.coverage)} (goal ${pct(D.GOALS[wid])})`, true) : ''}</section>`;
}
function go(n) {
  S.stage = n;
  if (globe) { globe.dispose(); globe = null; }
  clearInterval(timer);
  const m = $('#main'); m.onclick = null; m.oninput = null; document.onkeydown = null; // no stale handlers from the last screen
  render(); window.scrollTo({ top: 0 });
}
async function makeGlobe(el) {
  try { const { Globe } = await import('../../shared/globe.js'); return new Globe(el, { base: '../../', world, autoRotate: 0.05 }); }
  catch { el.innerHTML = '<p class="small muted" style="padding:20px">3D view needs an internet connection. The mission still works.</p>'; return null; }
}
const toGlobe = (p) => [p[0] / world.radiusKm, p[2] / world.radiusKm, -p[1] / world.radiusKm];

/* ---------- 1 Briefing ---------- */
function briefing() {
  $('#main').innerHTML = `<section class="panel stack hero"><span class="tag accent">Mission 1 of 3 · ${world.name}</span>
    <h1 class="big-title">Place the relay satellite</h1>
    <p class="lead">Your rover will land at <b>${world.site.name}</b>. From there it often can’t see Earth. A relay satellite in the right orbit passes its messages on.
    Your goal: keep the base in contact at least <b>${pct(D.GOALS[wid])}</b> of the time, within <b>$${D.BUDGET_M}M</b>.</p>
    <div class="statgrid">
      <div class="stat"><div class="lbl">Gravity</div><div class="val">${world.gravity} m/s²</div></div>
      <div class="stat"><div class="lbl">Radius</div><div class="val">${world.radiusKm.toLocaleString()} km</div></div>
      <div class="stat"><div class="lbl">One day there</div><div class="val">${world.dayHours < 48 ? world.dayHours + ' h' : Math.round(world.dayHours / 24) + ' Earth days'}</div></div>
      <div class="stat"><div class="lbl">Signal to Earth</div><div class="val">${world.lightSec[1] < 60 ? world.lightSec[0] + ' s' : Math.round(world.lightSec[0] / 60) + '–' + Math.round(world.lightSec[1] / 60) + ' min'}</div></div>
    </div>
    <p class="small muted">Gravity and size from NASA/JPL planetary data. Planet image: ${world.source}.</p>
    <div class="row"><button class="primary big" id="next">Build the satellite</button></div></section>`;
  $('#side').innerHTML = whiskers(['Every choice has a cost: a bigger antenna sends more data, but it is heavier and needs more power and fuel.', 'Your orbit decides how often the rover can talk to Earth in Mission 2.']);
  $('#next').onclick = () => { sfx.click(); go(1); };
}

/* ---------- 2 Build ---------- */
function cards(list, key, extra = () => '') {
  return `<div class="choice-grid">${list.map((x) => `<button class="choice ${S[key] === x.id ? 'on' : ''}" data-k="${key}" data-v="${x.id}">
    <b>${x.name}</b><span class="small muted">${x.info}</span><span class="nums">${extra(x)}</span></button>`).join('')}</div>`;
}
function build() {
  const d = design();
  $('#main').innerHTML = `<section class="panel stack"><h1>Build the satellite</h1><p>Pick a rocket, an antenna and solar wings. The fuel you need comes later from your orbit choice.</p>
    <h2>Rocket</h2>${cards(D.ROCKETS, 'rocket', (x) => `${Math.round(x.capKg * D.PAYLOAD_FACTOR[wid])} kg to ${world.name} · $${x.costM}M`)}
    <h2>Antenna</h2>${cards(D.ANTENNAS, 'antenna', (x) => `${x.massKg} kg · $${x.costM}M · ${x.powerW} W · data ×${x.rate}`)}
    <h2>Power</h2>${cards(D.POWER, 'power', (x) => `${x.massKg} kg · $${x.costM}M · ${x.powerW} W`)}
    <p class="small muted">Always included: ${D.BUS.name} (${D.BUS.massKg} kg, $${D.BUS.costM}M, ${D.BUS.powerW} W).</p>
    <div class="row"><button id="back">Back</button><button class="primary big" id="next">Design the orbit</button></div></section>`;
  const tips = [];
  if (d.needW > d.haveW) tips.push(`The antenna and computer need ${d.needW} W, but the wings make ${d.haveW} W. Pick bigger wings or a smaller antenna.`);
  if (d.cost > D.BUDGET_M) tips.push('Over budget. A smaller rocket or antenna would help.');
  if (wid !== 'moon' && S.rocket === 'small') tips.push(`${world.name} is far away: a rocket carries much less there than to the Moon.`);
  if (!tips.length) tips.push('Data rate matters in Mission 3: a bigger dish gives you more time to send the rover’s science home.');
  $('#side').innerHTML = budgetPanel(d) + whiskers(tips);
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.k) { S[b.dataset.k] = b.dataset.v; sfx.select(); build(); }
    if (b.id === 'back') go(0);
    if (b.id === 'next') { sfx.click(); go(2); }
  };
}

/* ---------- 3 Orbit design (live 3D) ---------- */
function orbit() {
  const L = D.LIMITS[wid];
  const sl = (k, label, min, max, step, unit) => `<div class="slider"><label for="s-${k}">${label}</label>
    <input type="range" id="s-${k}" min="${min}" max="${max}" step="${step}" value="${S.p[k]}"><output id="o-${k}">${S.p[k].toLocaleString()} ${unit}</output></div>`;
  $('#main').innerHTML = `<section class="panel stack"><h1>Design the orbit</h1>
    <div class="row">${D.PRESETS[wid].map((p, n) => `<button class="${S.preset === n ? 'primary' : ''}" data-preset="${n}" title="${p.like}">${n + 1}. ${p.name}</button>`).join('')}</div>
    <p class="small muted" id="like">${S.preset != null ? `${D.PRESETS[wid][S.preset].name}: ${D.PRESETS[wid][S.preset].like}` : 'Your own design'}</p>
    <div class="globe-box" id="globe"></div>
    ${sl('periAltKm', 'Lowest point (periapsis)', L.minPeri, Math.min(10000, L.maxApo), 10, 'km')}
    ${sl('apoAltKm', 'Highest point (apoapsis)', L.minPeri, L.maxApo, 50, 'km')}
    ${sl('incDeg', 'Tilt (inclination)', 0, 100, 1, '°')}
    <div class="slider"><label>Highest point above</label><div class="row">${['south', 'north', 'equator'].map((v) => `<button data-apo="${v}" class="${S.p.apoOver === v ? 'primary' : ''}">${v === 'equator' ? 'Equator' : v === 'south' ? 'South pole' : 'North pole'}</button>`).join('')}</div><span></span></div>
    <div class="row"><button id="back">Back</button><button class="primary big" id="next">Run the test campaign ($3M)</button></div></section>`;
  makeGlobe($('#globe')).then((g) => { globe = g; if (g) { g.setSite(world.site.latDeg); update(); } });
  const update = () => {
    const d = design(), t = tl(d.el);
    if (globe) { globe.setOrbit(O.orbitPath(d.el).map(toGlobe)); globe.frame(Math.max(3.4, (d.el.ra / world.radiusKm) * 2.6)); globe.setSat(toGlobe(O.positionAt(d.el, d.el.T / 2))); }
    $('#side').innerHTML = budgetPanel(d, t) + `<section class="panel"><h3>Orbit numbers</h3><div class="statgrid">
      <div class="stat"><div class="lbl">One orbit</div><div class="val">${hrs(d.el.T / 3600)}</div></div>
      <div class="stat ${t.coverage >= D.GOALS[wid] ? 'good' : 'bad'}"><div class="lbl">Base in contact</div><div class="val">${pct(t.coverage)}</div></div>
      <div class="stat"><div class="lbl">Each contact lasts</div><div class="val">${hrs(t.avgWindowH)}</div></div>
      <div class="stat"><div class="lbl">Brake burn (delta-v)</div><div class="val">${d.dv.toFixed(2)} km/s</div></div>
      <div class="stat"><div class="lbl">Fuel needed</div><div class="val">${Math.round(d.prop)} kg</div></div>
      <div class="stat"><div class="lbl">Speed at lowest point</div><div class="val">${O.visViva(d.el.rp, d.el.a, world.gm).toFixed(2)} km/s</div></div></div></section>`
      + whiskers(orbitTips(d, t));
  };
  let deb = null;
  $('#main').oninput = (e) => {
    const k = e.target.id?.replace('s-', ''); if (!(k in S.p)) return;
    S.p[k] = Number(e.target.value); S.preset = null;
    $(`#o-${k}`).textContent = `${S.p[k].toLocaleString()} ${k === 'incDeg' ? '°' : 'km'}`; $('#like').textContent = 'Your own design';
    clearTimeout(deb); deb = setTimeout(update, 60);
  };
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.preset) { S.preset = Number(b.dataset.preset); S.p = { ...D.PRESETS[wid][S.preset].p }; sfx.select(); orbit(); return; }
    if (b.dataset.apo) { S.p.apoOver = b.dataset.apo; S.preset = null; sfx.select(); orbit(); return; }
    if (b.id === 'back') go(1);
    if (b.id === 'next') { S.tests++; sfx.click(); go(3); }
  };
  document.onkeydown = (e) => { if (S.stage === 2 && ['1', '2', '3'].includes(e.key)) $(`[data-preset="${Number(e.key) - 1}"]`)?.click(); };
  update();
  coachOnce('orbit', ['Drag the sliders or pick a real mission’s orbit. The blue line is your orbit; the yellow dot is the base.',
    'Watch “Base in contact”. Hint: a satellite moves slowly at its highest point, so put that point above the base.']);
}
function orbitTips(d, t) {
  const tips = [];
  if (t.coverage < D.GOALS[wid]) tips.push(`Contact is ${pct(t.coverage)}; the goal is ${pct(D.GOALS[wid])}. Satellites crawl at their highest point: put it above ${world.site.latDeg < 0 ? 'the south pole' : world.site.latDeg > 60 ? 'the north pole' : 'the base'}.`);
  if (t.avgWindowH < 0.5) tips.push('Each contact is very short. The rover may not finish a conversation before the satellite drops below the horizon.');
  if (d.wet > d.cap) tips.push(`Too heavy: ${Math.round(d.wet)} kg, but the rocket carries ${d.cap} kg. Lower orbits need a bigger braking burn, which means more fuel.`);
  if (d.dv > 2.5) tips.push(`A ${d.dv.toFixed(1)} km/s braking burn is huge. Fuel grows exponentially with delta-v (the rocket equation).`);
  if (!tips.length) tips.push('Looks good. Remember: there is rarely one perfect orbit. Several designs can meet the goal.');
  return tips;
}

/* ---------- 4 Test ---------- */
function test() {
  const d = design(), t = tl(d.el), L = D.LIMITS[wid];
  const checks = [
    [d.wet <= d.cap ? 'pass' : 'fail', `Mass ${Math.round(d.wet)} kg (rocket carries ${d.cap} kg)`, d.wet <= d.cap ? 'It fits on the rocket, fuel included.' : 'Too heavy to launch. Lighter parts, a bigger rocket, or an orbit that needs less braking.'],
    [d.cost <= D.BUDGET_M ? 'pass' : 'fail', `Cost $${d.cost}M (budget $${D.BUDGET_M}M)`, d.cost <= D.BUDGET_M ? 'Within budget, tests included.' : 'Over budget: the mission would be cancelled.'],
    [d.haveW >= d.needW ? 'pass' : 'fail', `Power ${d.haveW} W for ${d.needW} W of equipment`, d.haveW >= d.needW ? 'The wings power everything.' : 'Not enough power to run the antenna.'],
    [S.p.periAltKm >= L.minPeri ? 'pass' : 'fail', `Lowest point ${S.p.periAltKm} km`, wid === 'mars' ? 'Below about 120 km, Mars’s thin air drags the satellite down.' : 'High enough to clear the mountains.'],
    [t.coverage >= D.GOALS[wid] ? 'pass' : 'warn', `Base in contact ${pct(t.coverage)} (goal ${pct(D.GOALS[wid])})`, t.coverage >= D.GOALS[wid] ? 'Meets the goal.' : 'Below the goal. You can still fly, but the rover will often be out of touch.'],
    [t.avgWindowH >= 0.5 ? 'pass' : 'warn', `Each contact lasts ${hrs(t.avgWindowH)}`, t.avgWindowH >= 0.5 ? 'Long enough to send data.' : 'Short windows make Mission 3 harder.'],
  ];
  const fails = checks.filter((c) => c[0] === 'fail').length;
  $('#main').innerHTML = `<section class="panel stack"><h1>Test campaign ${S.tests}</h1><p>Engineers checked your design in a computer model, like NASA does with GMAT before a real launch.</p>
    <div>${checks.map(([s, h, w], n) => `<div class="check rise" style="--i:${n}"><span class="tag ${s === 'pass' ? 'good' : s}">${s.toUpperCase()}</span><div><b>${h}</b><div class="small muted">${w}</div></div></div>`).join('')}</div>
    <div class="row"><button id="back">Change the orbit</button><button class="primary big launch" id="next" ${fails ? 'disabled' : ''}>Launch!</button></div></section>`;
  $('#side').innerHTML = budgetPanel(d, t) + whiskers([fails ? 'Blockers stop the launch. Go back and change the design.' : 'Next: the capture burn. Fire the engine at the lowest point of your arrival, or the orbit comes out wrong.']);
  if (fails) sfx.bad(); else sfx.good();
  $('#main').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.id === 'back') go(2); if (b.id === 'next') { sfx.thrust?.(); go(4); } };
}

/* ---------- 5 Launch: timed capture burn, then 3 days of operations ---------- */
function launch() {
  $('#main').innerHTML = `<section class="panel stack"><h1>Capture burn</h1>
    <p>Your satellite is falling toward ${world.name}. Fire the engine when the needle is in the green zone: that’s the lowest point of the approach, where braking works best.</p>
    <div class="globe-box" id="globe"></div>
    <div class="gauge-burn"><div class="zone"></div><div class="needle" id="needle"></div></div>
    <div class="row"><button class="primary big" id="fire">Fire engine <span class="kbd">Space</span></button><span class="small muted" id="burnmsg"></span></div></section>`;
  $('#side').innerHTML = whiskers(['Timing matters: braking too early or too late changes how high the orbit goes.', 'In real missions, computers time this burn to a fraction of a second.']);
  makeGlobe($('#globe')).then((g) => { globe = g; if (g) { g.setSite(world.site.latDeg); g.frame(5); } });
  const t0 = performance.now(), dur = isClassMode() ? 3500 : 4500;
  let fired = false;
  const fire = () => {
    if (fired) return; fired = true;
    const u = Math.min(1, (performance.now() - t0) / dur);
    S.err = Math.max(-1, Math.min(1, (u - 0.5) / 0.5));
    sfx.thrust?.();
    const q = Math.abs(S.err);
    $('#burnmsg').textContent = q < 0.1 ? 'Perfect burn!' : q < 0.3 ? 'Good burn, slightly off.' : 'Off target: the orbit came out different.';
    toast($('#burnmsg').textContent, q < 0.3 ? 'good' : 'bad');
    setTimeout(operate, 900);
  };
  $('#fire').onclick = fire;
  document.onkeydown = (e) => { if (e.key === ' ' && S.stage === 4) { e.preventDefault(); fire(); } };
  clearInterval(timer);
  timer = setInterval(() => {
    const u = Math.min(1, (performance.now() - t0) / dur);
    const n = $('#needle'); if (n) n.style.left = `${u * 100}%`;
    if (globe) { const a = (1 - u) * 2.2 + 1.15; globe.setSat([a * Math.cos(u * 3), 0.2 * (1 - u), a * Math.sin(u * 3)]); }
    if (u >= 1 && !fired) fire();
  }, 30);
}

function operate() {
  clearInterval(timer);
  if (globe) { globe.dispose(); globe = null; }
  const params = O.missedBurn(S.p, S.err);
  const el = O.elements(params, world), t = tl(el);
  S.final = { params, el, t };
  $('#main').innerHTML = `<section class="panel stack"><h1>Three days in orbit</h1><p>Green bars: times the base can talk to Earth through your satellite.</p>
    <div class="globe-box" id="globe"></div>
    <div class="timeline" id="tlbar">${t.windows.map((w) => `<i style="left:${(w.startH / 72) * 100}%;width:${Math.max(0.3, ((w.endH - w.startH) / 72) * 100)}%"></i>`).join('')}<span class="now" id="tnow"></span></div>
    <div class="row small muted" style="justify-content:space-between"><span>Day 1</span><span>Day 2</span><span>Day 3</span></div>
    <div class="row"><button class="primary big" id="next">Mission debrief</button><span id="tstat" class="small"></span></div></section>`;
  makeGlobe($('#globe')).then((g) => {
    globe = g; if (!g) return;
    g.autoRotate = 0; g.setSite(world.site.latDeg); g.setOrbit(O.orbitPath(el).map(toGlobe)); g.frame(Math.max(3.4, (el.ra / world.radiusKm) * 2.6));
    const start = performance.now(), simH = 72, realMs = 12000;
    g.onFrame = () => {
      const h = Math.min(simH, ((performance.now() - start) / realMs) * simH);
      g.setSat(toGlobe(O.positionAt(el, h * 3600)));
      g.spin.rotation.y = (2 * Math.PI * h) / world.dayHours;
      const on = t.windows.some((w) => h >= w.startH && h < w.endH);
      g.setContact(on);
      const now = $('#tnow'); if (now) now.style.left = `${(h / simH) * 100}%`;
      const ts = $('#tstat'); if (ts) ts.textContent = `Hour ${Math.round(h)} · ${on ? 'base in contact' : 'no contact'}`;
    };
  });
  $('#side').innerHTML = budgetPanel(design(), t) + whiskers([`Final orbit: ${Math.round(params.periAltKm)} × ${Math.round(params.apoAltKm)} km, one orbit every ${hrs(el.T / 3600)}.`, `The base is in contact ${pct(t.coverage)} of the time.`]);
  $('#next').onclick = () => { sfx.click(); go(5); };
}

/* ---------- 6 Debrief ---------- */
function debrief() {
  const d = design(), f = S.final, t = f.t;
  const left = D.BUDGET_M - d.cost, margin = d.cap - d.wet;
  const items = [
    ['Contact with the base', 40, Math.round(40 * Math.min(1, t.coverage / D.GOALS[wid])), `${pct(t.coverage)} of the time (goal ${pct(D.GOALS[wid])}).`],
    ['Contact length', 15, Math.round(15 * Math.min(1, t.avgWindowH / 2)), `Each contact lasts ${hrs(t.avgWindowH)}.`],
    ['Data rate', 10, Math.round((d.an.rate / 4) * 10), `${d.an.name}: data ×${d.an.rate}.`],
    ['Burn accuracy', 15, Math.round(15 * (1 - Math.abs(S.err))), Math.abs(S.err) < 0.1 ? 'A near-perfect capture burn.' : 'The burn was off, so the orbit changed.'],
    ['Budget left', 10, Math.round(10 * Math.min(1, Math.max(0, left) / 40)), `$${left}M left after ${S.tests} test campaign${S.tests === 1 ? '' : 's'}.`],
    ['Mass margin', 10, Math.round(10 * Math.min(1, Math.max(0, margin) / (d.cap * 0.25))), `${Math.round(margin)} kg spare on the rocket.`],
  ];
  const score = items.reduce((a, i) => a + i[2], 0);
  const badges = [];
  if (Math.abs(S.err) < 0.1) badges.push('Bullseye burn');
  if (t.coverage >= 0.8) badges.push('Always in touch');
  if (left >= 50) badges.push('Thrifty engineer');
  if (S.preset != null) badges.push('Real-mission twin');
  const lessons = [];
  if (t.coverage < D.GOALS[wid]) lessons.push('Satellites move slowest at their highest point (Kepler’s second law). Put that point above the base to stay in touch longer.');
  if (Math.abs(S.err) >= 0.3) lessons.push('The capture burn was mistimed, so the orbit came out higher or lower than planned. Real missions use computers and correction burns.');
  if (d.dv > 1.5) lessons.push('Low orbits need a big braking burn, and fuel grows exponentially with delta-v. That is why many relays use high, elliptical orbits.');
  if (!lessons.length) lessons.push('Great design. Could a smaller rocket or antenna still meet the goal? Engineers always look for margin.');
  const relay = { periodH: +t.cycleH.toFixed(2), windowH: +Math.min(t.avgWindowH, t.cycleH).toFixed(2), coverage: +t.coverage.toFixed(3), dataRate: d.an.rate, orbit: `${Math.round(f.params.periAltKm)} × ${Math.round(f.params.apoAltKm)} km` };
  saveMission(wid, 'orbit', { score, relay });
  const award = awardRun({ mission: 'orbit', world: wid, score, summary: `${relay.orbit}, ${pct(t.coverage)} contact`, badges,
    decisions: [d.rk.name, d.an.name, d.pw.name, S.preset != null ? D.PRESETS[wid][S.preset].name : 'Custom orbit', `Burn ${Math.abs(S.err) < 0.1 ? 'perfect' : 'off by ' + Math.round(Math.abs(S.err) * 100) + '%'}`] });
  celebrate(award);
  if (score >= 65) sfx.good(); else sfx.bad();
  const stars = score >= 85 ? 3 : score >= 60 ? 2 : score >= 35 ? 1 : 0;
  $('#main').innerHTML = `<section class="panel stack"><div class="row" style="justify-content:space-between"><div><span class="tag ${score >= 65 ? 'good' : 'warn'}">${score >= 65 ? 'Relay online' : 'Relay weak'}</span>
    <div class="row" style="align-items:baseline"><div class="score">${score}</div><div class="muted">/ 100</div></div></div>
    <div class="stars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="--i:${n}">★</span>`).join('')}</div></div>
    <div>${items.map(([l, m, p, w], n) => `<div class="check rise" style="--i:${n}"><span class="tag ${p >= m * 0.8 ? 'good' : p >= m * 0.4 ? 'warn' : 'bad'}">${p}/${m}</span><div><b>${l}</b><div class="small muted">${w}</div></div></div>`).join('')}</div>
    <h2>Why it went this way</h2><ul>${lessons.map((l) => `<li>${l}</li>`).join('')}</ul>
    <h2>What this means for Mission 2</h2><p>Your rover will have a relay contact window of <b>${hrs(relay.windowH)}</b> about every <b>${hrs(relay.periodH)}</b>. Outside those windows, surprises must be handled by the rover alone.</p>
    <div class="row"><a href="../rover/index.html"><button class="primary big">Next: Mission 2, the rover</button></a><button id="again">Fly again</button></div></section>`;
  $('#side').innerHTML = whiskers(['Your relay schedule is saved and will be used by the rover in Mission 2.']);
  $('#again').onclick = () => go(1);
}

function render() {
  stageBar();
  [briefing, build, orbit, test, launch, debrief][S.stage]();
}
render();
