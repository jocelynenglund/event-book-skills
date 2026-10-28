// ===========================================
// REFERENCES - Sheets: pick a reference to add, read a reference book, and its menu
// ===========================================

import { projectState, getOrderedSlices, getScenariosForSlice, sliceTitle } from '../../core/projections.js';
import { elementLabel, externalAttr, propLabel } from '../../core/constants.js';
import { renderGwt } from '../scenarios/view.js';
import { sliceTypeLabels } from '../board/view.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { toastWithUndo } from '../undo/command.js';
import { secondTap } from '../../ui/secondTap.js';
import { escapeHtml } from '../board/view.js';
import { listReferences, referenceState, renameReference, deleteReference, insertReference } from './store.js';
import { listModels, readModelEvents, openModel, canEditCurrent, getCurrentModelId } from '../../core/eventStore.js';
import { canEdit } from '../sync/client.js';
import { isBuildBook } from '../buildVersions/rules.js';

// Where "Add" goes: the open book when you can change it here; otherwise (on the bookshelves,
// where no book is open, or a read-only or build book) you pick one
const addTarget = () => document.body.classList.contains('library-mode') || !canEditCurrent() || isBuildBook(readModelEvents(getCurrentModelId()))
  ? null : (projectState().modelName || 'Untitled model');
const addButton = (id, option = false) => {
  const target = addTarget();
  const label = target ? `Add to ${escapeHtml(target)}` : 'Add to a book…';
  return option
    ? `<div class="sheet-option" data-ref-action="${target ? 'insert' : 'pick-book'}" data-ref="${id}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">＋</div>
        <div class="sheet-option-text"><div class="sheet-option-title">${label}</div></div>
      </div>`
    : `<button class="sheet-btn" data-ref-action="${target ? 'insert' : 'pick-book'}" data-ref="${id}">${label}</button>`;
};

// The books you can change on this device (not build books), to add a reference to
function openBookPicker(refId) {
  const ref = listReferences().find(r => r.id === refId);
  const books = listModels().filter(m => canEdit(m.id) && !isBuildBook(readModelEvents(m.id)))
    .map(m => ({ id: m.id, name: projectState(readModelEvents(m.id)).modelName || 'Untitled model' }))
    .sort((a, b) => a.name.localeCompare(b.name));
  sheet(`
    <div class="sheet-title">Add "${escapeHtml(ref?.name || '')}" to <span class="bd-sheet-sub">a book you can edit here</span></div>
    ${books.length ? books.map(b => `
      <div class="sheet-option" data-ref-action="insert-into" data-ref="${refId}" data-model="${b.id}">
        <div class="sheet-option-text"><div class="sheet-option-title">${escapeHtml(b.name)}</div></div>
      </div>`).join('') : '<p class="sy-p">No book here you can edit: open one and check it out first.</p>'}`);
}

let menuRefId = null;

function sheet(html) {
  document.getElementById('boardSheetContent').innerHTML = html;
  showSheet('boardSheet');
}

function summary(ref) {
  const { state } = referenceState(ref);
  const n = Object.keys(state.slices).length;
  return `${n} ${n === 1 ? 'slice' : 'slices'}${ref.from ? ` · from ${escapeHtml(ref.from)}` : ''}`;
}

// From the board's +: which reference to add to the open model
export function openReferencePicker() {
  const refs = listReferences();
  sheet(`
    <div class="sheet-title">From reference shelf</div>
    ${refs.length ? `
    <div class="sheet-options">
      ${refs.map(r => `
        <div class="sheet-option" data-ref-action="insert" data-ref="${r.id}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">📗</div>
          <div class="sheet-option-text">
            <div class="sheet-option-title">${escapeHtml(r.name)}</div>
            <div class="sheet-option-desc">${summary(r)}</div>
          </div>
        </div>`).join('')}
    </div>
    <div class="bd-cell-hint">Added as a new chapter at the end. Cards this model already has (same name) are reused.</div>`
    : `<div class="bd-cell-hint">Nothing saved yet. Open a chapter's menu (tap its name) → <b>Save to reference shelf</b>.</div>`}`);
}

// A reference book, open to read: each slice with its stickies and fields, its
// scenarios folded to their names. Nothing here changes it.
export function openReferenceBook(id) {
  const ref = listReferences().find(r => r.id === id);
  if (!ref) return;
  const { state } = referenceState(ref);
  const slices = getOrderedSlices(state).map(slice => {
    const stickies = slice.elements.map(e => state.elements[e]).filter(Boolean).map(el => `
      <div class="rb-sticky" data-type="${el.type}"${externalAttr(el)}>
        <span class="rb-kind">${escapeHtml(elementLabel(el))}</span> <b>${escapeHtml(el.name)}</b>
        ${el.properties?.length ? `<span class="rb-fields">${el.properties.map(p => escapeHtml(propLabel(p))).join(' · ')}</span>` : ''}
      </div>`).join('');
    const scenarios = getScenariosForSlice(slice.id, state).map(scn => `
      <details class="bd-scn"><summary>${scn.mustHave ? '<span class="must-star">★</span> ' : ''}${escapeHtml(scn.name || 'Scenario')}</summary>
        <div class="bd-scn-body">${renderGwt(scn, state)}</div></details>`).join('');
    return `
      <section class="rb-slice">
        <div class="rb-slice-type" data-slice-type="${slice.type}">${escapeHtml(sliceTypeLabels[slice.type] || slice.type)}</div>
        <div class="rb-slice-name">${escapeHtml(sliceTitle(slice, state))}</div>
        ${slice.description ? `<p class="rb-desc">${escapeHtml(slice.description)}</p>` : ''}
        <div class="rb-stickies">${stickies}</div>
        ${scenarios ? `<div class="bd-scns">${scenarios}</div>` : ''}
      </section>`;
  }).join('');
  sheet(`
    <div class="sheet-title">${escapeHtml(ref.name)} <span class="bd-sheet-sub">reference</span></div>
    <div class="bd-cell-hint">${summary(ref)}</div>
    <div class="rb-book">${slices || '<p class="bd-cell-hint">This book is empty.</p>'}</div>
    ${addButton(id)}
    <button class="sheet-btn secondary" data-ref-action="menu" data-ref="${id}">Rename or delete…</button>`);
}

// From a reference book: rename it, add it, delete it
export function openReferenceMenu(id) {
  const ref = listReferences().find(r => r.id === id);
  if (!ref) return;
  menuRefId = id;
  sheet(`
    <div class="sheet-title">${escapeHtml(ref.name)} <span class="bd-sheet-sub">reference</span></div>
    <div class="bd-cell-hint">${summary(ref)}</div>
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="refName" value="${escapeHtml(ref.name)}" aria-label="Name">
      <button class="sheet-btn" data-ref-action="rename">Save</button>
    </div>
    <div class="sheet-options">
      ${addButton(id, true)}
      <div class="sheet-option" data-ref-action="delete" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
        <div class="sheet-option-icon" style="background: #c0392b;">🗑️</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title" style="color: #e74c3c;">Delete reference</div>
          <div class="sheet-option-desc">Models it was added to keep their copy</div>
        </div>
      </div>
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
