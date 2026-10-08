#!/usr/bin/env node
// Renders a clip.html frame by frame.
//   node scripts/render.mjs <clip.html> --out final.mov [--data rows.json]   ProRes 4444 (alpha) or 422 HQ
//   node scripts/render.mjs <clip.html> --preview --out preview.mp4          half-size H.264, checkerboard behind alpha
//   node scripts/render.mjs <clip.html> --stills 0.5,2,4 --out sheet.png      key frames side by side
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { launch, openClip, frameCount, frameTime, RATES } from './page.mjs';

const CHECKER = 'repeating-conic-gradient(#9a9a9a 0% 25%, #5c5c5c 0% 50%) 0 0 / 32px 32px';

function parseArgs(argv) {
  const a = { clip: null, out: null, data: null, preview: false, stills: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--out') a.out = argv[++i];
    else if (k === '--data') a.data = argv[++i];
    else if (k === '--preview') a.preview = true;
    else if (k === '--stills') a.stills = argv[++i].split(',').map(Number);
    else if (!a.clip) a.clip = k;
    else throw new Error(`unknown argument: ${k}`);
  }
  if (!a.clip || !a.out) throw new Error('usage: render.mjs <clip.html> --out <file> [--data rows.json | --preview | --stills t1,t2]');
  return a;
}

function slug(s) {
  return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function batchName(out, i, row) {
  const ext = path.extname(out);
  const first = Object.values(row).find(v => typeof v === 'string' && v.trim());
  const tail = first ? '_' + slug(first) : '';
  return path.join(path.dirname(out), `${path.basename(out, ext)}_${String(i + 1).padStart(2, '0')}${tail}${ext}`);
}

function encoderArgs(clip, preview) {
  const [n, d] = RATES[clip.fps];
  const input = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', `${n}/${d}`, '-c:v', 'png', '-i', '-'];
  const color = ['-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709'];
  if (preview) {
    return [...input, '-vf', 'scale=trunc(iw/4)*2:trunc(ih/4)*2:out_color_matrix=bt709:out_range=tv',
      '-c:v', 'libx264', '-crf', '23', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', ...color, '-movflags', '+faststart'];
  }
  const scale = ['-vf', 'scale=out_color_matrix=bt709:out_range=tv'];
  if (clip.alpha) {
    return [...input, ...scale, '-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-vendor', 'apl0', ...color];
  }
  return [...input, ...scale, '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', '-vendor', 'apl0', ...color];
}

async function renderVideo(browser, file, out, data, preview) {
  const { page, clip, seek } = await openClip(browser, file, data);
  if (preview && clip.alpha) {
    await page.addStyleTag({ content: `html{background:${CHECKER} !important}` });
  }
  const ff = spawn('ffmpeg', [...encoderArgs(clip, preview), out], { stdio: ['pipe', 'inherit', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', d => (ffErr += d));
  const done = new Promise(res => ff.on('close', res));
  const frames = frameCount(clip);
  for (let i = 0; i < frames; i++) {
    await seek(frameTime(clip, i));
    const png = await page.screenshot({ type: 'png', omitBackground: clip.alpha && !preview });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  const code = await done;
  await page.close();
  if (code !== 0) throw new Error(`ffmpeg failed for ${out}: ${ffErr.trim()}`);
  const mb = (fs.statSync(out).size / 1e6).toFixed(1);
  const kind = preview ? 'H.264 preview' : clip.alpha ? 'ProRes 4444 + alpha' : 'ProRes 422 HQ';
  const size = preview ? `${Math.floor(clip.width / 4) * 2}x${Math.floor(clip.height / 4) * 2}` : `${clip.width}x${clip.height}`;
  console.log(`${path.basename(out)}  ${size} ${clip.fps}fps ${frames} frames  ${kind}  ${mb} MB`);
}

async function renderStills(browser, file, out, times) {
  const { page, clip, seek } = await openClip(browser, file);
  const shots = [];
  for (const t of times) {
    await seek(t);
    shots.push((await page.screenshot({ type: 'png', omitBackground: clip.alpha })).toString('base64'));
  }
  await page.close();
  const h = clip.height >= clip.width ? 640 : 360;
  const label = [clip.brand, path.basename(path.dirname(path.resolve(file))), `${clip.width}x${clip.height}`, `${clip.fps} fps`,
    `${clip.duration}s`, clip.alpha ? 'transparent' : 'full frame'].filter(Boolean).join('  ·  ');
  const sheet = await browser.newPage({ viewport: { width: 400, height: 400 } });
  await sheet.setContent(`<body style="margin:0;background:#1b1b1b;font:14px system-ui,sans-serif;color:#ddd;display:inline-block;padding:16px">
    <div style="margin-bottom:12px;font-weight:600">${label}</div>
    <div style="display:flex;gap:12px">${shots.map((b, i) => `<figure style="margin:0">
      <img src="data:image/png;base64,${b}" style="height:${h}px;display:block;background:${clip.alpha ? CHECKER : '#000'}">
      <figcaption style="margin-top:6px">${times[i]}s</figcaption></figure>`).join('')}</div></body>`);
  const box = await sheet.locator('body').boundingBox();
  await sheet.setViewportSize({ width: Math.ceil(box.width), height: Math.ceil(box.height) });
  await sheet.screenshot({ path: out, fullPage: true });
  await sheet.close();
  console.log(`${path.basename(out)}  ${times.length} stills at ${times.join(', ')}s`);
}

function loadRows(file, defaults) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`${file}: expected a non-empty JSON array of rows`);
  rows.forEach((row, i) => {
    const missing = Object.keys(defaults).filter(k => !(k in row));
    if (missing.length) throw new Error(`${file}: row ${i + 1} is missing ${missing.join(', ')}`);
  });
  return rows;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  fs.mkdirSync(path.dirname(path.resolve(a.out)), { recursive: true });
  const browser = await launch();
  try {
    if (a.stills) return await renderStills(browser, a.clip, a.out, a.stills);
    if (!a.data) return await renderVideo(browser, a.clip, a.out, null, a.preview);
    const probe = await openClip(browser, a.clip);
    const rows = loadRows(a.data, probe.clip.defaults);
    await probe.page.close();
    for (const [i, row] of rows.entries()) {
      await renderVideo(browser, a.clip, batchName(a.out, i, row), row, a.preview);
    }
  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });
