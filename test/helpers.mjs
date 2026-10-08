import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');

export function tmpdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mg-test-'));
}

// Writes a clip.html into dir. body: HTML inside <body>. script: JS run after MG.clip().
export function writeClip(dir, { spec, body = '', css = '', script = '', defaults = {} }) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden}
${css}</style></head><body>${body}
<script>
const DATA = MG.clip(${JSON.stringify(spec)}, ${JSON.stringify(defaults)});
${script}
</script></body></html>`;
  const file = path.join(dir, 'clip.html');
  fs.writeFileSync(file, html);
  return file;
}

export function run(script, args) {
  const r = spawnSync('node', [path.join(ROOT, 'scripts', script), ...args], { encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}

export function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_frames', '-show_entries',
    'stream=codec_name,profile,pix_fmt,width,height,r_frame_rate,nb_read_frames', '-of', 'json', file], { encoding: 'utf8' });
  return JSON.parse(r.stdout).streams[0];
}

// Min and max alpha of one frame (frame index n), as 0..1.
export function alphaRange(file, n = 0) {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-vf',
    `select=eq(n\\,${n}),alphaextract,format=gray,signalstats,metadata=print`,
    '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8' });
  const min = Number(/signalstats\.YMIN=(\d+)/.exec(r.stderr)?.[1]);
  const max = Number(/signalstats\.YMAX=(\d+)/.exec(r.stderr)?.[1]);
  return { min: min / 255, max: max / 255 };
}

// Min and max luma (0..255) of frame 0 after an optional filter such as a crop.
export function lumaRange(file, filter = 'null') {
  const r = spawnSync('ffmpeg', ['-v', 'info', '-i', file, '-vf', `${filter},format=yuv420p,signalstats,metadata=print`,
    '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8' });
  return {
    min: Number(/signalstats\.YMIN=(\d+)/.exec(r.stderr)?.[1]),
    max: Number(/signalstats\.YMAX=(\d+)/.exec(r.stderr)?.[1]),
  };
}

export function frameHash(file, n) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-vf', `select=eq(n\\,${n})`,
    '-frames:v', '1', '-f', 'md5', '-'], { encoding: 'utf8' });
  return r.stdout.trim();
}
