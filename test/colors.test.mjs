import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir, run } from './helpers.mjs';

// Bug caught: brand colors guessed by eye from a logo come out a few shades off the client's real ones.
test('colors.mjs reports the exact colors that fill an image, most-used first', () => {
  const dir = tmpdir();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100">
    <rect width="200" height="100" fill="#336699"/><rect x="200" width="100" height="100" fill="#ED7D31"/></svg>`;
  const file = path.join(dir, 'logo.svg');
  fs.writeFileSync(file, svg);
  const r = run('colors.mjs', [file]);
  assert.equal(r.code, 0, r.out);
  const hexes = r.out.match(/#[0-9A-F]{6}/g);
  assert.deepEqual(hexes.slice(0, 2), ['#336699', '#ED7D31']);
});
