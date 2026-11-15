// Graphics quality: resolution by level, the 30 fps cap in Lite, and automatic fallback when frames stay slow.
// perf.js touches the browser, so give it small stand-ins before it loads.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
globalThis.document = { hidden: false, documentElement: { dataset: {} }, createElement: () => ({}), head: { appendChild() {} } };
globalThis.CustomEvent = class { constructor(type) { this.type = type; } };
const events = [];
globalThis.window = { devicePixelRatio: 2, dispatchEvent: (e) => events.push(e.type) };
const P = await import('../shared/perf.js');

beforeEach(() => { P.setMode('auto'); events.length = 0; globalThis.document.hidden = false; });

/** Feed n frames that arrive every `gap` ms; returns how many were drawn. */
function run(gov, n, gap, t0 = 1000) { let drawn = 0; for (let i = 0; i < n; i++) if (gov.render(t0 + i * gap)) drawn++; return drawn; }

test('resolution and shadows follow the level', () => {
  P.setMode('high'); assert.equal(P.level(), 'high'); assert.equal(P.pixelRatio(), 2); assert.ok(P.useShadows() && P.softShadows()); assert.equal(P.shadowMapSize(), 2048);
  P.setMode('auto'); assert.equal(P.level(), 'medium'); assert.equal(P.pixelRatio(), 1.5); assert.ok(P.useShadows() && !P.softShadows()); assert.equal(P.shadowMapSize(), 1024);
  P.setMode('low'); assert.equal(P.level(), 'low'); assert.equal(P.pixelRatio(), 1); assert.ok(!P.useShadows() && !P.useAntialias());
});

test('the choice is remembered and set on the page for CSS', () => {
  P.setMode('low'); assert.equal(store.get('com.quality.v1'), 'low'); assert.equal(document.documentElement.dataset.quality, 'low');
  P.setMode('bogus'); assert.equal(P.getMode(), 'low');
});

test('changing the level tells every view so it updates live', () => {
  let calls = 0; const off = P.onChange(() => { calls++; });
  P.setMode('high'); P.setMode('low'); assert.equal(calls, 2);
  off(); P.setMode('auto'); assert.equal(calls, 2);
});

test('Lite caps rendering near 30 fps on a 60 Hz screen, other levels draw every frame', () => {
  P.setMode('low'); assert.equal(run(new P.Governor(), 60, 16.7), 30);
  P.setMode('auto'); assert.equal(run(new P.Governor(), 60, 16.7), 60);
});

test('a hidden tab draws nothing', () => {
  globalThis.document.hidden = true; assert.equal(run(new P.Governor(), 10, 16.7), 0);
});

test('Auto drops to Lite when frames stay slow, and says so once', () => {
  assert.equal(P.isDegraded(), false);
  run(new P.Governor(), 400, 55); // about 18 fps, long enough for the warm-up and two measuring windows
  assert.equal(P.isDegraded(), true); assert.equal(P.level(), 'low'); assert.deepEqual(events, ['quality-degraded']);
});

test('Auto stays sharp on a healthy device or a brief hiccup', () => {
  run(new P.Governor(), 600, 16.7); assert.equal(P.isDegraded(), false);
  const g = new P.Governor(); run(g, 100, 16.7); run(g, 90, 60, 5000); run(g, 200, 16.7, 20000); assert.equal(P.isDegraded(), false); // one slow window is not enough
});

test('a manual choice is never overridden, and tab-switch gaps are not counted as slowness', () => {
  P.setMode('high'); run(new P.Governor(), 400, 55); assert.equal(P.isDegraded(), false); assert.equal(P.level(), 'high');
  P.setMode('auto'); const g = new P.Governor(); run(g, 100, 16.7); for (let i = 0; i < 200; i++) g.render(10000 + i * 2000); assert.equal(P.isDegraded(), false);
});
