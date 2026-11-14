// Rover mission rules: power, temperature, driving, digging, scanning and scoring.
// Pure logic (no screen code) so it can be tested with `npm test`.
import { LIMITS, summarize, findObjective, scaledObjective } from './parts.js';
import { cells, cellAt, sunAt, commsAt, findPath, stepCost, CELL_M, WORLD_ID, KIND_TEXT } from './world.js';
import { rollEvent } from './events.js';

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function newRun({ design, objectiveId, siteK, testsRun = 0, seed = 2026, classMode = false }) {
  const rover = { ...summarize(design), alive: true };
  // Class mode: a 7-day mission with half the target, so it fits in a lesson.
  const objective = scaledObjective(findObjective(objectiveId), classMode);
  return {
    design, rover, objective, world: WORLD_ID, classMode,
    limits: { ...LIMITS, missionHours: classMode ? 168 : LIMITS.missionHours },
    samples: [], sampled: new Set(),
    t: 0, k: siteK, siteK, batteryWh: rover.batteryWh, shadowH: 0, dust: 0,
    cargo: { regolith: 0, water: 0 }, floorSample: false,
    scanned: new Set(), damage: {}, testsRun,
    decisions: { total: 0, withLink: 0 },
    stats: { driveKm: 0, digH: 0, brownouts: 0, faultStops: 0 },
    log: [], rand: rng(seed), lastEvent: null,
    tele: [{ t: 0, b: 1, shadow: false }], // battery history for the debrief chart
    track: [],                               // last drive, step by step, for the animation
    ended: false, endReason: '',
    get here() { return cells[this.k]; },
  };
}

const say = (s, text, kind = 'info') => s.log.unshift({ t: Math.round(s.t), text, kind });

function heaterW(s, sun) {
  const th = s.rover.therm;
  if (s.rover.warm || sun > 0.1 || s.damage.noHeater) return 0;
  return th.heaterW;
}

function shadowLimit(s) {
  if (s.rover.warm) return Infinity;
  return s.damage.noHeater ? 3 : s.rover.therm.shadowLimitH;
}

/** Let time pass. extraW is the load on top of the computer's base load. */
export function wait(s, hours, extraW = 0) {
  let left = hours;
  while (left > 1e-9 && !s.ended) {
    const dt = Math.min(1, left);
    const c = cells[s.k];
    const sun = sunAt(c, s.t);
    const gen = s.rover.solarW * sun * (1 - s.dust) + s.rover.rtgW;
    const load = Math.max(0, LIMITS.baseLoadW + extraW + heaterW(s, sun));
    s.batteryWh = Math.min(s.rover.batteryWh, s.batteryWh + (gen - load) * dt);
    s.shadowH = sun <= 0.1 && heaterW(s, sun) === 0 && !s.rover.warm ? s.shadowH + dt : 0;
    s.t += dt; left -= dt;
    s.tele.push({ t: s.t, b: Math.max(0, s.batteryWh / s.rover.batteryWh), shadow: sun <= 0.1 });
    if (s.shadowH > shadowLimit(s)) return end(s, 'froze', WORLD_ID === 'mars' ? 'The rover froze in the Martian night (about -80 °C) without heat.' : 'The rover froze in the shadow. Its electronics cracked at about -200 °C.');
    if (s.batteryWh <= 0) {
      if (sun > 0.2 || s.rover.rtgW) {
        s.stats.brownouts++;
        say(s, `Battery empty. The rover shut down and slowly recharged ${s.rover.rtgW ? 'from its RTG' : 'in the sunlight'}. Lost 6 hours.`, 'bad');
        s.t += 6;
        s.batteryWh = Math.max(0, Math.min(s.rover.batteryWh, (s.rover.solarW * sun * (1 - s.dust) + s.rover.rtgW - LIMITS.baseLoadW) * 6));
      } else {
        return end(s, 'battery', 'The battery ran out in the dark. With no power for heaters, the rover froze.');
      }
    }
    if (s.t >= s.limits.missionHours) return end(s, 'night', WORLD_ID === 'mars' ? `The ${Math.round(s.limits.missionHours / 24)}-day mission is over: dust season is coming.` : `The ${Math.round(s.limits.missionHours / 24)}-day mission is over and the lunar night begins.`);
  }
}

function end(s, reason, text) {
  if (s.ended) return;
  s.ended = true; s.endReason = reason;
  s.rover.alive = reason === 'night' || reason === 'player';
  say(s, text, s.rover.alive ? 'info' : 'bad');
}

export function finish(s) { end(s, 'player', 'You ended the mission and sent the final report to Earth.'); }

export function link(s) { return commsAt(cells[s.k], s.t, s.rover.comm); }

export function planDrive(s, target) { return findPath(cells[s.k], target, s.rover); }

/** Drive along a planned path. Returns an event (or null) for the screen to show. */
export function drive(s, plan) {
  let hours = 0, steep = false, i = 1;
  s.track = [{ k: s.k, t: s.t, b: s.batteryWh / s.rover.batteryWh }];
  for (; i < plan.path.length && !s.ended; i++) {
    if (s.batteryWh < 0.12 * s.rover.batteryWh) {
      s.stats.faultStops++;
      say(s, 'Fault protection stopped the drive: battery under 12%. Recharge before you go on.', 'bad');
      break;
    }
    const a = plan.path[i - 1], b = plan.path[i];
    const diag = a.i !== b.i && a.j !== b.j;
    const km = (CELL_M * (diag ? Math.SQRT2 : 1)) / 1000;
    steep = steep || b.slope === 3;
    const st = stepCost(b, diag, s.rover);
    const h = st.hours;
    s.k = b.k;
    wait(s, h, st.watts * (s.damage.drive || 1));
    hours += h; s.stats.driveKm += km;
    s.track.push({ k: b.k, t: s.t, b: Math.max(0, s.batteryWh / s.rover.batteryWh) });
    if (b.kind === 'floor') s.floorSample = true;
  }
  say(s, `Drove ${i - 1} cells in ${hours.toFixed(1)} h.`);
  return rollEvent(s, { action: 'drive', steep }, hours);
}

export function digRate(s) {
  const c = cells[s.k];
  const frozen = c.kind === 'trap' || c.kind === 'floor' || c.kind === 'wall';
  return s.rover.dig.rateKgH * (frozen ? s.rover.dig.iceFactor : 1) * (s.damage.digSlow || 1);
}

export function dig(s, hours) {
  const c = cells[s.k];
  const rate = digRate(s);
  let done = 0;
  while (done < hours && !s.ended) {
    if (s.batteryWh < 0.12 * s.rover.batteryWh) {
      s.stats.faultStops++;
      say(s, 'Fault protection stopped digging: battery under 12%.', 'bad');
      break;
    }
    wait(s, 1, s.rover.dig.digW); done++;
  }
  if (s.ended && !s.rover.alive) return null;
  if (s.objective.metric === 'samples') return coreSample(s, c, done);
  const kg = rate * done, water = (kg * c.ice) / 100;
  const before = s.objective.metric === 'water' ? s.cargo.water : s.cargo.regolith;
  s.cargo.regolith += kg; s.cargo.water += water; s.stats.digH += done;
  const after = s.objective.metric === 'water' ? s.cargo.water : s.cargo.regolith;
  if (before < s.objective.target && after >= s.objective.target) {
    say(s, 'Objective complete. Get the rover somewhere safe and sunny, then end the mission to keep the survival points.', 'good');
  }
  s.damage.digSlow = 1;
  if (c.kind === 'floor') s.floorSample = true;
  say(s, `Dug ${Math.round(kg)} kg of regolith with ${c.ice.toFixed(1)}% ice: ${water.toFixed(2)} kg of water.`, water > 0.5 ? 'good' : 'info');
  return done ? rollEvent(s, { action: 'dig' }, done) : null;
}

/** Mars: drilling 2+ hours at a new spot cores one rock sample (like Perseverance's sample tubes). */
function coreSample(s, c, hours) {
  s.stats.digH += hours; s.damage.digSlow = 1;
  if (hours < 2) { say(s, 'Drilling stopped before a full core was cut. A sample needs 2 hours.', 'bad'); return null; }
  if (s.sampled.has(c.k)) { say(s, 'You already have a sample from this spot. Scientists want variety: move somewhere new.'); return rollEvent(s, { action: 'dig' }, hours); }
  s.sampled.add(c.k);
  s.samples.push({ kind: c.kind, value: c.sample });
  const before = s.samples.length - 1;
  say(s, `Cored sample #${s.samples.length}: ${KIND_TEXT.mars[c.kind].toLowerCase()} rock (science value ${c.sample}).`, c.sample >= 20 ? 'good' : 'info');
  if (before < s.objective.target && s.samples.length >= s.objective.target && needsMet(s)) say(s, 'Objective complete. Park safely and end the mission to keep the survival points.', 'good');
  return rollEvent(s, { action: 'dig' }, hours);
}

function needsMet(s) {
  const have = s.samples.map((x) => x.kind);
  const need = s.objective.needKinds || [];
  return need.every((k) => have.filter((h) => h === k).length >= need.filter((x) => x === k).length);
}

/** How far along the objective is, 0..1. */
export function progressOf(s) {
  const o = s.objective;
  if (o.metric === 'samples') return Math.min(1, s.samples.length / o.target) * (needsMet(s) ? 1 : 0.7);
  return Math.min(1, (o.metric === 'water' ? s.cargo.water : s.cargo.regolith) / o.target);
}

export function gotText(s) {
  const o = s.objective;
  if (o.metric === 'samples') return `${s.samples.length} of ${o.target} samples${(o.needKinds || []).length ? (needsMet(s) ? ', all required places sampled' : ', still missing a required place') : ''}`;
  const got = o.metric === 'water' ? s.cargo.water : s.cargo.regolith;
  return `${got.toFixed(o.metric === 'water' ? 1 : 0)} of ${o.target} ${o.unit}`;
}

/** Science packets for Mission 3 (comms): what the rover will send home. */
export function dataPackets(s) {
  const p = [{ id: 'pano', label: 'Panorama photo', bits: 16, value: 10 }];
  if (s.scanned.size) p.push({ id: 'icemap', label: `Ice map (${s.scanned.size} squares)`, bits: 24, value: Math.min(30, 8 + Math.round(s.scanned.size / 5)) });
  if (s.cargo.regolith >= 50) p.push({ id: 'soil', label: `Soil data (${Math.round(s.cargo.regolith)} kg)`, bits: 16, value: Math.min(25, 6 + Math.round(s.cargo.regolith / 150)) });
  if (s.cargo.water >= 0.5) p.push({ id: 'water', label: `Water results (${s.cargo.water.toFixed(1)} kg)`, bits: 16, value: Math.min(35, 10 + Math.round(s.cargo.water * 2)) });
  s.samples.forEach((x, n) => p.push({ id: `samp${n + 1}`, label: `Sample log #${n + 1} (${KIND_TEXT.mars[x.kind].toLowerCase()})`, bits: 16, value: x.value }));
  if (s.floorSample && WORLD_ID === 'moon') p.push({ id: 'dark', label: 'Crater-floor data', bits: 16, value: 30 });
  return p.slice(0, 8);
}

export function scan(s) {
  if (!s.rover.sci.scan) return null;
  wait(s, 1, s.rover.sci.scanW);
  const c = cells[s.k];
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    const n = cellAt(c.i + di, c.j + dj); if (n) s.scanned.add(n.k);
  }
  say(s, 'Neutron scan done. Hidden ice nearby is now on the map.');
  return rollEvent(s, { action: 'scan' }, 1);
}

export function rest(s, hours) {
  wait(s, hours, 0);
  say(s, `Waited ${hours} h to recharge.`);
  return rollEvent(s, { action: 'rest' }, hours);
}

/** Resolve an event choice (index) or the automatic outcome when there is no link. */
export function resolveEvent(s, ev, choiceIdx) {
  const eng = { wait };
  const hasLink = link(s).ok;
  s.decisions.total++;
  if (ev.apply) ev.apply(s);
  if (!hasLink) {
    if (ev.noLink) { ev.noLink(s, eng); say(s, `${ev.title}: ${ev.noLinkText}`, 'bad'); return ev.noLinkText; }
    const msg = ev.choices[ev.auto].run(s, eng);
    say(s, `${ev.title}: no link to Earth, so the rover chose "${ev.choices[ev.auto].label}". ${msg}`, 'bad');
    return msg;
  }
  s.decisions.withLink++;
  const msg = ev.choices[choiceIdx].run(s, eng);
  say(s, `${ev.title}: ${msg}`);
  return msg;
}

/** Final score out of 100, with the reasons. */
export function debrief(s) {
  const o = s.objective;
  const got = o.metric === 'samples' ? s.samples.length : o.metric === 'water' ? s.cargo.water : s.cargo.regolith;
  const progress = progressOf(s);
  const budgetLeft = LIMITS.budgetM - s.rover.costM - s.testsRun * LIMITS.testCostM;
  const massMargin = LIMITS.landerCapacityKg - s.rover.massKg;
  const items = [
    { label: 'Objective', max: 50, pts: Math.round(50 * progress),
      why: `${gotText(s)}.` },
    { label: 'Survival', max: 15, pts: s.rover.alive ? 15 : 0,
      why: s.rover.alive ? 'The rover is still alive for the next crew.' : s.log.find((l) => l.kind === 'bad')?.text || 'The rover was lost.' },
    WORLD_ID === 'mars'
      ? { label: 'Science', max: 15, pts: Math.min(15, Math.round(s.samples.reduce((a, x) => a + x.value, 0) / 8)),
        why: `Sample science value ${s.samples.reduce((a, x) => a + x.value, 0)} (delta rocks are worth the most).` }
      : { label: 'Science', max: 15, pts: Math.min(15, Math.round(Math.min(1, s.scanned.size / 75) * 10) + (s.floorSample ? 5 : 0)),
        why: `${s.scanned.size} map squares scanned for ice${s.floorSample ? ', plus a sample from the never-lit crater floor' : ''}.` },
    { label: 'Teamwork with Earth', max: 10, pts: s.decisions.total ? Math.round(10 * s.decisions.withLink / s.decisions.total) : 10,
      why: s.decisions.total ? `${s.decisions.withLink} of ${s.decisions.total} surprises were handled with a live link to Earth.` : "No surprises this time, so the link was never tested." },
    { label: 'Efficiency', max: 10, pts: Math.round(5 * Math.min(1, Math.max(0, budgetLeft) / 40) + 5 * Math.min(1, Math.max(0, massMargin) / 40)),
      why: `$${budgetLeft}M left, ${massMargin} kg spare on the lander, ${s.testsRun} test campaign${s.testsRun === 1 ? '' : 's'}.` },
  ];
  const score = items.reduce((a, i) => a + i.pts, 0);
  const grade = progress >= 1 && s.rover.alive && score >= 80 ? 'Mission success'
    : progress >= 0.5 ? 'Partial success' : 'Mission failed';
  return { score, grade, items, progress, got };
}
