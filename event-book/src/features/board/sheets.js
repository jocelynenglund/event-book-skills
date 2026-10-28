// ===========================================
// BOARD - Sheets & interactions
// Each sheet lives in ./sheets/; this wires the board's taps and the sheet's.
// ===========================================

import { projectState } from '../../core/projections.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { render, showSlicePage } from '../../ui/feed.js';
import { isReadOnly, openElementReadSheet } from '../readOnly/sheet.js';
import { openElementMenu } from '../elementMenu/sheet.js';
import { openPropertySheet } from '../properties/sheet.js';
import { moveSlice, setUpdateRole } from './command.js';
import { openReplay } from '../replay/replay.js';
import { toggleChapterFolded, setAllChaptersFolded, isChapterFolded, toggleGwtLane, showFlow } from './view.js';
import { scrollToSlice } from './sheets/shared.js';
import { openNewSliceSheet, onSheetAction as newSliceAction } from './sheets/newSlice.js';
import { openChapterMenu, openChapterPicker, onSheetAction as chapterAction } from './sheets/chapters.js';
import { onSheetAction as readSheetAction } from '../readOnly/sheet.js';
import { openCellSheet, onSheetAction as cellAction } from './sheets/cell.js';
import { openEventsSheet, onSheetAction as eventsAction } from './sheets/events.js';
import { openScenariosSheet, onSheetAction as scenariosAction } from './sheets/scenarios.js';
import { openModelNameSheet, openSliceInfo, openSliceMenu, onSheetAction as sliceMenuAction } from './sheets/sliceMenu.js';
import { onSheetAction as processorAction } from './sheets/processor.js';
import { openReferencePicker } from '../references/sheet.js';

export { openNewSliceSheet } from './sheets/newSlice.js';
export { openChapterPicker, openChapterMenu } from './sheets/chapters.js';
export { openCellSheet } from './sheets/cell.js';
export { openSliceMenu, openReorderSheet, openModelNameSheet } from './sheets/sliceMenu.js';
export { openUpdatedByPicker, openProcessorInputs } from './sheets/processor.js';
import { openThread, openCommentsList } from '../comments/sheet.js';
import { canAddScenariosHere } from '../review/client.js';

// ---------- Wiring ----------

function handleBoardClick(e) {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const { action, slice, el, to } = t.dataset;
  if (isReadOnly() && readOnlyTap(action, t)) return;
  if (action === 'new-slice') openNewSliceSheet(t.dataset.chapter || undefined);
  else if (action === 'chapter-menu') openChapterMenu(t.dataset.chapter);
  else if (action === 'fold') {
    const opening = isChapterFolded(t.dataset.chapter);
    toggleChapterFolded(t.dataset.chapter);
    if (opening) {
      // Bring the chapter's first slice into view as it opens
      const state = projectState();
      const first = state.sliceOrder.find(id => state.slices[id]?.chapterId === t.dataset.chapter);
      if (first) scrollToSlice(first);
    }
  }
  else if (action === 'insert') {
    openNewSliceSheet(undefined, t.dataset.before ? { before: t.dataset.before } : { after: t.dataset.after });
  }
  else if (action === 'add') openCellSheet(slice, t.dataset.laneType);
  else if (action === 'events') openEventsSheet(slice);
  else if (action === 'givens') openEventsSheet(slice, { givens: true });
  else if (action === 'gwt-drawer') openScenariosSheet(slice);
  else if (action === 'element-read') {
    // A to-do list's update tag flips between adding an item and ticking one off
    const flip = e.target.closest('[data-flip]');
    if (flip) {
      setUpdateRole(flip.dataset.flip, el, flip.dataset.role === 'completes' ? 'adds' : 'completes');
      render();
      return;
    }
    // Tap reads (a field too); the ⋮ on the card is the editor
    openElementReadSheet(el, slice);
  }
  else if (action === 'element') openElementMenu(el, slice);
  else if (action === 'slice-menu') openSliceMenu(slice);
  else if (action === 'slice-page') showSlicePage(slice);
  else if (action === 'slice-info') openSliceInfo(slice);
  else if (action === 'toggle-gwt') toggleGwtLane();
  else if (action === 'comment') openThread(slice, t.dataset.scenario || null);
  else if (action === 'next-comment') openCommentsList(revealComment);
  else if (action === 'show-flow') showFlow(t.dataset.chapter, t.dataset.flow || null);
  else if (action === 'scenario') window.EventPad.editScenario(t.dataset.scenario);
  else if (action === 'add-scenario') {
    const s = projectState().slices[slice];
    if (s) window.EventPad.addScenario(s.id, s.type);
  }
  else if (action === 'move') {
    if (moveSlice(slice, to)) { render(); scrollToSlice(slice); }
  }
}

// Not checked out here: a tap reads (a sticky's sheet, the slice page, the scenarios);
// what would change the model does nothing. Folding, flows and ⓘ are left to the board.
const readOnlyReads = new Set(['fold', 'show-flow', 'toggle-gwt', 'slice-info', 'slice-page', 'comment', 'next-comment']);
function readOnlyTap(action, t) {
  const { slice, el } = t.dataset;
  if (readOnlyReads.has(action)) return false;
  if (action === 'element' || action === 'element-read') openElementReadSheet(el, slice);
  else if (action === 'slice-menu') showSlicePage(slice);
  else if (action === 'events') openEventsSheet(slice, { readOnly: true });
  else if (action === 'givens') openEventsSheet(slice, { readOnly: true, givens: true });
  else if (action === 'gwt-drawer') openScenariosSheet(slice, { readOnly: !canAddScenariosHere() });
  else if (action === 'scenario') {
    const scn = projectState().scenarios[t.dataset.scenario];
    if (scn) openScenariosSheet(scn.sliceId, { readOnly: !canAddScenariosHere() });
  }
  return true;
}

// A comment picked in the drawer: unfold its chapter, scroll the lane to it and flash it
function revealComment(c) {
  const chapterId = projectState().slices[c.sliceId]?.chapterId;
  if (chapterId && isChapterFolded(chapterId)) { toggleChapterFolded(chapterId); render(); }
  const el = document.querySelector(`.bd-cm[data-cm-anchor="${c.commentId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1400);
}

// Taps inside the board sheet: each sheet module answers its own
const sheetActions = [readSheetAction, newSliceAction, chapterAction, cellAction, eventsAction, scenariosAction, sliceMenuAction, processorAction];

function handleSheetClick(e) {
  const t = e.target.closest('[data-board-action]');
  if (!t) return;
  const a = t.dataset.boardAction;
  if (a === 'close') { hideAllSheets(); return; }
  sheetActions.some(handle => handle(a, t));
}

// ---------- Floating + ----------

export function toggleFabMenu(open) {
  const menu = document.getElementById('fabMenu');
  const isOpen = open ?? !menu.classList.contains('open');
  menu.classList.toggle('open', isOpen);
  document.getElementById('fab').classList.toggle('open', isOpen);
}

function handleFabMenu(e) {
  const t = e.target.closest('[data-fab]');
  if (!t) return;
  toggleFabMenu(false);
  // A slice from here starts outside any chapter; the sheet's chips can still pick one
  if (t.dataset.fab === 'slice') openNewSliceSheet(null);
  else if (t.dataset.fab === 'reference') openReferencePicker();
  else openChapterPicker(null);
}

export function initBoard() {
  document.getElementById('fabMenu').addEventListener('click', handleFabMenu);
  document.addEventListener('click', e => {
    if (!e.target.closest('#fab, #fabMenu')) toggleFabMenu(false);
  });
  document.getElementById('board').addEventListener('click', handleBoardClick);
  document.getElementById('boardStats')?.addEventListener('click', e => {
    if (e.target.closest('[data-replay]')) { openReplay(); return; }
    if (e.target.closest('[data-comments-open]')) { openCommentsList(revealComment); return; }
    const t = e.target.closest('[data-fold-all]');
    if (!t) return;
    const state = projectState();
    setAllChaptersFolded(state.chapterOrder, t.dataset.foldAll === 'close');
    render();
    document.getElementById('board')?.scrollTo({ left: 0 });
  });
  document.getElementById('boardSheetContent').addEventListener('click', handleSheetClick);
  // An untitled model's title asks for a name; once it has one, renaming is in the
  // library (the shelf's ⋯ → Name & description). In the library it just says eventPAD.
  document.getElementById('modelTitle').addEventListener('click', () => {
    if (!document.body.classList.contains('library-mode') && !isReadOnly() && !projectState().modelName) openModelNameSheet();
  });
}
