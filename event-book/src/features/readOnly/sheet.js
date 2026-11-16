// ===========================================
// READ-ONLY - A model kept on the server that isn't checked out here: taps only read.
// body.read-only hides the edit affordances (styles.css); the taps that would open an
// edit menu open these read sheets instead. Nothing is recorded: the check-out rules
// stay in sync/client.js (appendEvent still refuses).
// ===========================================

import { canEditCurrent, getEventCount, getCurrentModelId, isFrozenCurrent } from '../../core/eventStore.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { openElementMenu } from '../elementMenu/sheet.js';
import { toggleFieldsFolded } from '../board/foldedFields.js';
import { render } from '../../ui/feed.js';
import { elementReadSheet } from './elementReadSheet.read.js';
import { readOnlyFooter } from './readOnlyFooter.read.js';
import { elementRead, readOnlyFooterBar } from './readOnly.parts.js';

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
  const v = elementReadSheet(elementId);
  if (!v) return;
  const footer = readOnlyFooter({ readOnly: isReadOnly(), modelId: getCurrentModelId(), elementId: v.id, sliceId, checkoutAction, agent: editingAgent });
  openBoardSheet(`
    <div class="ro-sheet">
      ${elementRead(v)}
      ${readOnlyFooterBar(footer)}
    </div>`);
}
