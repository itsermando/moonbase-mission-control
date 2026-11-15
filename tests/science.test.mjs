// Mission 1 science trade-off: instruments see the base from the height where the orbit passes over it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as O from '../missions/orbit/orbit.js';
import * as I from '../missions/orbit/instruments.js';
import { designMetrics, scoreParts } from '../missions/orbit/plan.js';
import { WORLDS } from '../shared/worlds.js';

const moon = WORLDS.moon, nac = I.findInstrument('moon', 'nac');
const orbit = (argpDeg) => O.elements({ periAltKm: 90, apoAltKm: 14000, incDeg: 90, argpDeg }, moon);

test('a relay orbit (slow high point over the south pole) sees the base from far away', () => {
  const s = I.instrumentSpecs(nac, orbit(90), moon);
  assert.ok(s.hPeriKm > 13000, `height over base ${s.hPeriKm}`);
  assert.equal(s.goalMet, false);
});

test('flipping the low point over the base makes the camera sharp', () => {
  const s = I.instrumentSpecs(nac, orbit(270), moon);
  assert.ok(s.hPeriKm < 100);
  assert.ok(s.gsdM <= 1, `pixel ${s.gsdM} m`);
});

test('LRO-like 50 km polar orbit gives about 0.5 m pixels, like the real LROC NAC', () => {
  const s = I.instrumentSpecs(nac, O.elements({ periAltKm: 50, apoAltKm: 50, incDeg: 90, argpDeg: 90 }, moon), moon);
  assert.ok(Math.abs(s.gsdM - 0.5) < 0.05);
});

test('no instrument and standard shielding leave the design unchanged', () => {
  const p = { periAltKm: 800, apoAltKm: 8000, incDeg: 60, argpDeg: 90 };
  const a = designMetrics({ rocket: 'medium', antenna: 'dish', power: 'solarL', p }, moon, 'moon');
  const b = designMetrics({ rocket: 'medium', antenna: 'dish', power: 'solarL', instrument: 'none', shield: 'standard', p }, moon, 'moon');
  assert.equal(a.dry, b.dry); assert.equal(a.cost, b.cost); assert.equal(a.needW, b.needW);
});

test('an instrument and hardened shielding add mass, power and cost; hardening lowers storm risk', () => {
  const p = { periAltKm: 800, apoAltKm: 8000, incDeg: 60, argpDeg: 90 };
  const base = designMetrics({ rocket: 'medium', antenna: 'dish', power: 'solarL', p }, moon, 'moon');
  const d = designMetrics({ rocket: 'medium', antenna: 'dish', power: 'solarL', instrument: 'nac', shield: 'hardened', p }, moon, 'moon');
  assert.equal(d.dry - base.dry, nac.massKg + 15);
  assert.equal(d.needW - base.needW, nac.powerW);
  assert.ok(d.sh.hit < base.sh.hit);
});

test('with an instrument, the science goal replaces data rate in the score', () => {
  const p = { periAltKm: 90, apoAltKm: 14000, incDeg: 90, argpDeg: 270 };
  const d = designMetrics({ rocket: 'medium', antenna: 'dish', power: 'solarL', instrument: 'nac', p }, moon, 'moon');
  const t = { coverage: 0.5, avgWindowH: 2 };
  const parts = scoreParts(d, t, { science: I.instrumentSpecs(d.ins, d.el, moon) }, 'moon');
  const sci = parts.find((x) => x.label === 'Science goal');
  assert.ok(sci && sci.score >= 5);
  assert.ok(!parts.some((x) => x.label === 'Data rate'));
});
