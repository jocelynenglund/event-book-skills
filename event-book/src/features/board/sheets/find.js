// ===========================================
// BOARD SHEETS - Find a slice
// A search box over the book's slices (Slices Found): type a name, an S-number, a sticky,
// a code file or a chapter; tap a match to go to that slice on the board.
// ===========================================

import { projectState } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showSliceOnBoard } from '../../../ui/feed.js';
import { slicesFound } from '../../search/read.js';
import { escapeHtml, isChapterFolded, toggleChapterFolded } from '../view.js';
import { openBoardSheet } from './shared.js';

const reasonText = { number: 'number', name: 'name', sticky: 'sticky', description: 'description', chapter: 'chapter' };

// One match, drawn from the match alone
export const findMatch = m => `
  <button data-component="Find match" data-key="${m.sliceId}" class="bd-find-match" data-board-action="find-go" data-slice="${m.sliceId}" data-chapter="${m.chapterId || ''}">
    <span class="bd-find-ref">${escapeHtml(m.ref)}</span>
    <span class="bd-find-title">${escapeHtml(m.title)}</span>
    <span class="bd-find-sub">${m.chapter ? `${escapeHtml(m.chapter)} · ` : ''}${reasonText[m.why] || ''}</span>
  </button>`;

function matchList(query) {
  if (!query.trim()) return '<div class="bd-find-empty">Type a name, an S-number, a sticky or a code file</div>';
  const found = slicesFound(projectState(), query);
  return found.length ? found.map(findMatch).join('') : `<div class="bd-find-empty">Nothing matches "${escapeHtml(query)}"</div>`;
}

export function openFindSheet() {
  openBoardSheet(`
    <div class="sheet-title">Find a slice</div>
    <input type="search" class="sheet-input" id="findBox" placeholder="Name, S-number, sticky, code file…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
    <div class="bd-find-list" id="findList">${matchList('')}</div>`, 'findBox');
}

// Typing in the box redraws the list (the box keeps its focus)
export function onSheetInput(e) {
  if (e.target.id !== 'findBox') return;
  document.getElementById('findList').innerHTML = matchList(e.target.value);
}

export function onSheetAction(a, t) {
  if (a !== 'find-go') return false;
  // The match says where it is (its chapter, to unfold): no need to read the book again
  const { slice, chapter } = t.dataset;
  hideAllSheets();
  if (!slice) return true;
  if (chapter && isChapterFolded(chapter)) toggleChapterFolded(chapter);
  showSliceOnBoard(slice);
  return true;
}
