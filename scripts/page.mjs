// Shared by render.mjs and check.mjs: open a clip in Chromium and seek it to a time.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const MG_JS = fs.readFileSync(path.resolve(import.meta.dirname, '../lib/mg.js'), 'utf8');

// Premiere needs the exact rational for NTSC rates.
export const RATES = {
  23.976: [24000, 1001], 24: [24, 1], 25: [25, 1], 29.97: [30000, 1001],
  30: [30, 1], 50: [50, 1], 59.94: [60000, 1001], 60: [60, 1],
};

export function frameCount(clip) {
  const [n, d] = RATES[clip.fps];
  return Math.round((clip.duration * n) / d);
}

export function frameTime(clip, i) {
  const [n, d] = RATES[clip.fps];
  return (i * d) / n;
}

export async function launch() {
  return chromium.launch();
}

// Loads the clip with an optional data row. Returns { page, clip, seek(t) }.
export async function openClip(browser, file, data = null) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(`window.__MG_DATA__ = ${JSON.stringify(data)};\n${MG_JS}`);
  // The clip size is only known once its script has run. Load once to read it, then reload at
  // that size, so anything the script measures at start sees the real viewport.
  await page.goto('file://' + path.resolve(file));
  const first = await page.evaluate(() => window.CLIP);
  if (first) {
    await page.setViewportSize({ width: first.width, height: first.height });
    errors.length = 0;
    await page.reload();
  }
  const clip = await page.evaluate(() => window.CLIP);
  if (!clip) {
    await page.close();
    throw new Error(`${file}: MG.clip() never ran.${errors.length ? ' Page error: ' + errors.join('; ') : ''}`);
  }
  if (errors.length) throw new Error(`${file}: page error: ${errors.join('; ')}`);
  await page.evaluate(async () => {
    // Fonts load lazily on first use. Text that seek() fills in later would otherwise be
    // measured in the fallback font, and the check would see the face as never loaded.
    await Promise.all([...document.fonts].map(f => f.load().catch(() => {})));
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
  });
  const seek = t => page.evaluate(t => {
    for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
    if (typeof window.seek === 'function') window.seek(t);
  }, t);
  return { page, clip, seek, errors };
}
