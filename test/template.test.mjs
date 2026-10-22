import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir, writeClip, run } from './helpers.mjs';

const spec = { width: 320, height: 180, fps: 25, duration: 0.2, alpha: true };

// A job folder as SKILL-BODY.md leaves it: clip.html plus the fonts apply-brand wrote.
function job(defaults) {
  const dir = tmpdir();
  writeClip(dir, { spec, defaults });
  fs.mkdirSync(path.join(dir, 'fonts'));
  fs.writeFileSync(path.join(dir, 'fonts', 'poppins-600.woff2'), 'font bytes');
  return dir;
}

function save(jobDir, root, ...args) {
  return run('save-template.mjs', [jobDir, ...args, '--root', root]);
}

// Bug caught: the panel offers no fields, or the wrong ones, because template.json lacks the clip's text.
test('saves a job as a template whose fields are the clip defaults, fonts included', () => {
  const root = tmpdir();
  const r = save(job({ name: 'Jan de Vries', role: 'Product owner' }), root, 'productowner', 'lower-third');
  assert.equal(r.code, 0, r.out);
  const dir = path.join(root, 'productowner', 'lower-third');
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'template.json'), 'utf8'));
  assert.equal(meta.client, 'productowner');
  assert.equal(meta.type, 'lower-third');
  assert.deepEqual(meta.fields, { name: 'Jan de Vries', role: 'Product owner' });
  assert.ok(fs.existsSync(path.join(dir, 'clip.html')));
  assert.equal(fs.readFileSync(path.join(dir, 'fonts', 'poppins-600.woff2'), 'utf8'), 'font bytes');
});

// Bug caught: a new design silently replaces the approved one he still uses on the timeline.
test('refuses to replace an existing template unless asked', () => {
  const root = tmpdir();
  assert.equal(save(job({ name: 'First' }), root, 'acme', 'title-card').code, 0);
  const second = job({ name: 'Second' });
  const fieldsNow = () => JSON.parse(fs.readFileSync(path.join(root, 'acme', 'title-card', 'template.json'), 'utf8')).fields;

  const refused = save(second, root, 'acme', 'title-card');
  assert.equal(refused.code, 1);
  assert.match(refused.out, /acme\/title-card already exists/);
  assert.deepEqual(fieldsNow(), { name: 'First' });

  assert.equal(save(second, root, 'acme', 'title-card', '--replace').code, 0);
  assert.deepEqual(fieldsNow(), { name: 'Second' });
});

// Bug caught: a client name like "../brands" writes the template outside the templates folder.
test('refuses a client or type that is not a plain slug', () => {
  const parent = tmpdir();
  const root = path.join(parent, 'templates');
  const r = save(job({ name: 'X' }), root, '../brands', 'lower-third');
  assert.equal(r.code, 1);
  assert.match(r.out, /\.\.\/brands/);
  assert.deepEqual(fs.readdirSync(parent), []);
});
