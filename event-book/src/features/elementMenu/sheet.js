// ===========================================
// ELEMENT MENU - Unified edit entry point
// ===========================================

import { projectState, getOrderedSlices, chapterFlows, elementFlow, sliceFlow } from '../../core/projections.js';
import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { typeIcons, typeLabels } from '../../core/constants.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { render, showElementOnBoard } from '../../ui/feed.js';
import { showToast } from '../../ui/toast.js';
import { toastWithUndo } from '../undo/command.js';
import { secondTap } from '../../ui/secondTap.js';
import { openPropertySheet } from '../properties/sheet.js';
import { deleteElement } from '../deleteElement/command.js';
import { showActions } from '../connect/actionSheet.js';
import { removeFromSlice, sliceProcessor, isTrigger, setTrigger, setTodo, setElementFlow } from '../board/command.js';
import { isReadOnly, openElementReadSheet } from '../readOnly/sheet.js';

let currentElementId = null;
let currentSliceId = null;
let currentProcessorId = null;

const escapeName = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openElementMenu(elementId, sliceId = null) {
  if (isReadOnly()) { openElementReadSheet(elementId); return; }   // not checked out here: read it
  const state = projectState();
  const element = state.elements[elementId];
  if (!element) return;
  
  currentElementId = elementId;
  currentSliceId = sliceId && !sliceId.startsWith('au_inferred_') ? sliceId : null;
  
  const title = document.getElementById('elementMenuTitle');
  const options = document.getElementById('elementMenuOptions');
  
  // The name is the title, edited in place: tap it, type, Enter (or tap away) saves
  title.innerHTML = `
    <span class="em-title">
      <span style="background: var(--${element.type}); color: ${element.type === 'command' || element.type === 'processor' ? '#fff' : '#000'}; padding: 4px 8px; border-radius: 6px;">${typeIcons[element.type]}</span>
      <input type="text" class="em-name" id="emName" value="${escapeName(element.name)}" aria-label="Name" autocomplete="off" enterkeyhint="done">
      <button class="em-save" id="emSave" aria-label="Save name" hidden>✓</button>
    </span>
  `;
  const nameInput = document.getElementById('emName');
  const saveBtn = document.getElementById('emSave');
  // ✓ shows while the name is being edited; tapping it saves (the field keeps focus until then)
  nameInput.onfocus = () => { saveBtn.hidden = false; };
  nameInput.onblur = () => setTimeout(() => { saveBtn.hidden = true; }, 150);
  saveBtn.onpointerdown = e => e.preventDefault();
  saveBtn.onclick = () => { saveMenuName(nameInput); nameInput.blur(); };
  nameInput.onchange = () => saveMenuName(nameInput);
  nameInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); } };
  
  // Build properties preview
  const propsPreview = element.properties.length > 0
    ? `${element.properties.length} · ${element.properties.map(p => p.name).join(', ')}`
    : 'No properties';
  
  // Events can come from another system: mark them external (shown yellow)
  const externalToggle = element.type === 'event' ? `
    <div class="sheet-option" onclick="window.EventPad.menuToggleExternal()">
      <div class="sheet-option-icon bd-type-icon-external${element.external ? ' on' : ''}">⇄</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">${element.external ? 'Mark as internal' : 'Mark as external'}</div>
        <div class="sheet-option-desc">${element.external ? 'Happens in this system (orange)' : 'Comes from another system (yellow)'}</div>
      </div>
    </div>` : '';

  // In an automation's slice, an event can be what wakes the processor up
  const processor = currentSliceId && element.type === 'event'
    ? sliceProcessor(state.slices[currentSliceId], state) : null;
  currentProcessorId = processor?.id || null;
  const triggering = processor && isTrigger(element.id, processor.id, state);
  const triggerToggle = processor ? `
    <div class="sheet-option" onclick="window.EventPad.menuToggleTrigger()">
      <div class="sheet-option-icon" style="background: ${triggering ? 'var(--note-processor)' : 'var(--surface-hover)'};">⚡</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">${triggering ? `Doesn't trigger ${escapeName(processor.name)}` : `Triggers ${escapeName(processor.name)}`}</div>
        <div class="sheet-option-desc">${triggering ? 'Only feeds its read models' : 'This event wakes the processor up'}</div>
      </div>
    </div>` : '';

  // A read model can be a list of rows (its properties describe one row)
  const listOption = element.type === 'readModel' && !element.todo ? `
    <div class="sheet-option" onclick="window.EventPad.menuToggleList()">
      <div class="sheet-option-icon" style="background: ${element.list ? 'var(--note-readModel)' : 'var(--surface-hover)'};">≡</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">${element.list ? 'A single record' : 'A list of rows'}</div>
        <div class="sheet-option-desc">${element.list ? 'One of these, not many' : 'Many of these; its properties describe one row'}</div>
      </div>
    </div>` : '';

  // A read model can be a saga's to-do list, updated by events from anywhere
  const todoOptions = element.type === 'readModel' ? `
    <div class="sheet-option" onclick="window.EventPad.menuToggleTodo()">
      <div class="sheet-option-icon" style="background: ${element.todo ? 'var(--note-readModel)' : 'var(--surface-hover)'};">☑</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">${element.todo ? 'Not a to-do list' : 'Mark as to-do list'}</div>
        <div class="sheet-option-desc">${element.todo ? 'Back to a plain read model' : 'A work queue an automation picks items from'}</div>
      </div>
    </div>
    ${element.todo ? `
    <div class="sheet-option" onclick="window.EventPad.menuUpdatedBy()">
      <div class="sheet-option-icon" style="background: var(--note-event);">+</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Updated by…</div>
        <div class="sheet-option-desc">Pick the events that add or tick off items</div>
      </div>
    </div>` : ''}` : '';

  // A processor can read several read models and be woken by events from anywhere
  const processorOptions = element.type === 'processor' ? `
    <div class="sheet-option" onclick="window.EventPad.menuProcessorInputs()">
      <div class="sheet-option-icon" style="background: var(--note-readModel);">⚙</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Reads & triggers…</div>
        <div class="sheet-option-desc">The read models it uses and the events that wake it</div>
      </div>
    </div>` : '';

  // An event: the read models it updates, wherever they are. Tap one to go there.
  let consumerList = '';
  if (element.type === 'event') {
    const slices = getOrderedSlices(state);
    const readers = [...new Set(state.connections
      .filter(c => c.from === element.id && c.relation === 'consumer').map(c => c.to))]
      .map(id => state.elements[id]).filter(rm => rm?.type === 'readModel');
    const where = rm => slices.find(s => s.elements.includes(rm.id))?.name || null;
    consumerList = `
    <div class="em-consumers">
      <div class="bd-sheet-label">${readers.length ? `Updates ${readers.length} read ${readers.length === 1 ? 'model' : 'models'}` : 'No read model uses this event yet'}</div>
      ${readers.length ? `<div class="bd-chips">${readers.map(rm => `
        <button class="bd-chip" data-type="readModel" onclick="window.EventPad.menuShowElement('${rm.id}')">
          ${rm.todo ? '☑ ' : ''}${escapeName(rm.name)}<span class="bd-chip-used">${where(rm) ? `in ${escapeName(where(rm))}` : 'not on the board'}</span>
        </button>`).join('')}</div>` : ''}
    </div>`;
  }

  // An outcome event can belong to a flow, so the main line reads as the happy case
  const menuSlice = currentSliceId && state.slices[currentSliceId];
  // (in a flow's own slices every outcome shows, so it's only offered on the main line)
  const flows = element.type === 'event' && menuSlice?.chapterId && !sliceFlow(menuSlice, state) ? chapterFlows(menuSlice.chapterId, state) : [];
  const current = flows.length ? elementFlow(element, menuSlice, state) : null;
  const flowOption = flows.length ? `
    <div class="bd-sheet-label">Outcome of</div>
    <div class="bd-chips em-flows">
      <button class="bd-chip ${current ? '' : 'linked'}" onclick="window.EventPad.menuSetElementFlow('')">Every flow</button>
      <button class="bd-chip ${current?.id === 'main' ? 'linked' : ''}" onclick="window.EventPad.menuSetElementFlow('main')">Main line only</button>
      ${flows.map(f => `<button class="bd-chip ${current?.id === f.id ? 'linked' : ''}" onclick="window.EventPad.menuSetElementFlow('${f.id}')">↳ ${escapeName(f.name)}</button>`).join('')}
    </div>` : '';

  options.innerHTML = `
    ${flowOption}
    ${consumerList}
    ${processorOptions}
    ${listOption}
    ${todoOptions}
    ${triggerToggle}
    ${externalToggle}
    <div class="sheet-option" onclick="window.EventPad.menuProperties()">
      <div class="sheet-option-icon" style="background: var(--surface-hover);">📝</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Properties</div>
        <div class="sheet-option-desc">${propsPreview}</div>
      </div>
    </div>
    <div class="sheet-option" onclick="window.EventPad.menuConnect()">
      <div class="sheet-option-icon" style="background: var(--surface-hover);">🔗</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Connect</div>
        <div class="sheet-option-desc">Link to other elements</div>
      </div>
    </div>
    ${currentSliceId ? `
    <div class="sheet-option" onclick="window.EventPad.menuRemoveFromSlice()">
      <div class="sheet-option-icon" style="background: var(--surface-hover);">↩︎</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Remove from slice</div>
        <div class="sheet-option-desc">Keeps it in the model</div>
      </div>
    </div>` : ''}
    <div class="sheet-option" onclick="window.EventPad.menuDelete(this)" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
      <div class="sheet-option-icon" style="background: #c0392b;">🗑️</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title" style="color: #e74c3c;">Delete</div>
        <div class="sheet-option-desc">Remove element</div>
      </div>
    </div>
  `;
  
  showSheet('elementMenuSheet');
}

// Rename: straight into the name at the top of the menu
export function menuRename() {
  const input = document.getElementById('emName');
  if (!input) return;
  input.focus();
  input.select();
}

function saveMenuName(input) {
  const element = projectState().elements[currentElementId];
  if (!element) return;
  const name = input.value.trim();
  if (!name) { input.value = element.name; return; }
  if (name === element.name) return;
  appendEvent(EventTypes.ElementRenamed, { elementId: element.id, name });
  render();
  showToast('Renamed');
}

export function menuProperties() {
  hideAllSheets();
  if (currentElementId) {
    openPropertySheet(currentElementId);
  }
}

export function menuConnect() {
  hideAllSheets();
  if (currentElementId) {
    // Small delay to let sheet close
    setTimeout(() => {
      showActions(currentElementId);
    }, 100);
  }
}

export function menuDelete(button) {
  if (!secondTap(button)) return;
  hideAllSheets();
  if (currentElementId) {
    deleteElement(currentElementId);
  }
}

export function menuToggleList() {
  hideAllSheets();
  const element = projectState().elements[currentElementId];
  if (!element) return;
  appendEvent(EventTypes.ElementListSet, { elementId: element.id, list: !element.list });
  render();
}

export function menuToggleTodo() {
  hideAllSheets();
  const element = projectState().elements[currentElementId];
  if (!element) return;
  setTodo(element.id, !element.todo);
  render();
}

export function menuUpdatedBy() {
  hideAllSheets();
  if (currentElementId) setTimeout(() => window.EventPad.openUpdatedByPicker(currentElementId), 150);
}

export function menuSetElementFlow(flowId) {
  if (!currentElementId) return;
  setElementFlow(currentElementId, flowId || null);
  render();
  openElementMenu(currentElementId, currentSliceId);
}

export function menuShowElement(elementId) {
  hideAllSheets();
  setTimeout(() => { if (!showElementOnBoard(elementId)) showToast('Not on the board yet'); }, 150);
}

export function menuProcessorInputs() {
  hideAllSheets();
  if (currentElementId) setTimeout(() => window.EventPad.openProcessorInputs(currentElementId, currentSliceId), 150);
}

export function menuToggleTrigger() {
  hideAllSheets();
  if (!currentElementId || !currentProcessorId) return;
  setTrigger(currentElementId, currentProcessorId, !isTrigger(currentElementId, currentProcessorId, projectState()));
  render();
}

export function menuToggleExternal() {
  hideAllSheets();
  const element = projectState().elements[currentElementId];
  if (!element) return;
  appendEvent(EventTypes.ElementExternalSet, { elementId: element.id, external: !element.external });
  render();
}

export function menuRemoveFromSlice() {
  hideAllSheets();
  if (currentElementId && currentSliceId) {
    removeFromSlice(currentSliceId, currentElementId);
    render();
    toastWithUndo('Removed from the slice');
  }
}

export function getCurrentMenuElementId() {
  return currentElementId;
}
