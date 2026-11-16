// ===========================================
// LITERATURE - Stepping through what is waiting for her
// SV: Waiting Pill — "‹ 2 / 5 ›" near the bottom of Read and Outline: the open comments and suggestions in
//     reading order (waitingItems). ‹ › move between them (wrapping); the view scrolls the item into view and
//     flashes it. Open opens its thread (a suggestion: its paragraph, where Accept and Skip are); the count
//     lists them all, each a tap to jump. Nothing waiting: no pill. Navigation only: no events.
// It follows the list as items are resolved or accepted: if the current one goes, it stays at the same place.
// ===========================================

import { projectState } from '../../core/projections.js';
import { isLiterature, waitingItems } from './rules.js';
import { openThread } from '../comments/sheet.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { showSlicePage, onRender } from '../../ui/feed.js';
import { escapeHtml } from '../board/view.js';

let items = [];
let at = -1;           // the current item's place in the list (-1: not stepped into yet, so › goes to the first)
let currentId = null;  // ...and which item it is, to find it again when the list changes
let pill = null;

const shown = id => { const el = document.getElementById(id); return !!el && el.style.display !== 'none'; };
const view = () => shown('readView') ? 'read' : shown('outlineView') && shown('overviewView') ? 'outline' : null;

// Where an item sits in the view on screen: Read has the paragraph; Outline the sentence's row, else the paragraph's card
function targetOf(item) {
  if (view() === 'read') return document.querySelector(`#readView [data-slice="${item.sliceId}"]`);
  const point = document.querySelector(`#outlineView .lt-point[data-slice="${item.sliceId}"]`);
  return (item.sentenceId && point?.querySelector(`.lt-sentence[data-sentence="${item.sentenceId}"]`)) || point;
}

function flash(el) {
  el.classList.remove('lt-flash');
  void el.offsetWidth;   // restart the animation if it is the same element again
  el.classList.add('lt-flash');
  setTimeout(() => el.classList.remove('lt-flash'), 1800);
}

function goTo(i) {
  if (!items.length) return;
  at = (i + items.length) % items.length;
  currentId = items[at].id;
  const el = targetOf(items[at]);
  if (el) {
    el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    flash(el);
  }
  draw();
}

function draw() {
  if (!pill) return;
  const show = items.length && view();
  pill.hidden = !show;
  if (!show) return;
  pill.querySelector('[data-jump=count]').textContent = at < 0 ? `${items.length} waiting` : `${at + 1} / ${items.length}`;
  pill.querySelector('[data-jump=count]').setAttribute('aria-label', `${items.length} waiting: show the list`);
}

// After every render: the list as it stands now, and the current item's place in it
export function updateWaiting() {
  const state = projectState();
  items = isLiterature(state) ? waitingItems(state) : [];
  const found = items.findIndex(x => x.id === currentId);
  // Not stepped in yet: stay so; else the same item, or the same place if it went
  at = currentId === null && at < 0 ? -1 : found >= 0 ? found : Math.min(at, items.length - 1);
  currentId = items[at]?.id ?? null;
  draw();
}

function openCurrent() {
  if (at < 0 && items.length) goTo(0);
  const item = items[at];
  if (!item) return;
  if (item.kind === 'suggestion') showSlicePage(item.sliceId);
  else openThread(item.sliceId, item.sentenceId);
}

function openList() {
  openBoardSheet(`
    <div class="sheet-title">Waiting for you <span class="bd-sheet-sub">${items.length}</span></div>
    <div class="lt-jump-list">${items.map((x, i) => `
      <button class="cm-goto lt-jump-row" data-jump-to="${i}">
        <span class="cm-meta"><b>${escapeHtml(x.who)}</b> · ${x.kind === 'comment' ? 'comment' : 'suggestion'} · ${escapeHtml(x.where)}</span>
        <span class="cm-text">${escapeHtml(x.snippet)}</span>
      </button>`).join('')}</div>`);
}

export function initWaiting() {
  pill = document.createElement('div');
  pill.className = 'lt-jump';
  pill.hidden = true;
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', 'Comments and suggestions waiting for you');
  pill.innerHTML = `
    <button data-jump="prev" aria-label="Previous">‹</button>
    <button data-jump="count" class="lt-jump-count"></button>
    <button data-jump="next" aria-label="Next">›</button>
    <button data-jump="open" class="lt-jump-open">Open</button>`;
  document.body.appendChild(pill);
  pill.addEventListener('click', e => {
    const a = e.target.closest('[data-jump]')?.dataset.jump;
    if (a === 'prev') goTo(at < 0 ? items.length - 1 : at - 1);
    else if (a === 'next') goTo(at + 1);
    else if (a === 'open') openCurrent();
    else if (a === 'count') openList();
  });
  document.getElementById('boardSheetContent')?.addEventListener('click', e => {
    const row = e.target.closest('[data-jump-to]');
    if (!row) return;
    const i = Number(row.dataset.jumpTo);
    hideAllSheets();
    setTimeout(() => goTo(i), 150);
  });
  onRender(updateWaiting);
  updateWaiting();
}
