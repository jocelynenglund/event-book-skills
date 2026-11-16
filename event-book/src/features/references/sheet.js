// ===========================================
// REFERENCES - Sheets: pick a reference to add, read a reference book, and its menu
// ===========================================

import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { toastWithUndo } from '../undo/command.js';
import { secondTap } from '../../ui/secondTap.js';
import { escapeHtml } from '../board/view.js';
import { listReferences, renameReference, deleteReference, insertReference } from './store.js';
import { openModel } from '../../core/eventStore.js';
import { referenceShelf } from './referenceShelf.read.js';
import { referenceBook } from './referenceBook.read.js';
import { referenceMenu } from './referenceMenu.read.js';
import { referenceAddTarget } from './referenceAddTarget.read.js';
import { referenceBookChoices } from './referenceBookChoices.read.js';
import { referenceChoice, referenceAddButton, referenceAddOption, referenceSlice, referenceMenuButton, referenceBookChoice, referenceRenameForm, referenceDeleteOption } from './references.parts.js';

// The books you can change on this device (not build books), to add a reference to
function openBookPicker(refId) {
  const name = referenceMenu(refId)?.name || '';
  const books = referenceBookChoices(refId);
  sheet(`
    <div class="sheet-title">Add "${escapeHtml(name)}" to <span class="bd-sheet-sub">a book you can edit here</span></div>
    ${books.length ? books.map(referenceBookChoice).join('') : '<p class="sy-p">No book here you can edit: open one and check it out first.</p>'}`);
}

let menuRefId = null;

function sheet(html) {
  document.getElementById('boardSheetContent').innerHTML = html;
  showSheet('boardSheet');
}

// From the board's +: which reference to add to the open model
export function openReferencePicker() {
  const refs = referenceShelf();
  sheet(`
    <div class="sheet-title">From reference shelf</div>
    ${refs.length ? `
    <div class="sheet-options">
      ${refs.map(referenceChoice).join('')}
    </div>
    <div class="bd-cell-hint">Added as a new chapter at the end. Cards this model already has (same name) are reused.</div>`
    : `<div class="bd-cell-hint">Nothing saved yet. Open a chapter's menu (tap its name) → <b>Save to reference shelf</b>.</div>`}`);
}

// A reference book, open to read: each slice with its stickies and fields, its
// scenarios folded to their names. Nothing here changes it.
export function openReferenceBook(id) {
  const book = referenceBook(id);
  if (!book) return;
  sheet(`
    <div class="sheet-title">${escapeHtml(book.name)} <span class="bd-sheet-sub">reference</span></div>
    <div class="bd-cell-hint">${escapeHtml(book.summary)}</div>
    <div class="rb-book">${book.slices.map(referenceSlice).join('') || '<p class="bd-cell-hint">This book is empty.</p>'}</div>
    ${referenceAddButton(referenceAddTarget(id))}
    ${referenceMenuButton(id)}`);
}

// From a reference book: rename it, add it, delete it
export function openReferenceMenu(id) {
  const menu = referenceMenu(id);
  if (!menu) return;
  menuRefId = id;
  sheet(`
    <div class="sheet-title">${escapeHtml(menu.name)} <span class="bd-sheet-sub">reference</span></div>
    <div class="bd-cell-hint">${escapeHtml(menu.summary)}</div>
    ${referenceRenameForm(menu)}
    <div class="sheet-options">
      ${referenceAddOption(referenceAddTarget(id))}
      ${referenceDeleteOption()}
    </div>`);
}

function onClick(e) {
  const t = e.target.closest('[data-ref-action]');
  if (!t) return;
  const a = t.dataset.refAction;
  if (a === 'menu') { openReferenceMenu(t.dataset.ref); return; }
  if (a === 'pick-book') { openBookPicker(t.dataset.ref); return; }
  if (a === 'insert' || a === 'insert-into') {
    if (a === 'insert-into') openModel(t.dataset.model);
    const ref = listReferences().find(r => r.id === t.dataset.ref);
    const n = insertReference(t.dataset.ref);
    hideAllSheets();
    window.EventPad.showBoard();
    requestAnimationFrame(() => document.getElementById('board')?.scrollTo({ left: 99999, behavior: 'smooth' }));
    toastWithUndo(`Added "${ref?.name}" (${n} ${n === 1 ? 'slice' : 'slices'})`);
  } else if (a === 'rename') {
    const name = document.getElementById('refName')?.value.trim();
    if (!name) return;
    renameReference(menuRefId, name);
    hideAllSheets();
    render();
    showToast('Renamed');
  } else if (a === 'delete') {
    if (!secondTap(t)) return;
    deleteReference(menuRefId);
    hideAllSheets();
    render();
    showToast('Reference deleted');
  }
}

export function initReferences() {
  document.getElementById('boardSheetContent').addEventListener('click', onClick);
}
