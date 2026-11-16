// ===========================================
// BOARD SHEETS - A slice's scenarios in a drawer: each folded to its name,
// opened to its Given / When / Then; edit one, or add another
// ===========================================

import { projectState } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { idsHidden, setIdsHidden } from '../../scenarios/ids.js';
import { openBoardSheet } from './shared.js';
import { openThread } from '../../comments/sheet.js';
import { sliceScenariosDrawer } from './sliceScenariosDrawer.read.js';
import { scenarioAddTarget } from './scenarioAddTarget.read.js';
import { scenariosDrawerBody } from './scenarios.parts.js';

let book = null;   // the book as the drawer last drew it

// readOnly: not checked out here, so no Edit and no + Scenario
export function openScenariosSheet(sliceId, { readOnly = false } = {}) {
  book = projectState();
  const drawer = sliceScenariosDrawer(book, sliceId, { readOnly });
  if (drawer) openBoardSheet(scenariosDrawerBody(drawer));
}

export function onSheetAction(a, t) {
  if (a === 'scn-ids') {
    setIdsHidden(!idsHidden());
    openScenariosSheet(t.dataset.slice, { readOnly: t.dataset.readOnly === '1' });
    return true;
  }
  if (a === 'scn-comment') {
    openThread(t.dataset.slice, t.dataset.scenario || null);
    return true;
  }
  if (a === 'scn-edit') {
    hideAllSheets();
    setTimeout(() => window.EventPad.editScenario(t.dataset.scenario), 150);
    return true;
  }
  if (a === 'scn-add') {
    const target = book && scenarioAddTarget(book, t.dataset.slice);
    hideAllSheets();
    if (target) setTimeout(() => window.EventPad.addScenario(target.sliceId, target.type), 150);
    return true;
  }
  return false;
}
