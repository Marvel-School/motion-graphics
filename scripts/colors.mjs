#!/usr/bin/env node
// Lists the main colors in an image (logo, screenshot), most-used first, as exact hex values.
//   node scripts/colors.mjs <image>
// Transparent pixels are ignored. Near-identical shades (anti-aliased edges) merge into the
// most-used exact color nearby.
import fs from 'node:fs';
import path from 'node:path';
import { launch } from './page.mjs';

// file:// images taint the canvas, so the image goes in as a data URL.
function dataUrl(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const type = { svg: 'image/svg+xml', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[ext];
  if (!type) throw new Error(`unsupported image type: .${ext}`);
  return `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('usage: colors.mjs <image>');
  const browser = await launch();
  try {
    const page = await browser.newPage();
    const colors = await page.evaluate(async src => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = Math.min(1, 400 / Math.max(img.naturalWidth || 400, img.naturalHeight || 400));
      const w = Math.max(1, Math.round((img.naturalWidth || 400) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || 400) * scale));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const counts = new Map();
      let total = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] < 200) continue;
        const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        counts.set(key, (counts.get(key) || 0) + 1);
        total++;
      }
      const clusters = [];
      for (const [key, n] of [...counts].sort((a, b) => b[1] - a[1])) {
        const rgb = [key >> 16, (key >> 8) & 255, key & 255];
        const near = clusters.find(cl => Math.hypot(...cl.rgb.map((v, j) => v - rgb[j])) < 28);
        if (near) near.n += n; else clusters.push({ rgb, n });
      }
      return clusters.slice(0, 6).map(cl => ({
        hex: '#' + cl.rgb.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase(),
        share: Math.round((cl.n / total) * 100),
      }));
    }, dataUrl(file));
    for (const c of colors) console.log(`${c.hex}  ${c.share}%`);
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
