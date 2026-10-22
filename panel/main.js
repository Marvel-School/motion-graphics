// Spike for task 5 of docs/plans/2026-10-22-daily-use.md. Each button tries one Premiere move and
// logs what happened, so a failure names the call that failed. Not the real panel.
const ppro = require('premierepro');
const { host } = require('uxp');

const $ = id => document.getElementById(id);
const log = (...lines) => { $('log').textContent = lines.join('\n') + '\n\n' + $('log').textContent; };

async function activeSequence() {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error('No project is open.');
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error('No sequence is open.');
  return { project, sequence };
}

const samePath = (a, b) => a.replace(/\\/g, '/').toLowerCase() === b.replace(/\\/g, '/').toLowerCase();

// importFiles only reports true or false, so find the new item by its media path in the root bin.
async function importAndFind(project, file) {
  const ok = await project.importFiles([file], true, null, false);
  if (!ok) throw new Error(`importFiles returned false for ${file}`);
  const root = await project.getRootItem();
  for (const item of await root.getItems()) {
    const clip = ppro.ClipProjectItem.cast(item);
    if (clip && samePath(await clip.getMediaFilePath(), file)) return item;
  }
  throw new Error('Imported, but found no root-bin item with that media path.');
}

async function inspect() {
  const { sequence } = await activeSequence();
  const size = await sequence.getFrameSize();
  const timebase = await sequence.getTimebase();
  const tracks = await sequence.getVideoTrackCount();
  const playhead = await sequence.getPlayerPosition();
  const lines = [
    `Premiere ${host.version}`,
    `sequence: ${size.width}x${size.height}, timebase ${timebase}, ${tracks} video tracks, playhead ${playhead.seconds.toFixed(3)} s`,
  ];
  const items = await (await sequence.getSelection()).getTrackItems();
  if (items.length === 0) lines.push('selection: nothing selected');
  for (const item of items) {
    const clip = ppro.ClipProjectItem.cast(await item.getProjectItem());
    const path = clip ? await clip.getMediaFilePath() : '(not a clip)';
    const start = await item.getStartTime();
    lines.push(`selected: track ${await item.getTrackIndex()}, start ${start.seconds.toFixed(3)} s, ${path}`);
  }
  log(...lines);
}

async function importOnly() {
  const { project } = await activeSequence();
  const item = await importAndFind(project, $('file').value.trim());
  log(`imported: ${await ppro.ClipProjectItem.cast(item).getMediaFilePath()}`);
}

async function place() {
  const { project, sequence } = await activeSequence();
  const item = await importAndFind(project, $('file').value.trim());
  const track = Number($('track').value);
  const at = await sequence.getPlayerPosition();
  const editor = ppro.SequenceEditor.getEditor(sequence);
  let ok = false;
  project.lockedAccess(() => {
    ok = project.executeTransaction(compound => {
      compound.addAction(editor.createOverwriteItemAction(item, at, track, track));
    }, 'Place motion graphic');
  });
  log(ok ? `placed on video track index ${track} at ${at.seconds.toFixed(3)} s` : 'executeTransaction returned false');
}

for (const [id, fn] of [['inspect', inspect], ['import', importOnly], ['place', place]]) {
  $(id).addEventListener('click', () => fn().catch(e => log(`${id} failed: ${e.message || e}`)));
}
