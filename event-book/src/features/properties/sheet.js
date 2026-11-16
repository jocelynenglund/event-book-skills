// ===========================================
// PROPERTIES - Edit Element Properties
// One sheet per element: lists every property (tap to edit or delete), adds
// several at once ("orderId, drink, size:number"), stays open while you add,
// and suggests fields from connected elements.
// It reads the book only through its views (propertyListRows, propertyEditForm, propertySuggestions,
// propertyCopyTargets, propertyCopyPlan, propertyDownstreamTargets, propertyNames) and draws from
// properties.parts.js; here is the sheet's state, its commands and its taps.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { addProperty } from './command.js';
import { projectState } from '../../core/projections.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { splitArrayName, splitItemFields, parsePropertyText } from '../../core/constants.js';
import { isReadOnly, openElementReadSheet } from '../readOnly/sheet.js';
import { propertyListRows } from './propertyListRows.read.js';
import { propertyEditForm } from './propertyEditForm.read.js';
import { propertyNames } from './propertyNames.read.js';
import { propertySuggestions } from './propertySuggestions.read.js';
import { propertyCopyTargets } from './propertyCopyTargets.read.js';
import { propertyCopyPlan } from './propertyCopyPlan.read.js';
import { propertyDownstreamTargets } from './propertyDownstreamTargets.read.js';
import { propertiesSheetBody } from './properties.parts.js';

let editingElementId = null;
let editingPropertyId = null;
let addedThisSession = [];   // property ids added since the sheet opened, offered downstream on Done
let addType = 'string';
let copyTargets = new Set();   // connected elements ticked for Copy / Replace
let addOpen = false;           // the add box is open (no keyboard until asked for)

// The book as the sheet last looked at it: read afresh whenever the sheet draws or a tap needs it
let book = null;
const load = () => (book = projectState());

export function openPropertySheet(elementId, propertyId = null) {
  if (isReadOnly()) { openElementReadSheet(elementId); return; }   // not checked out here: read it
  const list = propertyListRows(load(), elementId);
  if (!list) return;
  editingElementId = elementId;
  editingPropertyId = propertyId;
  addedThisSession = [];
  // Copy targets start as the natural ones (a command's events, an event's read models…)
  copyTargets = new Set(propertyDownstreamTargets(book, elementId));
  // With properties already, open to read them; the add box (and keyboard) only on request
  addOpen = !propertyId && !list.rows.length;
  renderPropertySheet();
  showSheet('propertySheet');
  const focus = propertyId ? 'prEditName' : addOpen ? 'prAddInput' : null;
  if (focus) setTimeout(() => document.getElementById(focus)?.focus(), 300);
}

function renderPropertySheet() {
  load();
  const list = propertyListRows(book, editingElementId, editingPropertyId);
  const container = document.getElementById('propertySheetContent');
  if (!list || !container) return;

  // Read first: what it has, then adding (opened on request, so no keyboard), then copying
  const form = propertyEditForm(book, editingElementId, editingPropertyId);
  const adding = !form && addOpen ? { type: addType } : null;
  container.innerHTML = propertiesSheetBody({
    list, form, adding,
    suggestions: adding ? propertySuggestions(book, editingElementId) : [],
    copy: form ? null : propertyCopyTargets(book, editingElementId, copyTargets)
  });

  const addInput = document.getElementById('prAddInput');
  if (addInput) addInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); saveProperty(); } };
  const editInput = document.getElementById('prEditName');
  if (editInput) editInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); updateProperty(); } };
  const typeSel = document.getElementById('prEditType');
  if (typeSel) typeSel.onchange = () => { document.getElementById('prItemsRow').hidden = typeSel.value !== 'array'; };
}

function addProperties(items) {
  items.forEach(({ name, type, items: fields }) => {
    addedThisSession.push(addProperty(editingElementId, name, type, fields || null));
  });
}

// Add from the input (Enter or Add). The sheet stays open for the next batch.
export function saveProperty() {
  const names = propertyNames(load(), editingElementId);
  const input = document.getElementById('prAddInput');
  if (!names || !input) return;
  addType = document.getElementById('prAddType')?.value || addType;

  const { parsed, skipped } = parsePropertyText(input.value, addType, names);
  if (!parsed.length && !skipped) return;
  addProperties(parsed);

  const msg = [parsed.length ? `${parsed.length} added` : '', skipped ? `${skipped} already there` : ''].filter(Boolean).join(' · ');
  showToast(msg);
  render();
  renderPropertySheet();
  document.getElementById('prAddInput')?.focus();
}

function addSuggested(names) {
  if (!propertyNames(load(), editingElementId)) return;
  addProperties(names);
  showToast(`${names.length} added`);
  render();
  renderPropertySheet();
}

function updateProperty() {
  const typed = splitItemFields(document.getElementById('prEditName')?.value || '');
  const split = splitArrayName(typed.text);
  const name = split.name;
  const propertyType = split.array || typed.items ? 'array' : (document.getElementById('prEditType')?.value || 'string');
  const itemsText = document.getElementById('prEditItems')?.value || '';
  const fields = propertyType !== 'array' ? []
    : typed.items || itemsText.split(',').map(t => t.trim()).filter(Boolean);
  const generated = !!document.getElementById('prEditGenerated')?.checked;
  if (!name || !editingElementId || !editingPropertyId) return;
  const current = propertyEditForm(load(), editingElementId, editingPropertyId);

  if (current && (current.name !== name || current.type !== propertyType
      || current.items.join('|') !== fields.join('|'))) {
    appendEvent('PropertyUpdated', {
      elementId: editingElementId,
      propertyId: editingPropertyId,
      name,
      propertyType,
      items: fields.length ? fields : null
    });
  }
  if (current && current.generated !== generated) {
    appendEvent(EventTypes.PropertyGeneratedSet, { elementId: editingElementId, propertyId: editingPropertyId, generated });
  }
  editingPropertyId = null;
  showToast('Property updated');
  render();
  renderPropertySheet();
}

export function deleteProperty() {
  if (!editingElementId || !editingPropertyId) return;

  if (!confirm('Delete this property?')) return;

  appendEvent(EventTypes.PropertyRemoved, {
    elementId: editingElementId,
    propertyId: editingPropertyId
  });

  editingPropertyId = null;
  showToast('Property deleted');
  render();
  renderPropertySheet();
}

// Close. No second "copy to events?" prompt: the sheet's own Copy section does that.
function finish() {
  editingElementId = null;
  editingPropertyId = null;
  addedThisSession = [];
  hideAllSheets();
  render();
}

function handleSheetClick(e) {
  const t = e.target.closest('[data-prop-action]');
  if (!t) return;
  const a = t.dataset.propAction;
  if (a === 'edit') {
    editingPropertyId = t.dataset.prop === editingPropertyId ? null : t.dataset.prop;
    renderPropertySheet();
    if (editingPropertyId) document.getElementById('prEditName')?.focus();
  } else if (a === 'open-add') {
    addOpen = true;
    renderPropertySheet();
    document.getElementById('prAddInput')?.focus();
  } else if (a === 'add') saveProperty();
  else if (a === 'update') updateProperty();
  else if (a === 'delete') deleteProperty();
  else if (a === 'cancel') { editingPropertyId = null; renderPropertySheet(); }
  else if (a === 'suggest') addSuggested([{ name: t.dataset.name, type: t.dataset.type }]);
  else if (a === 'add-all') addSuggested(propertySuggestions(load(), editingElementId).map(s => ({ name: s.name, type: s.type })));
  else if (a === 'copy-target') {
    copyTargets.has(t.dataset.el) ? copyTargets.delete(t.dataset.el) : copyTargets.add(t.dataset.el);
    renderPropertySheet();
  } else if (a === 'copy') copyToTargets(false);
  else if (a === 'replace') copyToTargets(true);
  else if (a === 'done') finish();
}

// Copy (merge, same name overwritten) or replace (clear first) the properties of
// the ticked connected elements with this element's
function copyToTargets(replace) {
  const plan = propertyCopyPlan(load(), editingElementId, copyTargets, replace);
  if (!plan) return;
  if (replace && !confirm(`Replace the properties of ${plan.names.join(', ')}?`)) return;

  // Generated properties don't travel: the source's aren't copied, and Replace
  // keeps the target's own generated ones
  if (!plan.copyable.length) { showToast('Nothing to copy: these are all generated'); return; }

  plan.targets.forEach(target => {
    target.remove.forEach(propertyId => appendEvent(EventTypes.PropertyRemoved, { elementId: target.id, propertyId }));
    plan.copyable.forEach((p, i) => {
      if (target.sameAs[i]) {
        appendEvent('PropertyUpdated', { elementId: target.id, propertyId: target.sameAs[i], name: p.name, propertyType: p.type, items: p.items });
      } else {
        appendEvent(EventTypes.PropertyAdded, {
          elementId: target.id,
          propertyId: 'prop_' + Date.now() + '_' + i + '_' + target.id,
          name: p.name,
          propertyType: p.type,
          ...(p.items ? { items: p.items } : {})
        });
      }
    });
  });

  // Already copied deliberately: closing the sheet shouldn't ask again
  addedThisSession = [];
  showToast(`${replace ? 'Replaced on' : 'Copied to'} ${plan.targets.length} element${plan.targets.length === 1 ? '' : 's'}`);
  render();
  renderPropertySheet();
}

// Initialize
export function initProperties() {
  document.getElementById('propertySheetContent')?.addEventListener('click', handleSheetClick);
  // Tapping outside closes the sheet like Done does, so the copy offer still appears
  const overlay = document.getElementById('propertySheet');
  overlay?.addEventListener('click', e => {
    if (e.target === overlay && editingElementId) finish();
  });
}
