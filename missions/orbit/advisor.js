// The mission analyst. It calculates outcomes BEFORE the player decides and turns them into choices:
//  - designChoices: searches rockets, antennas, power and orbits and returns three different designs that really work
//  - stormForecast: the exact contact and score each storm response would cost, with probabilities
// All numbers come from the game's own physics (orbit.js) and scoring (plan.js). No AI model is involved here.
import * as O from './orbit.js';
import * as D from './data.js';
import { designMetrics, scoreParts, totalScore, launchReady } from './plan.js';
import { instrumentSpecs } from './instruments.js';
const sci = (d, world) => (d.ins.kind === 'none' ? null : instrumentSpecs(d.ins, d.el, world, { antennaRate: d.an.rate }));

const HOURS = 72;
const cache = {};

/** Orbits worth trying for a world: its real-mission presets plus a grid scaled to the planet's size. */
export function candidateOrbits(world, wid) {
  const L = D.LIMITS[wid], R = world.radiusKm;
  const argp = world.site.latDeg < 0 ? 90 : 270; // apoapsis over the base's hemisphere
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const peris = [0.05, 0.3, 0.8].map((f) => clamp(Math.round(R * f), L.minPeri, Math.min(20000, L.maxApo)));
  const apos = [0.05, 0.8, 2, 4, 8].map((f) => clamp(Math.round(R * f), L.minPeri, L.maxApo));
  const list = [], seen = new Set();
  const add = (name, p) => {
    const key = [p.periAltKm, p.apoAltKm, p.incDeg, p.argpDeg].join('|');
    if (!seen.has(key)) { seen.add(key); list.push({ name, p }); }
  };
  for (const pr of D.PRESETS[wid]) add(pr.name, { ...pr.p });
  for (const pe of peris) for (const ap of apos) if (ap >= pe) for (const inc of [90, 60]) add('Custom orbit', { periAltKm: pe, apoAltKm: ap, incDeg: inc, argpDeg: argp });
  // low point over the base: worse for the relay, but what a camera or neutron detector wants
  for (const pe of peris.slice(0, 1)) for (const ap of apos) if (ap >= pe) add('Low pass over the base', { periAltKm: pe, apoAltKm: ap, incDeg: 90, argpDeg: (argp + 180) % 360 });
  return list;
}

function orbitsFor(world, wid) {
  return (cache[wid] ||= candidateOrbits(world, wid).map((c) => {
    const el = O.elements(c.p, world);
    return { ...c, el, t: O.contactTimeline(el, world, { hours: HOURS }) };
  }));
}

const orbitKey = (p) => [p.periAltKm, p.apoAltKm, p.incDeg, p.argpDeg].join('|');

/**
 * Three different designs that pass every go / no-go check. Scores assume a capture burn right on target,
 * because the burn is the player's job; the sloppy score shows what a 12% apoapsis miss would cost.
 */
export function designChoices(world, wid, extra = {}) {
  const goal = D.GOALS[wid], all = [];
  for (const o of orbitsFor(world, wid)) {
    for (const rk of D.ROCKETS) for (const an of D.ANTENNAS) for (const pw of D.POWER) {
      const sel = { ...extra, rocket: rk.id, antenna: an.id, power: pw.id, p: o.p };
      const d = designMetrics(sel, world, wid);
      if (!launchReady(d, o.p, wid)) continue;
      all.push({ o, d, sel, score: totalScore(scoreParts(d, o.t, { err: 0, science: sci(d, world) }, wid)), meets: o.t.coverage >= goal });
    }
  }
  let pool = all.filter((x) => x.meets);
  const relaxed = pool.length === 0; // no design reaches the contact goal: offer the best that can fly
  if (relaxed) pool = all;
  if (!pool.length) return { choices: [], relaxed };

  const usedDesigns = new Set(), usedOrbits = new Set();
  const dkey = (x) => `${orbitKey(x.o.p)}|${x.sel.rocket}|${x.sel.antenna}|${x.sel.power}`;
  const take = (cmp, from = pool) => {
    const free = from.filter((x) => !usedDesigns.has(dkey(x)));
    const fresh = free.filter((x) => !usedOrbits.has(orbitKey(x.o.p)));
    const c = (fresh.length ? fresh : free).sort(cmp)[0];
    if (c) { usedDesigns.add(dkey(c)); usedOrbits.add(orbitKey(c.o.p)); }
    return c;
  };
  const picks = [
    ['balanced', 'Balanced', take((a, b) => b.score - a.score || a.d.cost - b.d.cost), true],
    ['budget', 'Lowest cost', take((a, b) => a.d.cost - b.d.cost || b.score - a.score), false],
    ['contact', 'Most contact', take((a, b) => b.o.t.coverage - a.o.t.coverage || a.d.cost - b.d.cost), false],
  ];
  if (extra.instrument && extra.instrument !== 'none') picks.push(['science', 'Sharpest science', take((a, b) => sci(a.d, world).gsdM - sci(b.d, world).gsdM || b.score - a.score, all), false]); // may miss the contact goal: that is the trade-off
  const pct = (x) => `${Math.round(x * 100)}%`;
  const choices = picks.filter(([, , c]) => c).map(([id, title, c, recommended]) => {
    const sloppy = totalScore(scoreParts(c.d, c.o.t, { err: 0.12, science: sci(c.d, world) }, wid));
    const why = { balanced: 'Highest predicted score of every design that works.', budget: `Cheapest design that ${relaxed ? 'can fly' : 'still meets the contact goal'}.`, contact: 'Keeps the base in touch the longest.', science: 'Flies lowest, so the instrument sees the most detail; the relay pays for it.' }[id];
    return {
      id, title, recommended, why, orbitName: c.o.name, design: c.sel,
      metrics: { cost: c.d.cost, capKg: c.d.cap, wetKg: Math.round(c.d.wet), dvMs: Math.round(c.d.dvNeed * 1000), fuelKg: Math.round(c.d.prop),
        coverage: c.o.t.coverage, windowH: c.o.t.avgWindowH, gapH: c.o.t.maxGapH, scoreOnTarget: c.score, scoreOff: sloppy },
      summary: `${c.d.rk.name}, ${c.d.an.name.toLowerCase()}, ${c.d.pw.name.toLowerCase()}. ${c.o.name}: ${Math.round(c.sel.p.periAltKm)} × ${Math.round(c.sel.p.apoAltKm)} km, inclination ${c.sel.p.incDeg}°.`,
      branches: [
        { text: `Burn on target: contact ${pct(c.o.t.coverage)}, cost $${c.d.cost}M, score about ${c.score}`, tone: 'good' },
        ...(sci(c.d, world) ? [{ text: `Instrument sees ${sci(c.d, world).gsdM < 1 ? Math.round(sci(c.d, world).gsdM * 100) + ' cm' : Math.round(sci(c.d, world).gsdM) + ' m'} pixels (goal ${sci(c.d, world).goalGsdM} m)`, tone: sci(c.d, world).goalMet ? 'good' : 'bad' }] : []),
        { text: `Burn 12% off the plan: score about ${sloppy}`, tone: 'warn' },
      ],
    };
  });
  return { choices, relaxed };
}

/** What each response to the solar storm would cost, computed from this orbit's actual contact windows. */
export function stormForecast(t, startH, d, wid, run = {}) {
  const S = { ...D.STORM, hitChance: run.hitChance ?? d.sh?.hit ?? D.STORM.hitChance };
  const score = (tl) => totalScore(scoreParts(d, tl, run, wid));
  const before = score(t);
  const after = (durH) => { const te = O.withOutage(t, startH, durH); return { lostH: te.outage.lostH, score: score(te) }; };
  const safe = after(S.safeH), reset = after(S.resetH);
  return {
    before, safe, reset, hit: S.hitChance,
    expected: { safeLostH: safe.lostH, rideLostH: S.hitChance * reset.lostH, safeScore: safe.score, rideScore: (1 - S.hitChance) * before + S.hitChance * reset.score },
  };
}

/** The forecast as decision-tree options (see shared/tree.js). */
export function stormOptions(f) {
  const S = { ...D.STORM, hitChance: f.hit }, h1 = (x) => x.toFixed(1), e = f.expected;
  const safeBest = e.safeScore >= e.rideScore;
  return [
    { id: 'safe', title: `Safe mode for ${S.safeH} h`, recommended: safeBest, button: 'Order safe mode',
      summary: 'Antenna off until the storm passes. The satellite is protected.',
      branches: [{ text: `${h1(f.safe.lostH)} h of contact lost, score ${f.before} → ${f.safe.score}`, tone: f.safe.lostH > 0 ? 'warn' : 'good' }],
      expected: `Expected: ${h1(e.safeLostH)} h lost, score ${e.safeScore.toFixed(1)}.` },
    { id: 'ride', title: 'Keep transmitting', recommended: !safeBest, button: 'Keep transmitting',
      summary: `A ${Math.round(S.hitChance * 100)}% chance the computer resets for ${S.resetH} h.`,
      branches: [
        { p: 1 - S.hitChance, text: `Nothing happens. Score stays ${f.before}`, tone: 'good' },
        { p: S.hitChance, text: `Reset: ${h1(f.reset.lostH)} h of contact lost, score ${f.before} → ${f.reset.score}`, tone: 'bad' },
      ],
      expected: `Expected: ${h1(e.rideLostH)} h lost, score ${e.rideScore.toFixed(1)}.` },
  ];
}
