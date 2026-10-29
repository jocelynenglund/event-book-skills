// ===========================================
// IMPORT MATCH - The sheet and its commands
// An import of a book you already have asks: Compare / Replace / Keep both.
// SC: Replace From Import — the import takes the shelf's place, never destructively: a draft gets
//   the import as its newest state (the old content stays in its history; one undo brings it
//   back), a build book gets it as its next edition. Refused for a library book not checked out
//   here, and for a published book (start its next draft first).
// SC: Keep Both — today's import, named "‹name› (2)" when the name is taken.
// Compare opens the shelf beside the import and changes nothing; after it the sheet asks again.
// ===========================================

import * as es from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { importMatch, keepBothName } from './match.js';
import { snapshotEvents } from '../snapshot/command.js';
import { isBuildBook, buildBookApp } from '../buildVersions/rules.js';
import { publishBuildEdition } from '../buildVersions/command.js';
import { account, isKept, holderOf } from '../sync/client.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../board/view.js';
import { render, showStart, showCompare, getView, onRender } from '../../ui/feed.js';

let pending = null;   // { importId, shelfId, name, matchedBy, fileName, comparing }
const nameOf = id => projectState(es.readModelEvents(id)).modelName || 'Untitled model';
const WHY = { id: 'the same book', name: 'the same name', app: 'the same app' };

// After an import: if it's a book you already have, ask. True when the sheet is up.
export function offerMatch(importId, fileName = null) {
  const shelves = es.listModels().map(m => ({ id: m.id, events: es.readModelEvents(m.id) }));
  const match = importMatch({ id: importId, events: es.readModelEvents(importId) }, shelves);
  if (!match) { pending = null; return false; }
  pending = { importId, ...match, fileName, comparing: false };
  openSheet();
  return true;
}

function openSheet() {
  const { name, matchedBy } = pending;
  openBoardSheet(`
    <div class="sheet-title im-title">You already have ${escapeHtml(name)}.</div>
    <p class="ti-line im-why">This import is ${WHY[matchedBy]}. What should it do?</p>
    <div class="sheet-options">
      <div class="sheet-option" data-import-action="compare">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↔</div>
        <div class="sheet-option-text"><div class="sheet-option-title">Compare</div><div class="sheet-option-desc">Yours beside the import. Changes nothing</div></div>
      </div>
      <div class="sheet-option" data-import-action="replace">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⤓</div>
        <div class="sheet-option-text"><div class="sheet-option-title">Replace</div><div class="sheet-option-desc">The import becomes the newest version; the old one is kept and one undo away</div></div>
      </div>
      <div class="sheet-option" data-import-action="keep">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">＋</div>
        <div class="sheet-option-text"><div class="sheet-option-title">Keep both</div><div class="sheet-option-desc">A second book, ${escapeHtml(keepBothName(name, es.listModels().map(m => nameOf(m.id))))}</div></div>
      </div>
    </div>`);
}

// Replace: why it can't (or null: done, the import's own shelf is gone)
export function replaceFromImport(shelfId, importId, { fileName = null, matchedBy = null } = {}) {
  if (account() && isKept(shelfId) && !holderOf(shelfId)?.you) {
    const h = holderOf(shelfId);
    return h ? `On loan to ${h.deviceName || 'another device'}: check it in first` : 'Check it out first, then replace it';
  }
  const imported = es.readModelEvents(importId);
  const st = projectState(imported);
  const snapshot = snapshotEvents(imported)[0].data;
  es.openModel(shelfId);
  const events = es.getEventStream();
  const shelf = projectState(events);
  let refused = null;
  if (isBuildBook(events) && st.modelSource?.commit) {
    refused = publishBuildEdition({
      app: buildBookApp(shelf.modelName) || st.modelName, commit: st.modelSource.commit, build: st.modelSource.build ?? null,
      createdAt: st.modelSource.createdAt || null, scenarios: Object.keys(st.scenarios).length, snapshot
    });
  } else if (es.isFrozenCurrent()) {
    refused = 'Published: start its next draft, then import again';
  } else {
    // The shelf keeps its own name, what it follows and its comments; the rest is the import
    snapshot.state = { ...snapshot.state, modelName: shelf.modelName, follow: shelf.follow, comments: shelf.comments };
    if (!es.appendEvent(es.EventTypes.ModelSnapshot, snapshot)) refused = 'Read-only here';
    else es.appendEvent(es.EventTypes.BookReplacedFromImport, { fileName, from: importId, matchedBy });
  }
  if (refused) { es.openModel(importId); return refused; }
  es.deleteModel(importId);
  es.openModel(shelfId);
  return null;
}

// Keep both: the import stays, under a name of its own
export function keepBoth(importId) {
  const name = nameOf(importId);
  const others = es.listModels().filter(m => m.id !== importId).map(m => nameOf(m.id));
  if (!others.some(n => n.trim().toLowerCase() === name.trim().toLowerCase())) return name;
  const free = keepBothName(name, others);
  es.openModel(importId);
  es.appendEvent(es.EventTypes.ModelNamed, { name: free });
  return free;
}

export function initImportMatch() {
  document.getElementById('boardSheetContent')?.addEventListener('click', e => {
    const t = e.target.closest('[data-import-action]');
    if (!t || !pending) return;
    const a = t.dataset.importAction;
    const { importId, shelfId, fileName, matchedBy } = pending;
    if (a === 'compare') {
      pending.comparing = true;
      hideAllSheets();
      es.openModel(shelfId);
      showCompare(shelfId, importId);
    } else if (a === 'replace') {
      const why = replaceFromImport(shelfId, importId, { fileName, matchedBy });
      if (why) { showToast(why); return; }
      pending = null;
      hideAllSheets();
      render();
      showStart();
      // A build book's new edition is published (its older editions stay); a draft's replace is one undo
      if (isBuildBook(es.getEventStream())) showToast('Replaced: the import is its newest edition, the older ones are kept');
      else showToast('Replaced: the previous version is in its history', { action: 'Undo', onAction: () => window.EventPad.undo() });
    } else if (a === 'keep') {
      const name = keepBoth(importId);
      pending = null;
      hideAllSheets();
      render();
      showStart();
      showToast(`Kept both: the import is ${name}`);
    }
  });
  // Back from Compare: ask again (the import is still waiting for an answer)
  onRender(() => {
    if (!pending?.comparing || getView() === 'compare') return;
    pending.comparing = false;
    if (es.listModels().some(m => m.id === pending.importId) && es.listModels().some(m => m.id === pending.shelfId)) setTimeout(openSheet, 0);
    else pending = null;
  });
}
