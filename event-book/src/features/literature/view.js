// ===========================================
// LITERATURE - Screens: Read, the Outline and the Point page of a literature book, and what taps do
// SV: Read — the piece as continuous prose in order (a literature book's home, in place of the board):
//     no chips, no claims; Parked points left out; tap a paragraph to open its point. An open gap is a
//     quiet [question] line; suggested edits show inline as strike/insert (subtle, unnumbered).
// SV: Outline — paragraphs in order with their sentences under them, for reordering, parking and
//     commenting. Each sentence has its own 💬 (the same threads as a scenario's). Suggested edits are
//     numbered marks; ＋ Gap asks for a line she will write.
// SV: Point page — the paragraph at full width and a comfortable measure, its sentences under it; a gap
//     to write into; the suggestions on it, one by one or All in (& refine).
// SV: Open suggestions — "N suggestions · skip 2,5 · All in" on Read and Outline.
// Each screen reads the book once, through its own view (readingPage.read.js, literatureOutline.read.js,
// pointPage.read.js), and draws from that alone (read.parts.js, outline.parts.js, point.parts.js).
// ===========================================

import { projectState } from '../../core/projections.js';
import { movePoint, parkPoint, unparkPoint, addGap, fillGap } from './command.js';
import { acceptSuggestions, skipSuggestions } from './suggestions.js';
import { nickname } from '../comments/command.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { markSliceRefined, clearSliceRefined } from '../board/command.js';
import { toastWithUndo } from '../undo/command.js';
import { showToast } from '../../ui/toast.js';
import { render, showSlicePage } from '../../ui/feed.js';
import { openThread, openCommentsList } from '../comments/sheet.js';
import { isReadOnly } from '../readOnly/sheet.js';
import { unsentComments, shelfStatus, syncModel, onSyncChange } from '../sync/client.js';
import { getCurrentModelId } from '../../core/eventStore.js';
import { reviewOf } from '../review/client.js';
import { readingPage } from './readingPage.read.js';
import { literatureOutline } from './literatureOutline.read.js';
import { pointPage } from './pointPage.read.js';
import { pointFacts, pointNeighbours } from './pointFacts.read.js';
import { readArticle } from './read.parts.js';
import { literatureOutlineHtml } from './outline.parts.js';
import { pointPageHtml as drawPointPage } from './point.parts.js';

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// On a library book: this device's comments the server hasn't got yet, and why the last send failed
function unsentOf() {
  const id = getCurrentModelId();
  const n = unsentComments(id);
  if (!n) return null;
  const s = shelfStatus(id) || '';
  return { n, why: s.startsWith('error') ? s.replace(/^error: /, '') : s === 'syncing' ? 'Sending…' : null };
}

// What this device adds to the views: read only, what is unsent, a reviewer's copy
const deviceOf = () => ({ readOnly: isReadOnly(), unsent: unsentOf(), reviewer: !!reviewOf(getCurrentModelId()) });

// ---------- Read ----------

export function renderRead() {
  const root = document.getElementById('readView');
  if (!root) return;
  root.innerHTML = readArticle(readingPage(projectState(), deviceOf()));
}

// ---------- Outline ----------

export function renderLiteratureOutline(container) {
  container.innerHTML = literatureOutlineHtml(literatureOutline(projectState(), deviceOf()));
}

// ---------- Point page ----------

// paragraphsHtml: what an agent wrote on the point (editable, from the slice page), shown in place of sentences when it has none
export function pointPageHtml(slice, state, paragraphsHtml = '') {
  return drawPointPage(pointPage(state, slice.id, { readOnly: isReadOnly() }), paragraphsHtml);
}

// ---------- Doing things ----------

function step(id, dir, state, name) {
  const move = pointNeighbours(state, id)[dir < 0 ? 'up' : 'down'];
  if (!move) return;
  const why = movePoint({ sliceId: id, afterSliceId: move.after });
  if (why) showToast(why);
  else toastWithUndo(`${name} moved ${dir < 0 ? 'up' : 'down'}`);
}

// ＋ Gap on a point: a question for a line she will write, right after it
function openGapSheet(afterSliceId) {
  openBoardSheet(`
    <div class="sheet-title">Ask for a gap</div>
    <div class="bd-sheet-label">What is the question?</div>
    <input type="text" class="sheet-input" id="ltGapQ" placeholder="What does developer^x mean to you?">
    <button class="sheet-btn" data-lit-gap="${afterSliceId}">Add the gap</button>`, 'ltGapQ');
}

// A comment picked from a list (the 💬 open list, the Chat drawer): scroll to where it is in the view on
// screen and flash it. Read: its paragraph; Outline: the comment's line, else its sentence, else the card.
// A parked paragraph isn't in Read, so it opens its page.
export function revealInBook(c) {
  const shown = id => { const el = document.getElementById(id); return !!el && el.style.display !== 'none'; };
  const sentenceId = c.scenarioId || null;
  let el = null;
  if (shown('readView')) el = document.querySelector(`#readView .lt-p[data-slice="${c.sliceId}"]`);
  else {
    const card = document.querySelector(`#outlineView .lt-point[data-slice="${c.sliceId}"]`);
    el = card && (card.querySelector(`[data-cm-anchor="${c.commentId}"]`) || (sentenceId && card.querySelector(`.lt-sentence[data-sentence="${sentenceId}"]`)) || card);
  }
  if (!el) { showSlicePage(c.sliceId); return; }
  el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  el.classList.remove('lt-flash');
  void el.offsetWidth;
  el.classList.add('lt-flash');
  setTimeout(() => el.classList.remove('lt-flash'), 1800);
}

function handle(e) {
  const t = e.target.closest('[data-lit-action]');
  if (!t || t.disabled) return;
  const a = t.dataset.litAction, id = t.dataset.slice;
  const state = projectState();
  const facts = pointFacts(state, id), name = facts.name;
  if (a === 'paste') return;   // draftFile.js
  if (a === 'gap') return isReadOnly() ? undefined : openGapSheet(id);
  if (a === 'open') return showSlicePage(id);
  if (a === 'comment') return openThread(id, t.dataset.sentence || null);
  if (a === 'next-comment') return openCommentsList(revealInBook);
  if (a === 'send-now') return syncModel(getCurrentModelId()).then(() => showToast('Sent'), e => showToast(`Not sent: ${e.message}`)).finally(render);
  if (isReadOnly()) return;
  if (a === 'up' || a === 'down') step(id, a === 'up' ? -1 : 1, state, name);
  else if (a === 'park') {
    const why = parkPoint({ sliceId: id });
    if (why) { showToast(why); return; }
    toastWithUndo(`Parked: ${name}`);
  } else if (a === 'unpark') {
    const why = unparkPoint({ sliceId: id });
    if (why) { showToast(why); return; }
    toastWithUndo(`${name} is back in the story`);
  } else if (a === 'fill') {
    const why = fillGap({ sliceId: id, text: document.getElementById('ltFill')?.value, by: nickname() });
    if (why) { showToast(why); return; }
    toastWithUndo('Your paragraph is in');
  } else if (a === 'all-in') {
    const skip = (t.closest('.lt-sugg-bar').querySelector('.lt-skip').value.match(/\d+/g) || []).map(Number);
    const why = acceptSuggestions({ skip });
    if (why) { showToast(why); return; }
    toastWithUndo(skip.length ? `All in, skipping ${skip.join(', ')}` : 'All suggestions are in');
  } else if (a === 'all-in-page' || a === 'all-in-refine') {
    const why = acceptSuggestions({ sliceId: id });
    if (why) { showToast(why); return; }
    // Accepting took its Refined back; "& refine" is her sign-off, in the same tap
    if (a === 'all-in-refine') markSliceRefined(id);
    toastWithUndo(a === 'all-in-refine' ? `${name}: all in, refined` : `${name}: all in`);
  } else if (a === 'accept-one') {
    const why = acceptSuggestions({ only: [Number(t.dataset.n)] });
    if (why) { showToast(why); return; }
    toastWithUndo(`Suggestion ${t.dataset.n} is in`);
  } else if (a === 'skip-one') {
    const why = skipSuggestions({ numbers: [Number(t.dataset.n)] });
    if (why) { showToast(why); return; }
    toastWithUndo(`Suggestion ${t.dataset.n} skipped`);
  } else if (a === 'refined') {
    if (facts.refined) { clearSliceRefined(id); showToast(`${name}: no longer refined`); }
    else {
      const why = markSliceRefined(id);
      if (why) { showToast(why); return; }
      const left = facts.suggestions;
      toastWithUndo(left ? `${name} is refined. ${plural(left, 'suggestion', 'suggestions')} still open: Accept or Skip under its sentence` : `${name} is refined`);
    }
  }
  render();
}

export function initLiterature() {
  document.addEventListener('click', e => { if (e.target.closest('#readView, #outlineView, #sliceView')) handle(e); });
  // A sync started or ended: Read / Outline say again what's not sent yet (only when it changed, so no loop)
  let lastUnsent = 'null';
  onSyncChange(() => {
    const shown = ['readView', 'outlineView'].some(id => { const el = document.getElementById(id); return el && el.style.display !== 'none'; });
    if (!shown) return;
    const now = JSON.stringify(unsentOf());
    if (now !== lastUnsent) { lastUnsent = now; render(); }
  });
  document.addEventListener('click', e => {
    const go = e.target.closest('[data-lit-gap]');
    if (!go) return;
    const why = addGap({ question: document.getElementById('ltGapQ')?.value, afterSliceId: go.dataset.litGap, by: nickname() });
    if (why) { showToast(why); return; }
    hideAllSheets();
    toastWithUndo('Gap added');
    render();
  });
  // A paragraph in the story opens with Enter or Space
  document.getElementById('readView')?.addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.litAction === 'open') { e.preventDefault(); e.target.click(); }
  });
}
