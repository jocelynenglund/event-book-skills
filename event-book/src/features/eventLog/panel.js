// ===========================================
// EVENT LOG - Panel
// ===========================================

import { getEventStream, loadEventStream, saveEventStream, createModel, StorageFullError, getCurrentModelId } from '../../core/eventStore.js';
import { offerMatch } from '../testImport/matchSheet.js';
import { snapshotEvents } from '../snapshot/command.js';
import { projectState } from '../../core/projections.js';
import { importFiles } from '../testImport/import.js';
import { kindOf } from '../testImport/spec.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { copyText } from '../../ui/clipboard.js';

export function toggleEventLog() {
  document.getElementById('eventLog').classList.toggle('open');
}

export async function copyEvent(index, element) {
  const eventStream = getEventStream();
  const evt = eventStream[index];
  const text = JSON.stringify(evt, null, 2);

  if (!(await copyText(text))) {
    showToast("Couldn't copy here");
    return;
  }
  // Show feedback
  const existing = element.querySelector('.copied');
  if (existing) existing.remove();

  const badge = document.createElement('span');
  badge.className = 'copied';
  badge.textContent = '✓ copied';
  element.querySelector('.event-log-type').after(badge);

  setTimeout(() => badge.remove(), 1500);
}

export async function copyAllEvents() {
  const eventStream = getEventStream();
  const text = JSON.stringify(eventStream, null, 2);

  if (await copyText(text)) showToast(`All ${eventStream.length} events copied`);
  // Some browsers won't copy this much: the same events as a file instead
  else showToast("Couldn't copy here", { action: 'Download', onAction: exportModel });
}

// history: false saves the model as it stands, in one snapshot event (much smaller)
const slug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Named by where the model comes from. Built from tests and not touched since its
// snapshot: that build (<date>-<app>-<sha>-built.json). Built from tests, then edited: a
// plan started from that build (<date>-<app>-<sha>-plan.json). Drawn from scratch:
// <date>-<model name>-plan.json. Every plan ends in -plan.json (the save scripts prune by it).
export function exportFileName(events, date = new Date().toISOString().slice(0, 10)) {
  const state = projectState(events);
  const src = state.modelSource;
  if (!src?.commit) return `${date}-${slug(state.modelName) || 'model'}-plan.json`;
  const repo = String(src.repo || '').replace(/\/+$/, '').split('/').pop();
  const untouched = events[events.length - 1]?.type === 'ModelSnapshot';
  // The app's name: the app a plan follows, else the snapshot's (the shelf may be renamed since),
  // without the shelf's " · built" / " · plan 2" (the file name says which it is)
  const snap = [...events].reverse().find(e => e.type === 'ModelSnapshot');
  const bare = s => String(s || '').replace(/\s*·\s*(built|plan)(\s+\d+)?\s*$/i, '');
  const app = slug(state.follow?.app) || slug(bare(snap?.data?.state?.modelName)) || slug(repo) || slug(bare(state.modelName)) || 'model';
  return `${date}-${app}-${String(src.commit).slice(0, 7)}-${untouched ? 'built' : 'plan'}.json`;
}

export function exportModel({ history = true } = {}) {
  if (getEventStream().length === 0) {
    showToast('Nothing to export yet');
    return;
  }
  const eventStream = history ? getEventStream() : snapshotEvents(getEventStream());

  const json = JSON.stringify(eventStream, null, history ? 2 : 0);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName(getEventStream());
  a.click();
  URL.revokeObjectURL(url);
  showToast('Model exported!');
}

export function importModel(input) {
  const file = input.files[0];
  if (!file) return;
  // Several files, or ones that aren't an eventPAD model (test exports, a plan): Import Test Export
  if (input.files.length > 1 || !/\.json$/i.test(file.name) || /\.test\.json$|latest(-built)?\.json$|-built\.json$|slices\.json$/i.test(file.name)) {
    importFiles(input.files).finally(() => { input.value = ''; });
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    let events;
    try {
      events = JSON.parse(e.target.result);
      // A test export or a plan under another name
      if (kindOf(events) !== 'events') { importFiles(input.files).finally(() => { input.value = ''; }); return; }
    } catch (err) {
      showToast("That file isn't an Event Book model");
      input.value = '';
      return;
    }
    try {
      // Imports land on their own shelf instead of replacing the open model
      createModel(events);
      render();
      // A book you already have: ask (Compare / Replace / Keep both)
      if (offerMatch(getCurrentModelId(), file.name)) { input.value = ''; return; }
      showToast(events.length === 1 && events[0].type === 'ModelSnapshot'
        ? 'Imported as a new model (without history)'
        : `Imported as a new model (${events.length} events)`);
    } catch (err) {
      const mb = (e.target.result.length / 1e6).toFixed(1);
      showToast(err instanceof StorageFullError
        ? `No room on this device for this ${mb} MB model. Delete a model from your bookshelves (an older copy?) and import again.`
        : "Couldn't import that model");
    }
    // Reset input so same file can be re-imported
    input.value = '';
  };
  reader.readAsText(file);
}
