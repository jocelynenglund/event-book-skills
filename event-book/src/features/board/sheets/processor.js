// ===========================================
// BOARD SHEETS - Pickers: the events that update a to-do list, a processor's reads & triggers
// ===========================================

import { projectState, getTodoUpdates } from '../../../core/projections.js';
import { externalAttr, byName } from '../../../core/constants.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showToast } from '../../../ui/toast.js';
import { render } from '../../../ui/feed.js';
import { setUpdatedBy, setTrigger, setReads, readsModel, isTrigger, addProcessorReadModel, newId } from '../command.js';
import { appendEvent, EventTypes } from '../../../core/eventStore.js';
import { escapeHtml } from '../view.js';
import { onEnter, openBoardSheet, scrollToSlice, searchKey } from './shared.js';

// ---------- To-do list: which events update it ----------

let updatedByRm = null;

// Every event in the model, ticked if it updates this read model; tick to link
export function openUpdatedByPicker(readModelId) {
  const state = projectState();
  const rm = state.elements[readModelId];
  if (!rm) return;
  updatedByRm = readModelId;
  const linked = new Set(getTodoUpdates(readModelId, state).map(u => u.event.id));
  const events = Object.values(state.elements).filter(e => e.type === 'event')
    .sort(byName);
  openBoardSheet(`
    <div class="sheet-title">Updated by <span class="bd-sheet-sub">${escapeHtml(rm.name)}</span></div>
    <input type="text" class="sheet-input" id="bdUpdatedSearch" placeholder="Search events" autocomplete="off">
    ${pickList('bdUpdatedChips', events.map(ev => `
        <button class="bd-chip ${linked.has(ev.id) ? 'linked' : ''}" data-type="event"${externalAttr(ev)} data-board-action="toggle-updated-by" data-el="${ev.id}" data-key="${escapeHtml(searchKey(ev.name))}">${linked.has(ev.id) ? '✓ ' : ''}${escapeHtml(ev.name)}</button>`), events.filter(e => linked.has(e.id)).length)}
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
  const state = projectState();
  const proc = state.elements[processorId];
  if (!proc) return;
  inputsProc = processorId;
  inputsSlice = sliceId && state.slices[sliceId] ? sliceId : null;
  const triggered = id => isTrigger(id, processorId, state);
  const models = Object.values(state.elements).filter(e => e.type === 'readModel')
    .sort(byName);
  const events = Object.values(state.elements).filter(e => e.type === 'event').sort(byName);
  const chip = (e, action, linked) => `
    <button class="bd-chip ${linked ? 'linked' : ''}" data-type="${e.type}"${externalAttr(e)} data-board-action="${action}" data-el="${e.id}" data-key="${escapeHtml(searchKey(e.name))}" data-name="${escapeHtml(e.name)}">${linked ? '✓ ' : ''}${e.todo ? '☑ ' : ''}${escapeHtml(e.name)}</button>`;
  const reads = models.filter(m => readsModel(processorId, m.id, state)).length;
  const triggers = events.filter(e => triggered(e.id)).length;
  openBoardSheet(`
    <div class="sheet-title">What it uses <span class="bd-sheet-sub">${escapeHtml(proc.name)}</span></div>
    <div class="bd-sheet-label">Reads</div>
    ${models.length > 8 ? `<input type="text" class="sheet-input" id="bdReadsSearch" placeholder="Search read models" autocomplete="off">` : ''}
    ${pickList('bdReadsChips', models.map(m => chip(m, 'toggle-reads', readsModel(processorId, m.id, state))), reads)}
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdNewReadModel" placeholder="New read model, e.g. Amount to charge" autocomplete="off">
      <button class="sheet-btn" data-board-action="new-read-model">Add</button>
    </div>
    <div class="bd-cell-hint">${inputsSlice ? 'A new one gets its own state view on the left: add the events that build it there.' : 'Give a new read model its own state view to show the events that build it.'}</div>
    <div class="bd-sheet-label">⚡ Triggered by</div>
    ${events.length > 8 ? `<input type="text" class="sheet-input" id="bdTriggerSearch" placeholder="Search events" autocomplete="off">` : ''}
    ${pickList('bdTriggerChips', events.map(e => chip(e, 'toggle-trigger', triggered(e.id))), triggers)}
    <button class="sheet-btn" data-board-action="close">Done</button>`);
  onEnter('bdNewReadModel', submitNewReadModel);
  searchList('bdTriggerSearch', 'bdTriggerChips');
  searchList('bdReadsSearch', 'bdReadsChips');
}

function submitNewReadModel() {
  const name = document.getElementById('bdNewReadModel')?.value.trim();
  if (!name) { showToast('Name the read model'); return; }
  const state = projectState();
  // Typing an existing read model's name links that one
  const rm = Object.values(state.elements).find(e => e.type === 'readModel' && searchKey(e.name) === searchKey(name));
  if (rm) {
    setReads(inputsProc, rm.id, true);
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
    t.textContent = (on ? '✓ ' : '') + projectState().elements[t.dataset.el].name;
    render();
  }
  else return false;
  return true;
}
