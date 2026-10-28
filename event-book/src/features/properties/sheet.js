// ===========================================
// PROPERTIES - Edit Element Properties
// One sheet per element: lists every property (tap to edit or delete), adds
// several at once ("orderId, drink, size:number"), stays open while you add,
// and suggests fields from connected elements.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { addProperty } from './command.js';
import { projectState } from '../../core/projections.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { escapeHtml } from '../board/view.js';
import { externalAttr, propLabel, splitArrayName, splitItemFields, byName, propertyTypes, parsePropertyText } from '../../core/constants.js';
import { isReadOnly, openElementReadSheet } from '../readOnly/sheet.js';


let editingElementId = null;
let editingPropertyId = null;
let addedThisSession = [];   // property ids added since the sheet opened, offered downstream on Done
let addType = 'string';
let pendingPropagation = null; // { propNames, fromElementId }
let copyTargets = new Set();   // connected elements ticked for Copy / Replace
let addOpen = false;           // the add box is open (no keyboard until asked for)

export function openPropertySheet(elementId, propertyId = null) {
  if (isReadOnly()) { openElementReadSheet(elementId); return; }   // not checked out here: read it
  if (!projectState().elements[elementId]) return;
  editingElementId = elementId;
  editingPropertyId = propertyId;
  addedThisSession = [];
  // Copy targets start as the natural ones (a command's events, an event's read models…)
  copyTargets = new Set(getDownstreamElements(elementId).map(e => e.id));
  // With properties already, open to read them; the add box (and keyboard) only on request
  addOpen = !propertyId && !projectState().elements[elementId].properties.length;
  renderPropertySheet();
  showSheet('propertySheet');
  const focus = propertyId ? 'prEditName' : addOpen ? 'prAddInput' : null;
  if (focus) setTimeout(() => document.getElementById(focus)?.focus(), 300);
}

// Property names on elements connected to this one that it doesn't have yet
function getSuggestions(state, element) {
  const have = new Set(element.properties.map(p => p.name.toLowerCase()));
  const seen = new Set();
  const out = [];
  state.connections
    .filter(c => c.from === element.id || c.to === element.id)
    .map(c => state.elements[c.from === element.id ? c.to : c.from])
    .filter(Boolean)
    .forEach(other => other.properties.filter(p => !p.generated).forEach(p => {
      const key = p.name.toLowerCase();
      if (have.has(key) || seen.has(key)) return;
      seen.add(key);
      out.push({ name: p.name, type: p.type || 'string', from: other.name });
    }));
  return out;
}

function typeSelect(id, selected) {
  return `<select class="sheet-input pr-type-select" id="${id}">
    ${propertyTypes.map(t => `<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`).join('')}
  </select>`;
}

function renderPropertySheet() {
  const state = projectState();
  const element = state.elements[editingElementId];
  const container = document.getElementById('propertySheetContent');
  if (!element || !container) return;

  const list = element.properties.length
    ? element.properties.map(p => `
        <button class="pr-row ${p.id === editingPropertyId ? 'active' : ''}" data-prop-action="edit" data-prop="${p.id}">
          <span class="pr-name">${escapeHtml(propLabel(p))}${p.generated ? ' <span class="pr-generated" title="Generated: never copied">⚙ generated</span>' : ''}</span>
          <span class="pr-type">${escapeHtml(p.type || 'string')}</span>
          <span class="pr-edit" aria-hidden="true">✎</span>
        </button>`).join('')
    : `<div class="pr-empty">No properties yet</div>`;

  const editing = element.properties.find(p => p.id === editingPropertyId);
  const form = editing ? `
    <div class="bd-sheet-label">Edit property</div>
    <div class="pr-form">
      <input type="text" class="sheet-input" id="prEditName" value="${escapeHtml(editing.name)}" autocapitalize="off" autocorrect="off" spellcheck="false">
      ${typeSelect('prEditType', editing.type || 'string')}
    </div>
    <div class="pr-items" id="prItemsRow" ${(editing.type || 'string') === 'array' ? '' : 'hidden'}>
      <label for="prEditItems">Each item has</label>
      <input type="text" class="sheet-input" id="prEditItems" value="${escapeHtml((editing.items || []).join(', '))}" placeholder="optional: stuffId, name, price" autocapitalize="off" autocorrect="off" spellcheck="false">
    </div>
    <label class="pr-gen-toggle">
      <input type="checkbox" id="prEditGenerated" ${editing.generated ? 'checked' : ''}>
      <span><b>Generated</b> — made by the system, not carried from events. Never offered for copying.</span>
    </label>
    <div class="pr-actions">
      <button class="sheet-btn danger" data-prop-action="delete">Delete</button>
      <button class="sheet-btn secondary" data-prop-action="cancel">Cancel</button>
      <button class="sheet-btn" data-prop-action="update">Save</button>
    </div>` : !addOpen ? `
    <button class="sheet-btn secondary pr-open-add" data-prop-action="open-add">＋ Add properties</button>` : `
    <div class="bd-sheet-label">Add properties</div>
    <div class="pr-form">
      <input type="text" class="sheet-input" id="prAddInput" placeholder="orderId, drink, size:number" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
      ${typeSelect('prAddType', addType)}
      <button class="sheet-btn" data-prop-action="add">Add</button>
    </div>
    <div class="pr-hint">Separate with commas · <code>name:type</code> sets a type · <code>items[]</code> is a list · <code>items[]{id, name}</code> a list of things with fields</div>`;

  const suggestions = editing || !addOpen ? [] : getSuggestions(state, element).sort(byName);
  const suggest = suggestions.length ? `
    <div class="bd-sheet-label pr-suggest-head">
      <span>From connected elements</span>
      <button class="pr-add-all" data-prop-action="add-all">Add all ${suggestions.length}</button>
    </div>
    <div class="pr-suggest">
      ${suggestions.map(s => `<button class="pr-chip" data-prop-action="suggest" data-name="${escapeHtml(s.name)}" data-type="${escapeHtml(s.type)}" title="from ${escapeHtml(s.from)}">+ ${escapeHtml(s.name)}</button>`).join('')}
    </div>` : '';

  // Push this element's properties onto connected ones: Copy merges (same name is
  // overwritten), Replace clears theirs first
  const connected = editing || !element.properties.length ? [] : getConnectedElements(state, element.id).sort(byName);
  const copyable = element.properties.filter(p => !p.generated);
  const copy = connected.length && copyable.length ? `
    <div class="bd-sheet-label">Copy all ${copyable.length} to connected</div>
    <div class="pr-hint pr-copy-what">${copyable.map(p => escapeHtml(propLabel(p))).join(', ')}</div>
    <div class="pr-copy-targets">
      ${connected.map(t => `
        <button class="bd-chip pr-copy-target ${copyTargets.has(t.id) ? 'active' : ''}" data-type="${t.type}"${externalAttr(t)} data-prop-action="copy-target" data-el="${t.id}">
          ${copyTargets.has(t.id) ? '✓ ' : ''}${escapeHtml(t.name)}
        </button>`).join('')}
    </div>
    <div class="pr-actions pr-copy-actions">
      <button class="sheet-btn secondary" data-prop-action="copy" ${copyTargets.size ? '' : 'disabled'}>Copy all ${copyable.length}</button>
      <button class="sheet-btn secondary" data-prop-action="replace" ${copyTargets.size ? '' : 'disabled'}>Replace theirs</button>
    </div>
    <div class="pr-hint">Both send every property listed above, not just what you changed. <b>Copy all</b> adds them to the ticked elements and updates ones with the same name. <b>Replace theirs</b> first removes the ticked elements' own properties. Generated ones never travel.</div>` : '';

  // Read first: what it has, then adding (opened on request, so no keyboard), then copying
  container.innerHTML = `
    <div class="sheet-title">Properties <span class="bd-sheet-sub">on ${escapeHtml(element.name)}</span></div>
    ${element.properties.length ? `<div class="bd-sheet-label">${element.properties.length} ${element.properties.length === 1 ? 'property' : 'properties'} · tap one to edit it</div>
    <div class="pr-list">${list}</div>` : ''}
    ${form}
    ${suggest}
    ${copy}
    ${editing ? '' : `<button class="sheet-btn pr-done" data-prop-action="done">Done</button>`}`;

  const addInput = document.getElementById('prAddInput');
  if (addInput) addInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); saveProperty(); } };
  const editInput = document.getElementById('prEditName');
  if (editInput) editInput.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); updateProperty(); } };
  const typeSel = document.getElementById('prEditType');
  if (typeSel) typeSel.onchange = () => { document.getElementById('prItemsRow').hidden = typeSel.value !== 'array'; };
}

function parseNames(text, defaultType, element) {
  return parsePropertyText(text, defaultType, element.properties.map(p => p.name));
}

function addProperties(items) {
  items.forEach(({ name, type, items: fields }) => {
    addedThisSession.push(addProperty(editingElementId, name, type, fields || null));
  });
}

// Add from the input (Enter or Add). The sheet stays open for the next batch.
export function saveProperty() {
  const element = projectState().elements[editingElementId];
  const input = document.getElementById('prAddInput');
  if (!element || !input) return;
  addType = document.getElementById('prAddType')?.value || addType;

  const { parsed, skipped } = parseNames(input.value, addType, element);
  if (!parsed.length && !skipped) return;
  addProperties(parsed);

  const msg = [parsed.length ? `${parsed.length} added` : '', skipped ? `${skipped} already there` : ''].filter(Boolean).join(' · ');
  showToast(msg);
  render();
  renderPropertySheet();
  document.getElementById('prAddInput')?.focus();
}

function addSuggested(names) {
  const element = projectState().elements[editingElementId];
  if (!element) return;
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
  const current = projectState().elements[editingElementId]?.properties.find(p => p.id === editingPropertyId);

  if (current && (current.name !== name || (current.type || 'string') !== propertyType
      || (current.items || []).join('|') !== fields.join('|'))) {
    appendEvent('PropertyUpdated', {
      elementId: editingElementId,
      propertyId: editingPropertyId,
      name,
      propertyType,
      items: fields.length ? fields : null
    });
  }
  if (current && !!current.generated !== generated) {
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
  else if (a === 'add-all') {
    const state = projectState();
    addSuggested(getSuggestions(state, state.elements[editingElementId]).map(s => ({ name: s.name, type: s.type })));
  } else if (a === 'copy-target') {
    copyTargets.has(t.dataset.el) ? copyTargets.delete(t.dataset.el) : copyTargets.add(t.dataset.el);
    renderPropertySheet();
  } else if (a === 'copy') copyToTargets(false);
  else if (a === 'replace') copyToTargets(true);
  else if (a === 'done') finish();
}

// Every element linked to this one, by a connection either way or a shared slice
function getConnectedElements(state, elementId) {
  const ids = new Set();
  state.connections
    .filter(c => c.from === elementId || c.to === elementId)
    .forEach(c => ids.add(c.from === elementId ? c.to : c.from));
  Object.values(state.slices)
    .filter(s => s.elements.includes(elementId))
    .forEach(s => s.elements.forEach(id => ids.add(id)));
  ids.delete(elementId);
  return [...ids].map(id => state.elements[id]).filter(Boolean);
}

// Copy (merge, same name overwritten) or replace (clear first) the properties of
// the ticked connected elements with this element's
function copyToTargets(replace) {
  const state = projectState();
  const source = state.elements[editingElementId];
  const targets = [...copyTargets].map(id => state.elements[id]).filter(Boolean);
  if (!source || !targets.length) return;
  if (replace && !confirm(`Replace the properties of ${targets.map(t => t.name).join(', ')}?`)) return;

  // Generated properties don't travel: the source's aren't copied, and Replace
  // keeps the target's own generated ones
  const copyable = source.properties.filter(p => !p.generated);
  if (!copyable.length) { showToast('Nothing to copy: these are all generated'); return; }

  targets.forEach(target => {
    if (replace) {
      target.properties.filter(p => !p.generated)
        .forEach(p => appendEvent(EventTypes.PropertyRemoved, { elementId: target.id, propertyId: p.id }));
    }
    copyable.forEach((p, i) => {
      const same = !replace && target.properties.find(tp => tp.name.toLowerCase() === p.name.toLowerCase());
      if (same) {
        appendEvent('PropertyUpdated', { elementId: target.id, propertyId: same.id, name: p.name, propertyType: p.type || 'string', items: p.items || null });
      } else {
        appendEvent(EventTypes.PropertyAdded, {
          elementId: target.id,
          propertyId: 'prop_' + Date.now() + '_' + i + '_' + target.id,
          name: p.name,
          propertyType: p.type || 'string',
          ...(p.items ? { items: p.items } : {})
        });
      }
    });
  });

  // Already copied deliberately: closing the sheet shouldn't ask again
  addedThisSession = [];
  showToast(`${replace ? 'Replaced on' : 'Copied to'} ${targets.length} element${targets.length === 1 ? '' : 's'}`);
  render();
  renderPropertySheet();
}

// Where new fields usually belong too: a command's and a read model's fields
// live on their events; an event's flow on to its read models; a screen's to its command
const propagationTypes = {
  command: 'event',
  readModel: 'event',
  event: 'readModel',
  screen: 'command'
};

// Elements of the target type linked to this one — by a connection in either
// direction (older models store some links reversed) or by sharing a slice.
// Automation slices and trigger links are skipped: a processor's trigger event
// isn't something its command produces.
function getDownstreamElements(elementId) {
  const state = projectState();
  const el = state.elements[elementId];
  const targetType = el && propagationTypes[el.type];
  if (!targetType) return [];

  const ids = new Set();
  state.connections
    .filter(c => (c.from === elementId || c.to === elementId) && c.relation !== 'trigger')
    .forEach(c => ids.add(c.from === elementId ? c.to : c.from));
  Object.values(state.slices)
    .filter(s => s.type !== 'AU' && s.elements.includes(elementId))
    .forEach(s => s.elements.forEach(id => ids.add(id)));

  return [...ids]
    .map(id => state.elements[id])
    .filter(t => t && t.id !== elementId && t.type === targetType);
}

function openPropagateSheet(propNames, fromElementId, targets) {
  pendingPropagation = { propNames, fromElementId };

  const state = projectState();
  const fromEl = state.elements[fromElementId];
  const targetLabel = { event: 'events', readModel: 'read models', command: 'commands' }[targets[0]?.type] || 'connected elements';

  document.getElementById('propagateTitle').textContent = `Copy to ${targetLabel}?`;
  document.getElementById('propagateSubtitle').textContent =
    `"${propNames.join(', ')}" added to ${fromEl?.name}`;

  document.getElementById('propagateTargets').innerHTML = targets.map(t => `
    <label class="checkbox-item" style="display:flex; align-items:center; gap:10px; padding:12px 0; border-bottom:1px solid var(--border);">
      <input type="checkbox" checked data-element-id="${t.id}">
      <span class="element-type-dot ${t.type}"></span>
      <span>${escapeHtml(t.name)}</span>
    </label>
  `).join('');

  showSheet('propagateSheet');
}

export function confirmPropagate() {
  if (!pendingPropagation) return;
  const { propNames, fromElementId } = pendingPropagation;

  const checked = [...document.querySelectorAll('#propagateTargets input[type=checkbox]:checked')];
  const state = projectState();
  const source = state.elements[fromElementId];

  checked.forEach(cb => {
    const targetId = cb.dataset.elementId;
    const el = state.elements[targetId];
    if (!el) return;
    propNames.forEach((n, i) => {
      // Skip if prop with same name already exists
      if (!el.properties?.find(p => p.name === n)) {
        appendEvent(EventTypes.PropertyAdded, {
          elementId: targetId,
          propertyId: 'prop_' + Date.now() + '_' + i + '_' + targetId,
          name: n,
          propertyType: source?.properties.find(p => p.name === n)?.type || 'string'
        });
      }
    });
  });

  pendingPropagation = null;
  hideAllSheets();
  showToast(`Propagated to ${checked.length} element${checked.length !== 1 ? 's' : ''}`);
  render();
}

export function skipPropagate() {
  pendingPropagation = null;
  hideAllSheets();
  showToast('Properties added');
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
