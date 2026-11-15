// Mission 1 screen pieces: mission profiles, the spacecraft assembly bay, consequence chains and the science panel.
// HTML builders only (the screen logic lives in ui.js). Every number comes from plan.js / instruments.js.
import * as D from './data.js';
import { findInstrument, instrumentsFor, sizeText, daysText } from './instruments.js';
import { whyTree, chainHTML, info } from '../../shared/explain.js';

const fmt = (x, d = 0) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const profileOf = (id) => D.PROFILES.find((p) => p.id === id) || D.PROFILES[0];
export const insForProfile = (pid, wid) => { const p = profileOf(pid); return p.ins === 'none' ? 'none' : D.PROFILE_INS[p.ins][wid]; };

/** Mission profile cards: WHAT the satellite is for, WHY and HOW, and the trade-off. */
export function profileCardsHTML(cur, wid) {
  return `<div class="profiles" id="profiles" role="radiogroup" aria-label="What is the satellite for?">${D.PROFILES.map((p) => {
    const ins = findInstrument(wid, insForProfile(p.id, wid));
    return `<button type="button" class="choice prof ${cur === p.id ? 'on' : ''}" role="radio" aria-checked="${cur === p.id}" data-profile="${p.id}">
      <span class="prof-ico" aria-hidden="true">${p.icon}</span><b>${esc(p.name)}</b>
      <span class="prof-row"><i>WHAT</i>${esc(p.what)}</span>
      <span class="prof-row"><i>WHY</i>${esc(p.why)}</span>
      <span class="prof-row"><i>HOW</i>${esc(p.how)}</span>
      <span class="small muted">${ins.kind === 'none' ? 'No instrument.' : `Carries: ${esc(ins.name)} (like ${esc(ins.ref)}).`} ${esc(p.tradeoff)}</span></button>`;
  }).join('')}</div>`;
}

/** The briefing's mission-at-a-glance diagram. */
export function briefTree(world, wid, pid) {
  const p = profileOf(pid), ins = findInstrument(wid, insForProfile(pid, wid)), goal = Math.round(D.GOALS[wid] * 100);
  const branches = [
    { how: '1 · Build the satellite', detail: 'Rocket, antenna, solar wings, shielding' + (ins.kind === 'none' ? '' : `, ${ins.name.toLowerCase()}`),
      why: [{ text: 'Every kilogram needs fuel', detail: 'and the rocket can only lift so much' }] },
    { how: '2 · Shape the orbit', detail: 'Lowest and highest point, tilt, and where the high point sits',
      why: [{ text: 'Slow high point over the base', detail: 'Kepler’s 2nd law: long contact windows' }].concat(ins.kind === 'none' ? [] : [{ text: 'Low point for sharp science', detail: `${ins.name} works best close to the ground`, tone: 'warn' }]) },
    { how: '3 · Fly the capture burn', detail: 'Brake at the right moment, by the right amount',
      why: [{ text: 'Too gentle: fly past', tone: 'bad' }, { text: 'Too hard: orbit too low', tone: 'warn' }] },
    { how: '4 · Operate for 72 h', detail: 'Watch contact windows, handle a solar storm',
      why: [{ text: 'Your windows become the rover’s calls home', detail: 'in Mission 2', tone: 'good' }] },
  ];
  return whyTree({ title: 'Your mission at a glance', what: `${p.icon} ${p.name}: keep ${world.site.name.split(',')[0]} talking to Earth ≥ ${goal}% of the time`, whatDetail: p.what, branches });
}

/** A choice section with an info badge and a tooltip on every card. */
export function choiceSection(title, tipKey, list, key, cur, extra, cardTip = (x) => x.info) {
  return `<div class="cs"><h2>${esc(title)}${info(D.TIPS[tipKey])}</h2><div class="choice-grid">${list.map((x) => `<button class="choice ${cur === x.id ? 'on' : ''}" data-k="${key}" data-val="${x.id}" data-tip="${esc(cardTip(x))}" aria-pressed="${cur === x.id}">
  <b>${esc(x.name)}</b><span class="small muted">${esc(x.job || x.info)}</span><span class="nums">${extra(x)}</span></button>`).join('')}</div></div>`;
}

export function instrumentList(wid) { return [findInstrument(wid, 'none'), ...instrumentsFor(wid)]; }

/** Consequence chains for the current design: mass, power and money. */
export function chainsHTML(d) {
  const massTone = d.wet <= d.cap ? (d.cap - d.wet < d.cap * 0.1 ? 'warn' : 'good') : 'bad';
  const pTone = d.haveW >= d.needW ? (d.haveW - d.needW < 30 ? 'warn' : 'good') : 'bad';
  const cTone = d.cost <= D.BUDGET_M ? (D.BUDGET_M - d.cost < 15 ? 'warn' : 'good') : 'bad';
  return `<div class="chains" id="chain">
    <div class="ch-row"><span class="ch-k">Mass</span>${chainHTML([
      { k: 'Satellite (dry)', v: `${fmt(d.dry)} kg`, tip: D.TIPS.launchMass },
      { k: `Fuel for ${fmt(d.dvNeed * 1000)} m/s brake`, v: `+${fmt(d.prop)} kg`, tip: D.TIPS.fuel },
      { k: 'Launch mass', v: `${fmt(d.wet)} kg`, tone: massTone },
      { k: `${d.rk.name} lifts`, v: `${fmt(d.cap)} kg`, tone: massTone, tip: D.TIPS.rocket }], 'Mass chain')}</div>
    <div class="ch-row"><span class="ch-k">Power</span>${chainHTML([
      { k: 'Computer', v: `${D.BUS.powerW} W` }, { k: d.an.name, v: `+${d.an.powerW} W` },
      ...(d.ins.powerW ? [{ k: d.ins.name, v: `+${d.ins.powerW} W` }] : []),
      { k: 'Need / wings make', v: `${d.needW} / ${d.haveW} W`, tone: pTone, tip: D.TIPS.powerBal }], 'Power chain')}</div>
    <div class="ch-row"><span class="ch-k">Money</span>${chainHTML([
      { k: 'Rocket', v: `$${d.rk.costM}M` }, { k: 'Body + parts', v: `+$${d.cost - d.rk.costM}M` },
      { k: 'Total / budget', v: `$${d.cost}M / $${D.BUDGET_M}M`, tone: cTone, tip: D.TIPS.budget }], 'Money chain')}</div></div>`;
}

/** "You changed X: +20 kg, +60 W, +$13M -> needs +31 kg of fuel". */
export function deltaHTML(prev, d, what) {
  if (!prev) return '<p class="small muted" id="delta">Click any part: the model and the chains above show what it changes.</p>';
  const sign = (x, u, pre = '') => (x === 0 ? null : `${x > 0 ? '+' : '−'}${pre}${fmt(Math.abs(x))}${u}`);
  const bits = [sign(d.dry - prev.dry, ' kg'), sign(d.needW - prev.needW, ' W used'), sign(d.haveW - prev.haveW, ' W made'), sign(d.cost - prev.cost, 'M', '$'), sign(d.cap - prev.cap, ' kg rocket capacity')].filter(Boolean);
  const fuel = d.prop - prev.prop;
  return `<p class="delta" id="delta" aria-live="polite"><b>${esc(what)}</b>: ${bits.length ? bits.join(', ') : 'no change in mass, power or cost'}${Math.abs(fuel) >= 1 ? ` → ${fuel > 0 ? 'needs' : 'saves'} ${fmt(Math.abs(fuel))} kg of fuel` : ''}.</p>`;
}

/** The satellite model is assembled from NASA Satellite Kit parts: body (shielding), radio (antenna), wings (power). */
export function satFiles(S) {
  const body = { none: 'kit-body-1', standard: 'kit-body-2', hardened: 'kit-body-3' }[S.shield] || 'kit-body-2';
  const radio = { patch: 'kit-radio-1', dish: 'kit-radio-2', big: 'kit-radio-3' }[S.antenna];
  const wings = { solarS: 'kit-wings-1', solarL: 'kit-wings-3' }[S.power];
  return [body, radio, wings];
}

/** Science panel for the orbit design: sharpness, strip width, time to map, and a simulated camera view. */
export function scienceHTML(ins, sp) {
  if (!sp) return '';
  const ok = sp.goalMet, ratio = sp.gsdM / sp.goalGsdM;
  return `<section class="panel sci" id="science"><h3>${esc(ins.name)} on this orbit${info(`${ins.job} Modelled on ${ins.ref}. ${ins.info}`)}</h3>
    <div class="sci-grid"><div class="camview" data-tip="What one picture of the base would look like: each square is one pixel."><canvas id="camview" width="160" height="160" aria-label="Simulated view from the instrument"></canvas>
      <span class="small">${ok ? 'Sharp enough' : `${fmt(ratio, ratio < 10 ? 1 : 0)}× too blurry`}</span></div>
    <table class="readout">
      <tr><td data-tip="${esc(D.TIPS.gsd)}">Pixel size over the base</td><td class="${ok ? 'good' : 'bad'}">${sizeText(sp.gsdM)}</td></tr>
      <tr><td data-tip="The sharpest detail this job needs.">Science goal</td><td>${sizeText(sp.goalGsdM)}</td></tr>
      <tr><td data-tip="${esc(D.TIPS.swath)}">Strip width</td><td>${fmt(sp.swathKm, sp.swathKm < 10 ? 1 : 0)} km</td></tr>
      <tr><td data-tip="${esc(D.TIPS.mapTime)}">Time to map the world</td><td>${daysText(sp.mapDays)}</td></tr>
      <tr><td data-tip="Highest latitude the instrument can see. The base is at the pole.">Reaches latitude</td><td>${fmt(sp.latReach)}°</td></tr>
      <tr><td data-tip="Share of the science recorded each orbit that the antenna can send home.">Data sent home</td><td>${fmt(sp.returnFraction * 100)}%</td></tr></table></div>
    <p class="small muted">${ok ? 'The satellite passes close enough over the base for this job.' : 'Bring the low point over the base (and lower it) for sharper detail. But the relay wants the slow HIGH point over the base: that is the trade-off.'}</p></section>`;
}

/** Paint a pixelated crop of the world map into the camera canvas: fewer, bigger pixels when the orbit is too high. */
export function paintCamera(canvas, textureUrl, ratio) {
  if (!canvas) return;
  const img = new Image();
  img.onload = () => {
    const g = canvas.getContext('2d'), n = Math.max(4, Math.min(160, Math.round(160 / Math.max(1, ratio))));
    const t = document.createElement('canvas'); t.width = n; t.height = n;
    const sw = img.width * 0.08, sh = sw; // a small square of the map near the bottom (south)
    t.getContext('2d').drawImage(img, img.width * 0.46, img.height * 0.86, sw, sh, 0, 0, n, n);
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, 160, 160); g.drawImage(t, 0, 0, 160, 160);
  };
  img.src = textureUrl;
}
export { sizeText };
