// ===========================================
// PROPERTIES - Parts of the properties sheet, each drawn from its row of a view alone
// (Property List Rows, Property Edit Form, Property Suggestions, Property Copy Targets). A root carries
// data-component and data-key.
// ===========================================

import { propertyTypes } from '../../core/constants.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function typeSelect(id, selected) {
  return `<select class="sheet-input pr-type-select" id="${id}">
    ${propertyTypes.map(t => `<option value="${t}" ${t === selected ? 'selected' : ''}>${t}</option>`).join('')}
  </select>`;
}

// One property in the list: tap to edit it
export function propertyRow(row) {
  return `
        <button class="pr-row ${row.active ? 'active' : ''}" data-component="Property row" data-key="${row.id}" data-prop-action="edit" data-prop="${row.id}">
          <span class="pr-name">${escapeHtml(row.label)}${row.generated ? ' <span class="pr-generated" title="Generated: never copied">⚙ generated</span>' : ''}</span>
          <span class="pr-type">${escapeHtml(row.type)}</span>
          <span class="pr-edit" aria-hidden="true">✎</span>
        </button>`;
}

// The form to change, delete or mark generated the property being edited
export function propertyEditor(form) {
  return `
    <div data-component="Property editor" data-key="${form.id}">
    <div class="bd-sheet-label">Edit property</div>
    <div class="pr-form">
      <input type="text" class="sheet-input" id="prEditName" value="${escapeHtml(form.name)}" autocapitalize="off" autocorrect="off" spellcheck="false">
      ${typeSelect('prEditType', form.type)}
    </div>
    <div class="pr-items" id="prItemsRow" ${form.isArray ? '' : 'hidden'}>
      <label for="prEditItems">Each item has</label>
      <input type="text" class="sheet-input" id="prEditItems" value="${escapeHtml(form.itemsText)}" placeholder="optional: stuffId, name, price" autocapitalize="off" autocorrect="off" spellcheck="false">
    </div>
    <label class="pr-gen-toggle">
      <input type="checkbox" id="prEditGenerated" ${form.generated ? 'checked' : ''}>
      <span><b>Generated</b> — made by the system, not carried from events. Never offered for copying.</span>
    </label>
    <div class="pr-actions">
      <button class="sheet-btn danger" data-prop-action="delete">Delete</button>
      <button class="sheet-btn secondary" data-prop-action="cancel">Cancel</button>
      <button class="sheet-btn" data-prop-action="update">Save</button>
    </div>
    </div>`;
}

// The box that adds several properties at once ("orderId, drink, size:number"); adding = { type }
export function propertyAdder(adding) {
  return `
    <div data-component="Property adder" data-key="add">
    <div class="bd-sheet-label">Add properties</div>
    <div class="pr-form">
      <input type="text" class="sheet-input" id="prAddInput" placeholder="orderId, drink, size:number" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done">
      ${typeSelect('prAddType', adding.type)}
      <button class="sheet-btn" data-prop-action="add">Add</button>
    </div>
    <div class="pr-hint">Separate with commas · <code>name:type</code> sets a type · <code>items[]</code> is a list · <code>items[]{id, name}</code> a list of things with fields</div>
    </div>`;
}

// Opens the add box (it stays shut until asked for, so no keyboard pops up)
export function addPropertiesButton() {
  return `
    <button class="sheet-btn secondary pr-open-add" data-component="Add properties button" data-key="open-add" data-prop-action="open-add">＋ Add properties</button>`;
}

// The heading over the suggestions, with "Add all"
export function suggestionsHead(suggestions) {
  return `
    <div class="bd-sheet-label pr-suggest-head" data-component="Suggestions head" data-key="head">
      <span>From connected elements</span>
      <button class="pr-add-all" data-prop-action="add-all">Add all ${suggestions.length}</button>
    </div>`;
}

// One property name a connected sticky has, to add with a tap
export function suggestionChip(s) {
  return `<button class="pr-chip" data-component="Suggestion chip" data-key="${escapeHtml(s.name)}" data-prop-action="suggest" data-name="${escapeHtml(s.name)}" data-type="${escapeHtml(s.type)}" title="from ${escapeHtml(s.from)}">+ ${escapeHtml(s.name)}</button>`;
}

// One connected sticky to copy the properties to, ticked or not
export function copyTargetChip(t) {
  return `
        <button class="bd-chip pr-copy-target ${t.ticked ? 'active' : ''}" data-component="Copy target chip" data-key="${t.id}" data-type="${t.type}"${t.attrs} data-prop-action="copy-target" data-el="${t.id}">
          ${t.ticked ? '✓ ' : ''}${escapeHtml(t.name)}
        </button>`;
}

// Copy all / Replace theirs, off until a target is ticked
export function copyActions(copy) {
  return `
    <div class="pr-actions pr-copy-actions" data-component="Copy actions" data-key="copy">
      <button class="sheet-btn secondary" data-prop-action="copy" ${copy.canCopy ? '' : 'disabled'}>Copy all ${copy.count}</button>
      <button class="sheet-btn secondary" data-prop-action="replace" ${copy.canCopy ? '' : 'disabled'}>Replace theirs</button>
    </div>`;
}

export function propertiesDoneButton() {
  return `<button class="sheet-btn pr-done" data-component="Properties done button" data-key="done" data-prop-action="done">Done</button>`;
}

// The whole sheet, from the views the sheet put together:
//   list (Property List Rows), form (Property Edit Form or null), adding ({ type } while the add box is open, else null),
//   suggestions (Property Suggestions), copy (Property Copy Targets or null)
export function propertiesSheetBody({ list, form, adding, suggestions, copy }) {
  const editing = !!form;
  return `
    <div class="sheet-title">Properties <span class="bd-sheet-sub">on ${escapeHtml(list.name)}</span></div>
    ${list.heading ? `<div class="bd-sheet-label">${list.heading}</div>
    <div class="pr-list">${list.rows.map(propertyRow).join('')}</div>` : ''}
    ${editing ? propertyEditor(form) : adding ? propertyAdder(adding) : addPropertiesButton()}
    ${suggestions.length ? `${suggestionsHead(suggestions)}
    <div class="pr-suggest">
      ${suggestions.map(suggestionChip).join('')}
    </div>` : ''}
    ${copy ? `
    <div class="bd-sheet-label">Copy all ${copy.count} to connected</div>
    <div class="pr-hint pr-copy-what">${escapeHtml(copy.what)}</div>
    <div class="pr-copy-targets">
      ${copy.targets.map(copyTargetChip).join('')}
    </div>
    ${copyActions(copy)}
    <div class="pr-hint">Both send every property listed above, not just what you changed. <b>Copy all</b> adds them to the ticked elements and updates ones with the same name. <b>Replace theirs</b> first removes the ticked elements' own properties. Generated ones never travel.</div>` : ''}
    ${editing ? '' : propertiesDoneButton()}`;
}
