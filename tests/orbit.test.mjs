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

test('capture burn: the exact required brake gives the planned apoapsis', () => {
  const rp = moon.radiusKm + 800, ra = moon.radiusKm + 8000;
  const dv = O.requiredDv(rp, ra, moon.vInfKms, moon.gm);
  const res = O.captureResult(rp, moon.vInfKms, dv, moon.gm, moon.radiusKm);
  assert.ok(!res.escaped && Math.abs(res.apoKm - ra) < 0.01);
});

test('capture burn: too little brake and you fly past; too much drops the orbit', () => {
  const rp = moon.radiusKm + 800, ra = moon.radiusKm + 8000;
  const dv = O.requiredDv(rp, ra, moon.vInfKms, moon.gm);
  assert.equal(O.captureResult(rp, moon.vInfKms, 0.1, moon.gm, moon.radiusKm).escaped, true);
  const low = O.captureResult(rp, moon.vInfKms, dv + 0.1, moon.gm, moon.radiusKm);
  assert.ok(low.apoKm < ra);
});

test('rocket equation round-trips: fuel for a delta-v gives that delta-v back', () => {
  const dry = 250, dv = 0.65;
  assert.ok(Math.abs(O.dvAvailable(dry, O.propellantKg(dry, dv)) - dv) < 1e-9);
});

test('an outage removes exactly the overlapping contact time', () => {
  const t = { windows: [{ startH: 0, endH: 2 }, { startH: 10, endH: 12 }], coverage: 0.2, hours: 20, avgWindowH: 2, cycleH: 10, maxGapH: 8 };
  const o = O.withOutage(t, 1, 10);
  assert.deepEqual(o.windows, [{ startH: 0, endH: 1 }, { startH: 11, endH: 12 }]);
  assert.ok(Math.abs(o.coverage - 0.1) < 1e-9);
  assert.equal(o.maxGapH, 10);
  assert.equal(o.outage.lostH, 2);
});

test('an outage that misses every window changes nothing', () => {
  const t = { windows: [{ startH: 0, endH: 2 }], coverage: 0.1, hours: 20, avgWindowH: 2, cycleH: 20, maxGapH: 18 };
  const o = O.withOutage(t, 5, 3);
  assert.deepEqual(o.windows, t.windows);
  assert.equal(o.coverage, t.coverage);
  assert.equal(o.outage.lostH, 0);
});

test('an areostationary orbit stays over Jezero (planet turns at its sidereal rate)', () => {
  const el = O.elements({ periAltKm: 17032, apoAltKm: 17032, incDeg: 0, argpDeg: 0 }, mars);
  const a = O.subPoint(el, mars, 0), b = O.subPoint(el, mars, 24);
  console.log('areostationary drift over a day', (b.lon - a.lon).toFixed(2), 'deg; period', (el.T / 3600).toFixed(3), 'h');
  assert.ok(Math.abs(b.lon - a.lon) < 2);
});
