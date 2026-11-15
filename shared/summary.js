// Campaign summary: the end-of-game page. Shows how each mission's result fed the next, a WHAT / HOW / WHY tree,
// the decisions behind every score and the key science ideas, from what this browser saved (nothing is sent anywhere).
import { mountShell } from './shell.js';
import { getWorld, getWorldId, getMission, campaignScore } from './campaign.js';
import { MISSIONS } from './worlds.js';
import { whyTree, chainHTML } from './explain.js';

mountShell({ base: '', mission: null });
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const world = getWorld(), wid = getWorldId();
const res = Object.fromEntries(['orbit', 'rover', 'comms'].map((m) => [m, getMission(wid, m)]));
const MEDAL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', none: 'Flown' };
const tone = (s) => (s == null ? '' : s >= 65 ? 'good' : s >= 35 ? 'warn' : 'bad');
const hrs = (h) => (h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`);

const o = res.orbit, r = res.rover, c = res.comms;
const packets = r?.data?.packets || [];
const facts = {
  orbit: o ? (o.relay ? `${o.relay.orbit}: ${Math.round(o.relay.coverage * 100)}% contact, a ${hrs(o.relay.windowH)} pass every ${hrs(o.relay.periodH)}` : 'The satellite was lost during capture') : null,
  rover: r ? (r.summary || `${packets.length} data packets collected`) : null,
  comms: c ? (c.maxValue ? `${c.got} of ${c.maxValue} science points reached Earth${c.decoded ? `; decoded “${c.decoded}”` : ''}` : `Score ${c.score}`) : null,
};
const LEARN = {
  orbit: ['Kepler’s 2nd law: a satellite is slowest at its highest point, so put that point over the base for long contact.', 'The rocket equation: every kilogram needs fuel, and fuel needs a bigger rocket.', 'Science wants a low orbit; a relay wants a high one. Real missions balance both.'],
  rover: ['Energy budget: driving, digging and heating all drain one battery; the Sun or an RTG refills it.', 'Terrain decides everything: steep crater walls (from NASA laser maps) stop ordinary wheels.', 'Cold traps that never see sunlight keep water ice for billions of years.'],
  comms: ['Light delay: radio needs about 1.3 s to reach the Moon and up to 22 min to reach Mars.', 'Parity bits detect damage that noise causes; compression trades detail for speed.', 'NASA’s Deep Space Network hands spacecraft between Goldstone, Madrid and Canberra as Earth turns.'],
};

function missionCard(m) {
  const M = MISSIONS[m], x = res[m];
  return `<article class="panel sm-card ${tone(x?.best ?? x?.score)}">
    <div class="row" style="justify-content:space-between"><span class="tag accent">Mission ${M.n}</span>${x ? `<span class="tag ${tone(x.score)}">${MEDAL[x.medal] || 'Flown'}</span>` : '<span class="tag">Not flown</span>'}</div>
    <h2>${esc(M.title)}: ${esc(M.long)}</h2>
    ${x ? `<div class="row" style="align-items:baseline"><div class="score">${x.score}</div><div class="muted">/ 100 · best ${x.best}</div></div>
      <p>${esc(facts[m])}</p>
      ${x.decisions?.length ? `<p class="small muted">Your decisions:</p><div class="sm-chips">${x.decisions.map((d) => `<span>${esc(d)}</span>`).join('')}</div>` : ''}`
    : `<p class="muted">Fly this mission to complete the chain.</p>`}
    <a href="${M.href}"><button class="${x ? '' : 'primary'}">${x ? 'Fly it again' : 'Fly it now'}</button></a></article>`;
}

function tree() {
  const total = campaignScore(wid);
  const br = [];
  if (o) br.push({ how: `Orbit: ${o.profile || 'relay'}`, detail: (o.decisions || []).slice(0, 3).join(', '), tone: tone(o.score),
    why: [{ text: o.relay ? `${Math.round(o.relay.coverage * 100)}% contact` : 'Satellite lost', detail: o.relay ? `the rover could call home every ${hrs(o.relay.periodH)}` : 'the rover used the backup schedule', tone: tone(o.score) }]
      .concat(o.instrument ? [{ text: `${o.instrument}: ${o.gsdM} m pixels`, detail: o.goalMet ? 'science goal met' : 'too high to see the detail', tone: o.goalMet ? 'good' : 'warn' }] : []) });
  if (r) br.push({ how: 'Rover: built and drove', detail: (r.decisions || []).slice(0, 3).join(', '), tone: tone(r.score),
    why: [{ text: `${packets.length} data packet${packets.length === 1 ? '' : 's'}`, detail: r.summary || '', tone: tone(r.score) }] });
  if (c) br.push({ how: `Comms: ${c.comp || 'downlink'}`, detail: c.check || '', tone: tone(c.score),
    why: [{ text: c.maxValue ? `${Math.round((c.got / c.maxValue) * 100)}% of the science home` : `Score ${c.score}`, detail: c.ruined ? `${c.ruined} packet${c.ruined > 1 ? 's' : ''} damaged by noise` : 'no damaged packets', tone: tone(c.score) }] });
  if (!br.length) return '<p class="muted">No missions flown yet on this world. Start with Mission 1.</p>';
  return whyTree({ title: 'The whole campaign: WHAT happened, HOW you decided, WHY it turned out so', what: `${total} / ${world.missions.length * 100} · ${world.name} campaign`,
    whatDetail: total >= 200 ? 'The base is talking to Earth and the science is home.' : 'Part of the chain is still weak: replay a mission to strengthen it.', tone: total >= 200 ? 'good' : 'warn', branches: br });
}

function render() {
  const total = campaignScore(wid), done = Object.values(res).filter(Boolean).length;
  const chain = chainHTML([
    { k: 'Mission 1 · Orbit', v: o?.relay ? `${Math.round(o.relay.coverage * 100)}% contact` : o ? 'lost' : '—', tone: tone(o?.score), tip: 'Your relay orbit set how often the rover could talk to Earth.' },
    { k: 'gave the rover', v: o?.relay ? `a call every ${hrs(o.relay.periodH)}` : 'backup calls' },
    { k: 'Mission 2 · Rover', v: r ? `${packets.length} packets` : '—', tone: tone(r?.score), tip: 'What the rover found became the data to send home.' },
    { k: 'Mission 3 · Comms', v: c?.maxValue ? `${c.got}/${c.maxValue} science` : c ? `${c.score} pts` : '—', tone: tone(c?.score), tip: 'How much of the rover’s science reached Earth.' },
    { k: 'Campaign', v: `${total} / ${world.missions.length * 100}`, tone: tone(total / world.missions.length) }], 'How each mission fed the next');
  $('#main').innerHTML = `<section class="panel stack"><span class="tag accent">${esc(world.name)} · ${done} of ${world.missions.length} missions flown</span>
      <h1 class="big-title">Campaign summary</h1>
      <p class="lead">One base, three missions, one chain of consequences. Here is what you built, why it worked or failed, and what real space engineers learn from the same trade-offs.</p>
      <h2>How each mission fed the next</h2>${chain}
      <div id="sm-tree">${tree()}</div></section>
    <div class="sm-grid">${['orbit', 'rover', 'comms'].filter((m) => world.missions.includes(m)).map(missionCard).join('')}</div>
    <section class="panel stack"><h2>The science you used</h2><div class="sm-grid">${['orbit', 'rover', 'comms'].filter((m) => world.missions.includes(m)).map((m) => `<div><h3>${esc(MISSIONS[m].title)}</h3><ul>${LEARN[m].map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>`).join('')}</div>
      <p class="small muted">Numbers come from the game’s own physics, using NASA data: LRO laser terrain, Moon and Mars Trek maps, JPL planetary constants and the Deep Space Network schedule. Simplified models are labelled in each mission.</p>
      <div class="row no-print"><button class="primary" id="print">Print or save as PDF</button><a href="hub.html"><button>Back to mission control</button></a><a href="profile.html"><button>Crew profiles</button></a></div></section>`;
  $('#print').onclick = () => window.print();
}
render();
