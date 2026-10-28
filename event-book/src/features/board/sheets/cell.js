// ===========================================
// BOARD SHEETS - Filling a cell: name a new element or reuse one
// ===========================================

import { projectState } from '../../../core/projections.js';
import { typeLabels, externalAttr, byName } from '../../../core/constants.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { render } from '../../../ui/feed.js';
import { addToSlice } from '../command.js';
import { escapeHtml } from '../view.js';
import { onEnter, openBoardSheet, placeholders, searchKey } from './shared.js';
import { isReadOnly } from '../../readOnly/sheet.js';

// ---------- Fill a cell ----------

let cellCtx = null;

export function openCellSheet(sliceId, elementType) {
  if (isReadOnly()) return;   // not checked out here: nothing to change
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  cellCtx = { sliceId, elementType };

  const reusable = Object.values(state.elements)
    .filter(el => el.type === elementType && !slice.elements.includes(el.id))
    .sort(byName);
  const usedIn = id => Object.values(state.slices).filter(s => s.elements.includes(id)).length;

  // One box both searches the existing ones and names a new one
  const label = typeLabels[elementType];
  const newHtml = `
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdCellName" placeholder="${reusable.length ? `Search or name a new ${label.toLowerCase()}` : (placeholders[elementType] || 'Name')}" autocomplete="off">
      <button class="sheet-btn" id="bdCellGo" data-board-action="create-in-cell">Add</button>
    </div>
    <div class="bd-cell-hint" id="bdCellHint">${reusable.length ? `${reusable.length} existing ${reusable.length === 1 ? label.toLowerCase() : label.toLowerCase() + 's'} · tap one to reuse it` : ''}</div>`;
  const reuseHtml = reusable.length ? `
    <div class="bd-chips" id="bdCellChips">
      ${reusable.map((el, i) => {
        const n = usedIn(el.id);
        return `<button class="bd-chip" data-type="${el.type}"${externalAttr(el)} data-board-action="reuse" data-el="${el.id}" data-key="${escapeHtml(searchKey(el.name))}" data-name="${escapeHtml(el.name)}" ${i >= CHIP_LIMIT ? 'hidden' : ''}>
          ${escapeHtml(el.name)}${n ? `<span class="bd-chip-used">in ${n} ${n === 1 ? 'slice' : 'slices'}</span>` : ''}
        </button>`;
      }).join('')}
    </div>
    <div class="bd-cell-more" id="bdCellMore">${reusable.length > CHIP_LIMIT ? `+${reusable.length - CHIP_LIMIT} more — type to narrow` : ''}</div>` : '';

  // The top lane of a view or change is driven by a person (screen) or the system (processor)
  const actorSwitch = (elementType === 'screen' || elementType === 'processor') && slice.type !== 'AU' ? `
    <div class="segmented bd-actor-switch">
      <button class="${elementType === 'screen' ? 'active' : ''}" data-board-action="switch-actor" data-type="screen">Screen</button>
      <button class="${elementType === 'processor' ? 'active' : ''}" data-board-action="switch-actor" data-type="processor">⚙️ Automation</button>
    </div>` : '';

  openBoardSheet(`
    <div class="sheet-title">${label} <span class="bd-sheet-sub">in ${escapeHtml(slice.name || 'this slice')}</span></div>
    ${actorSwitch}
    ${newHtml}
    ${reuseHtml}
  `, 'bdCellName');
  onEnter('bdCellName', submitCellNew);
  const input = document.getElementById('bdCellName');
  if (input) input.oninput = () => filterCellChips(input.value);
}

const CHIP_LIMIT = 18;
// "Order placed", "order_placed" and "OrderPlaced" are the same name

// Narrow the chips to what's typed; an exact match turns Add into "Use <name>"
function filterCellChips(text) {
  const q = searchKey(text);
  const chips = [...document.querySelectorAll('#bdCellChips .bd-chip')];
  const matches = chips.filter(c => !q || c.dataset.key.includes(q));
  const exact = q ? chips.find(c => c.dataset.key === q) : null;
  chips.forEach(c => { c.hidden = true; c.classList.toggle('exact', c === exact); });
  matches.slice(0, CHIP_LIMIT).forEach(c => { c.hidden = false; });

  const label = typeLabels[cellCtx?.elementType] || 'element';
  const hint = document.getElementById('bdCellHint');
  const more = document.getElementById('bdCellMore');
  const go = document.getElementById('bdCellGo');
  if (more) more.textContent = matches.length > CHIP_LIMIT ? `+${matches.length - CHIP_LIMIT} more — type to narrow` : '';
  if (go) go.textContent = exact ? 'Use it' : (q ? 'Add new' : 'Add');
  if (!hint) return;
  if (!q) hint.textContent = chips.length ? `${chips.length} existing · tap one to reuse it` : '';
  else if (exact) hint.innerHTML = `<b>${escapeHtml(exact.dataset.name)}</b> already exists — Use it to reuse, not duplicate`;
  else if (matches.length) hint.textContent = `${matches.length} similar · or Add new`;
  else hint.textContent = `No ${label.toLowerCase()} called that yet — Add new creates it`;
}

// Enter / Add: reuse an exact match rather than make a duplicate
function submitCellNew() {
  const name = document.getElementById('bdCellName')?.value.trim();
  if (!name || !cellCtx) return;
  const exact = document.querySelector('#bdCellChips .bd-chip.exact');
  if (exact) { submitCellReuse(exact.dataset.el); return; }
  addToSlice(cellCtx.sliceId, cellCtx.elementType, { name });
  hideAllSheets();
  render();
}

function submitCellReuse(elementId) {
  if (!cellCtx) return;
  addToSlice(cellCtx.sliceId, cellCtx.elementType, { elementId });
  hideAllSheets();
  render();
}

// Taps in the sheet that belong to filling a cell; true when handled
export function onSheetAction(a, t) {
  if (a === 'create-in-cell') submitCellNew();
  else if (a === 'reuse') submitCellReuse(t.dataset.el);
  else if (a === 'switch-actor' && cellCtx) openCellSheet(cellCtx.sliceId, t.dataset.type);
  else return false;
  return true;
}
