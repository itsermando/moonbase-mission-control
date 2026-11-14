// Mission 3 signal maths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../missions/comms/codec.js';

test('letter code round-trips every command', () => {
  for (const w of C.COMMANDS) assert.equal(C.decodeWord(C.encodeWord(w)), w);
  assert.equal(C.encodeLetter('A'), '00001');
  assert.equal(C.encodeLetter('Z'), '11010');
});

test('parity catches any single flipped bit', () => {
  const byte = '10110010', sent = C.withParity(byte);
  assert.ok(C.parityOk(sent));
  for (let i = 0; i < sent.length; i++) {
    const flipped = sent.slice(0, i) + (sent[i] === '1' ? '0' : '1') + sent.slice(i + 1);
    assert.equal(C.parityOk(flipped), false);
  }
});

test('compression cuts bits; parity adds one bit per byte', () => {
  const pk = [{ id: 'a', bits: 16, value: 10 }, { id: 'b', bits: 24, value: 20 }];
  const none = C.planTotals(pk, C.COMPRESSION[0], C.CHECKS[0]);
  const max = C.planTotals(pk, C.COMPRESSION[2], C.CHECKS[0]);
  const par = C.planTotals(pk, C.COMPRESSION[0], C.CHECKS[1]);
  assert.ok(max.bits < none.bits && max.value < none.value);
  assert.equal(par.bits, none.bits + 5); // 2 + 3 bytes
});

test('packets are the same every time (fair for everyone)', () => {
  const p = { id: 'pano', bits: 16, value: 10 };
  assert.deepEqual(C.packetBytes(p, C.COMPRESSION[0]), C.packetBytes(p, C.COMPRESSION[0]));
});

test('noise flips about the expected share of bits', () => {
  let s = 1; const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const bits = '0'.repeat(10000);
  const flips = [...C.transmit(bits, 0.05, rand)].filter((b) => b === '1').length;
  assert.ok(flips > 400 && flips < 600);
});

test('a DSN station is always on duty', () => {
  for (let h = 0; h < 24; h++) assert.ok(C.dsnStation(h).name);
});

const PK = [{ id: 'a', bits: 16, value: 10 }, { id: 'b', bits: 24, value: 20 }];

test('forecast: with no noise a plan that fits is clean and worth its full value', () => {
  const f = C.forecastPlan({ packets: PK, compression: C.COMPRESSION[0], check: C.CHECKS[0], windowS: 60, noise: 0 });
  assert.equal(f.pAllClean, 1);
  assert.deepEqual(f.dropped, []);
  assert.equal(f.valueExpected, 30);
  assert.equal(f.bitsNeeded, 40);
});

test('forecast: noise without parity risks damage; parity removes it but costs bits', () => {
  const none = C.forecastPlan({ packets: PK, compression: C.COMPRESSION[0], check: C.CHECKS[0], windowS: 60, noise: 0.07 });
  const par = C.forecastPlan({ packets: PK, compression: C.COMPRESSION[0], check: C.CHECKS[1], windowS: 60, noise: 0.07 });
  assert.ok(none.pAllClean < 1 && none.valueExpected < none.valueIfClean);
  assert.equal(par.pAllClean, 1);
  assert.ok(par.bitsNeeded > none.bitsNeeded);
});

test('forecast: a packet that does not fit stops everything after it', () => {
  const f = C.forecastPlan({ packets: PK, compression: C.COMPRESSION[0], check: C.CHECKS[0], windowS: 5, noise: 0 });
  assert.deepEqual(f.sent, []);
  assert.deepEqual(f.dropped, ['a', 'b']);
});

test('plan choices all fit the window, differ from each other, and the safe one uses parity', () => {
  const pk = [{ id: 'pano', bits: 16, value: 10 }, { id: 'soil', bits: 8, value: 8 }, { id: 'icemap', bits: 24, value: 20 }];
  const { choices } = C.planChoices(pk, { windowS: 40, noise: C.NOISE.moon });
  assert.ok(choices.length >= 2);
  assert.equal(new Set(choices.map((c) => JSON.stringify(c.plan))).size, choices.length);
  for (const c of choices) {
    const packets = c.plan.order.filter((id) => !c.plan.skip.includes(id)).map((id) => pk.find((p) => p.id === id));
    const f = C.forecastPlan({ packets, compression: C.COMPRESSION.find((x) => x.id === c.plan.comp), check: C.CHECKS.find((x) => x.id === c.plan.check), windowS: 40, noise: C.NOISE.moon });
    assert.deepEqual(f.dropped, []);
  }
  const safe = choices.find((c) => c.id === 'safe');
  if (safe) assert.equal(safe.plan.check, 'parity');
  assert.equal(choices.filter((c) => c.recommended).length, 1);
});

test('game noise flips at most one bit per byte, so parity always catches it', () => {
  let s = 7; const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let caught = 0, flipped = 0;
  for (let k = 0; k < 2000; k++) {
    const sent = C.withParity('10110010'), rec = C.transmitByte(sent, 0.05, rand);
    const diff = [...rec].filter((b, i) => b !== sent[i]).length;
    assert.ok(diff <= 1);
    if (diff) { flipped++; if (!C.parityOk(rec)) caught++; }
  }
  assert.ok(flipped > 0 && caught === flipped);
});
