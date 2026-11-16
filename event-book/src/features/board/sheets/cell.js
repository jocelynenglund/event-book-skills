// ===========================================
// BOARD SHEETS - Filling a cell: name a new element or reuse one
// ===========================================

import { projectState } from '../../../core/projections.js';
import { typeLabels } from '../../../core/constants.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { render } from '../../../ui/feed.js';
import { addToSlice } from '../command.js';
import { escapeHtml } from '../view.js';
import { onEnter, openBoardSheet, searchKey } from './shared.js';
import { cellReuseChoices, CHIP_LIMIT } from './cellReuseChoices.read.js';
import { cellSheetBody } from './cell.parts.js';
import { isReadOnly } from '../../readOnly/sheet.js';

// ---------- Fill a cell ----------

let cellCtx = null;

export function openCellSheet(sliceId, elementType) {
  if (isReadOnly()) return;   // not checked out here: nothing to change
  const choices = cellReuseChoices(projectState(), sliceId, elementType);
  if (!choices) return;
  cellCtx = { sliceId, elementType };

  openBoardSheet(cellSheetBody(choices), 'bdCellName');
  onEnter('bdCellName', submitCellNew);
  const input = document.getElementById('bdCellName');
  if (input) input.oninput = () => filterCellChips(input.value);
}

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
