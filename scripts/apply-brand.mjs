#!/usr/bin/env node
// Writes a brand kit into a clip: colors and fonts as CSS variables, font files, logo.
//   node scripts/apply-brand.mjs <brand-dir> <clip-dir>
// The clip's <style> must contain a /* brand */ ... /* /brand */ block; it is replaced whole.
// brand.json: { name, colors: { bg, fg, primary, accent, ... }, fonts: [{ role, family, weights, file? }], logo, rules }
import fs from 'node:fs';
import path from 'node:path';
import { fromFile, fromFontsource } from './font.mjs';

const REQUIRED = ['bg', 'fg', 'primary', 'accent'];
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function main() {
  const [brandDir, clipDir] = process.argv.slice(2);
  if (!brandDir || !clipDir) throw new Error('usage: apply-brand.mjs <brand-dir> <clip-dir>');
  const kit = JSON.parse(fs.readFileSync(path.join(brandDir, 'brand.json'), 'utf8'));
  const clipFile = path.join(clipDir, 'clip.html');
  const html = fs.readFileSync(clipFile, 'utf8');
  if (!/\/\* brand \*\/[\s\S]*?\/\* \/brand \*\//.test(html)) throw new Error(`${clipFile}: no /* brand */ ... /* /brand */ block`);

  const colors = kit.colors || {};
  const missing = REQUIRED.filter(k => !colors[k]);
  if (missing.length) throw new Error(`${kit.name}: brand.json has no color for ${missing.join(', ')}`);
  for (const [k, v] of Object.entries(colors)) if (!HEX.test(v)) throw new Error(`${kit.name}: color ${k} is not a hex value: ${v}`);

  const faces = [];
  const fontVars = {};
  for (const f of kit.fonts || []) {
    const weights = (f.weights || [400]).map(String);
    faces.push(...(f.file ? fromFile(path.join(brandDir, f.file), f.family, weights, clipDir) : fromFontsource(f.family, weights, clipDir)));
    fontVars[f.role] = `"${f.family}"`;
  }
  const display = fontVars.display || fontVars.body || 'sans-serif';
  const body = fontVars.body || fontVars.display || 'sans-serif';

  let logo = '';
  if (kit.logo) {
    const ext = path.extname(kit.logo);
    fs.mkdirSync(path.join(clipDir, 'assets'), { recursive: true });
    fs.copyFileSync(path.join(brandDir, kit.logo), path.join(clipDir, 'assets', 'logo' + ext));
    logo = `assets/logo${ext}`;
  }

  const vars = [
    `--brand:"${kit.name.replace(/"/g, '')}"`,
    ...Object.entries(colors).map(([k, v]) => `--${k}:${v}`),
    `--font-display:${display},sans-serif`,
    `--font-body:${body},sans-serif`,
    `--logo-src:"${logo}"`,
  ];
  const block = `/* brand */\n${faces.join('\n')}${faces.length ? '\n' : ''}:root{${vars.join(';')}}\n/* /brand */`;
  fs.writeFileSync(clipFile, html.replace(/\/\* brand \*\/[\s\S]*?\/\* \/brand \*\//, () => block));
  console.log(`${kit.name} applied to ${path.basename(path.resolve(clipDir))}: ${Object.keys(colors).length} colors, ${faces.length} font files${logo ? ', logo' : ''}`);
}

try { main(); } catch (e) { console.error(e.message); process.exit(1); }
