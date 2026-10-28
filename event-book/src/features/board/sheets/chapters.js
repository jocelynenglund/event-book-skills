// ===========================================
// BOARD SHEETS - Chapters: picking one for a slice, and a chapter's menu
// ===========================================

import { projectState, chapterFlows, sliceFlow } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showToast } from '../../../ui/toast.js';
import { render } from '../../../ui/feed.js';
import { toastWithUndo } from '../../undo/command.js';
import { secondTap } from '../../../ui/secondTap.js';
import { createChapter, renameChapter, moveChapter, deleteChapter, setSliceChapter, createFlow, renameFlow, deleteFlow, setSliceFlow } from '../command.js';
import { escapeHtml, toggleChapterFolded, isChapterFolded, showFlow, isChapterBookmarked, toggleChapterBookmark } from '../view.js';
import { openNewSliceSheet } from './newSlice.js';
import { saveReference } from '../../references/store.js';
import { onEnter, openBoardSheet, scrollToSlice } from './shared.js';
import { isReadOnly } from '../../readOnly/sheet.js';

// ---------- Chapters ----------

// Pick (or create) the chapter a slice belongs to; sliceId null = just create one
export function openChapterPicker(sliceId) {
  if (isReadOnly()) return;   // not checked out here: nothing to change
  const state = projectState();
  const slice = sliceId && state.slices[sliceId];
  const current = slice?.chapterId || null;
  openBoardSheet(`
    <div class="sheet-title">${slice ? 'Chapter' : 'New chapter'} ${slice ? `<span class="bd-sheet-sub">for ${escapeHtml(slice.name || 'this slice')}</span>` : ''}</div>
    ${slice && state.chapterOrder.length ? `
    <div class="sheet-options">
      ${[...state.chapterOrder, null].map(id => `
        <div class="sheet-option ${current === id ? 'selected' : ''}" data-board-action="set-chapter" data-slice="${sliceId}" data-chapter="${id || ''}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">${current === id ? '✓' : ''}</div>
          <div class="sheet-option-text"><div class="sheet-option-title">${id ? escapeHtml(state.chapters[id].name) : 'No chapter'}</div></div>
        </div>`).join('')}
    </div>
    <div class="bd-sheet-label">Or a new chapter</div>` : ''}
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdChapterName" placeholder="e.g. MVP, Additional features">
      <button class="sheet-btn" data-board-action="create-chapter" data-slice="${sliceId || ''}">Add</button>
    </div>`, slice && state.chapterOrder.length ? null : 'bdChapterName');
  onEnter('bdChapterName', () => submitNewChapter(sliceId));
}

function submitNewChapter(sliceId) {
  const name = document.getElementById('bdChapterName')?.value.trim();
  if (!name) return;
  const chapterId = createChapter(name);
  if (sliceId) setSliceChapter(sliceId, chapterId);
  hideAllSheets();
  render();
  showToast(`Chapter "${name}" added`);
}

let menuChapterId = null;

export function openChapterMenu(chapterId) {
  if (isReadOnly()) return;   // not checked out here: nothing to change
  const state = projectState();
  const chapter = state.chapters[chapterId];
  if (!chapter) return;
  menuChapterId = chapterId;
  const i = state.chapterOrder.indexOf(chapterId);
  const last = state.chapterOrder.length - 1;
  openBoardSheet(`
    <div class="sheet-title">Chapter</div>
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdRenameChapter" value="${escapeHtml(chapter.name)}" placeholder="Chapter name">
      <button class="sheet-btn" data-board-action="rename-chapter">Save</button>
    </div>
    <div class="sheet-options">
      <div class="sheet-option" data-board-action="fold-chapter">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">${isChapterFolded(chapterId) ? '📖' : '📕'}</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">${isChapterFolded(chapterId) ? 'Open on the board' : 'Fold into a spine'}</div>
          <div class="sheet-option-desc">Just on this device; shared images can show it folded too</div>
        </div>
      </div>
      <div class="sheet-option" data-board-action="bookmark-chapter">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">🔖</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">${isChapterBookmarked(chapterId) ? 'Remove bookmark' : 'Bookmark: keep it open'}</div>
          <div class="sheet-option-desc">On a phone, chapters open one at a time; a bookmarked one stays open</div>
        </div>
      </div>
    </div>
    <div class="bd-sheet-label">Flows <span class="bd-label-note">ways through this chapter, e.g. Capture failed</span></div>
    ${chapterFlows(chapterId, state).map(f => `
    <div class="bd-inline-form bd-flow-row">
      <input type="text" class="sheet-input" data-flow-name="${f.id}" value="${escapeHtml(f.name)}" aria-label="Flow name">
      <button class="sheet-btn secondary" data-board-action="delete-flow" data-flow="${f.id}" aria-label="Delete flow">✕</button>
    </div>`).join('')}
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdNewFlow" placeholder="New flow, e.g. Capture failed">
      <button class="sheet-btn" data-board-action="create-flow">Add</button>
    </div>
    <div class="bd-cell-hint">The chapter header gets a chip per flow; pick one to see just its slices, still left to right. Slices on no flow are the main line, in every flow.</div>
    <div class="sheet-options">
      <div class="sheet-option" data-board-action="save-reference">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">📗</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Save to reference shelf</div>
          <div class="sheet-option-desc">A copy to add to other models later (Bookshelves → Reference shelf)</div>
        </div>
      </div>
      <div class="sheet-option" data-board-action="new-slice-in-chapter">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">＋</div>
        <div class="sheet-option-text"><div class="sheet-option-title">Add a slice here</div></div>
      </div>
      <div class="bd-move-row">
        <button class="sheet-btn secondary" data-board-action="move-chapter" data-to="${i - 1}" ${i === 0 ? 'disabled' : ''}>◀ Earlier</button>
        <button class="sheet-btn secondary" data-board-action="move-chapter" data-to="${i + 1}" ${i === last ? 'disabled' : ''}>Later ▶</button>
      </div>
      <div class="sheet-option" data-board-action="delete-chapter" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
        <div class="sheet-option-icon" style="background: #c0392b;">🗑️</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title" style="color: #e74c3c;">Delete chapter</div>
          <div class="sheet-option-desc">Its slices stay, without a chapter</div>
        </div>
      </div>
    </div>`);
  onEnter('bdRenameChapter', submitRenameChapter);
  onEnter('bdNewFlow', submitNewFlow);
  // Renaming a flow: edit its name, it saves when you leave the field
  document.querySelectorAll('[data-flow-name]').forEach(input => {
    input.onchange = () => { const name = input.value.trim(); if (name) { renameFlow(input.dataset.flowName, name); render(); } };
  });
}

function submitNewFlow() {
  const name = document.getElementById('bdNewFlow')?.value.trim();
  if (!name || !menuChapterId) return;
  createFlow(menuChapterId, name);
  render();
  openChapterMenu(menuChapterId);
  showToast(`Flow "${name}" added: pick it for slices from their menu`);
}

// Which flow a slice belongs to (its chapter's main line, or one of its flows)
export function openFlowPicker(sliceId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice?.chapterId) return;
  const current = sliceFlow(slice, state)?.id || null;
  const flows = chapterFlows(slice.chapterId, state);
  openBoardSheet(`
    <div class="sheet-title">Flow <span class="bd-sheet-sub">for ${escapeHtml(slice.name || 'this slice')}</span></div>
    <div class="sheet-options">
      ${[null, ...flows.map(f => f.id)].map(id => `
        <div class="sheet-option ${current === id ? 'selected' : ''}" data-board-action="set-flow" data-slice="${sliceId}" data-flow="${id || ''}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">${current === id ? '✓' : id ? '↳' : '—'}</div>
          <div class="sheet-option-text">
            <div class="sheet-option-title">${id ? escapeHtml(state.flows[id].name) : 'Main line'}</div>
            <div class="sheet-option-desc">${id ? 'Only when this flow is shown' : 'In every flow of the chapter'}</div>
          </div>
        </div>`).join('')}
    </div>
    <div class="bd-sheet-label">Or a new flow</div>
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdSliceNewFlow" placeholder="e.g. Capture failed">
      <button class="sheet-btn" data-board-action="create-flow-for-slice" data-slice="${sliceId}">Add</button>
    </div>`, flows.length ? null : 'bdSliceNewFlow');
  onEnter('bdSliceNewFlow', () => submitSliceFlow(sliceId));
}

function submitSliceFlow(sliceId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  const name = document.getElementById('bdSliceNewFlow')?.value.trim();
  if (!slice?.chapterId || !name) return;
  const flowId = createFlow(slice.chapterId, name);
  setSliceFlow(sliceId, flowId);
  showFlow(slice.chapterId, flowId);
  hideAllSheets();
  render();
  scrollToSlice(sliceId);
}

function submitRenameChapter() {
  const name = document.getElementById('bdRenameChapter')?.value.trim();
  if (!name || !menuChapterId) return;
  renameChapter(menuChapterId, name);
  hideAllSheets();
  render();
}

// Taps in the sheet that belong to chapters; true when handled
export function onSheetAction(a, t) {
  if (a === 'chapter') openChapterPicker(t.dataset.slice);
  else if (a === 'set-chapter') {
    setSliceChapter(t.dataset.slice, t.dataset.chapter || null);
    hideAllSheets();
    render();
    scrollToSlice(t.dataset.slice);
  }
  else if (a === 'create-chapter') submitNewChapter(t.dataset.slice || null);
  else if (a === 'create-flow') submitNewFlow();
  else if (a === 'save-reference') {
    const ref = saveReference(menuChapterId);
    hideAllSheets();
    if (ref) showToast(`"${ref.name}" saved to the reference shelf`);
  }
  else if (a === 'delete-flow') {
    if (!secondTap(t, '✕?')) return true;
    deleteFlow(t.dataset.flow);
    render();
    openChapterMenu(menuChapterId);
    toastWithUndo('Flow deleted, its slices are back on the main line');
  }
  else if (a === 'flow') openFlowPicker(t.dataset.slice);
  else if (a === 'set-flow') {
    const slice = projectState().slices[t.dataset.slice];
    setSliceFlow(t.dataset.slice, t.dataset.flow || null);
    // Show the flow it went to, so it doesn't vanish from the board
    if (slice?.chapterId && t.dataset.flow) showFlow(slice.chapterId, t.dataset.flow);
    hideAllSheets();
    render();
    scrollToSlice(t.dataset.slice);
  }
  else if (a === 'create-flow-for-slice') submitSliceFlow(t.dataset.slice);
  else if (a === 'rename-chapter') submitRenameChapter();
  else if (a === 'fold-chapter') { toggleChapterFolded(menuChapterId); hideAllSheets(); }
  else if (a === 'bookmark-chapter') { toggleChapterBookmark(menuChapterId); hideAllSheets(); }
  else if (a === 'new-slice-in-chapter') openNewSliceSheet(menuChapterId);
  else if (a === 'move-chapter') {
    if (moveChapter(menuChapterId, Number(t.dataset.to))) { render(); openChapterMenu(menuChapterId); }
  }
  else if (a === 'delete-chapter') {
    if (!secondTap(t)) return true;
    const chapter = projectState().chapters[menuChapterId];
    if (chapter) {
      deleteChapter(menuChapterId);
      hideAllSheets();
      render();
      toastWithUndo('Chapter deleted, its slices stay');
    }
  }
  else return false;
  return true;
}
