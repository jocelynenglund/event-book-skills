// ===========================================
// DETAILS - View (SV: View Element Details)
// Every element grouped by type, with its properties, the slices it's in
// and what it's linked to. Tap a property to edit it.
// ===========================================

import { moveScenario } from '../scenarios/command.js';
import { toastWithUndo } from '../undo/command.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { escapeHtml } from '../board/view.js';
import { openPropertySheet } from '../properties/sheet.js';
import { openElementMenu } from '../elementMenu/sheet.js';
import { showElementOnBoard, render } from '../../ui/feed.js';
import { showToast } from '../../ui/toast.js';
import { isReadOnly } from '../readOnly/sheet.js';
import { detailsPage } from './detailsPage.read.js';
import { moveScenarioChoices } from './moveScenarioChoices.read.js';
import { movedToSlice } from './movedToSlice.read.js';
import { detailsFilter, detailsCard, detailsOrphan, detailsScenario, detailsMoveOption } from './details.parts.js';

let filter = 'all';

export function renderDetails() {
  const container = document.getElementById('detailsView');
  if (!container) return;
  const page = detailsPage(filter);
  filter = page.filter;
  const section = (title, count, inner, cls = '') => `
      <section class="dt-section${cls}">
        <h2 class="dt-section-title">${title} <span>${count}</span></h2>
        ${inner}
      </section>`;
  let body = page.sections.map(sec => section(sec.title, sec.count, sec.cards.map(detailsCard).join(''))).join('');
  if (page.orphans) {
    body = `
      <section class="dt-section dt-orphans">
        <h2 class="dt-section-title">Scenarios without a slice <span>${page.orphans.count}</span></h2>
        <p class="dt-orphans-note">Their slice was deleted. Move each onto a slice to keep it.</p>
        ${page.orphans.scenarios.map(detailsOrphan).join('')}
      </section>` + body;
  }
  if (page.scenarios) {
    body += section('Scenarios', page.scenarios.count, page.scenarios.groups.map(g => `
          <div class="dt-scenario-slice">${escapeHtml(g.title)}</div>
          ${g.scenarios.map(detailsScenario).join('')}`).join(''));
  }
  container.innerHTML = `
    <div class="dt-filters">${page.chips.map(detailsFilter).join('')}</div>
    ${body || `<div class="dt-none">Nothing here yet. Build slices on the board and their elements show up here.</div>`}`;
}

function handleClick(e) {
  const t = e.target.closest('[data-details-action]');
  if (!t) return;
  const a = t.dataset.detailsAction;
  if (isReadOnly() && (a === 'move-scenario' || a === 'move-to')) return;   // not checked out here
  if (a === 'filter') {
    filter = t.dataset.filter;
    renderDetails();
  } else if (a === 'edit-prop') openPropertySheet(t.dataset.el, t.dataset.prop);
  else if (a === 'add-props') openPropertySheet(t.dataset.el);
  else if (a === 'element') openElementMenu(t.dataset.el);
  else if (a === 'scenario') window.EventPad.editScenario(t.dataset.scenario);
  else if (a === 'move-scenario') openMoveScenario(t.dataset.scenario);
  else if (a === 'move-to') {
    moveScenario(t.dataset.scenario, t.dataset.slice);
    hideAllSheets();
    render();
    toastWithUndo(movedToSlice(t.dataset.slice));
  }
  // A linked element: go to it on the board
  else if (a === 'show-el' && !showElementOnBoard(t.dataset.el)) showToast('Not on the board yet');
}

// Move to slice…: every slice, searchable, its kind and chapter beside it
function openMoveScenario(scenarioId) {
  const choices = moveScenarioChoices(scenarioId);
  if (!choices) return;
  const rows = choices.rows.map(detailsMoveOption).join('');
  openBoardSheet(`
    <div class="sheet-title">Move to slice <span class="bd-sheet-sub">${escapeHtml(choices.name)}</span></div>
    <input type="search" class="sheet-input" id="dtMoveSearch" placeholder="Search slices…" autocomplete="off">
    <div class="share-scope-list dt-move-list" id="dtMoveList">${rows || '<div class="share-scope-none">No slices yet</div>'}</div>`, 'dtMoveSearch');
  document.getElementById('dtMoveSearch').oninput = e => {
    const words = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);
    document.querySelectorAll('#dtMoveList .dt-move-option').forEach(b => { b.hidden = !words.every(w => b.dataset.search.includes(w)); });
  };
}

export function initDetails() {
  document.getElementById('detailsView')?.addEventListener('click', handleClick);
  // Move to slice… lives in the board sheet
  document.getElementById('boardSheetContent')?.addEventListener('click', e => {
    if (e.target.closest('[data-details-action="move-to"]')) handleClick(e);
  });
}
