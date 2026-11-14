// Debrief: score, battery chart, badges, lessons, real missions, XP for the crew, and the hand-off to Mission 3.
import { LIMITS } from './parts.js';
import * as E from './engine.js';
import { WORLD_ID, cells } from './world.js';
import { S, go } from './game.js';
import { leaveDeploy, startDeploy } from './deploy.js';
import { saveMission } from '../../shared/campaign.js';
import { awardRun } from '../../shared/profile.js';
import { celebrate } from '../../shared/shell.js';
import { sfx } from '../../shared/fx.js';

const $ = (sel) => document.querySelector(sel);

export function finishRun() {
  const r = S.run;
  S.result = E.debrief(r);
  S.badges = badges(r, S.result);
  saveMission(WORLD_ID, 'rover', { score: S.result.score, data: { packets: E.dataPackets(r) } });
  S.award = awardRun({
    mission: 'rover', world: WORLD_ID, score: S.result.score, summary: `${r.objective.title}: ${E.gotText(r)}`,
    badges: S.badges.filter((b) => b.got).map((b) => b.name),
    decisions: [r.rover.mob.name, r.rover.parts.find((p) => p.batteryWh)?.name || '', r.rover.dig.name, r.rover.therm.name, r.rover.comm.name, r.rover.sci.name, r.rover.extra.name].filter(Boolean),
  });
  leaveDeploy();
  go('debrief');
  if (S.result.grade === 'Mission success') sfx.good(); else sfx.bad();
  celebrate(S.award);
}

function badges(r, d) {
  const budgetLeft = LIMITS.budgetM - r.rover.costM - r.testsRun * LIMITS.testCostM;
  const mars = WORLD_ID === 'mars';
  const all = [
    ['Objective met', 'Hit the mission target', d.progress >= 1],
    ['Survivor', 'Rover alive at the end', r.rover.alive],
    mars ? ['Delta hunter', 'Cored 2 or more delta samples', r.samples.filter((x) => x.kind === 'delta').length >= 2]
      : ['Into the dark', 'Reached the never-lit crater floor', r.floorSample],
    mars ? ['Field geologist', 'Sampled the floor, the delta and the rim', ['floor', 'delta', 'rim'].every((k) => r.samples.some((x) => x.kind === k))]
      : ['Ice mapper', 'Scanned 75+ squares for ice', r.scanned.size >= 75],
    ['Never flat', 'No brownouts and no fault-protection stops', r.stats.brownouts === 0 && r.stats.faultStops === 0],
    ['Penny pincher', '$40M or more left over', budgetLeft >= 40],
    ['Light packer', '40 kg or more spare on the lander', LIMITS.landerCapacityKg - r.rover.massKg >= 40],
    ['Mission control', 'Every surprise handled with a link to Earth', r.decisions.total > 0 && r.decisions.total === r.decisions.withLink],
  ];
  return all.map(([name, why, got]) => ({ name, why, got }));
}

function lessonsFor(r, d) {
  const L = [], mars = WORLD_ID === 'mars';
  if (r.endReason === 'froze') L.push(mars ? 'Martian nights last about 12 hours at around -80 °C. Without heaters or an RTG, electronics crack. That is why Curiosity and Perseverance carry an RTG.' : 'Shadows near the lunar pole drop to about -200 °C. Heaters or an RTG keep electronics alive.');
  if (r.endReason === 'battery') L.push('The battery ran out where there was no sunlight. Plan trips into the dark like dives: go in, work, come back up to recharge.');
  if (r.stats.brownouts) L.push(`The battery ran flat ${r.stats.brownouts} time${r.stats.brownouts === 1 ? '' : 's'}. A bigger battery or shorter drives would have saved hours.`);
  if (r.stats.faultStops) L.push(`Fault protection stopped the rover ${r.stats.faultStops} time${r.stats.faultStops === 1 ? '' : 's'} to protect the battery. Real rovers do this too; it’s a sign to rest earlier.`);
  if (d.progress < 1) {
    if (r.objective.metric === 'samples') {
      const need = (r.objective.needKinds || []).filter((k) => !r.samples.some((x) => x.kind === k));
      L.push(need.length ? `You were still missing a sample from: ${[...new Set(need)].join(', ')}. Plan a route that visits each kind of rock.` : `You cored ${r.samples.length} of ${r.objective.target} samples. Each core takes 2 hours: less driving back and forth leaves more time to drill.`);
    } else if (r.objective.metric === 'water') {
      const bestScanned = [...r.scanned].reduce((m, k) => Math.max(m, cells[k].ice), 0);
      L.push(`You ended with ${E.gotText(r)}. ${bestScanned >= 2 ? `Your scans found spots with ${bestScanned.toFixed(1)}% ice: digging there pays off most.` : 'Low-ice spots make water slowly. Scan first, then dig where the ice is richest.'}`);
      if (r.rover.rtgW && r.rover.dig.digW > r.rover.rtgW) L.push(`The RTG makes ${r.rover.rtgW} W but your digger needs ${r.rover.dig.digW} W, so each dig drained the battery. A smaller digger or a battery top-up between digs helps.`);
    } else {
      L.push(`You ended with ${E.gotText(r)}. A faster digger, or less time driving, gets more regolith out of the same days.`);
    }
  }
  if (!mars && r.rover.sci.id === 'none' && r.objective.id !== 'base') L.push('Without an ice detector you dug blind. VIPER carried a neutron spectrometer for exactly this reason.');
  if (r.decisions.total > r.decisions.withLink) L.push('Some surprises hit while there was no link to Earth. Comms are part of survival, not an extra: a better relay orbit in Mission 1 helps.');
  if (d.progress >= 1) L.push('You met the objective. Could you do it with less mass or money? Real missions are judged on margins too.');
  if (!L.length) L.push('A steady mission. Try a harder objective, or the same one with a cheaper rover.');
  return L;
}

function chart(canvas, r) {
  const W = 1200, H = 260, pad = 36; canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'), T = r.limits.missionHours, days = Math.round(T / 24);
  const X = (t) => pad + (t / T) * (W - pad * 2), Y = (b) => H - pad - b * (H - pad * 2);
  ctx.fillStyle = '#0d1220'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(40,70,160,.35)';
  r.tele.forEach((p, n) => { if (p.shadow && n) ctx.fillRect(X(r.tele[n - 1].t), pad, Math.max(1, X(p.t) - X(r.tele[n - 1].t)), H - pad * 2); });
  ctx.strokeStyle = '#26314a'; ctx.lineWidth = 1; ctx.font = '20px system-ui'; ctx.fillStyle = '#9aa6bd';
  const step = days > 8 ? 2 : 1;
  for (let d = 0; d <= days; d += step) { const x = X(d * 24); ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H - pad); ctx.stroke(); ctx.fillText(`day ${d}`, x - 22, H - 8); }
  ctx.fillText('100%', 0, Y(1) + 6); ctx.fillText('0%', 8, Y(0));
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.beginPath();
  r.tele.forEach((p, n) => (n ? ctx.lineTo(X(p.t), Y(p.b)) : ctx.moveTo(X(p.t), Y(p.b))));
  ctx.stroke();
}

const REAL = {
  moon: [
    ['NASA VIPER', 'Planned south pole ice rover with "wheel-walking", a neutron spectrometer, a drill, solar power, heaters and headlights for driving into shadow.'],
    ['NASA RASSOR', 'Digging robot prototype with two bucket drums spinning opposite ways, so it can dig in low gravity without being pushed away.'],
    ['Honeybee TRIDENT', 'A 1 m rotary-percussive drill built to reach ice-rich soil on the Moon.'],
    ['LCROSS (2009)', 'Crashed a rocket stage into Cabeus crater near the south pole and measured about 5.6% water in the plume.'],
  ],
  mars: [
    ['NASA Perseverance', 'Landed in Jezero crater in 2021. It cores rock samples into tubes for a future mission to bring back to Earth, powered by an RTG.'],
    ['NASA Ingenuity', 'A small helicopter that flew 72 times on Mars, scouting routes for Perseverance.'],
    ['Mars relay orbiters', 'MRO, MAVEN and Mars Odyssey pass most of the rovers’ data back to Earth, just like your Mission 1 satellite.'],
  ],
};

export function renderDebrief(capcomPanel) {
  const d = S.result, r = S.run, mars = WORLD_ID === 'mars';
  const lessons = lessonsFor(r, d);
  const stars = d.score >= 85 ? 3 : d.score >= 60 ? 2 : d.score >= 35 ? 1 : 0;
  $('#main').innerHTML = `<section class="panel stack debrief">
    <div class="row" style="justify-content:space-between;align-items:flex-start">
      <div><span class="tag ${d.grade === 'Mission success' ? 'good' : d.grade === 'Partial success' ? 'warn' : 'bad'}">${d.grade}</span>
      <div class="row" style="align-items:baseline;margin-top:8px"><div class="score" id="score">${d.score}</div><div class="muted">/ 100 points</div></div>
      ${S.award?.changes?.length ? `<p class="small">+${S.award.xp} XP for the crew${S.award.medal !== 'none' ? ` · ${S.award.medal} medal` : ''}</p>` : '<p class="small muted"><a href="../../profile.html">Create a player profile</a> to earn XP and badges.</p>'}</div>
      <div class="stars" aria-label="${stars} of 3 stars">${[1, 2, 3].map((n) => `<span class="${n <= stars ? 'on' : ''}" style="--i:${n}">★</span>`).join('')}</div>
    </div>
    <div>${d.items.map((i, n) => `<div class="check rise" style="--i:${n}"><span class="tag ${i.pts >= i.max * 0.8 ? 'good' : i.pts >= i.max * 0.4 ? 'warn' : 'bad'}">${i.pts}/${i.max}</span>
      <div><b>${i.label}</b><div class="small muted">${i.why}</div></div></div>`).join('')}</div>
    <h2>Why it went this way</h2><ul>${lessons.map((l) => `<li>${l}</li>`).join('')}</ul>
    <h2>Battery over the mission</h2><canvas id="chart" class="chart" aria-label="Battery level over the mission; blue bands are time in ${mars ? 'night' : 'shadow'}"></canvas>
    <p class="small muted">Yellow line: battery. Blue bands: time in ${mars ? 'night' : 'shadow'}.</p>
    <h2>Badges</h2>
    <div class="badges">${S.badges.map((b, n) => `<div class="badge ${b.got ? 'got' : ''} rise" style="--i:${n}"><b>${b.name}</b><span class="small">${b.why}</span></div>`).join('')}</div>
    <h2>What this means for Mission 3</h2>
    <p>Your rover is sending home <b>${E.dataPackets(r).length} data packets</b>: ${E.dataPackets(r).map((p) => p.label.toLowerCase()).join(', ')}. In Mission 3 you encode them and beam them to Earth.</p>
    <h2>Real missions like yours</h2>${REAL[mars ? 'mars' : 'moon'].map(([n, t]) => `<p class="small"><b>${n}:</b> ${t}</p>`).join('')}
    <div class="row"><a href="../comms/index.html"><button class="primary big">Next: Mission 3, send the data</button></a><button id="again">Fly the same rover again</button><button id="redesign">Change the design</button></div></section>`;
  $('#side').innerHTML = capcomPanel([d.grade === 'Mission success' ? 'Great flying. Your score is saved to the campaign. Try a harder objective next.' : 'Your score is saved. Read “Why it went this way”, change one decision, and fly again.']);
  chart($('#chart'), r);
  $('#main').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.id === 'again') { startDeploy(); go('deploy'); }
    if (b.id === 'redesign') go('build');
  };
}
