#!/usr/bin/env node
// Checks a clip before it is rendered. Prints one "ok" line, or one FAIL line per problem and exits 1.
//   node scripts/check.mjs <clip.html>
// Checks: determinism, text inside title-safe, text cut off by a mask, fonts loaded from files,
// alpha or background as declared.
import path from 'node:path';
import { launch, openClip, frameCount, frameTime } from './page.mjs';

const SAFE = 0.05;      // title-safe margin on each side, as a fraction of the frame
const HOLD = 0.5;       // seconds text may sit outside title-safe while moving in or out
const CUT_HOLD = 0.8;   // seconds text may be partly hidden by a mask during a reveal or exit
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'system-ui', 'cursive', 'fantasy', 'ui-sans-serif', 'ui-serif', 'ui-monospace']);

// Runs in the page: every visible text run with its visible box.
function measureText() {
  const out = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) {
    const node = walk.currentNode;
    const text = node.textContent.trim();
    const el = node.parentElement;
    if (!text || !el || el.closest('script,style,[data-bleed]')) continue;
    let opacity = 1;
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') { opacity = 0; break; }
      opacity *= Number(cs.opacity);
    }
    if (opacity < 0.05) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    let box = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (getComputedStyle(e).overflow === 'visible') continue;
      const c = e.getBoundingClientRect();
      box = { l: Math.max(box.l, c.left), t: Math.max(box.t, c.top), r: Math.min(box.r, c.right), b: Math.min(box.b, c.bottom) };
    }
    if (box.r - box.l < 1 || box.b - box.t < 1) continue;
    const family = getComputedStyle(el).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
    // Cut off: a mask hides part of the text (not the frame edge, which title-safe covers).
    const cut = (box.r - box.l) < (r.right - r.left) - 2 || (box.b - box.t) < (r.bottom - r.top) - 2;
    out.push({ text: text.slice(0, 40), family, cut, ...box });
  }
  return out;
}

// Runs in the page: the lowest alpha in a PNG, sampled on a grid.
async function minAlpha(b64) {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let min = 255;
  for (let i = 3; i < d.length; i += 4 * 7) min = Math.min(min, d[i]);
  return min;
}

async function checkDeterminism(browser, file, clip, fails) {
  const frames = frameCount(clip);
  for (const i of [Math.floor(frames / 3), Math.floor((2 * frames) / 3)]) {
    const t = frameTime(clip, i);
    const a = await openClip(browser, file);
    await a.seek(0); await a.seek(frameTime(clip, frames - 1)); await a.seek(t);
    const shotA = await a.page.screenshot({ omitBackground: true });
    await a.page.close();
    const b = await openClip(browser, file);
    await b.seek(t);
    const shotB = await b.page.screenshot({ omitBackground: true });
    await b.page.close();
    if (!shotA.equals(shotB)) {
      fails.push(`determinism: frame ${i} (${t.toFixed(2)}s) differs between renders. Use MG.rand(seed) instead of Math.random, and make seek(t) set state from t instead of adding to it.`);
      return;
    }
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: check.mjs <clip.html>');
  const fails = [];
  const browser = await launch();
  try {
    const { page, clip, seek } = await openClip(browser, file);
    const frames = frameCount(clip);
    const safe = { l: clip.width * SAFE, t: clip.height * SAFE, r: clip.width * (1 - SAFE), b: clip.height * (1 - SAFE) };

    // Background as declared.
    const bg = await page.evaluate(() => [document.documentElement, document.body].map(e => getComputedStyle(e).backgroundColor));
    const painted = bg.some(c => c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent');
    if (!clip.alpha && !painted) fails.push('background: alpha is false but html and body have no background, so frames render on white. Set a background or set alpha: true.');

    // Fonts.
    const loaded = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replace(/^["']|["']$/g, '')));
    const broken = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'error').map(f => f.family.replace(/^["']|["']$/g, '')));
    for (const f of new Set(broken)) fails.push(`font: "${f}" failed to load. Check the @font-face src path.`);
    const loadedSet = new Set(loaded);

    // Walk every frame. A problem only fails once it lasts longer than its hold limit,
    // so text passing an edge or a mask on its way in or out is fine.
    const LIMITS = { safe: HOLD, cut: CUT_HOLD };
    const runs = new Map();      // "kind\0text" -> { start, detail }
    const reported = new Set();
    const families = new Set();
    const flush = (key, end) => {
      const r = runs.get(key);
      runs.delete(key);
      const [kind, text] = key.split('\0');
      if (!r || end - r.start <= LIMITS[kind] || reported.has(key)) return;
      reported.add(key);
      const span = `from ${r.start.toFixed(2)}s to ${end.toFixed(2)}s`;
      fails.push(kind === 'safe'
        ? `title-safe: "${text}" sits outside title-safe ${span} (${r.detail}). Move it in, or mark the element data-bleed if the bleed is intended.`
        : `cut off: "${text}" is partly hidden by a mask ${span}. The mask is narrower than the text; measure the text after fonts load (inside seek), not at script start.`);
    };
    for (let i = 0; i < frames; i++) {
      const t = frameTime(clip, i);
      await seek(t);
      const boxes = await page.evaluate(measureText);
      const live = new Set();
      const open = (kind, text, detail) => {
        const key = kind + '\0' + text;
        live.add(key);
        if (!runs.has(key)) runs.set(key, { start: t, detail });
      };
      for (const b of boxes) {
        families.add(b.family);
        const edges = [];
        if (b.l < safe.l - 1) edges.push(`left edge at ${Math.round(b.l)}px, safe starts at ${Math.round(safe.l)}px`);
        if (b.r > safe.r + 1) edges.push(`right edge at ${Math.round(b.r)}px, safe ends at ${Math.round(safe.r)}px`);
        if (b.t < safe.t - 1) edges.push(`top at ${Math.round(b.t)}px, safe starts at ${Math.round(safe.t)}px`);
        if (b.b > safe.b + 1) edges.push(`bottom at ${Math.round(b.b)}px, safe ends at ${Math.round(safe.b)}px`);
        const onFrame = b.r > 0 && b.l < clip.width && b.b > 0 && b.t < clip.height;
        if (edges.length && onFrame) open('safe', b.text, edges.join('; '));
        if (b.cut) open('cut', b.text, '');
      }
      for (const key of [...runs.keys()]) if (!live.has(key)) flush(key, t);
    }
    for (const key of [...runs.keys()]) flush(key, clip.duration);

    for (const f of families) {
      if (!GENERIC.has(f) && !loadedSet.has(f)) {
        fails.push(`font: text uses "${f}" but no @font-face file for it loaded, so it renders in a fallback font. Add the font file (scripts/font.mjs).`);
      }
    }

    // Alpha as declared.
    if (clip.alpha) {
      let min = 255;
      for (const i of [0, Math.floor(frames / 2), frames - 1]) {
        await seek(frameTime(clip, i));
        const png = (await page.screenshot({ omitBackground: true })).toString('base64');
        min = Math.min(min, await page.evaluate(minAlpha, png));
      }
      if (min === 255) fails.push('alpha: clip is declared transparent but no frame has a transparent pixel. Remove the page background or set alpha: false.');
    }
    await page.close();

    if (!fails.some(f => f.startsWith('determinism'))) await checkDeterminism(browser, file, clip, fails);

    if (fails.length) {
      for (const f of fails) console.log('FAIL ' + f);
      process.exitCode = 1;
    } else {
      console.log(`ok  ${path.basename(path.dirname(path.resolve(file)))}  ${clip.width}x${clip.height} ${clip.fps}fps ${frames} frames checked`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
