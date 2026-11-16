// ===========================================
// BOARD SHEETS - A slice's events: the board folds them into a pile, this
// drawer shows each one and adds another. Tapping an event goes to the command
// that produces it; ✎ edits it.
// ===========================================

import { projectState } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showElementOnBoard } from '../../../ui/feed.js';
import { openElementMenu } from '../../elementMenu/sheet.js';
import { openCellSheet } from './cell.js';
import { openBoardSheet } from './shared.js';
import { sliceEventsDrawer } from './sliceEventsDrawer.read.js';
import { eventsDrawerBody } from './events.parts.js';
import { openElementReadSheet } from '../../readOnly/sheet.js';

// readOnly: not checked out here, so no ✎ and no + (an event nothing produces reads its sticky)
// givens: the events its scenarios start from (tap one: the command that produces it)
export function openEventsSheet(sliceId, { readOnly = false, givens = false } = {}) {
  const drawer = sliceEventsDrawer(projectState(), sliceId, { readOnly, givens });
  if (drawer) openBoardSheet(eventsDrawerBody(drawer));
}

export function onSheetAction(a, t) {
  if (a === 'event-read') { openElementReadSheet(t.dataset.el); return true; }
  if (a === 'event-edit') { openElementMenu(t.dataset.el, t.dataset.slice); return true; }
  if (a === 'event-go') {
    hideAllSheets();
    setTimeout(() => showElementOnBoard(t.dataset.el, t.dataset.slice), 150);
    return true;
  }
  if (a === 'event-add') { openCellSheet(t.dataset.slice, 'event'); return true; }
  return false;
}
