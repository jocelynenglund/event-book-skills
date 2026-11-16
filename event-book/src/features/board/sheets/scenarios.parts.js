// ===========================================
// BOARD SHEETS - Parts of a slice's scenarios drawer, drawn from Slice Scenarios Drawer alone
// ===========================================

import { scenarioLinesBlock } from '../../scenarios/scenarios.parts.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Show ids / Hide ids: ids in values read as aliases or not at all
export function idsToggleButton(drawer) {
  return `<button class="bd-ids-toggle" data-component="Ids toggle" data-key="${drawer.sliceId}" data-board-action="scn-ids" data-slice="${drawer.sliceId}" data-read-only="${drawer.readOnly ? 1 : 0}" aria-pressed="${drawer.idsHidden}">${drawer.idsHidden ? 'Show ids' : 'Hide ids'}</button>`;
}

// Comment on the slice itself
export function sliceCommentButton(drawer) {
  return `<button class="sheet-btn secondary bd-slice-cm" data-component="Slice comment button" data-key="${drawer.sliceId}" data-board-action="scn-comment" data-slice="${drawer.sliceId}">💬 ${escapeHtml(drawer.sliceComment)}</button>`;
}

// One scenario folded to its name, opened to its lines, with Comment and (unless read only) Edit
export function scenarioDrawerItem(scn) {
  return `
      <details class="bd-scn" data-component="Scenario drawer item" data-key="${scn.id}">
        <summary>${scn.mustHave ? '<span class="must-star" title="Must have">★</span> ' : ''}${escapeHtml(scn.name)}${scn.openComments ? ` <span class="bd-scn-cmcount">💬 ${scn.openComments}</span>` : ''}</summary>
        <div class="bd-scn-body">
          ${scenarioLinesBlock(scn.lines)}
          <div class="bd-scn-actions">
            <button class="sheet-btn secondary bd-scn-cm" data-board-action="scn-comment" data-slice="${scn.sliceId}" data-scenario="${scn.id}">💬 ${scn.commentLabel}</button>
            ${scn.readOnly ? "" : `<button class="sheet-btn secondary bd-scn-edit" data-board-action="scn-edit" data-scenario="${scn.id}">Edit</button>`}
          </div>
        </div>
      </details>`;
}

// + Scenario
export function addScenarioButton(drawer) {
  return `<button class="sheet-btn" data-component="Add scenario button" data-key="${drawer.sliceId}" data-board-action="scn-add" data-slice="${drawer.sliceId}">+ Scenario</button>`;
}

// The whole sheet
export function scenariosDrawerBody(drawer) {
  return `
    <div class="sheet-title">Scenarios <span class="bd-sheet-sub">${escapeHtml(drawer.sub)}</span>
      ${drawer.hasIds ? idsToggleButton(drawer) : ''}
    </div>
    ${sliceCommentButton(drawer)}
    ${drawer.scenarios.length ? `<div class="bd-scns">${drawer.scenarios.map(scenarioDrawerItem).join('')}
    </div>` : `<p class="sy-p">${drawer.readOnly ? 'No scenarios yet.' : 'No scenarios yet: say what should happen, given what already did.'}</p>`}
    ${drawer.readOnly ? '' : addScenarioButton(drawer)}`;
}
