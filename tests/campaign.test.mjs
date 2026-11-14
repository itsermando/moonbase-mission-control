// Mars rover rules and the hand-offs between missions (orbit -> rover -> comms).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../missions/rover/world.js';
import * as E from '../missions/rover/engine.js';
import { summarize } from '../missions/rover/parts.js';

test('the orbit relay schedule decides when the rover can use the relay', () => {
  W.useWorld('moon', { periodH: 10, windowH: 2 });
  const c = W.cells.find((x) => x.elev < 150 && x.kind === 'plain');
  const relay = { relay: true };
  assert.equal(W.commsAt(c, 1, relay).ok, true);
  assert.equal(W.commsAt(c, 5, relay).ok, false);
  assert.equal(W.commsAt(c, 11, relay).ok, true);
  W.useWorld('moon', { periodH: 12, windowH: 4 });
});

test('Mars map has a delta, a rim and a floor to sample', () => {
  W.useWorld('mars');
  const kinds = {}; W.cells.forEach((c) => { kinds[c.kind] = (kinds[c.kind] || 0) + 1; });
  console.log('mars kinds', kinds);
  for (const k of ['delta', 'rim', 'floor']) assert.ok(kinds[k] > 3, `few ${k}`);
});

test('Mars nights are dark and cold: solar power drops to zero', () => {
  W.useWorld('mars');
  const c = W.cells[0];
  assert.ok(W.sunAt(c, 3) > 0.4);    // midday sun
  assert.equal(W.sunAt(c, 15), 0);   // night
});

function playMars(objectiveId, design) {
  W.useWorld('mars');
  const site = W.cells.find((c) => c.kind === 'plain' && c.slope === 0 && W.nearestReachable(c, ['delta'], summarize(design)));
  const s = E.newRun({ design, objectiveId, siteK: site.k, testsRun: 1 });
  const handle = (ev) => { if (ev) E.resolveEvent(s, ev, ev.choices.findIndex((c) => !c.needs || c.needs(s))); };
  const order = ['floor', 'delta', 'rim', 'delta', 'plain', 'delta', 'floor'];
  let guard = 0;
  while (!s.ended && guard++ < 400 && E.progressOf(s) < 1) {
    if (s.batteryWh / s.rover.batteryWh < 0.4) { handle(E.rest(s, 4)); continue; }
    const want = order[Math.min(order.length - 1, s.samples.length)];
    const here = W.cells[s.k];
    if (here.kind === want && !s.sampled.has(here.k)) { handle(E.dig(s, 2)); continue; }
    const goal = W.cells.filter((c) => c.kind === want && !s.sampled.has(c.k))
      .sort((a, b) => Math.hypot(a.i - here.i, a.j - here.j) - Math.hypot(b.i - here.i, b.j - here.j))[0];
    const p = goal && E.planDrive(s, goal); if (!p) break;
    handle(E.drive(s, p));
  }
  if (!s.ended) E.finish(s);
  return { s, d: E.debrief(s) };
}

test('Mars: an RTG rover like Perseverance can tell the story of Jezero', () => {
  const design = { mobility: 'mesh6', power: 'rtg', digger: 'drill', thermal: 'blanket', comms: 'both', science: 'none', extra: 'none' };
  const { s, d } = playMars('m-story', design);
  console.log('mars story', d.score, d.grade, s.samples.map((x) => x.kind).join(','), Math.round(s.t), 'h', s.endReason);
  assert.ok(d.progress >= 1);
});

test('Mars: a solar rover with only blankets freezes at night', () => {
  const design = { mobility: 'rigid4', power: 'solarS', digger: 'scoop', thermal: 'blanket', comms: 'dte', science: 'none', extra: 'none' };
  const { s } = playMars('m-first', design);
  console.log('mars cold', s.endReason);
  assert.equal(s.endReason, 'froze');
});

test('the rover hands its science to comms as data packets', () => {
  W.useWorld('mars');
  const design = { mobility: 'mesh6', power: 'rtg', digger: 'drill', thermal: 'blanket', comms: 'both', science: 'none', extra: 'none' };
  const { s } = playMars('m-first', design);
  const packets = E.dataPackets(s);
  console.log('packets', packets.map((p) => p.label).join(' | '));
  assert.ok(packets.length >= 3 && packets.every((p) => p.bits > 0 && p.value > 0));
  W.useWorld('moon');
});

test('class mode halves the target and the mission length', () => {
  W.useWorld('moon');
  const s = E.newRun({ design: { mobility: 'mesh6', power: 'solarS', digger: 'scoop', thermal: 'blanket', comms: 'dte', science: 'none', extra: 'none' }, objectiveId: 'ice', siteK: W.cells.find((c) => c.kind === 'plain').k, classMode: true });
  assert.equal(s.objective.target, 6);
  assert.equal(s.limits.missionHours, 168);
});
