// ===========================================
// SCENARIOS - Parts of the scenario editor (Given / When / Then), each drawn from its view object alone
// (Scenario Given Rows, Scenario Given Pool, Scenario Editor Choices, Scenario Element Fields, Scenario Then Rows).
// A root carries data-component and data-key.
// ===========================================

import { typeIcons } from '../../core/constants.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One item of a list property: a small field per item field ("stuffId:number" is the field stuffId), and ✕
const fieldKey = f => String(f).split(':')[0].trim();
export function valueItemRow(fields, item = {}) {
  return `
    <div class="prop-item" data-component="Value item row" data-key="${escapeHtml(fields.map(fieldKey).join(','))}">
      ${fields.map(f => `<input type="text" class="prop-item-field" data-field="${escapeHtml(fieldKey(f))}" placeholder="${escapeHtml(fieldKey(f))}" value="${escapeHtml(item[fieldKey(f)] ?? '')}" autocapitalize="off" autocorrect="off" spellcheck="false">`).join('')}
      <button type="button" class="given-entry-btn" onclick="this.closest('.prop-item').remove()" aria-label="Remove item">✕</button>
    </div>`;
}

// One value box of a sticky's property (a list with item fields: a line per item and ＋ item): a field of Scenario Element
// Fields, which says which sticky and part of the sheet it belongs to and what is filled in so far
export function valueInputRow(field) {
  if (field.items) {
    const items = Array.isArray(field.value) ? field.value : [];
    return `
      <div class="property-input-row prop-items-row" data-component="Value input row" data-key="${escapeHtml(field.name)}">
        <label>${escapeHtml(field.name)}[]</label>
        <div class="prop-items" data-prefix="${field.prefix}" data-element-id="${field.elementId}" data-prop-name="${escapeHtml(field.name)}" data-fields="${escapeHtml(JSON.stringify(field.items))}">
          ${items.map(item => valueItemRow(field.items, item)).join('')}
          <button type="button" class="given-entry-btn prop-item-add" onclick="window.EventPad.propItemAdd(this)">＋ item</button>
        </div>
      </div>`;
  }
  const raw = field.value ?? '';
  const shown = escapeHtml(raw !== null && typeof raw === 'object' ? JSON.stringify(raw) : raw);
  const inputType = field.type === 'number' || field.type === 'decimal' ? 'number' : 'text';
  return `
      <div class="property-input-row" data-component="Value input row" data-key="${escapeHtml(field.name)}">
        <label>${escapeHtml(field.label)}</label>
        <input type="${inputType}"${inputType === 'number' ? ' step="any" inputmode="decimal"' : ''}
               class="property-value-input"
               data-prefix="${field.prefix}"
               data-element-id="${field.elementId}"
               data-prop-name="${escapeHtml(field.name)}"
               placeholder="${escapeHtml(`${field.name} (${field.type})`)}"
               value="${shown}">
      </div>
    `;
}

// The value boxes of a sticky (Scenario Element Fields)
export function valueInputs(inputs) {
  return inputs.fields.length ? inputs.fields.map(valueInputRow).join('') : '<p class="property-hint">No properties defined</p>';
}

// One event the scenario is given: its values, ＋ again, ✕ (row: Scenario Given Rows')
export function givenEntry(row) {
  return `
      <div class="given-entry" data-component="Given entry" data-key="${row.index}" data-index="${row.index}">
        <div class="given-entry-head">
          <span class="given-entry-name">${typeIcons.event} ${escapeHtml(row.name)}</span>
          <button class="given-entry-btn" onclick="window.EventPad.givenAgain(${row.index})" aria-label="Add ${escapeHtml(row.name)} again">＋ again</button>
          <button class="given-entry-btn" onclick="window.EventPad.givenRemove(${row.index})" aria-label="Remove">✕</button>
        </div>
        <div class="property-inputs">${valueInputs(row.inputs)}</div>
      </div>`;
}

// One event that can be added to Given (Scenario Given Pool's)
export function givenPoolChip(e) {
  return `
    <button class="bd-chip" data-component="Given pool chip" data-type="event"${e.external ? ' data-external="true"' : ''} data-key="${escapeHtml(e.name.toLowerCase())}" onclick="window.EventPad.givenAdd('${e.id}')">
      ${escapeHtml(e.name)}${e.where ? `<span class="bd-chip-used">${escapeHtml(e.where)}</span>` : ''}
    </button>`;
}

// "Add an event": a search once there are many, then every event to pick from (adder: { pool, hasEntries })
export function givenAdder(adder) {
  return `
    <div class="given-add" data-component="Given adder" data-key="add">
      <div class="given-add-label">Add an event${adder.hasEntries ? ' (again, for another example)' : ''}</div>
      ${adder.pool.length > 8 ? `<input type="text" class="sheet-input given-search" id="givenSearch" placeholder="Search events" autocomplete="off">` : ''}
      <div class="bd-chips" id="givenChips">${adder.pool.map(givenPoolChip).join('') || '<p class="empty">No events yet</p>'}</div>
    </div>`;
}

// The whole Given part: rows (Scenario Given Rows) then the adder
export function givenSection(rows, pool) {
  return `
    ${rows.map(givenEntry).join('') || '<p class="property-hint">Nothing happened before: add events below.</p>'}
    ${givenAdder({ pool, hasEntries: rows.length > 0 })}`;
}

// When: pick the command, then its values (when: Scenario Editor Choices' when)
export function whenCommandChoice(when) {
  return `
      <div data-component="When command choice" data-key="when">
      <div class="section-label">WHEN</div>
      <select class="sheet-input" id="whenCommandSelect" style="padding: 12px;"
              onchange="window.EventPad.selectWhenCommand(this.value)">
        <option value="">Select command...</option>
        ${when.commands.map(c => `
          <option value="${c.id}" ${when.selectedId === c.id ? 'selected' : ''}>
            ${typeIcons.command} ${escapeHtml(c.name)}
          </option>
        `).join('')}
      </select>
      <div class="property-inputs ${when.inputs ? '' : 'hidden'}" id="when-props">
        ${when.inputs ? valueInputs(when.inputs) : ''}
      </div>
      </div>
    `;
}

// Then, for a change: an event with its values, or a rejection with its reason (then: Scenario Editor Choices' then)
export function thenOutcomeChoice(then) {
  const isRejection = then.kind === 'rejection';
  return `
      <div data-component="Then outcome choice" data-key="then">
      <div class="then-type-toggle">
        <label class="radio-item ${isRejection ? '' : 'selected'}">
          <input type="radio" name="thenType" value="event" ${isRejection ? '' : 'checked'}
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
          ${then.events.map(e => `
            <option value="${e.id}" ${then.selectedId === e.id ? 'selected' : ''}>
              ${typeIcons.event} ${escapeHtml(e.name)}
            </option>
          `).join('')}
        </select>
        <div class="property-inputs ${then.inputs ? '' : 'hidden'}" id="then-event-props">
          ${then.inputs ? valueInputs(then.inputs) : ''}
        </div>
      </div>

      <div id="thenRejectionSection" style="${isRejection ? '' : 'display:none'}">
        <input type="text" class="sheet-input" id="rejectionReasonInput"
               placeholder="Rejection reason..." value="${escapeHtml(then.reason)}"
               style="margin-top: 12px;">
      </div>
      </div>
    `;
}

// One example row of a list read model, with its ✕ (row: Scenario Then Rows')
export function thenRow(row) {
  return `
    <div class="given-entry then-row" data-component="Then row" data-key="${row.index}" data-row="${row.index}">
      <div class="given-entry-head">
        <span class="given-entry-name">Row ${row.index + 1}</span>
        <button class="given-entry-btn" onclick="window.EventPad.thenRowRemove(${row.index})" aria-label="Remove row">✕</button>
      </div>
      <div class="property-inputs">${valueInputs(row.inputs)}</div>
    </div>`;
}

// A list read model's example rows, one by one, and ＋ row (list: Scenario Then Rows)
export function thenRowList(list) {
  return list.rows.map(thenRow).join('') + `<button class="given-entry-btn then-row-add" data-component="Then row add button" data-key="add" onclick="window.EventPad.thenRowAdd()">＋ row</button>`;
}

// Then, for a view: the read model with its values (or its rows when it is a list)
export function thenReadModelChoice(then) {
  return `
      <div data-component="Then read model choice" data-key="then">
      <select class="sheet-input" id="thenReadModelSelect" style="padding: 12px;"
              onchange="window.EventPad.selectThenReadModel(this.value)">
        <option value="">Select read model...</option>
        ${then.readModels.map(rm => `
          <option value="${rm.id}" ${then.selectedId === rm.id ? 'selected' : ''}>
            ${typeIcons.readModel} ${escapeHtml(rm.name)}
          </option>
        `).join('')}
      </select>
      <div class="property-inputs ${then.inputs ? '' : 'hidden'}" id="then-rm-props">
        ${then.inputs ? valueInputs(then.inputs) : ''}
      </div>
      </div>
    `;
}
