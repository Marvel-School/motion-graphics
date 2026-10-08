#!/usr/bin/env node
// Puts font files next to a clip and prints the @font-face CSS for them.
//   node scripts/font.mjs "Bebas Neue" 400 <clip-dir>          from npm @fontsource (Google Fonts families)
//   node scripts/font.mjs "Poppins" 400,600,800 <clip-dir>
//   node scripts/font.mjs --file Brand.otf "Brand Sans" 700 <clip-dir>   a file the user uploaded
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function fromFile(file, family, weights, dir) {
  const ext = path.extname(file).toLowerCase();
  const format = { '.woff2': 'woff2', '.woff': 'woff', '.otf': 'opentype', '.ttf': 'truetype' }[ext];
  if (!format) throw new Error(`unsupported font file type: ${ext}`);
  const name = `${slug(family)}-${weights[0]}${ext}`;
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  fs.copyFileSync(file, path.join(dir, 'fonts', name));
  return [`@font-face{font-family:"${family}";font-weight:${weights[0]};src:url(fonts/${name}) format("${format}")}`];
}

export function fromFontsource(family, weights, dir) {
  const pkg = `@fontsource/${slug(family)}`;
  const pkgDir = path.join(ROOT, 'node_modules', pkg);
  // A package without files/ is a half-finished install (two installs at once); install again.
  if (!fs.existsSync(path.join(pkgDir, 'files'))) {
    // On Windows npm is npm.cmd, which Node only starts through a shell.
    const r = spawnSync('npm', ['install', '--no-save', '--silent', pkg], { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
    if (r.status !== 0) throw new Error(`"${family}" is not on npm as ${pkg}. Ask the user for the font file and use --file.`);
  }
  const css = [];
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  for (const w of weights) {
    const src = path.join(pkgDir, 'files', `${slug(family)}-latin-${w}-normal.woff2`);
    if (!fs.existsSync(src)) {
      const have = [...new Set(fs.readdirSync(path.join(pkgDir, 'files'))
        .map(f => /-latin-(\d+)-normal\.woff2$/.exec(f)?.[1]).filter(Boolean))].join(', ');
      throw new Error(`"${family}" has no weight ${w}. Available: ${have}`);
    }
    const name = `${slug(family)}-${w}.woff2`;
    fs.copyFileSync(src, path.join(dir, 'fonts', name));
    css.push(`@font-face{font-family:"${family}";font-weight:${w};src:url(fonts/${name}) format("woff2")}`);
  }
  return css;
}

function main() {
  const args = process.argv.slice(2);
  let file = null;
  if (args[0] === '--file') { file = args[1]; args.splice(0, 2); }
  const [family, weightList, dir] = args;
  if (!family || !weightList || !dir) throw new Error('usage: font.mjs [--file <path>] "<Family>" <w1,w2> <clip-dir>');
  const weights = weightList.split(',').map(s => s.trim());
  fs.mkdirSync(path.join(dir, 'fonts'), { recursive: true });
  const css = file ? fromFile(file, family, weights, dir) : fromFontsource(family, weights, dir);
  console.log(css.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (e) { console.error(e.message); process.exit(1); }
}
