// ===========================================
// SHARE IMAGE - Parts of the "Share as image" sheet, each drawn from its own view alone
// (Share Scope Choices, Share Scopes, Share Sheet Controls). A root carries data-component and data-key.
// ===========================================

import { scopeOf } from './scope.js';

const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

// The button that opens the scope picker: what is shared now. choice: Share Scope Choices (+ open: whether the panel shows)
export function shareScopeButton(choice) {
  return `<button type="button" class="sheet-input share-scope" id="shareScopeBtn" data-component="Share scope button" data-key="scope" aria-haspopup="listbox" aria-expanded="${!!choice.open}" ${choice.showButton ? '' : 'hidden'}>
          <span id="shareScopeLabel">${escapeHtml(choice.label)}</span><span class="share-scope-caret">▾</span>
        </button>`;
}

// The picker's choices, from Share Scopes alone (view); slice: the one slice the sheet was opened from,
// query: the search box. The whole model and the slice always stay; chapters filter by every word typed.
// Chapters tick on and off (share several); the whole model and the slice are one choice each.
export function scopeButtons(view, { slice = null, query = '' } = {}) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const options = [...(slice ? [{ id: 'slice:' + slice.id, name: slice.name }] : []), ...(view.whole ? [{ id: '', name: 'Whole model' }] : []),
    ...view.chapters.map(c => ({ id: c.chapterId, name: c.name, chapter: true }))];
  const ticked = scopeOf(view.picked).chapters || [];
  const shown = options.filter(o => !o.chapter || words.every(w => o.name.toLowerCase().includes(w)));
  return shown.map(o => {
    const on = o.chapter ? ticked.includes(o.id) : (view.picked || '') === o.id;
    return `<button type="button" class="share-scope-option ${on ? 'active' : ''}" role="option" aria-selected="${on}" data-component="Share scope option" data-key="${escapeHtml(o.id || 'whole')}" data-scope="${escapeHtml(o.id)}">${o.chapter ? `<span class="share-scope-tick">${on ? '✓' : ''}</span>` : ''}${escapeHtml(o.name)}</button>`;
  }).join('')
    + (words.length && shown.every(o => !o.chapter) ? `<div class="share-scope-none">No chapter matches</div>` : '');
}

// One of the three ways to share: Picture, Slides 4:5, Outline (a row of Share Sheet Controls' format)
export function shareFormatButton(row) {
  return `<button ${row.active ? 'class="active" ' : ''}data-component="Share format button" data-key="${row.value}" data-share-set="format" data-value="${row.value}">${escapeHtml(row.label)}</button>`;
}

// One option chip (a chip of Share Sheet Controls): ticked when on, gone when the book has nothing for it
export function shareOptionChip(chip) {
  return `<button class="share-chip${chip.active ? ' active' : ''}" ${chip.id ? `id="${chip.id}" ` : ''}data-component="Share option chip" data-key="${chip.opt}" data-share-opt="${chip.opt}" data-on="${chip.on}" data-off="${chip.off}"${chip.shown ? '' : ' style="display: none;"'}>${escapeHtml(chip.label)}</button>`;
}
