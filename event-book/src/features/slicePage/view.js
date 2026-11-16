// ===========================================
// SLICE PAGE - One slice with room to breathe (SV: View Slice)
// Its stickies with their properties, in the order data flows, then each
// Given / When / Then scenario with its values as rows. ‹ › (or a swipe)
// steps to the neighbouring slices.
// ===========================================

import { projectState } from '../../core/projections.js';
import { writeParagraph, editParagraph } from '../article/command.js';
import { showToast } from '../../ui/toast.js';
import { nickname, commentDeviceId } from '../comments/command.js';
import { idsHidden, setIdsHidden } from '../scenarios/ids.js';
import { escapeHtml } from '../board/view.js';
import { openElementMenu } from '../elementMenu/sheet.js';
import { openSliceMenu } from '../board/sheets/sliceMenu.js';
import { openShareSheet } from '../shareImage/sheet.js';
import { isReadOnly } from '../readOnly/sheet.js';
import { pointPageHtml } from '../literature/view.js';
import { conversationAction } from '../comments/page.js';
import { slicePageScreen } from './screen.js';
import { slicePageNav, slicePagePin, slicePageHead, slicePageParagraphs, slicePageFlow, slicePageScenarios, slicePageConversation } from './rowView.js';

function editParagraphHere(t, sliceId) {
  const had = t.dataset.para ? { id: t.dataset.para, text: t.dataset.text || '' } : null;
  const box = document.createElement('div');
  box.className = 'sp-para-edit';
  box.innerHTML = `<textarea class="sheet-input" rows="6" aria-label="Paragraph">${escapeHtml(had?.text || '')}</textarea>
    <div class="sp-para-actions"><button class="sp-tool" data-slice-page="para-save" data-slice="${sliceId}"${had ? ` data-para="${had.id}"` : ''}>Save</button>
    <button class="sp-tool" data-slice-page="para-cancel" data-slice="${sliceId}">Cancel</button></div>`;
  t.replaceWith(box);
  box.querySelector('textarea').focus();
}

function saveParagraphHere(t, sliceId) {
  const text = t.closest('.sp-para-edit')?.querySelector('textarea')?.value;
  const why = t.dataset.para ? editParagraph({ paragraphId: t.dataset.para, text }) : writeParagraph({ sliceId, text, by: nickname() || null });
  if (why) { showToast(why); return; }
  showPage(sliceId);
}

let showPage = () => {};   // the feed's showSlicePage, from initSlicePage
let openedFrom = () => null;   // the view the slice page was opened from (board, details, …), from initSlicePage

// A page turn in progress: the direction ('next' | 'prev') and the slice it turns from
let turn = null;

export function renderSlicePage(sliceId) {
  const root = document.getElementById('sliceView');
  if (!root) return;
  const turning = turn && turn.from !== sliceId ? turn : null;
  turn = null;
  const screen = slicePageScreen(projectState(), sliceId, { readOnly: isReadOnly(), hideIds: idsHidden(), from: turning?.from, me: commentDeviceId(), nick: nickname(), openedFrom: openedFrom() });
  if (!screen) { root.innerHTML = '<p class="sp-none sp-gone">This slice was deleted.</p>'; return; }
  const lit = screen.literature;
  root.innerHTML = lit ? pointPageHtml(lit.slice, lit.state, lit.paragraphs ? slicePageParagraphs(lit.paragraphs) : '') + slicePageConversation(screen.conversation) : `
    ${slicePagePin(screen.head)}
    ${slicePageNav(screen.nav)}
    ${slicePageHead(screen.head)}
    ${screen.paragraphs ? slicePageParagraphs(screen.paragraphs) : ''}
    ${slicePageFlow(screen.stickies)}
    ${slicePageScenarios(screen.scenarios)}
    ${slicePageConversation(screen.conversation)}`;
  if (turning) {
    // The page comes in from the side it was turned to; into another chapter, its name shows as it turns
    root.classList.remove('sp-turn-next', 'sp-turn-prev');
    void root.offsetWidth;
    root.classList.add(`sp-turn-${turning.dir}`);
    if (screen.turnChapter) root.insertAdjacentHTML('afterbegin', `<div class="sp-turn-chapter" aria-hidden="true">${escapeHtml(screen.turnChapter)}</div>`);
  }
  pinTitle(root);
}

// Scrolled past the slice's header, its title stays at the top as a thin line
let pinWatch = null;
function pinTitle(root) {
  pinWatch?.disconnect();
  const head = root.querySelector('.sp-head');
  if (!head || !('IntersectionObserver' in window)) return;
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 56;
  pinWatch = new IntersectionObserver(([e]) => root.classList.toggle('sp-pinned', !e.isIntersecting && e.boundingClientRect.top < top),
    { rootMargin: `-${top}px 0px 0px 0px` });
  pinWatch.observe(head);
}

// Clicks and swipes; the feed decides which slice is shown (go → showSlicePage)
export function initSlicePage({ showSlicePage, showSliceOnBoard, sliceOpenedFrom }) {
  showPage = showSlicePage;
  if (sliceOpenedFrom) openedFrom = sliceOpenedFrom;
  const root = document.getElementById('sliceView');
  if (!root) return;
  // Turn to the next or previous slice in the book's order (across chapters)
  const turnPage = dir => {
    const btn = root.querySelector(`.sp-nav-btn[aria-label="${dir === 'next' ? 'Next' : 'Previous'} slice"]`);
    // A literature chapter's page (votes) is shown here too: it turns to the chapter beside it
    const chapterBtn = !btn && root.querySelector(`.sp-nav-btn[aria-label="${dir === 'next' ? 'Next' : 'Previous'} chapter"]`);
    if (chapterBtn) { if (!chapterBtn.disabled && chapterBtn.dataset.chapter) chapterBtn.click(); return; }
    if (!btn || btn.disabled || !btn.dataset.slice) return;
    turn = { dir, from: root.querySelector('.sp-tools [data-slice]')?.dataset.slice || null };
    showSlicePage(btn.dataset.slice);
  };
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-slice-page]');
    if (!t || t.disabled) return;
    const a = t.dataset.slicePage, id = t.dataset.slice;
    if (a === 'go' && id) turnPage(t.getAttribute('aria-label') === 'Next slice' ? 'next' : 'prev');
    else if (a === 'open' && id) showSlicePage(id);
    else if (a === 'element') openElementMenu(t.dataset.el, id);
    else if (a === 'scenario') window.EventPad.editScenario(t.dataset.scenario);
    else if (a === 'add-scenario') window.EventPad.addScenario(id, t.dataset.sliceType);
    else if (a === 'menu') openSliceMenu(id);
    else if (a === 'board') showSliceOnBoard(id);
    else if (a === 'share') openShareSheet(null, { sliceId: id });
    else if (a === 'ids') { setIdsHidden(!idsHidden()); showSlicePage(id); }
    else if (a === 'para' || a === 'para-add') editParagraphHere(t, id);
    else if (a === 'para-save') saveParagraphHere(t, id);
    else if (a === 'para-cancel') showSlicePage(id);
  });
  // The conversation: reply, resolve, delete and the new-thread box work in place
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-comment-action]');
    const id = root.querySelector('[data-convo]')?.dataset.convo;
    if (t && id) conversationAction(t.dataset.commentAction, t, id, () => renderSlicePage(id));
  });
  // A clearly sideways swipe turns the page: left for the next slice, right for the previous.
  // Not while scrolling a wide table, and never on a pinch or while zoomed in.
  let start = null;
  const zoomed = () => (window.visualViewport?.scale || 1) > 1.01;
  root.addEventListener('touchstart', e => {
    start = e.target.closest('.sp-table-wrap') || e.touches.length > 1 || zoomed() ? null
      : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  root.addEventListener('touchmove', e => { if (e.touches.length > 1) start = null; }, { passive: true });
  root.addEventListener('touchend', e => {
    if (!start || e.touches.length) { if (e.touches.length) start = null; return; }
    const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy) || zoomed()) return;
    turnPage(dx < 0 ? 'next' : 'prev');
  }, { passive: true });
  // Arrow keys turn the page on a keyboard (not while typing in a box you can see, or with a sheet showing).
  // Only what's on screen counts: a sheet that left its open mark behind, or a box that's hidden now,
  // doesn't stop them (Jocelyn, 2026-11-08: the arrows didn't turn her slice page).
  const showing = el => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !showing(root)) return;
    if (showing(e.target.closest?.('input, textarea, select, [contenteditable="true"]'))) return;
    if ([...document.querySelectorAll('.sheet.active, .bottom-sheet.active, .sheet-overlay.active')].some(showing)) return;
    e.preventDefault();
    turnPage(e.key === 'ArrowRight' ? 'next' : 'prev');
  });
}
