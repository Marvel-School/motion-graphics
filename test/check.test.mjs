import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir, writeClip, run } from './helpers.mjs';

const spec = { width: 640, height: 360, fps: 25, duration: 2, alpha: true };
const title = (left, extra = '') => ({
  css: `#t{position:absolute;top:150px;left:${left}px;color:#fff;font:bold 40px monospace;white-space:nowrap}${extra}`,
  body: '<div id="t">PRODUCT OWNER</div>',
});

function check(clip) {
  return run('check.mjs', [clip]);
}

// Bug caught: particles placed with Math.random change on every render, so a text fix also changes the look.
test('fails a clip that uses Math.random in seek', () => {
  const clip = writeClip(tmpdir(), {
    spec, ...title(100),
    script: "window.seek = t => { document.getElementById('t').style.transform = `translateY(${Math.random() * 40}px)`; };",
  });
  const r = check(clip);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /determinism/);
});

// Bug caught: seek() that adds to state instead of setting it renders right in order and wrong after any jump.
test('fails a clip whose seek accumulates state', () => {
  const clip = writeClip(tmpdir(), {
    spec, ...title(100),
    script: "let x = 0; window.seek = t => { x += 7; document.getElementById('t').style.transform = `translateX(${x % 200}px)`; };",
  });
  const r = check(clip);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /determinism/);
});

// Bug caught: a held title sits partly off frame or under Premiere's title-safe edge.
test('fails text held outside title-safe, and names it', () => {
  const clip = writeClip(tmpdir(), { spec, ...title(420) });
  const r = check(clip);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /title-safe.*PRODUCT OWNER/);
});

// Bug caught: the check flags every slide-in, so it gets ignored. Text that only passes the edge briefly is fine.
test('passes text that enters from off frame and settles inside title-safe', () => {
  const clip = writeClip(tmpdir(), {
    spec, ...title(100),
    script: "window.seek = t => { const p = Math.min(1, t / 0.3); document.getElementById('t').style.transform = `translateX(${(1 - p) * -500}px)`; };",
  });
  const r = check(clip);
  assert.equal(r.code, 0, r.out);
});

// Bug caught: a mask that opens too narrow holds a name cut off ("Jan de") for the whole clip.
test('fails text held cut off by a mask, and names it', () => {
  const clip = writeClip(tmpdir(), {
    spec,
    css: '#m{position:absolute;top:150px;left:100px;width:120px;overflow:hidden}#t{color:#fff;font:bold 40px monospace;white-space:nowrap}',
    body: '<div id="m"><div id="t">Jan de Vries</div></div>',
  });
  const r = check(clip);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /cut off.*Jan de Vries/);
});

// Bug caught: an intentional full-bleed headline fails the check and Claude shrinks it.
test('passes text marked data-bleed', () => {
  const clip = writeClip(tmpdir(), {
    spec,
    css: '#t{position:absolute;top:100px;left:-20px;color:#fff;font:bold 120px monospace;white-space:nowrap}',
    body: '<div id="t" data-bleed>MELUSIO MELUSIO</div>',
  });
  const r = check(clip);
  assert.equal(r.code, 0, r.out);
});

// Bug caught: a brand font that never loads renders in a fallback font and nobody notices.
test('fails text whose font is not loaded from a file', () => {
  const clip = writeClip(tmpdir(), {
    spec,
    css: '#t{position:absolute;top:150px;left:100px;color:#fff;font:40px "Bebas Neue",sans-serif}',
    body: '<div id="t">PRODUCT</div>',
  });
  const r = check(clip);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /font.*Bebas Neue/);
});

// Bug caught: a font first used by text that seek() fills in is never loaded, so a valid clip fails
// and anything measured in seek uses the fallback font's width.
test('passes a clip whose text and font only appear once seek runs', () => {
  const dir = tmpdir();
  fs.copyFileSync(path.join(import.meta.dirname, 'fixtures/inter-latin-700-normal.woff2'), path.join(dir, 'inter.woff2'));
  const clip = writeClip(dir, {
    spec,
    css: '@font-face{font-family:"Inter";font-weight:700;src:url(inter.woff2)}#t{position:absolute;top:150px;left:100px;color:#fff;font:700 40px "Inter"}',
    body: '<div id="t"></div>',
    script: "window.seek = t => { document.getElementById('t').textContent = 'Product'; };",
  });
  const r = check(clip);
  assert.equal(r.code, 0, r.out);
});

// Bug caught: a clip declared transparent paints a background, so the overlay covers the footage.
test('fails a transparent clip that paints a full background', () => {
  const clip = writeClip(tmpdir(), { spec, ...title(100, 'body{background:#041443}') });
  const r = check(clip);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /alpha/);
});

// Bug caught: a full-frame clip with no background renders on white.
test('fails a full-frame clip with no background', () => {
  const clip = writeClip(tmpdir(), { spec: { ...spec, alpha: false }, ...title(100) });
  const r = check(clip);
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /background/);
});
