// ===========================================
// FEED - Orchestrator
// ===========================================

import { getEventCount, markOpened, getCurrentModelId } from '../core/eventStore.js';
import { projectState, getOrderedSlices } from '../core/projections.js';
import { isChapterFolded, toggleChapterFolded, setModelSize } from '../features/board/view.js';

// Import feature views
import { renderEventLog } from '../features/eventLog/view.js';
import { renderBoard } from '../features/board/view.js';
import { renderDetails } from '../features/details/view.js';
import { renderOutline } from '../features/outline/view.js';
import { renderLibrary } from '../features/library/view.js';
import { renderSlicePage } from '../features/slicePage/view.js';
import { renderCompare, setCompare } from '../features/compare/view.js';

// 'board' (swimlane timeline, the editor), 'details' (the overview: an outline of
// chapters and slices, or elements with their properties) or 'library'
let view = 'board';
let overviewTab = 'outline';
// 'slice': one slice on its own page; ‹ Back returns to where you came from
let slicePageId = null;
let viewBeforeSlice = 'board';

export function getView() { return view; }

// The library of models (shelves of books), and back to the open model's board
export function showLibrary() {
  view = 'library';
  window.scrollTo(0, 0);
  render();
}

export function showBoard() {
  view = 'board';
  window.scrollTo(0, 0);
  render();
  document.getElementById('board')?.scrollTo({ left: 0 });
}

// Plotter or pantser (borrowed from writing): start a model in the outline, or
// straight on the board. Per device; a new model asks, opening one follows it.
const START_KEY = 'eventpad_start_in';
export function getStartIn() {
  try { return localStorage.getItem(START_KEY) === 'outline' ? 'outline' : 'board'; } catch (e) { return 'board'; }
}
export function setStartIn(where) {
  try { localStorage.setItem(START_KEY, where); } catch (e) { /* private mode: just this time */ }
}

export function showOutline() {
  view = 'details';
  overviewTab = 'outline';
  window.scrollTo(0, 0);
  render();
}

// Open the model where you like to start
export function showStart() {
  getStartIn() === 'outline' ? showOutline() : showBoard();
}

export function setOverviewTab(tab) {
  overviewTab = tab;
  render();
}

// Plan vs built: two models side by side (‹ Bookshelves goes back)
export function showCompare(planId, builtId) {
  setCompare(planId, builtId);
  view = 'compare';
  window.scrollTo(0, 0);
  render();
}

// One slice with room to breathe: its stickies and its scenarios
export function showSlicePage(sliceId) {
  if (view !== 'slice') viewBeforeSlice = view === 'library' ? 'board' : view;
  view = 'slice';
  slicePageId = sliceId;
  window.scrollTo(0, 0);
  render();
}

export function leaveSlicePage() {
  view = viewBeforeSlice;
  window.scrollTo(0, 0);
  render();
  if (view === 'board' && slicePageId) showSliceOnBoard(slicePageId);
}

// Leave the overview and bring a slice into view on the board
export function showSliceOnBoard(sliceId) {
  view = 'board';
  render();
  requestAnimationFrame(() => {
    const head = document.querySelector(`.bd-head-name[data-slice="${sliceId}"]`)?.closest('.bd-head');
    if (!head) return;
    head.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    head.classList.add('bd-flash');
    setTimeout(() => head.classList.remove('bd-flash'), 1400);
  });
}

// Bring an element into view on the board (its first slice, left to right) and
// flash its card. False when it isn't in any slice.
// sliceId: the slice to show it in (an element can sit in several); else the first one
export function showElementOnBoard(elementId, sliceId = null) {
  const slices = getOrderedSlices(projectState());
  const slice = slices.find(s => s.id === sliceId && s.elements.includes(elementId)) || slices.find(s => s.elements.includes(elementId));
  if (!slice) return false;
  if (slice.chapterId && isChapterFolded(slice.chapterId)) toggleChapterFolded(slice.chapterId);
  view = 'board';
  render();
  requestAnimationFrame(() => {
    const card = document.querySelector(`.bd-card[data-el="${elementId}"][data-slice="${slice.id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'center' });
    card.classList.add('bd-card-flash');
    setTimeout(() => card.classList.remove('bd-card-flash'), 1800);
  });
  return true;
}

export function toggleDetailsView() {
  view = view === 'details' || view === 'slice' ? 'board' : 'details';
  window.scrollTo(0, 0);
  render();
}

// Main render function
// In the library when the page was left: a reload comes back to the library, not a model
const IN_LIBRARY_KEY = 'eventpad_in_library';
export function wasInLibrary() {
  try { return localStorage.getItem(IN_LIBRARY_KEY) === '1'; } catch (e) { return false; }
}

// A new visit (a new browser session: the app opened again) starts on the bookshelves;
// a reload keeps your place. Marks this session as started.
const SESSION_KEY = 'eventpad_session';
export function isNewVisit() {
  try {
    const fresh = !sessionStorage.getItem(SESSION_KEY);
    sessionStorage.setItem(SESSION_KEY, '1');
    return fresh;
  } catch (e) { return true; }
}

export function render() {
  try { localStorage.setItem(IN_LIBRARY_KEY, view === 'library' ? '1' : '0'); } catch (e) { /* just this time */ }
  const state = projectState();
  // A big model opens with its chapters folded (unless you opened them)
  setModelSize(Object.keys(state.slices).length);
  const eventCount = getEventCount();
  
  // Update event count
  document.getElementById('eventCount').textContent = eventCount;
  document.getElementById('undoBtn').disabled = eventCount === 0;
  
  const isBoard = view === 'board';
  const isDetails = view === 'details';
  const isLibrary = view === 'library';
  const isSlice = view === 'slice';
  const isCompare = view === 'compare';
  document.body.classList.add('board-mode');
  // In a book (board, outline, a slice): it's the one most recently opened
  if (isBoard || isDetails || isSlice) markOpened(getCurrentModelId());
  document.body.classList.toggle('slice-mode', isSlice);
  document.body.classList.toggle('library-mode', isLibrary);
  document.getElementById('libraryView').style.display = isLibrary ? '' : 'none';
  // The ‹ button goes back: from a slice page to where it was opened, from a compare. A book
  // goes back to the bookshelves from ☰; the bookshelves are where you land.
  const hasBack = isSlice || isCompare;
  document.querySelector('.header h1').hidden = !hasBack;
  document.body.classList.toggle('has-back', hasBack);
  document.getElementById('libraryBtn').textContent = isSlice ? `‹ ${viewBeforeSlice === 'details' ? (overviewTab === 'outline' ? 'Outline' : 'Details') : 'Board'}` : '‹ Bookshelves';
  document.getElementById('sliceView').style.display = isSlice ? '' : 'none';
  document.getElementById('compareView').style.display = isCompare ? '' : 'none';
  // The bookshelves: the Event Book brand in the header (icon and word); a book: its name
  const title = document.getElementById('modelTitle');
  if (isLibrary) title.innerHTML = '<img class="hd-brand-icon" src="icons/mark.svg" alt="" width="36" height="36"><span class="hd-brand-word">Event Book</span>';
  else title.textContent = state.modelName || 'Untitled model';
  title.title = isLibrary ? '' : state.modelName || 'Untitled model';
  title.classList.toggle('brand', isLibrary);
  document.getElementById('modelTitle').classList.toggle('named', isLibrary || !!state.modelName);
  document.getElementById('boardView').style.display = isBoard ? '' : 'none';
  document.getElementById('overviewView').style.display = isDetails ? '' : 'none';
  document.getElementById('outlineView').style.display = overviewTab === 'outline' ? '' : 'none';
  document.getElementById('detailsView').style.display = overviewTab === 'details' ? '' : 'none';
  document.querySelectorAll('.ov-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === overviewTab));
  document.getElementById('fab').style.display = isDetails || isLibrary || isSlice || isCompare ? 'none' : '';
  if (!isBoard) document.getElementById('fabMenu')?.classList.remove('open');
  // Board | Outline in the header: the one you're on is lit (Details counts as the outline side)
  document.querySelectorAll('[data-view-switch]').forEach(b => {
    const on = b.dataset.viewSwitch === 'board' ? isBoard : isDetails;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  if (isBoard) renderBoard();
  if (isDetails) overviewTab === 'outline' ? renderOutline() : renderDetails();
  if (isLibrary) renderLibrary();
  if (isSlice) renderSlicePage(slicePageId);
  if (isCompare) renderCompare();

  // Update event log (from eventLog feature)
  document.getElementById('eventLogList').innerHTML = renderEventLog();
  afterRender.forEach(fn => { try { fn(); } catch (e) { /* a feature's problem */ } });
}

// Told after every render (sync shows whether the open model is checked out)
const afterRender = [];
export function onRender(fn) { afterRender.push(fn); }
