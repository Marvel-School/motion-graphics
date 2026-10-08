import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir, writeClip, run, probe, alphaRange, frameHash, lumaRange } from './helpers.mjs';

const box = {
  css: '#b{position:absolute;left:100px;top:100px;width:200px;height:120px;background:#ED7D31}',
  body: '<div id="b"></div>',
  script: "window.seek = t => { document.getElementById('b').style.transform = `translateX(${t * 400}px)`; };",
};

// Bug caught: the background renders opaque, so the overlay hides the footage in Premiere.
test('transparent clip renders ProRes 4444 with a real alpha channel', () => {
  const dir = tmpdir();
  const clip = writeClip(dir, { spec: { width: 640, height: 360, fps: 25, duration: 0.4, alpha: true }, ...box });
  const out = path.join(dir, 'out.mov');
  const r = run('render.mjs', [clip, '--out', out]);
  assert.equal(r.code, 0, r.out);
  const s = probe(out);
  assert.equal(s.codec_name, 'prores');
  assert.equal(s.profile, '4444');
  assert.match(s.pix_fmt, /^yuva444/);
  const a = alphaRange(out);
  assert.equal(a.min, 0, 'background must be fully transparent');
  assert.equal(a.max, 1, 'the box must be fully opaque');
});

// Bug caught: 29.97 written as 30/1, which drifts one frame every ~33 s against a 29.97 sequence.
test('frame rates are written as the exact rational Premiere expects', () => {
  for (const [fps, rate, frames] of [[25, '25/1', 10], [29.97, '30000/1001', 12], [23.976, '24000/1001', 10]]) {
    const dir = tmpdir();
    const clip = writeClip(dir, { spec: { width: 320, height: 180, fps, duration: 0.4, alpha: true }, ...box });
    const out = path.join(dir, 'out.mov');
    const r = run('render.mjs', [clip, '--out', out]);
    assert.equal(r.code, 0, r.out);
    const s = probe(out);
    assert.equal(s.r_frame_rate, rate, `fps ${fps}`);
    assert.equal(Number(s.nb_read_frames), frames, `frame count at fps ${fps}`);
  }
});

// Bug caught: full-frame clips shipped as 4444, doubling file size for an alpha channel nobody uses.
test('full-frame clip renders ProRes 422 HQ without alpha', () => {
  const dir = tmpdir();
  const clip = writeClip(dir, {
    spec: { width: 640, height: 360, fps: 25, duration: 0.2, alpha: false }, ...box,
    css: box.css + 'body{background:#041443}',
  });
  const out = path.join(dir, 'out.mov');
  const r = run('render.mjs', [clip, '--out', out]);
  assert.equal(r.code, 0, r.out);
  const s = probe(out);
  assert.equal(s.profile, 'HQ');
  assert.equal(s.pix_fmt, 'yuv422p10le');
});

// Bug caught: plain CSS keyframe animations are not seeked, so every frame is identical.
test('CSS keyframe animations move with the render clock', () => {
  const dir = tmpdir();
  const clip = writeClip(dir, {
    spec: { width: 320, height: 180, fps: 25, duration: 1, alpha: true },
    css: '#b{position:absolute;left:0;top:40px;width:80px;height:80px;background:#fff;animation:go 1s linear both}@keyframes go{to{left:220px}}',
    body: '<div id="b"></div>',
  });
  const out = path.join(dir, 'out.mov');
  const r = run('render.mjs', [clip, '--out', out]);
  assert.equal(r.code, 0, r.out);
  assert.notEqual(frameHash(out, 0), frameHash(out, 24));
});

// Bug caught: every batch row renders the first row's text.
test('batch renders one file per data row, each with its own content', () => {
  const dir = tmpdir();
  const clip = writeClip(dir, {
    spec: { width: 320, height: 180, fps: 25, duration: 0.2, alpha: true },
    defaults: { name: 'Default' },
    css: '#n{color:#fff;font:bold 40px sans-serif;position:absolute;left:20px;top:60px}',
    body: '<div id="n"></div>',
    script: "document.getElementById('n').textContent = DATA.name;",
  });
  const rows = path.join(dir, 'rows.json');
  fs.writeFileSync(rows, JSON.stringify([{ name: 'Jan de Vries' }, { name: 'Ayla' }, { name: 'Sem' }]));
  const r = run('render.mjs', [clip, '--out', path.join(dir, 'lt.mov'), '--data', rows]);
  assert.equal(r.code, 0, r.out);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.mov')).sort();
  assert.deepEqual(files, ['lt_01_jan-de-vries.mov', 'lt_02_ayla.mov', 'lt_03_sem.mov']);
  const hashes = new Set(files.map(f => frameHash(path.join(dir, f), 0)));
  assert.equal(hashes.size, 3);
});

// Bug caught: a row missing a field renders the template's placeholder into a client deliverable.
test('batch stops and names the row when a row lacks a field the defaults have', () => {
  const dir = tmpdir();
  const clip = writeClip(dir, {
    spec: { width: 320, height: 180, fps: 25, duration: 0.2, alpha: true },
    defaults: { name: 'Default', role: 'Role' },
  });
  const rows = path.join(dir, 'rows.json');
  fs.writeFileSync(rows, JSON.stringify([{ name: 'A', role: 'B' }, { name: 'C' }]));
  const r = run('render.mjs', [clip, '--out', path.join(dir, 'lt.mov'), '--data', rows]);
  assert.notEqual(r.code, 0);
  assert.match(r.out, /row 2.*role/);
});

// Bug caught: sizes read in JS at script start come from the browser's default viewport, not the clip's.
test('the viewport is the clip size while the clip script runs', () => {
  const dir = tmpdir();
  const clip = writeClip(dir, {
    spec: { width: 640, height: 360, fps: 25, duration: 0.04, alpha: true },
    css: '#b{position:absolute;top:100px;width:80px;height:80px;background:#fff}',
    body: '<div id="b"></div>',
    script: "document.getElementById('b').style.left = (innerWidth - 100) + 'px';",
  });
  const out = path.join(dir, 'out.mov');
  const r = run('render.mjs', [clip, '--out', out]);
  assert.equal(r.code, 0, r.out);
  assert.equal(alphaRange(out).max, 1, 'box placed from innerWidth must be on frame');
});

// Bug caught: a preview of a transparent clip comes out black-on-black and unreadable in chat.
test('preview is half-size H.264 with transparency shown on a checkerboard', () => {
  const dir = tmpdir();
  const clip = writeClip(dir, { spec: { width: 640, height: 360, fps: 25, duration: 0.2, alpha: true }, ...box });
  const out = path.join(dir, 'p.mp4');
  const r = run('render.mjs', [clip, '--preview', '--out', out]);
  assert.equal(r.code, 0, r.out);
  const s = probe(out);
  assert.equal(s.codec_name, 'h264');
  assert.equal(s.width, 320);
  const corner = lumaRange(out, 'crop=40:40:0:0');
  assert.ok(corner.max - corner.min > 40, `empty corner should show a checkerboard, got ${JSON.stringify(corner)}`);
});
