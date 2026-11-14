// The analyst's forecasts must agree with the real physics and scoring.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as O from '../missions/orbit/orbit.js';
import * as D from '../missions/orbit/data.js';
import { designMetrics, scoreParts, totalScore, launchReady } from '../missions/orbit/plan.js';
import { designChoices, stormForecast, stormOptions } from '../missions/orbit/advisor.js';
import { WORLDS } from '../shared/worlds.js';

const moon = WORLDS.moon;

test('every offered design passes all launch checks and is different from the others', () => {
  const { choices } = designChoices(moon, 'moon');
  assert.ok(choices.length >= 1);
  for (const c of choices) {
    const d = designMetrics(c.design, moon, 'moon');
    assert.ok(launchReady(d, c.design.p, 'moon'));
    assert.ok(d.cost <= D.BUDGET_M && d.wet <= d.cap && d.haveW >= d.needW);
  }
  assert.equal(new Set(choices.map((c) => JSON.stringify(c.design))).size, choices.length);
  assert.equal(choices.filter((c) => c.recommended).length, 1);
});

test('predicted contact equals a fresh simulation of the same orbit', () => {
  for (const c of designChoices(moon, 'moon').choices) {
    const t = O.contactTimeline(O.elements(c.design.p, moon), moon, { hours: 72 });
    assert.ok(Math.abs(t.coverage - c.metrics.coverage) < 1e-12);
  }
});

test('the contact goal is met whenever some design can meet it', () => {
  const { choices, relaxed } = designChoices(moon, 'moon');
  if (!relaxed) for (const c of choices) assert.ok(c.metrics.coverage >= D.GOALS.moon);
});

test('score parts add up to the same total the debrief uses (max 100)', () => {
  const d = designMetrics({ rocket: 'medium', antenna: 'dish', power: 'solarL', p: { periAltKm: 800, apoAltKm: 8000, incDeg: 60, argpDeg: 90 } }, moon, 'moon');
  const t = O.contactTimeline(d.el, moon, { hours: 72 });
  const parts = scoreParts(d, t, { err: 0 }, 'moon');
  assert.equal(parts.reduce((a, p) => a + p.max, 0), 100);
  assert.ok(totalScore(parts) <= 100 && parts.every((p) => p.score >= 0 && p.score <= p.max));
  assert.ok(totalScore(scoreParts(d, t, { err: 0.2 }, 'moon')) < totalScore(parts));
});

test('storm forecast matches a worked example', () => {
  const d = designMetrics({ rocket: 'medium', antenna: 'dish', power: 'solarL', p: { periAltKm: 800, apoAltKm: 8000, incDeg: 60, argpDeg: 90 } }, moon, 'moon');
  const t = { windows: [{ startH: 0, endH: 2 }, { startH: 10, endH: 12 }], coverage: 0.2, hours: 20, avgWindowH: 2, cycleH: 10, maxGapH: 8 };
  const f = stormForecast(t, 0.5, d, 'moon');
  assert.ok(Math.abs(f.safe.lostH - 1.5) < 1e-9);   // [0.5, 6.5] overlaps [0, 2] by 1.5 h
  assert.ok(Math.abs(f.reset.lostH - 3.5) < 1e-9);  // [0.5, 14.5] overlaps 1.5 h + 2 h
  assert.ok(Math.abs(f.expected.rideLostH - D.STORM.hitChance * 3.5) < 1e-9);
  assert.ok(f.safe.score <= f.before && f.reset.score <= f.before);
  const opts = stormOptions(f);
  assert.deepEqual(opts.map((o) => o.id), ['safe', 'ride']);
  assert.equal(opts.filter((o) => o.recommended).length, 1);
  const p = opts[1].branches.reduce((a, b) => a + b.p, 0);
  assert.ok(Math.abs(p - 1) < 1e-9);
});
