// ===========================================
// SCENARIOS - UI Sheets
// The editor reads the book only through its views (scenarioEditorChoices, scenarioGivenPool, scenarioGivenRows,
// scenarioGivenEntries, scenarioElementFields) and draws from scenarioEditor.parts.js; here is the sheet's state,
// what is typed, and its commands.
// ===========================================

import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { projectState } from '../../core/projections.js';
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
  setThenNothing,
  setThenReadModel,
  renameScenario,
  setMustHave
} from './command.js';
import { scenarioEditorChoices } from './scenarioEditorChoices.read.js';
import { scenarioGivenPool } from './scenarioGivenPool.read.js';
import { scenarioGivenRows } from './scenarioGivenRows.read.js';
import { scenarioGivenEntries } from './scenarioGivenEntries.read.js';
import { scenarioElementFields } from './scenarioElementFields.read.js';
import { scenarioThenRows } from './scenarioThenRows.read.js';
import { valueItemRow, valueInputs, givenSection, whenCommandChoice, thenOutcomeChoice, thenReadModelChoice, thenRowList } from './scenarioEditor.parts.js';

// ===========================================
// STATE
// ===========================================

let editingSliceId = null;
let editingSliceType = null;
let editingScenarioId = null;
let editingScenario = null;

// The book as the editor was opened on it (what its views read)
let book = null;
const load = () => (book = projectState());

// ===========================================
// HELPERS
// ===========================================

export function propItemAdd(button) {
  const block = button.closest('.prop-items');
  button.insertAdjacentHTML('beforebegin', valueItemRow(JSON.parse(block.dataset.fields)));
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
  const sliceId = editingSliceId;
  const draft = { id: null, draft: true, sliceId, name, type: editingSliceType, given: [], when: null, then: null };
  const sliceIsThere = !!scenarioEditorChoices(load(), sliceId, draft);
  hideAllSheets();
  if (sliceIsThere) setTimeout(() => openEditScenarioSheet(draft, { id: sliceId }), 100);
}

// ===========================================
// EDIT SCENARIO SHEET
// ===========================================

let givenEntries = [];  // [{ elementId, values }] in order
let givenPool = [];     // events that can be added, with where they live

function renderGiven() {
  const list = document.getElementById('givenEventsList');
  list.innerHTML = givenSection(scenarioGivenRows(book, givenEntries), givenPool);
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
  const choices = scenarioEditorChoices(load(), slice.id, scenario);
  if (!choices) return;
  editingScenarioId = scenario.id;
  editingSliceId = slice.id;
  editingSliceType = scenario.type;
  editingScenario = scenario;

  // The title is the name, editable in place
  document.getElementById('editScenarioTitle').value = scenario.name || '';
  const must = document.getElementById('editScenarioMust');
  if (must) must.checked = !!scenario.mustHave;

  // GIVEN - the events that happened before, in order. The same event can be
  // given more than once, each with its own example values. Given can be any event in the
  // model, whatever chapter it's in: this slice's own first, then the rest.
  givenEntries = scenarioGivenEntries(book, scenario);
  givenPool = scenarioGivenPool(book, slice.id);
  renderGiven();

  // WHEN - command select with property inputs (SC only)
  const whenSection = document.getElementById('whenSection');
  if (choices.type === 'SC') {
    whenSection.style.display = 'block';
    whenSection.innerHTML = whenCommandChoice(choices.when);
  } else {
    whenSection.style.display = 'none';
  }

  // THEN - different for SC vs SV
  const thenOptions = document.getElementById('thenOptions');
  if (choices.type === 'SC') {
    thenOptions.innerHTML = thenOutcomeChoice(choices.then);
  } else {
    // SV - read model with property inputs; a list read model: its example rows, one by one
    thenOptions.innerHTML = thenReadModelChoice(choices.then);
    thenRows = choices.then.rows;
    if (choices.then.inputs?.isList) renderThenRows(choices.then.selectedId);
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

  const command = scenarioElementFields(book, commandId, 'when');
  if (command) {
    propsDiv.innerHTML = valueInputs(command);
    propsDiv.classList.remove('hidden');
  }
}

// Select Then type (event/rejection)
export function selectThenType(type) {
  document.getElementById('thenEventSection').style.display = type === 'event' ? '' : 'none';
  document.getElementById('thenRejectionSection').style.display = type === 'rejection' ? '' : 'none';
  document.getElementById('thenNothingSection').style.display = type === 'nothing' ? '' : 'none';

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

  const event = scenarioElementFields(book, eventId, 'then-event');
  if (event) {
    propsDiv.innerHTML = valueInputs(event);
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

  const rm = scenarioElementFields(book, rmId, 'then-rm');
  if (rm) {
    propsDiv.classList.remove('hidden');
    if (rm.isList) { thenRows = [{}]; renderThenRows(rmId); }
    else propsDiv.innerHTML = valueInputs(rm);
  }
}

// ---------- A list read model's rows ----------

let thenRows = [];  // [{ prop: value }] for the read model in Then, when it's a list

function renderThenRows(readModelId) {
  const list = scenarioThenRows(book, readModelId, thenRows);
  if (list) document.getElementById('then-rm-props').innerHTML = thenRowList(list);
}

function captureThenRows() {
  document.querySelectorAll('#then-rm-props .then-row').forEach(el => {
    const i = Number(el.dataset.row);
    if (thenRows[i]) thenRows[i] = readValues(el);
  });
}

export function thenRowAdd() {
  captureThenRows();
  const rmId = document.getElementById('thenReadModelSelect')?.value;
  if (!scenarioThenRows(book, rmId, [])) return;
  thenRows.push({});
  renderThenRows(rmId);
}

export function thenRowRemove(index) {
  captureThenRows();
  const rmId = document.getElementById('thenReadModelSelect')?.value;
  if (!scenarioThenRows(book, rmId, [])) return;
  thenRows.splice(index, 1);
  renderThenRows(rmId);
}

export function saveScenario() {
  if (!editingScenarioId && !editingScenario?.draft) return;

  // Then nothing needs its reason: say so before anything is saved
  if (editingSliceType === 'SC' && document.querySelector('input[name="thenType"]:checked')?.value === 'nothing'
      && !document.getElementById('nothingReasonInput')?.value?.trim()) {
    showToast('nothing needs a reason: one line saying why nothing happens');
    return;
  }

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
    } else if (thenType === 'nothing') {
      setThenNothing(editingScenarioId, document.getElementById('nothingReasonInput').value.trim());
    } else if (thenType === 'rejection') {
      const reason = document.getElementById('rejectionReasonInput')?.value?.trim();
      if (reason) {
        setThenRejection(editingScenarioId, reason);
      }
    }
  } else {
    const rmSelect = document.getElementById('thenReadModelSelect');
    if (rmSelect?.value) {
      if (scenarioElementFields(book, rmSelect.value)?.isList) {
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
