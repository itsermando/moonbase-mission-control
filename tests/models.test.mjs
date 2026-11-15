// The NASA 3D models: every model the game refers to exists and is a real binary glTF file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../shared/models/', import.meta.url);
const src = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('every model in the registry has a valid .glb file', () => {
  const ids = [...src('../shared/models.js').matchAll(/^\s+'?([a-z0-9-]+)'?: \{ label:/gm)].map((m) => m[1]);
  assert.ok(ids.length >= 14, 'registry has the NASA models');
  for (const id of ids) {
    const buf = fs.readFileSync(new URL(`${id}.glb`, dir));
    assert.equal(buf.subarray(0, 4).toString(), 'glTF', `${id}.glb is not a binary glTF`);
    assert.equal(buf.readUInt32LE(8), buf.length, `${id}.glb is truncated`);
  }
});

test('the Satellite Kit parts used by the spacecraft screen exist', () => {
  const files = [...src('../missions/orbit/bay.js').matchAll(/'(kit-[a-z]+-\d)'/g)].map((m) => m[1]);
  assert.ok(files.length >= 5);
  for (const f of new Set(files)) assert.ok(fs.existsSync(new URL(`${f}.glb`, dir)), f);
});

test('every world has its map texture, and elevation maps exist where declared', () => {
  const w = src('../shared/worlds.js');
  const paths = [...w.matchAll(/(?:texture|textureTopo): '([^']+)'/g)].map((m) => m[1]);
  assert.ok(paths.length >= 7);
  for (const p of paths) assert.ok(fs.existsSync(new URL(`../${p}`, import.meta.url)), p);
});
