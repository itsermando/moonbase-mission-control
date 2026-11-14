// Orbit physics checked against real missions (values from NASA mission pages).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as O from '../missions/orbit/orbit.js';
import { WORLDS } from '../shared/worlds.js';

const moon = WORLDS.moon, mars = WORLDS.mars;

test('LRO-like 50 km circular lunar orbit takes about 2 hours', () => {
  const el = O.elements({ periAltKm: 50, apoAltKm: 50, incDeg: 90 }, moon);
  const min = el.T / 60;
  console.log('LRO period', min.toFixed(1), 'min');
  assert.ok(min > 105 && min < 125);
});

test('MRO-like 300 km Mars orbit takes about 2 hours', () => {
  const el = O.elements({ periAltKm: 255, apoAltKm: 320, incDeg: 93 }, mars);
  const min = el.T / 60; console.log('MRO period', min.toFixed(1), 'min');
  assert.ok(min > 105 && min < 120); // real MRO: about 112 min
});

test('lunar orbit insertion for LRO is close to the real ~0.8-0.9 km/s', () => {
  const el = O.elements({ periAltKm: 50, apoAltKm: 50, incDeg: 90 }, moon);
  const dv = O.captureBurn(el, moon.vInfKms); console.log('LOI dv', dv.toFixed(2), 'km/s');
  assert.ok(dv > 0.6 && dv < 1.1);
});

test('apoapsis over the south pole gives far more south-pole contact than a low orbit', () => {
  const low = O.contactTimeline(O.elements({ periAltKm: 50, apoAltKm: 50, incDeg: 90 }, moon), moon, { hours: 48 });
  const high = O.contactTimeline(O.elements({ periAltKm: 800, apoAltKm: 8000, incDeg: 60, apoOver: 'south' }, moon), moon, { hours: 48 });
  const wrong = O.contactTimeline(O.elements({ periAltKm: 800, apoAltKm: 8000, incDeg: 60, apoOver: 'north' }, moon), moon, { hours: 48 });
  console.log('coverage low', low.coverage.toFixed(2), 'elliptic south', high.coverage.toFixed(2), 'elliptic north', wrong.coverage.toFixed(2));
  assert.ok(high.coverage > 3 * low.coverage);
  assert.ok(high.coverage > wrong.coverage);
});

test('positions stay on the orbit (radius between peri and apo)', () => {
  const el = O.elements({ periAltKm: 300, apoAltKm: 5000, incDeg: 45 }, moon);
  for (let k = 0; k < 50; k++) {
    const r = Math.hypot(...O.positionAt(el, (k / 50) * el.T));
    assert.ok(r >= el.rp - 1e-6 && r <= el.ra + 1e-6);
  }
});

test('rocket equation: more delta-v needs more propellant', () => {
  assert.ok(O.propellantKg(200, 1.5) > O.propellantKg(200, 0.8));
  assert.ok(Math.abs(O.propellantKg(100, 0) ) < 1e-9);
});
