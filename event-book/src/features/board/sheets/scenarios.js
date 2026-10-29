// ===========================================
// BOARD SHEETS - A slice's scenarios in a drawer: each folded to its name,
// opened to its Given / When / Then; edit one, or add another
// ===========================================

import { projectState, sliceTitle, getScenariosForSlice } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { renderGwt } from '../../scenarios/view.js';
import { idsHidden, setIdsHidden, scenarioHasIds } from '../../scenarios/ids.js';
import { escapeHtml } from '../view.js';
import { openBoardSheet } from './shared.js';
import { openThread } from '../../comments/sheet.js';
import { commentsOn } from '../../comments/read.js';

const openOn = (state, sliceId, scenarioId) => commentsOn(state, sliceId, scenarioId).filter(c => !c.resolved).length;
const commentLabel = (state, sliceId, scenarioId) => {
  const n = openOn(state, sliceId, scenarioId);
  return n ? `${n} open` : 'Comment';
};

// readOnly: not checked out here, so no Edit and no + Scenario
export function openScenariosSheet(sliceId, { readOnly = false } = {}) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  const scenarios = getScenariosForSlice(slice.id, state);
  openBoardSheet(`
    <div class="sheet-title">Scenarios <span class="bd-sheet-sub">${escapeHtml(sliceTitle(slice, state))}</span>
      ${scenarios.some(s => scenarioHasIds(s, state)) ? `<button class="bd-ids-toggle" data-board-action="scn-ids" data-slice="${slice.id}" data-read-only="${readOnly ? 1 : 0}" aria-pressed="${idsHidden()}">${idsHidden() ? 'Show ids' : 'Hide ids'}</button>` : ''}
    </div>
    <button class="sheet-btn secondary bd-slice-cm" data-board-action="scn-comment" data-slice="${slice.id}">💬 ${openOn(state, slice.id, null) ? `${openOn(state, slice.id, null)} open on the slice` : 'Comment on the slice'}</button>
    ${scenarios.length ? `<div class="bd-scns">${scenarios.map(scn => `
      <details class="bd-scn">
        <summary>${scn.mustHave ? '<span class="must-star" title="Must have">★</span> ' : ''}${escapeHtml(scn.name || 'Scenario')}${openOn(state, slice.id, scn.id) ? ` <span class="bd-scn-cmcount">💬 ${openOn(state, slice.id, scn.id)}</span>` : ''}</summary>
        <div class="bd-scn-body">
          ${renderGwt(scn, state)}
          <div class="bd-scn-actions">
            <button class="sheet-btn secondary bd-scn-cm" data-board-action="scn-comment" data-slice="${slice.id}" data-scenario="${scn.id}">💬 ${commentLabel(state, slice.id, scn.id)}</button>
            ${readOnly ? '' : `<button class="sheet-btn secondary bd-scn-edit" data-board-action="scn-edit" data-scenario="${scn.id}">Edit</button>`}
          </div>
        </div>
      </details>`).join('')}
    </div>` : `<p class="sy-p">${readOnly ? 'No scenarios yet.' : 'No scenarios yet: say what should happen, given what already did.'}</p>`}
    ${readOnly ? '' : `<button class="sheet-btn" data-board-action="scn-add" data-slice="${slice.id}">+ Scenario</button>`}`);
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
    const slice = projectState().slices[t.dataset.slice];
    hideAllSheets();
    if (slice) setTimeout(() => window.EventPad.addScenario(slice.id, slice.type), 150);
    return true;
  }
  return false;
}
