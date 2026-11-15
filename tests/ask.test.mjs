// CAPCOM's question box: the knowledge base matches real questions, falls back politely and stays consistent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KB, ask, answerFor, suggestions, tokens } from '../shared/capcom-kb.js';
import { WORLDS } from '../shared/worlds.js';

const ctx = (mission = 'all', world = WORLDS.moon) => ({ mission, world });

test('every entry is well formed: unique id, keywords, a short plain-text answer', () => {
  const ids = new Set();
  for (const e of KB) {
    assert.ok(!ids.has(e.id), `duplicate id ${e.id}`); ids.add(e.id);
    assert.ok(e.keys.length > 0 && e.q.endsWith('?') && e.m.length > 0, e.id);
    const text = typeof e.a === 'function' ? e.a(ctx()) : e.a;
    const words = text.split(/\s+/).length;
    assert.ok(words >= 15 && words <= 80, `${e.id} answer has ${words} words`);
    assert.ok(!/[<>]/.test(text), `${e.id} contains markup`);
  }
  assert.ok(KB.length >= 45);
});

test('each suggestion chip question finds its own answer', () => {
  for (const e of KB) {
    const r = ask(e.q, ctx(e.m[0]));
    assert.equal(r.id, e.id, `“${e.q}” found ${r.id} instead of ${e.id}`);
  }
});

test('natural questions find the right answer', () => {
  const cases = [
    ['what is periapsis', 'apsis'], ['Why do we use a polar orbit?', 'inclination'], ['how much fuel do I need', 'fuel'],
    ['what does delta-v mean', 'delta-v'], ['how long does it take to go around', 'period'], ['what is a parity bit', 'parity'],
    ['why is there ice in craters', 'ice'], ['can the rover freeze at night', 'night'], ['wheels vs legs', 'mobility'],
    ['how do I read the binary', 'binary'], ['what is the deep space network', 'dsn'], ['is this AI?', 'ai'],
    ['the game is laggy', 'slow'], ['how do I score more points', 'scoring'], ['what is a solar storm', 'storm'],
    ['tell me about Vesta', 'dawn'], ['how do I drive the rover', 'controls'],
  ];
  for (const [q, id] of cases) assert.equal(ask(q, ctx('orbit')).id, id, q);
});

test('off-topic or empty questions fall back with suggestions, never a wrong confident answer', () => {
  for (const q of ['what is the capital of France', 'asdf qwerty', '', 'tell me a joke']) {
    const r = ask(q, ctx('rover'));
    assert.equal(r.id, null, q);
    assert.ok(r.related.length >= 3);
  }
});

test('the light-delay answer uses the current world', () => {
  assert.match(ask('why is there a signal delay', ctx('comms', WORLDS.moon)).text, /Moon/);
  assert.match(ask('why is there a signal delay', ctx('comms', WORLDS.mars)).text, /Mars/);
});

test('suggestions exist for every mission, and answerFor returns the stored answer', () => {
  for (const m of ['orbit', 'rover', 'comms', 'all', undefined]) assert.ok(suggestions(m).length >= 4);
  assert.equal(answerFor('parity', ctx()).id, 'parity');
  assert.equal(answerFor('nope', ctx()), null);
});

test('numbers quoted in answers match the game data', async () => {
  const D = await import('../missions/orbit/data.js'), P = await import('../missions/rover/parts.js');
  const say = (id) => answerFor(id, ctx()).text;
  assert.match(say('launcher'), new RegExp(`\\$${D.ROCKETS[0].costM}M`));
  assert.match(say('launcher'), new RegExp(`\\$${D.ROCKETS[2].costM}M`));
  assert.match(say('launcher'), new RegExp(`\\$${D.BUDGET_M}M`));
  assert.match(say('storm'), new RegExp(`${D.STORM.safeH}[ -]hour`)); assert.match(say('storm'), new RegExp(`${D.STORM.hitChance * 100}%`));
  assert.match(say('storm'), new RegExp(`${D.STORM.resetH}-hour`));
  assert.match(say('lander'), new RegExp(String(P.LIMITS.landerCapacityKg)));
  assert.match(say('budget'), new RegExp(`\\$${P.LIMITS.budgetM}M`));
});

test('tokens drop filler words and trim plurals', () => {
  assert.deepEqual(tokens('What are the orbits?'), ['orbit']);
  assert.deepEqual(tokens('Delta-v!'), ['delta', 'v']);
});
