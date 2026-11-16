// ===========================================
// BOARD SHEETS - Pickers: the events that update a to-do list, a processor's reads & triggers
// ===========================================

import { projectState } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showToast } from '../../../ui/toast.js';
import { render } from '../../../ui/feed.js';
import { setUpdatedBy, setTrigger, setReads, addProcessorReadModel, newId } from '../command.js';
import { appendEvent, EventTypes } from '../../../core/eventStore.js';
import { escapeHtml } from '../view.js';
import { onEnter, openBoardSheet, scrollToSlice, searchKey } from './shared.js';
import { updatedByView, processorInputsView, readModelNamed } from './read.js';
import { pickChip } from './parts.js';

// The book, through one sheet's view: the sheets read nothing of it but what their view holds
const viewOf = (view, ...args) => view(projectState(), ...args);

// ---------- To-do list: which events update it ----------

let updatedByRm = null;

// Every event in the model, ticked if it updates this read model; tick to link
export function openUpdatedByPicker(readModelId) {
  const v = viewOf(updatedByView, readModelId);
  if (!v) return;
  updatedByRm = readModelId;
  const events = v.events;
  openBoardSheet(`
    <div class="sheet-title">Updated by <span class="bd-sheet-sub">${escapeHtml(v.name)}</span></div>
    <input type="text" class="sheet-input" id="bdUpdatedSearch" placeholder="Search events" autocomplete="off">
    ${pickList('bdUpdatedChips', events.map(ev => pickChip(ev, 'toggle-updated-by')), events.filter(e => e.linked).length)}
    <div class="bd-cell-hint">Ticked events update this list. On the card, tap a tag to switch between + adds and ✓ completes.</div>
    <button class="sheet-btn" data-board-action="close">Done</button>`);
  searchList('bdUpdatedSearch', 'bdUpdatedChips');
}

// A picker's chips. Once something is picked, just the picked ones show (✓), the rest behind
// "Change…", so it's clear what's chosen; nothing picked yet, all of them
function pickList(id, chips, picked) {
  const rest = chips.length - picked;
  return `<div class="bd-pick ${picked && rest ? 'folded' : ''}" id="${id}"><div class="bd-chips">${chips.join('')}</div>
    ${picked && rest ? `<button class="bd-pick-more" data-board-action="pick-more">Change… <span>${rest} more</span></button>` : ''}</div>`;
}
// Searching opens the list and shows the matches
function searchList(inputId, listId) {
  const input = document.getElementById(inputId);
  if (input) input.oninput = () => {
    const q = searchKey(input.value);
    const list = document.getElementById(listId);
    if (q) list.classList.remove('folded');
    list.querySelectorAll('.bd-chip').forEach(c => { c.hidden = !!q && !c.dataset.key.includes(q); });
  };
}

// ---------- A processor's inputs: what it reads, what wakes it ----------

let inputsProc = null;
let inputsSlice = null;

// sliceId: the column the processor was tapped in, where a new read model's view goes
export function openProcessorInputs(processorId, sliceId = inputsSlice) {
  const v = viewOf(processorInputsView, processorId, sliceId);
  if (!v) return;
  inputsProc = processorId;
  inputsSlice = v.sliceId;
  const models = v.readModels, events = v.events;
  const reads = models.filter(m => m.linked).length;
  const triggers = events.filter(e => e.linked).length;
  openBoardSheet(`
    <div class="sheet-title">What it uses <span class="bd-sheet-sub">${escapeHtml(v.name)}</span></div>
    <div class="bd-sheet-label">Reads</div>
    ${models.length > 8 ? `<input type="text" class="sheet-input" id="bdReadsSearch" placeholder="Search read models" autocomplete="off">` : ''}
    ${pickList('bdReadsChips', models.map(m => pickChip(m, 'toggle-reads')), reads)}
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdNewReadModel" placeholder="New read model, e.g. Amount to charge" autocomplete="off">
      <button class="sheet-btn" data-board-action="new-read-model">Add</button>
    </div>
    <div class="bd-cell-hint">${inputsSlice ? 'A new one gets its own state view on the left: add the events that build it there.' : 'Give a new read model its own state view to show the events that build it.'}</div>
    <div class="bd-sheet-label">⚡ Triggered by</div>
    ${events.length > 8 ? `<input type="text" class="sheet-input" id="bdTriggerSearch" placeholder="Search events" autocomplete="off">` : ''}
    ${pickList('bdTriggerChips', events.map(e => pickChip(e, 'toggle-trigger')), triggers)}
    <button class="sheet-btn" data-board-action="close">Done</button>`);
  onEnter('bdNewReadModel', submitNewReadModel);
  searchList('bdTriggerSearch', 'bdTriggerChips');
  searchList('bdReadsSearch', 'bdReadsChips');
}

function submitNewReadModel() {
  const name = document.getElementById('bdNewReadModel')?.value.trim();
  if (!name) { showToast('Name the read model'); return; }
  // Typing an existing read model's name links that one
  const rm = viewOf(readModelNamed, name);
  if (rm) {
    setReads(inputsProc, rm, true);
    render();
    openProcessorInputs(inputsProc);
    return;
  }
  if (inputsSlice) {
    // Its own state view beside the processor, ready for the events that build it
    const viewId = addProcessorReadModel(inputsSlice, inputsProc, name);
    hideAllSheets();
    render();
    scrollToSlice(viewId);
    showToast('Added a state view for it on the left');
    return;
  }
  const id = newId('el');
  appendEvent(EventTypes.ElementCreated, { elementId: id, elementType: 'readModel', name });
  setReads(inputsProc, id, true);
  render();
  openProcessorInputs(inputsProc);
}

// Taps in the sheet that belong to a to-do list's or a processor's picker; true when handled
export function onSheetAction(a, t) {
  if ((a === 'toggle-reads' || a === 'toggle-trigger') && inputsProc) {
    const on = !t.classList.contains('linked');
    if (a === 'toggle-reads') setReads(inputsProc, t.dataset.el, on);
    else setTrigger(t.dataset.el, inputsProc, on);
    t.classList.toggle('linked', on);
    t.textContent = (on ? '✓ ' : '') + (t.dataset.name || '');
    render();
  }
  else if (a === 'new-read-model' && inputsProc) submitNewReadModel();
  else if (a === 'pick-more') { t.closest('.bd-pick')?.classList.remove('folded'); t.remove(); }
  else if (a === 'toggle-updated-by' && updatedByRm) {
    const on = !t.classList.contains('linked');
    setUpdatedBy(t.dataset.el, updatedByRm, on);
    t.classList.toggle('linked', on);
    t.textContent = (on ? '✓ ' : '') + t.dataset.name;
    render();
  }
  else return false;
  return true;
}
