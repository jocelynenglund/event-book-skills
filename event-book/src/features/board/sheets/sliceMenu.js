// ===========================================
// BOARD SHEETS - A slice's menu, its description, reordering, and the model's name
// ===========================================

import { projectState, getBoardGroups, getScenariosForSlice, sliceFlow, sliceTitle } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showToast } from '../../../ui/toast.js';
import { render, getStartIn, setStartIn, showOutline, showBoard, showSlicePage, getView } from '../../../ui/feed.js';
import { setModelStartIn, getCurrentModelId, openModel } from '../../../core/eventStore.js';
import { toastWithUndo } from '../../undo/command.js';
import { secondTap } from '../../../ui/secondTap.js';
import { nameSlice, describeSlice, deleteSlice, moveSlice, nameModel, describeModel, unlinkProcessor } from '../command.js';
import { sliceTypeLabels, escapeHtml } from '../view.js';
import { onEnter, openBoardSheet } from './shared.js';
import { openShareSheet } from '../../shareImage/sheet.js';
import { openThread } from '../../comments/sheet.js';
import { isReadOnly } from '../../readOnly/sheet.js';

// ---------- Slice menu ----------

let menuSliceId = null;

export function openSliceMenu(sliceId) {
  if (isReadOnly()) return;   // not checked out here: nothing to change
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  menuSliceId = sliceId;
  const scenarios = getScenariosForSlice(sliceId, state);
  const synthetic = sliceId.startsWith('au_inferred_');

  openBoardSheet(`
    <div class="sheet-title">${sliceTypeLabels[slice.type] || 'Slice'}</div>
    ${synthetic ? '' : `
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdRenameSlice" value="${escapeHtml(slice.name || '')}" placeholder="Slice name">
      <button class="sheet-btn" data-board-action="rename-slice">Save</button>
    </div>
    <textarea class="sheet-input bd-slice-desc" id="bdSliceDesc" rows="2" placeholder="What happens here? (optional, shown behind ⓘ)">${escapeHtml(slice.description || '')}</textarea>
    ${getView() === 'slice' ? '' : `<button class="sheet-btn secondary bd-open-slice" data-board-action="open-slice">Open slice page</button>`}`}
    <div class="bd-sheet-label">Scenarios (${scenarios.length})</div>
    <div class="sheet-options">
      ${scenarios.map(sc => `
        <div class="sheet-option" data-board-action="edit-scenario" data-scenario="${sc.id}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">✓</div>
          <div class="sheet-option-text"><div class="sheet-option-title">${escapeHtml(sc.name)}</div></div>
        </div>`).join('')}
      <div class="sheet-option" data-board-action="add-scenario">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">＋</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Add scenario</div>
          <div class="sheet-option-desc">Given / When / Then</div>
        </div>
      </div>
      ${synthetic ? `
      <div class="sheet-option" data-board-action="unlink-inferred">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">✕</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Remove from board</div>
          <div class="sheet-option-desc">Unlinks the processor from its trigger and command; nothing is deleted</div>
        </div>
      </div>` : `
      <div class="bd-move-row">
        <button class="sheet-btn secondary" data-board-action="insert" data-before="${sliceId}">＋ Slice before</button>
        <button class="sheet-btn secondary" data-board-action="insert" data-after="${sliceId}">＋ Slice after</button>
      </div>
      <div class="sheet-option" data-board-action="slice-comment">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">💬</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Comment on this slice</div>
          <div class="sheet-option-desc">About the slice as a whole, not one scenario</div>
        </div>
      </div>
      <div class="sheet-option" data-board-action="share-slice">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↗</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Share this slice…</div>
          <div class="sheet-option-desc">A picture of just this slice, scenarios too if you like</div>
        </div>
      </div>
      <div class="sheet-option" data-board-action="chapter" data-slice="${sliceId}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">§</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Chapter: ${slice.chapterId ? escapeHtml(state.chapters[slice.chapterId]?.name || '') : 'none'}</div>
          <div class="sheet-option-desc">Group it, e.g. MVP or Additional features</div>
        </div>
      </div>
      ${slice.chapterId ? `
      <div class="sheet-option" data-board-action="flow" data-slice="${sliceId}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↳</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Flow: ${escapeHtml(sliceFlow(slice, state)?.name || 'Main line')}</div>
          <div class="sheet-option-desc">An alternate ending, e.g. Capture failed</div>
        </div>
      </div>` : ''}`}
      <div class="sheet-option" data-board-action="reorder">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⇄</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Reorder slices</div>
          <div class="sheet-option-desc">Change where things happen on the timeline</div>
        </div>
      </div>
      ${synthetic ? '' : `
      <div class="sheet-option" data-board-action="delete-slice" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
        <div class="sheet-option-icon" style="background: #c0392b;">🗑️</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title" style="color: #e74c3c;">Delete slice</div>
          <div class="sheet-option-desc">Its elements stay in the model</div>
        </div>
      </div>`}
    </div>`);
  onEnter('bdRenameSlice', submitRenameSlice);
}

function submitRenameSlice() {
  const slice = projectState().slices[menuSliceId];
  const name = document.getElementById('bdRenameSlice')?.value.trim();
  const description = document.getElementById('bdSliceDesc')?.value.trim() ?? '';
  if (!slice || !name) return;
  if (name !== slice.name) nameSlice(slice.id, name);
  if (description !== (slice.description || '')) describeSlice(slice.id, description);
  hideAllSheets();
  render();
}

// A slice's description, from the ⓘ on its header
export function openSliceInfo(sliceId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  menuSliceId = sliceId;
  openBoardSheet(`
    <div class="sheet-title">${escapeHtml(sliceTitle(slice, state))} <span class="bd-sheet-sub">${sliceTypeLabels[slice.type] || ''}</span></div>
    <p class="bd-slice-info">${escapeHtml(slice.description || '')}</p>
    <div class="bd-move-row">
      <button class="sheet-btn secondary" data-board-action="edit-slice-info">Edit</button>
      <button class="sheet-btn" data-board-action="close">Close</button>
    </div>`);
}

// ---------- Reorder ----------

// Slices move within their chapter here; a slice's menu moves it between chapters
export function openReorderSheet() {
  const state = projectState();
  const groups = getBoardGroups(state)
    .map(g => ({ ...g, slices: g.slices.filter(s => state.sliceOrder.includes(s.id)) }))
    .filter(g => g.slices.length);
  openBoardSheet(`
    <div class="sheet-title">Reorder slices <span class="bd-sheet-sub">left → right</span></div>
    ${groups.map(({ chapter, slices }) => `
    ${chapter ? `<div class="bd-sheet-label">${escapeHtml(chapter.name)}</div>` : ''}
    <div class="bd-reorder">
      ${slices.map((s, i) => `
        <div class="bd-reorder-row">
          <span class="bd-reorder-dot" data-slice-type="${s.type}"></span>
          <span class="bd-reorder-name">${escapeHtml(sliceTitle(s, state))}</span>
          <button aria-label="Move up" data-board-action="reorder-move" data-slice="${s.id}" data-to="${slices[i - 1]?.id || ''}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button aria-label="Move down" data-board-action="reorder-move" data-slice="${s.id}" data-to="${slices[i + 1]?.id || ''}" ${i === slices.length - 1 ? 'disabled' : ''}>↓</button>
        </div>`).join('')}
    </div>`).join('')}
    <button class="sheet-btn" data-board-action="close">Done</button>`);
}

// ---------- Model title ----------

// isNew: a new model also asks how you like to start — 📋 plotter (the outline)
// or 🌀 pantser (straight on the board); the pick is remembered on this device
// returnTo: the model to open again after saving (naming one from the library)
let nameReturnTo = null;
export function openModelNameSheet({ isNew = false, returnTo = null } = {}) {
  nameReturnTo = returnTo;
  const state = projectState();
  const start = getStartIn();
  const startChip = (where, label, note) => `
      <button class="bd-start ${start === where ? 'active' : ''}" data-board-action="start-in" data-start="${where}">
        <b>${label}</b><span>${note}</span>
      </button>`;
  openBoardSheet(`
    <div class="sheet-title">${isNew ? 'New model' : 'Model'}</div>
    ${isNew ? `
    <div class="bd-sheet-label">How do you start?</div>
    <div class="bd-start-row">
      ${startChip('outline', '📋 Plotter', 'Outline the journey first')}
      ${startChip('board', '🌀 Pantser', 'Straight onto the board')}
    </div>` : ''}
    <div class="bd-sheet-label">Name</div>
    <input type="text" class="sheet-input" id="bdModelName" value="${escapeHtml(state.modelName || '')}" placeholder="e.g. Coffee shop orders">
    <div class="bd-sheet-label">Description</div>
    <textarea class="sheet-input bd-model-desc" id="bdModelDesc" rows="3" placeholder="What is this system for? A sentence or two — it can go on the shared image.">${escapeHtml(state.modelDescription || '')}</textarea>
    <button class="sheet-btn" data-board-action="name-model">Save</button>`, 'bdModelName');
  onEnter('bdModelName', submitModelName);
}

// Records only what changed
function submitModelName() {
  const state = projectState();
  const name = document.getElementById('bdModelName')?.value.trim();
  const description = document.getElementById('bdModelDesc')?.value.trim() || '';
  if (name && name !== state.modelName) nameModel(name);
  if (description !== (state.modelDescription || '')) describeModel(description);
  hideAllSheets();
  if (nameReturnTo) { openModel(nameReturnTo); nameReturnTo = null; }
  render();
}

// Taps in the sheet that belong to a slice's menu, reordering or the model's name; true when handled
export function onSheetAction(a, t) {
  if (a === 'start-in') {
    setStartIn(t.dataset.start);
    setModelStartIn(getCurrentModelId(), t.dataset.start);
    document.querySelectorAll('.bd-start').forEach(b => b.classList.toggle('active', b === t));
    t.dataset.start === 'outline' ? showOutline() : showBoard();
  }
  else if (a === 'rename-slice') submitRenameSlice();
  else if (a === 'edit-slice-info') openSliceMenu(menuSliceId);
  else if (a === 'unlink-inferred' && menuSliceId?.startsWith('au_inferred_')) {
    unlinkProcessor(menuSliceId.slice('au_inferred_'.length));
    hideAllSheets();
    render();
    showToast('Removed from the board');
  }
  else if (a === 'name-model') submitModelName();
  else if (a === 'open-slice') {
    const id = menuSliceId;
    hideAllSheets();
    showSlicePage(id);
  }
  else if (a === 'slice-comment') {
    const id = menuSliceId;
    hideAllSheets();
    setTimeout(() => openThread(id, null), 150);
  }
  else if (a === 'share-slice') {
    const id = menuSliceId;
    hideAllSheets();
    setTimeout(() => openShareSheet(null, { sliceId: id }), 150);
  }
  else if (a === 'add-scenario') {
    const slice = projectState().slices[menuSliceId];
    hideAllSheets();
    if (slice) setTimeout(() => window.EventPad.addScenario(slice.id, slice.type), 150);
  }
  else if (a === 'edit-scenario') {
    hideAllSheets();
    setTimeout(() => window.EventPad.editScenario(t.dataset.scenario), 150);
  }
  else if (a === 'reorder') openReorderSheet();
  else if (a === 'reorder-move') {
    if (moveSlice(t.dataset.slice, t.dataset.to)) { render(); openReorderSheet(); }
  }
  else if (a === 'delete-slice') {
    if (!secondTap(t)) return true;
    const state = projectState();
    const slice = state.slices[menuSliceId];
    if (slice) {
      // Its scenarios go with it: say so, while Undo is right there
      const scenarios = getScenariosForSlice(menuSliceId, state).length;
      deleteSlice(menuSliceId);
      hideAllSheets();
      render();
      toastWithUndo(`Slice "${sliceTitle(slice, state)}"${scenarios ? ` and its ${scenarios} ${scenarios === 1 ? 'scenario' : 'scenarios'}` : ''} deleted`);
    }
  }
  else return false;
  return true;
}
