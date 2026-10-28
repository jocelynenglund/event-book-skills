// ===========================================
// SCENARIOS - UI Sheets
// ===========================================

import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { typeIcons, propLabel, byName } from '../../core/constants.js';
import { projectState, getScenariosForSlice, getOrderedSlices } from '../../core/projections.js';
import { render } from '../../ui/feed.js';
import { toastWithUndo } from '../undo/command.js';
import { secondTap } from '../../ui/secondTap.js';
import {
  addScenario,
  deleteScenario as deleteScenarioCmd,
  setGiven,
  setWhen,
  setThenEvent,
  setThenRejection,
  setThenReadModel,
  renameScenario,
  setMustHave
} from './command.js';

// ===========================================
// STATE
// ===========================================

let editingSliceId = null;
let editingSliceType = null;
let editingScenarioId = null;
let editingScenario = null;
let editingState = null;

// ===========================================
// HELPERS
// ===========================================

// Render property inputs for an element
function renderPropertyInputs(element, existingValues = {}, prefix) {
  if (!element.properties || element.properties.length === 0) {
    return '<p class="property-hint">No properties defined</p>';
  }

  return element.properties.map(prop => {
    const raw = existingValues[prop.name] ?? '';
    // A list of things with fields (stuff[]{stuffId, name}): one line per item
    if (prop.type === 'array' && prop.items?.length) {
      const items = Array.isArray(raw) ? raw : [];
      return `
      <div class="property-input-row prop-items-row">
        <label>${escapeHtml(prop.name)}[]</label>
        <div class="prop-items" data-prefix="${prefix}" data-element-id="${element.id}" data-prop-name="${escapeHtml(prop.name)}" data-fields="${escapeHtml(JSON.stringify(prop.items))}">
          ${items.map(item => itemRow(prop.items, item)).join('')}
          <button type="button" class="given-entry-btn prop-item-add" onclick="window.EventPad.propItemAdd(this)">＋ item</button>
        </div>
      </div>`;
    }
    const value = escapeHtml(raw !== null && typeof raw === 'object' ? JSON.stringify(raw) : raw);
    const inputType = prop.type === 'number' || prop.type === 'decimal' ? 'number' : 'text';
    const placeholder = prop.type === 'array' && prop.items?.length
      ? `[{ ${prop.items.map(f => `"${f}": …`).join(', ')} }]`
      : `${prop.name} (${prop.type})`;

    return `
      <div class="property-input-row">
        <label>${propLabel(prop)}</label>
        <input type="${inputType}"${inputType === 'number' ? ' step="any" inputmode="decimal"' : ''}
               class="property-value-input"
               data-prefix="${prefix}"
               data-element-id="${element.id}"
               data-prop-name="${prop.name}"
               placeholder="${placeholder}"
               value="${value}">
      </div>
    `;
  }).join('');
}

// One item of a list property: a small field per item field, and ✕
const fieldKey = f => String(f).split(':')[0].trim();
function itemRow(fields, item = {}) {
  return `
    <div class="prop-item">
      ${fields.map(f => `<input type="text" class="prop-item-field" data-field="${escapeHtml(fieldKey(f))}" placeholder="${escapeHtml(fieldKey(f))}" value="${escapeHtml(item[fieldKey(f)] ?? '')}" autocapitalize="off" autocorrect="off" spellcheck="false">`).join('')}
      <button type="button" class="given-entry-btn" onclick="this.closest('.prop-item').remove()" aria-label="Remove item">✕</button>
    </div>`;
}

export function propItemAdd(button) {
  const block = button.closest('.prop-items');
  button.insertAdjacentHTML('beforebegin', itemRow(JSON.parse(block.dataset.fields)));
  button.previousElementSibling.querySelector('input')?.focus();
}

// Values in a part of the sheet: the plain inputs, plus each list property's items
function readValues(root, match = '') {
  const values = readInputs(root.querySelectorAll(`input.property-value-input${match}`));
  root.querySelectorAll(`.prop-items${match}`).forEach(block => {
    const items = [...block.querySelectorAll('.prop-item')].map(row => {
      const item = {};
      row.querySelectorAll('input[data-field]').forEach(i => {
        const v = i.value.trim();
        if (v) item[i.dataset.field] = /^-?\d+(\.\d+)?$/.test(v) && !/^0\d/.test(v) ? Number(v) : v;
      });
      return item;
    }).filter(item => Object.keys(item).length);
    if (items.length) values[block.dataset.propName] = items;
  });
  return values;
}

// Values typed into property inputs: numbers, true/false, JSON lists and objects
function readInputs(inputs) {
  const values = {};
  inputs.forEach(input => {
    const val = input.value.trim();
    if (!val) return;
    const key = input.dataset.propName;
    if (input.type === 'number') values[key] = parseFloat(val);
    else if (val === 'true') values[key] = true;
    else if (val === 'false') values[key] = false;
    else {
      try { values[key] = /^[\[{]/.test(val) ? JSON.parse(val) : val; } catch (e) { values[key] = val; }
    }
  });
  return values;
}

// Get values from property inputs
function getPropertyValues(prefix, elementId) {
  return readValues(document, `[data-prefix="${prefix}"][data-element-id="${elementId}"]`);
}

// ===========================================
// ADD SCENARIO SHEET
// ===========================================

export function openAddScenarioSheet(sliceId, sliceType) {
  editingSliceId = sliceId;
  editingSliceType = sliceType;

  document.getElementById('addScenarioTitle').textContent = 'Add a scenario';
  document.getElementById('scenarioNameInput').value = '';
  document.getElementById('scenarioTypeHint').textContent = sliceType === 'SC' ? 'Given / When / Then' : 'Given / Then';

  showSheet('addScenarioSheet');
  setTimeout(() => document.getElementById('scenarioNameInput').focus(), 300);
}

export function submitAddScenario() {
  const name = document.getElementById('scenarioNameInput').value.trim();
  if (!name || !editingSliceId) {
    showToast('Enter a scenario name');
    return;
  }

  // A draft: it's only added when the editor saves, so cancelling leaves nothing behind
  const slice = projectState().slices[editingSliceId];
  const draft = { id: null, draft: true, sliceId: editingSliceId, name, type: editingSliceType, given: [], when: null, then: null };
  hideAllSheets();
  if (slice) setTimeout(() => openEditScenarioSheet(draft, slice), 100);
}

// ===========================================
// EDIT SCENARIO SHEET
// ===========================================

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Every event: this slice's own first, then the rest A to Z, each saying where it lives
function givenCandidates(slice, state) {
  const seen = new Set();
  const out = [];
  const take = (id, where) => {
    const el = state.elements[id];
    if (el?.type !== 'event' || seen.has(id)) return;
    seen.add(id);
    out.push({ ...el, where });
  };
  slice.elements.forEach(id => take(id, ''));
  getOrderedSlices(state).forEach(s => {
    const chapter = s.chapterId && state.chapters[s.chapterId]?.name;
    s.elements.forEach(id => take(id, [chapter, s.name].filter(Boolean).join(' · ')));
  });
  Object.keys(state.elements).forEach(id => take(id, 'not on the board'));
  const own = new Set(slice.elements);
  return [...out.filter(e => own.has(e.id)).sort(byName), ...out.filter(e => !own.has(e.id)).sort(byName)];
}

let givenEntries = [];  // [{ elementId, values }] in order
let givenPool = [];     // events that can be added, with where they live

function renderGiven() {
  const state = editingState || projectState();
  const list = document.getElementById('givenEventsList');
  const entries = givenEntries.map((g, i) => {
    const el = state.elements[g.elementId];
    if (!el) return '';
    return `
      <div class="given-entry" data-index="${i}">
        <div class="given-entry-head">
          <span class="given-entry-name">${typeIcons.event} ${escapeHtml(el.name)}</span>
          <button class="given-entry-btn" onclick="window.EventPad.givenAgain(${i})" aria-label="Add ${escapeHtml(el.name)} again">＋ again</button>
          <button class="given-entry-btn" onclick="window.EventPad.givenRemove(${i})" aria-label="Remove">✕</button>
        </div>
        <div class="property-inputs">${renderPropertyInputs(el, g.values, 'given')}</div>
      </div>`;
  }).join('');
  const chips = givenPool.map(e => `
    <button class="bd-chip" data-type="event"${e.external ? ' data-external="true"' : ''} data-key="${escapeHtml(e.name.toLowerCase())}" onclick="window.EventPad.givenAdd('${e.id}')">
      ${escapeHtml(e.name)}${e.where ? `<span class="bd-chip-used">${escapeHtml(e.where)}</span>` : ''}
    </button>`).join('');
  list.innerHTML = `
    ${entries || '<p class="property-hint">Nothing happened before: add events below.</p>'}
    <div class="given-add">
      <div class="given-add-label">Add an event${givenEntries.length ? ' (again, for another example)' : ''}</div>
      ${givenPool.length > 8 ? `<input type="text" class="sheet-input given-search" id="givenSearch" placeholder="Search events" autocomplete="off">` : ''}
      <div class="bd-chips" id="givenChips">${chips || '<p class="empty">No events yet</p>'}</div>
    </div>`;
  const search = document.getElementById('givenSearch');
  if (search) search.oninput = () => {
    const q = search.value.trim().toLowerCase();
    list.querySelectorAll('#givenChips .bd-chip').forEach(c => { c.hidden = !!q && !c.dataset.key.includes(q); });
  };
}

// Keep what's typed before the list re-renders
function captureGiven() {
  document.querySelectorAll('#givenEventsList .given-entry').forEach(entry => {
    const g = givenEntries[Number(entry.dataset.index)];
    if (g) g.values = readValues(entry);
  });
}

export function givenAdd(eventId) {
  captureGiven();
  givenEntries.push({ elementId: eventId, values: {} });
  renderGiven();
  document.querySelector('#givenEventsList .given-entry:last-of-type input')?.focus();
}

export function givenAgain(index) {
  captureGiven();
  const g = givenEntries[index];
  if (!g) return;
  givenEntries.splice(index + 1, 0, { elementId: g.elementId, values: { ...g.values } });
  renderGiven();
}

export function givenRemove(index) {
  captureGiven();
  givenEntries.splice(index, 1);
  renderGiven();
}

export function openEditScenarioSheet(scenario, slice) {
  editingScenarioId = scenario.id;
  editingSliceId = slice.id;
  editingSliceType = scenario.type;
  editingScenario = scenario;
  editingState = projectState();

  const state = editingState;
  const sliceElements = slice.elements.map(id => state.elements[id]).filter(Boolean);

  // Given can be any event in the model, whatever chapter it's in: this
  // slice's own first, then the rest in board order
  const events = givenCandidates(slice, state);
  const commands = sliceElements.filter(e => e.type === 'command').sort(byName);
  const readModels = sliceElements.filter(e => e.type === 'readModel').sort(byName);

  // Title
  // The title is the name, editable in place
  document.getElementById('editScenarioTitle').value = scenario.name || '';
  const must = document.getElementById('editScenarioMust');
  if (must) must.checked = !!scenario.mustHave;

  // GIVEN - the events that happened before, in order. The same event can be
  // given more than once, each with its own example values.
  // Events deleted since were "(removed)"; they drop out here, so saving cleans them up
  givenEntries = (scenario.given || []).filter(g => state.elements[g.elementId])
    .map(g => ({ elementId: g.elementId, values: { ...(g.values || {}) } }));
  givenPool = events;
  renderGiven();

  // WHEN - command select with property inputs (SC only)
  const whenSection = document.getElementById('whenSection');
  if (scenario.type === 'SC') {
    whenSection.style.display = 'block';

    // A slice with one command: that's the When, unless one was chosen already
    const selectedCmd = commands.find(c => c.id === scenario.when?.commandId)
      || (!scenario.when?.commandId && commands.length === 1 ? commands[0] : null);
    const whenValues = scenario.when?.values || {};

    whenSection.innerHTML = `
      <div class="section-label">WHEN</div>
      <select class="sheet-input" id="whenCommandSelect" style="padding: 12px;"
              onchange="window.EventPad.selectWhenCommand(this.value)">
        <option value="">Select command...</option>
        ${commands.map(c => `
          <option value="${c.id}" ${selectedCmd?.id === c.id ? 'selected' : ''}>
            ${typeIcons.command} ${c.name}
          </option>
        `).join('')}
      </select>
      <div class="property-inputs ${selectedCmd ? '' : 'hidden'}" id="when-props">
        ${selectedCmd ? renderPropertyInputs(selectedCmd, whenValues, 'when') : ''}
      </div>
    `;
  } else {
    whenSection.style.display = 'none';
  }

  // THEN - different for SC vs SV
  const thenOptions = document.getElementById('thenOptions');
  if (scenario.type === 'SC') {
    const isEvent = scenario.then?.type === 'event';
    const isRejection = scenario.then?.type === 'rejection';
    const selectedEvent = isEvent ? events.find(e => e.id === scenario.then?.eventId) : null;
    const thenValues = scenario.then?.values || {};

    thenOptions.innerHTML = `
      <div class="then-type-toggle">
        <label class="radio-item ${isEvent || !scenario.then ? 'selected' : ''}">
          <input type="radio" name="thenType" value="event" ${isEvent || !scenario.then ? 'checked' : ''}
                 onchange="window.EventPad.selectThenType('event')">
          <span>✅ Event</span>
        </label>
        <label class="radio-item ${isRejection ? 'selected' : ''}">
          <input type="radio" name="thenType" value="rejection" ${isRejection ? 'checked' : ''}
                 onchange="window.EventPad.selectThenType('rejection')">
          <span>❌ Rejection</span>
        </label>
      </div>

      <div id="thenEventSection" style="${isRejection ? 'display:none' : ''}">
        <select class="sheet-input" id="thenEventSelect" style="padding: 12px; margin-top: 12px;"
                onchange="window.EventPad.selectThenEvent(this.value)">
          <option value="">Select event...</option>
          ${events.map(e => `
            <option value="${e.id}" ${scenario.then?.eventId === e.id ? 'selected' : ''}>
              ${typeIcons.event} ${e.name}
            </option>
          `).join('')}
        </select>
        <div class="property-inputs ${selectedEvent ? '' : 'hidden'}" id="then-event-props">
          ${selectedEvent ? renderPropertyInputs(selectedEvent, thenValues, 'then-event') : ''}
        </div>
      </div>

      <div id="thenRejectionSection" style="${isRejection ? '' : 'display:none'}">
        <input type="text" class="sheet-input" id="rejectionReasonInput"
               placeholder="Rejection reason..." value="${scenario.then?.reason || ''}"
               style="margin-top: 12px;">
      </div>
    `;
  } else {
    // SV - read model with property inputs
    const selectedRM = readModels.find(rm => rm.id === scenario.then?.readModelId);
    const thenValues = scenario.then?.values || {};

    thenOptions.innerHTML = `
      <select class="sheet-input" id="thenReadModelSelect" style="padding: 12px;"
              onchange="window.EventPad.selectThenReadModel(this.value)">
        <option value="">Select read model...</option>
        ${readModels.map(rm => `
          <option value="${rm.id}" ${scenario.then?.readModelId === rm.id ? 'selected' : ''}>
            ${typeIcons.readModel} ${rm.name}
          </option>
        `).join('')}
      </select>
      <div class="property-inputs ${selectedRM ? '' : 'hidden'}" id="then-rm-props">
        ${selectedRM ? renderPropertyInputs(selectedRM, thenValues, 'then-rm') : ''}
      </div>
    `;
    // A list read model: its example rows, one by one
    thenRows = selectedRM && isList(selectedRM)
      ? (scenario.then?.rows?.length ? scenario.then.rows.map(r => ({ ...r })) : [{}]) : [];
    if (selectedRM && isList(selectedRM)) renderThenRows(selectedRM);
  }

  showSheet('editScenarioSheet');
}

// Toggle Given event selection and show/hide properties
export function toggleGivenEvent(eventId, checked) {
  const container = document.querySelector(`.given-event-item[data-event-id="${eventId}"]`);
  const propsDiv = document.getElementById(`given-props-${eventId}`);

  if (container) container.classList.toggle('selected', checked);
  if (propsDiv) propsDiv.classList.toggle('hidden', !checked);
}

// Select When command and show properties
export function selectWhenCommand(commandId) {
  const propsDiv = document.getElementById('when-props');
  if (!commandId) {
    propsDiv.classList.add('hidden');
    propsDiv.innerHTML = '';
    return;
  }

  const command = editingState.elements[commandId];
  if (command) {
    propsDiv.innerHTML = renderPropertyInputs(command, {}, 'when');
    propsDiv.classList.remove('hidden');
  }
}

// Select Then type (event/rejection)
export function selectThenType(type) {
  document.getElementById('thenEventSection').style.display = type === 'event' ? '' : 'none';
  document.getElementById('thenRejectionSection').style.display = type === 'rejection' ? '' : 'none';

  document.querySelectorAll('.then-type-toggle .radio-item').forEach(item => {
    item.classList.toggle('selected', item.querySelector('input').value === type);
  });
}

// Select Then event and show properties
export function selectThenEvent(eventId) {
  const propsDiv = document.getElementById('then-event-props');
  if (!eventId) {
    propsDiv.classList.add('hidden');
    propsDiv.innerHTML = '';
    return;
  }

  const event = editingState.elements[eventId];
  if (event) {
    propsDiv.innerHTML = renderPropertyInputs(event, {}, 'then-event');
    propsDiv.classList.remove('hidden');
  }
}

// Select Then read model and show properties
export function selectThenReadModel(rmId) {
  const propsDiv = document.getElementById('then-rm-props');
  if (!rmId) {
    propsDiv.classList.add('hidden');
    propsDiv.innerHTML = '';
    return;
  }

  const rm = editingState.elements[rmId];
  if (rm) {
    propsDiv.classList.remove('hidden');
    if (isList(rm)) { thenRows = [{}]; renderThenRows(rm); }
    else propsDiv.innerHTML = renderPropertyInputs(rm, {}, 'then-rm');
  }
}

// ---------- A list read model's rows ----------

let thenRows = [];  // [{ prop: value }] for the read model in Then, when it's a list

const isList = rm => rm?.type === 'readModel' && (rm.list || rm.todo);

function renderThenRows(rm) {
  const div = document.getElementById('then-rm-props');
  div.innerHTML = thenRows.map((row, i) => `
    <div class="given-entry then-row" data-row="${i}">
      <div class="given-entry-head">
        <span class="given-entry-name">Row ${i + 1}</span>
        <button class="given-entry-btn" onclick="window.EventPad.thenRowRemove(${i})" aria-label="Remove row">✕</button>
      </div>
      <div class="property-inputs">${renderPropertyInputs(rm, row, 'then-row')}</div>
    </div>`).join('') + `<button class="given-entry-btn then-row-add" onclick="window.EventPad.thenRowAdd()">＋ row</button>`;
}

function captureThenRows() {
  document.querySelectorAll('#then-rm-props .then-row').forEach(el => {
    const i = Number(el.dataset.row);
    if (thenRows[i]) thenRows[i] = readValues(el);
  });
}

export function thenRowAdd() {
  captureThenRows();
  const rm = editingState.elements[document.getElementById('thenReadModelSelect')?.value];
  if (!rm) return;
  thenRows.push({});
  renderThenRows(rm);
}

export function thenRowRemove(index) {
  captureThenRows();
  const rm = editingState.elements[document.getElementById('thenReadModelSelect')?.value];
  if (!rm) return;
  thenRows.splice(index, 1);
  renderThenRows(rm);
}

export function saveScenario() {
  if (!editingScenarioId && !editingScenario?.draft) return;

  // Name, if it was changed in the title
  const newName = document.getElementById('editScenarioTitle')?.value.trim();
  if (editingScenario?.draft) editingScenarioId = addScenario(editingSliceId, newName || editingScenario.name, editingSliceType);
  else if (newName && newName !== editingScenario?.name) renameScenario(editingScenarioId, newName);
  const must = !!document.getElementById('editScenarioMust')?.checked;
  if (must !== !!editingScenario?.mustHave) setMustHave(editingScenarioId, must);

  // Save Given - every entry in order, repeats included
  captureGiven();
  setGiven(editingScenarioId, givenEntries.map(g => ({ elementId: g.elementId, values: g.values })));

  // Save When (SC only)
  if (editingSliceType === 'SC') {
    const commandSelect = document.getElementById('whenCommandSelect');
    if (commandSelect?.value) {
      const values = getPropertyValues('when', commandSelect.value);
      setWhen(editingScenarioId, commandSelect.value, values);
    }
  }

  // Save Then
  if (editingSliceType === 'SC') {
    const thenType = document.querySelector('input[name="thenType"]:checked')?.value;
    if (thenType === 'event') {
      const eventSelect = document.getElementById('thenEventSelect');
      if (eventSelect?.value) {
        const values = getPropertyValues('then-event', eventSelect.value);
        setThenEvent(editingScenarioId, eventSelect.value, values);
      }
    } else if (thenType === 'rejection') {
      const reason = document.getElementById('rejectionReasonInput')?.value?.trim();
      if (reason) {
        setThenRejection(editingScenarioId, reason);
      }
    }
  } else {
    const rmSelect = document.getElementById('thenReadModelSelect');
    if (rmSelect?.value) {
      const rm = editingState.elements[rmSelect.value];
      if (isList(rm)) {
        captureThenRows();
        setThenReadModel(editingScenarioId, rmSelect.value, {}, thenRows.filter(r => Object.keys(r).length));
      } else {
        setThenReadModel(editingScenarioId, rmSelect.value, getPropertyValues('then-rm', rmSelect.value));
      }
    }
  }

  editingScenarioId = null;
  editingSliceId = null;
  editingSliceType = null;
  editingScenario = null;
  editingState = null;

  hideAllSheets();
  showToast('Scenario saved');
  render();
}

export function deleteScenario(button) {
  // A draft was never added: just let it go
  if (editingScenario?.draft) { editingScenario = null; hideAllSheets(); return; }
  if (!editingScenarioId || !editingSliceId) return;
  if (!secondTap(button, 'Tap again')) return;


  deleteScenarioCmd(editingScenarioId, editingSliceId);

  editingScenarioId = null;
  editingSliceId = null;
  editingSliceType = null;
  editingScenario = null;
  editingState = null;

  hideAllSheets();
  toastWithUndo('Scenario deleted');
  render();
}

// ===========================================
// INIT
// ===========================================

export function initScenarios() {
  const nameInput = document.getElementById('scenarioNameInput');
  if (nameInput) {
    nameInput.onkeydown = (e) => {
      if (e.key === 'Enter') submitAddScenario();
    };
  }
}
