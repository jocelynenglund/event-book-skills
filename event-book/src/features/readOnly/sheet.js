// ===========================================
// READ-ONLY - A model kept on the server that isn't checked out here: taps only read.
// body.read-only hides the edit affordances (styles.css); the taps that would open an
// edit menu open these read sheets instead. Nothing is recorded: the check-out rules
// stay in sync/client.js (appendEvent still refuses).
// ===========================================

import { canEditCurrent, getEventCount, getCurrentModelId, isFrozenCurrent, getEventStream } from '../../core/eventStore.js';
import { isBuildBook } from '../buildVersions/rules.js';
import { projectState, getOrderedSlices, sliceTitle } from '../../core/projections.js';
import { elementLabel, externalAttr, propLabel, typeIcons } from '../../core/constants.js';
import { escapeHtml } from '../board/view.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { openElementMenu } from '../elementMenu/sheet.js';
import { fieldsFolded, toggleFieldsFolded } from '../board/foldedFields.js';
import { render } from '../../ui/feed.js';

// True when the open model can't be changed on this device
export const isReadOnly = () => !canEditCurrent();

// The header's ☁ chip says what to do; the body class and the undo button follow it.
// syncAction: the chip's action (checkout / takeover), or null when editable here.
// agent: who is editing it when that's an agent ("Claude"): the footer offers Take back.
let checkoutAction = null;
let editingAgent = null;
export function setReadOnly(on, syncAction = null, agent = null) {
  checkoutAction = on ? syncAction : null;
  editingAgent = on ? agent : null;
  document.body.classList.toggle('read-only', !!on);
  const undo = document.getElementById('undoBtn');
  if (undo) {
    undo.disabled = !!on || getEventCount() === 0;
    undo.title = on ? (isFrozenCurrent() ? 'Published: start the next draft to change it' : 'Read-only here: check it out to edit') : '';
  }
}

// What the footer button does: the same as the header chip
function checkoutLine(modelId) {
  // A build: never checked out, a plan starts from it
  if (isBuildBook(getEventStream())) return `
    <div class="ro-foot">
      <span>A build: read only</span>
      <button class="ro-checkout" data-title-action="plan" data-model="${escapeHtml(modelId || '')}">Start a plan from this build</button>
    </div>`;
  // A published edition: nothing to check out, start the next draft instead
  if (isFrozenCurrent()) return `
    <div class="ro-foot">
      <span>Published: read only</span>
      <button class="ro-checkout" data-library-action="next-draft" data-model="${escapeHtml(modelId || '')}">Start next draft</button>
    </div>`;
  const action = checkoutAction || 'checkout';
  return `
    <div class="ro-foot">
      <span>${editingAgent ? `${escapeHtml(editingAgent)} is editing, read only here` : 'Read-only here'}</span>
      <button class="ro-checkout" data-sync-action="${action}" data-model="${escapeHtml(modelId || '')}">${editingAgent ? 'Take back' : action === 'takeover' ? '🔒 Take over to edit' : '☁ Check out to edit'}</button>
    </div>`;
}

// Editable here: the footer offers Edit (the same editor as the card's ⋮)
function editLine(elementId, sliceId) {
  return `
    <div class="ro-foot">
      <span></span>
      <button class="ro-checkout" data-board-action="read-edit" data-el="${escapeHtml(elementId)}" data-slice="${escapeHtml(sliceId || '')}">Edit</button>
    </div>`;
}

export function onSheetAction(a, t) {
  if (a !== 'read-edit') return false;
  const { el, slice } = t.dataset;
  hideAllSheets();
  setTimeout(() => openElementMenu(el, slice || null), 150);
  return true;
}

// A sticky, to read: kind, name, description, its fields, its flags, the slices it's in
// Fold on the board: a big payload shows as "N fields" there and in the share image
document.addEventListener('click', e => {
  const t = e.target.closest('[data-fold-fields]');
  if (!t) return;
  const folded = toggleFieldsFolded(t.dataset.foldFields);
  t.textContent = folded ? 'Show on the board' : 'Fold on the board';
  render();
});

export function openElementReadSheet(elementId, sliceId = null) {
  const state = projectState();
  const el = state.elements[elementId];
  if (!el) return;
  const flags = [
    el.type === 'event' && el.external ? 'From another system (external)' : '',
    el.type === 'readModel' && el.list ? 'A list' : '',
    el.todo ? 'A to-do list (a processor works through it)' : ''
  ].filter(Boolean);
  const props = el.properties || [];
  const slices = getOrderedSlices(state).filter(s => s.elements.includes(el.id));
  openBoardSheet(`
    <div class="ro-sheet">
      <div class="ro-kind">${typeIcons[el.type] || ''} ${escapeHtml(elementLabel(el))}</div>
      <div class="ro-name rb-sticky" data-type="${el.type}"${externalAttr(el)}>${escapeHtml(el.name)}</div>
      ${el.description ? `<p class="ro-desc">${escapeHtml(el.description)}</p>` : ''}
      <div class="bd-sheet-label ro-fields-head">Fields${props.length ? `<button class="cm-btn quiet" data-fold-fields="${el.id}">${fieldsFolded(el.id) ? 'Show on the board' : 'Fold on the board'}</button>` : ''}</div>
      ${props.length ? `<ul class="ro-fields">${props.map(p => `
        <li><span class="ro-field-name">${p.generated ? '<span title="Generated">⚙</span> ' : ''}${escapeHtml(propLabel(p))}</span><span class="ro-field-type">${escapeHtml(p.type || 'string')}</span></li>`).join('')}
      </ul>` : '<p class="sy-p">No fields</p>'}
      ${flags.length ? `<div class="ro-flags">${flags.map(f => `<span>${escapeHtml(f)}</span>`).join('')}</div>` : ''}
      <div class="bd-sheet-label">In ${slices.length === 1 ? 'slice' : 'slices'}</div>
      ${slices.length ? `<ul class="ro-slices">${slices.map(s => `<li>${escapeHtml(sliceTitle(s, state))}</li>`).join('')}</ul>` : '<p class="sy-p">Not in a slice</p>'}
      ${isReadOnly() ? checkoutLine(getCurrentModelId()) : editLine(el.id, sliceId)}
    </div>`);
}
