// Mission 3 ground station (Jeongha's Deep Link mini-games): the pure rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { majority, syncHit, stationAngle, scoreDSN, decoy } from '../missions/comms/dsn.js';
import { DSN, dsnStation } from '../missions/comms/codec.js';

test('majority voting picks the bit that arrived at least twice', () => {
  assert.equal(majority([1, 0, 1]), 1); assert.equal(majority([0, 0, 1]), 0); assert.equal(majority([1, 1, 1]), 1);
});
test('sync presses count only inside the target zone', () => {
  assert.ok(syncHit(0.5)); assert.ok(syncHit(0.6)); assert.ok(!syncHit(0.2)); assert.ok(!syncHit(0.9));
});
test('the station the game expects is the one nearest the target direction', () => {
  for (let h = 0; h < 24; h++) {
    const right = dsnStation(h), best = DSN.reduce((a, s) => (stationAngle(s.lon, h) < stationAngle(a.lon, h) ? s : a));
    assert.equal(right.name, best.name, `hour ${h}`);
  }
});
test('a perfect ground station scores 20 and mistakes cost points', () => {
  assert.equal(scoreDSN({ stationWrong: 0, syncMiss: 0, signalWrong: 0, photoWrong: 0 }).total, 20);
  assert.ok(scoreDSN({ stationWrong: 1, syncMiss: 2, signalWrong: 1, photoWrong: 3 }).total < 20);
  assert.equal(scoreDSN({ stationWrong: 9, syncMiss: 9, signalTimeout: true, photoWrong: 9 }).total, 0);
});
test('decoy signals differ from the reference in exactly two bits', () => {
  const ref = [1, 0, 1, 1, 0, 0, 1, 0];
  for (let k = 0; k < 50; k++) assert.equal(decoy(ref).filter((v, i) => v !== ref[i]).length, 2);
});
