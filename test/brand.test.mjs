import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir, run } from './helpers.mjs';

const clipHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
/* brand */
:root{--brand:"Template";--bg:#000;--fg:#fff;--primary:#888;--accent:#888;--font-display:sans-serif;--font-body:sans-serif}
/* /brand */
html,body{margin:0}#b{position:absolute;inset:0;background:var(--accent)}
</style></head><body><div id="b"></div>
<script>const DATA = MG.clip({ width: 64, height: 64, fps: 25, duration: 0.04, alpha: true }, {});</script></body></html>`;

function kit(dir, colors) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify({ name: 'Acme', colors, fonts: [], logo: null, rules: [] }));
  return dir;
}

function pixel(file) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'crop=1:1:32:32', '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {});
  return [...r.stdout].map(v => v.toString(16).padStart(2, '0')).join('');
}

// Bug caught: the client's colors never reach the clip, so it renders in the template's placeholder colors.
test('apply-brand puts the kit colors into the clip', () => {
  const dir = tmpdir();
  const clipDir = path.join(dir, 'clip');
  fs.mkdirSync(clipDir);
  fs.writeFileSync(path.join(clipDir, 'clip.html'), clipHtml);
  const brand = kit(path.join(dir, 'acme'), { bg: '#000000', fg: '#ffffff', primary: '#336699', accent: '#00ff00' });
  const r = run('apply-brand.mjs', [brand, clipDir]);
  assert.equal(r.code, 0, r.out);
  const out = path.join(dir, 'out.mov');
  const rr = run('render.mjs', [path.join(clipDir, 'clip.html'), '--out', out]);
  assert.equal(rr.code, 0, rr.out);
  const [red, green, blue] = pixel(out).match(/../g).map(h => parseInt(h, 16));
  assert.ok(red < 10 && green > 245 && blue < 10, `expected green, got ${red},${green},${blue}`);
});

// Bug caught: a kit missing the accent renders with the template's placeholder accent and nobody notices.
test('apply-brand stops when the kit lacks a required color', () => {
  const dir = tmpdir();
  const clipDir = path.join(dir, 'clip');
  fs.mkdirSync(clipDir);
  fs.writeFileSync(path.join(clipDir, 'clip.html'), clipHtml);
  const brand = kit(path.join(dir, 'acme'), { bg: '#000000', fg: '#ffffff', primary: '#336699' });
  const r = run('apply-brand.mjs', [brand, clipDir]);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /accent/);
});
