// The advisor endpoint, with a fake upstream provider (no network, no real key).
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/advise.js';

const realFetch = globalThis.fetch;
let calls;
beforeEach(() => {
  calls = [];
  for (const k of ['ADVISOR_API_KEY', 'ADVISOR_MODEL', 'ADVISOR_BASE_URL', 'ALLOWED_ORIGINS']) delete process.env[k];
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return { ok: true, json: async () => ({ choices: [{ message: { content: '  Safe mode costs a known 2 hours. ' } }] }) }; };
});
afterEach(() => { globalThis.fetch = realFetch; });

const call = async ({ method = 'POST', body, headers = {} } = {}) => {
  const res = { code: 0, out: null, headers: {}, status(c) { this.code = c; return this; }, json(o) { this.out = o; return this; }, end() { return this; }, setHeader(k, v) { this.headers[k] = v; } };
  await handler({ method, body, headers: { host: 'game.example', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}`, ...headers } }, res);
  return res;
};
const good = { kind: 'storm', facts: [['Safe mode', '2.0 h lost'], ['Keep transmitting', '40% chance of 14 h']] };
const configure = () => { process.env.ADVISOR_API_KEY = 'test-key'; process.env.ADVISOR_MODEL = 'test-model'; };

test('answers 503 when no key and model are configured, and never calls out', async () => {
  const r = await call({ body: good });
  assert.equal(r.code, 503);
  assert.equal(calls.length, 0);
});

test('sends the facts to the default free provider with the key in the header only', async () => {
  configure();
  const r = await call({ body: good });
  assert.equal(r.code, 200);
  assert.equal(r.out.text, 'Safe mode costs a known 2 hours.');
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer test-key');
  const sent = JSON.parse(calls[0].init.body);
  assert.equal(sent.model, 'test-model');
  assert.ok(sent.max_tokens <= 200);
  assert.ok(!JSON.stringify(sent).includes('test-key'));
  assert.ok(sent.messages[1].content.includes('Safe mode: 2.0 h lost'));
});

test('a different OpenAI-compatible base URL can be configured', async () => {
  configure(); process.env.ADVISOR_BASE_URL = 'https://example.test/v1beta/openai/';
  await call({ body: good });
  assert.equal(calls[0].url, 'https://example.test/v1beta/openai/chat/completions');
});

test('rejects unknown kinds, empty or oversized facts, and non-POST', async () => {
  configure();
  assert.equal((await call({ body: { kind: 'write-my-essay', facts: [['a', 'b']] } })).code, 400);
  assert.equal((await call({ body: { kind: 'storm', facts: [] } })).code, 400);
  assert.equal((await call({ body: { kind: 'storm', facts: Array.from({ length: 11 }, () => ['a', 'b']) } })).code, 400);
  assert.equal((await call({ method: 'GET' })).code, 405);
  assert.equal(calls.length, 0);
});

test('rejects requests from another origin unless allowed', async () => {
  configure();
  assert.equal((await call({ body: good, headers: { origin: 'https://evil.example' } })).code, 403);
  assert.equal((await call({ body: good, headers: { origin: 'https://game.example' } })).code, 200);
  process.env.ALLOWED_ORIGINS = 'https://me.github.io';
  const r = await call({ body: good, headers: { origin: 'https://me.github.io' } });
  assert.equal(r.code, 200);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://me.github.io');
});

test('control characters in facts are stripped before they reach the model', async () => {
  configure();
  await call({ body: { kind: 'storm', facts: [['Safe\u0000 mode', 'ok\u001b[31m red']] } });
  const content = JSON.parse(calls[0].init.body).messages[1].content;
  assert.ok(!/[\u0000-\u001f]/.test(content.replace(/\n/g, '')));
});

test('an upstream failure becomes a clean error the game can ignore', async () => {
  configure();
  globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
  assert.equal((await call({ body: good })).code, 502);
});
