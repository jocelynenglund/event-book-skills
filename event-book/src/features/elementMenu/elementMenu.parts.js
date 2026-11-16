// ===========================================
// ELEMENT MENU - Parts of a sticky's ⋮ menu, each drawn from its view alone
// (Element Menu State, Element Menu Options, Element Menu Readers, Element Menu Flow Choices, Element Menu Consumers).
// A root carries data-component and data-key.
// ===========================================

import { typeIcons } from '../../core/constants.js';

const escapeName = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The name is the title, edited in place: tap it, type, Enter (or tap away) saves; ✓ shows while editing
export function elementMenuTitle(el) {
  return `
    <span class="em-title" data-component="Element menu title" data-key="${el.elementId}">
      <span style="background: var(--${el.type}); color: ${el.type === 'command' || el.type === 'processor' ? '#fff' : '#000'}; padding: 4px 8px; border-radius: 6px;">${typeIcons[el.type]}</span>
      <input type="text" class="em-name" id="emName" value="${escapeName(el.name)}" aria-label="Name" autocomplete="off" enterkeyhint="done">
      <button class="em-save" id="emSave" aria-label="Save name" hidden>✓</button>
    </span>
  `;
}

// One thing the menu offers: tap to do it
export function elementMenuOption(o) {
  return `
    <div class="sheet-option" data-component="Element menu option" data-key="${o.key}" onclick="window.EventPad.${o.call}(${o.passThis ? 'this' : ''})"${o.danger ? ' style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;"' : ''}>
      <div class="sheet-option-icon${o.iconClass ? ' ' + o.iconClass : ''}"${o.iconBg ? ` style="background: ${o.iconBg};"` : ''}>${o.icon}</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title"${o.danger ? ' style="color: #e74c3c;"' : ''}>${escapeName(o.title)}</div>
        <div class="sheet-option-desc">${escapeName(o.desc)}</div>
      </div>
    </div>`;
}

// One read model an event updates: tap to go to it
export function readerChip(r) {
  return `
        <button class="bd-chip" data-component="Reader chip" data-key="${r.id}" data-type="readModel" onclick="window.EventPad.menuShowElement('${r.id}')">
          ${r.todo ? '☑ ' : ''}${escapeName(r.name)}<span class="bd-chip-used">${r.where ? `in ${escapeName(r.where)}` : 'not on the board'}</span>
        </button>`;
}

// The read models an event updates (readers: Element Menu Readers)
export function readersSection(readers) {
  return `
    <div class="em-consumers">
      <div class="bd-sheet-label">${readers.label}</div>
      ${readers.readers.length ? `<div class="bd-chips">${readers.readers.map(readerChip).join('')}</div>` : ''}
    </div>`;
}

// One flow an outcome event can belong to
export function flowChoiceChip(c) {
  return `<button class="bd-chip ${c.on ? 'linked' : ''}" data-component="Flow choice chip" data-key="${c.flowId || 'every'}" onclick="window.EventPad.menuSetElementFlow('${c.flowId}')">${escapeName(c.label)}</button>`;
}

// "Outcome of": every flow, the main line only, or one flow (flows: Element Menu Flow Choices)
export function flowChoicesSection(flows) {
  return `
    <div class="bd-sheet-label">Outcome of</div>
    <div class="bd-chips em-flows">
      ${flows.choices.map(flowChoiceChip).join('\n      ')}
    </div>`;
}

// An integration event: who it goes to, comma-separated, saved when the field changes (Element Menu Consumers)
export function elementMenuConsumers(c) {
  return `
    <div class="em-consumers-field" data-component="Element menu consumers" data-key="${c.elementId}">
      <label class="bd-sheet-label" for="emConsumers">Published to</label>
      <input type="text" class="em-name" id="emConsumers" value="${escapeName(c.to)}" placeholder="Billing, CRM (who consumes it)" aria-label="Consumers" autocomplete="off" enterkeyhint="done">
    </div>`;
}

// The whole menu: flows, readers, the options, then (an integration event) who it is published to
export function elementMenuBody({ flows, readers, options, consumers }) {
  return `
    ${flows ? flowChoicesSection(flows) : ''}
    ${readers ? readersSection(readers) : ''}
    ${consumers ? elementMenuConsumers(consumers) : ''}
    ${options.map(elementMenuOption).join('')}
  `;
}
