#!/usr/bin/env node
// Saves an approved job as a template the Premiere panel can fill.
//   node scripts/save-template.mjs <job-dir> <client> <type> [--replace] [--root <templates-dir>]
// Copies clip.html, fonts/ and assets/ to <root>/<client>/<type>/ and writes template.json,
// whose fields are the clip's defaults. Root defaults to ~/motion-graphics/templates.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch, openClip } from './page.mjs';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function parseArgs(argv) {
  const a = { replace: false, root: path.join(os.homedir(), 'motion-graphics', 'templates'), rest: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--replace') a.replace = true;
    else if (argv[i] === '--root') a.root = argv[++i];
    else a.rest.push(argv[i]);
  }
  const [job, client, type] = a.rest;
  if (!job || !client || !type || a.rest.length > 3) {
    throw new Error('usage: save-template.mjs <job-dir> <client> <type> [--replace] [--root <dir>]');
  }
  for (const s of [client, type]) {
    if (!SLUG.test(s)) throw new Error(`"${s}" is not a plain name; use lowercase letters, digits and dashes`);
  }
  return { ...a, job, client, type };
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const dest = path.join(a.root, a.client, a.type);
  const name = `${a.client}/${a.type}`;
  if (fs.existsSync(dest) && !a.replace) throw new Error(`${name} already exists; ask before replacing it, then add --replace`);

  const browser = await launch();
  let defaults;
  try {
    ({ clip: { defaults } } = await openClip(browser, path.join(a.job, 'clip.html')));
  } finally {
    await browser.close();
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of ['clip.html', 'fonts', 'assets']) {
    const src = path.join(a.job, entry);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, entry), { recursive: true });
  }
  const meta = { client: a.client, type: a.type, fields: defaults, saved: new Date().toISOString() };
  fs.writeFileSync(path.join(dest, 'template.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(`saved ${name}: ${Object.keys(defaults).join(', ') || 'no text fields'}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
