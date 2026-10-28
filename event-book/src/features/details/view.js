// ===========================================
// DETAILS - View (SV: View Element Details)
// Every element grouped by type, with its properties, the slices it's in
// and what it's linked to. Tap a property to edit it.
// ===========================================

import { projectState, getOrderedSlices, getScenariosForSlice, getScenariosWithoutSlice, sliceTitle } from '../../core/projections.js';
import { moveScenario } from '../scenarios/command.js';
import { toastWithUndo } from '../undo/command.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { renderGwt } from '../scenarios/view.js';
import { typeLabels, elementLabel, externalAttr, connectionLabels, reverseConnectionLabels, propLabel } from '../../core/constants.js';
import { escapeHtml } from '../board/view.js';
import { openPropertySheet } from '../properties/sheet.js';
import { openElementMenu } from '../elementMenu/sheet.js';
import { showElementOnBoard, render } from '../../ui/feed.js';
import { showToast } from '../../ui/toast.js';
import { isReadOnly } from '../readOnly/sheet.js';

// The data-carrying types first: they're what people come here to read
const sections = [
  { type: 'command', title: 'Commands' },
  { type: 'event', title: 'Events' },
  { type: 'readModel', title: 'Read models' },
  { type: 'screen', title: 'Screens' },
  { type: 'processor', title: 'Automations' }
];

let filter = 'all';

function renderLinks(el, state) {
  const seen = new Set();
  const links = [];
  state.connections.forEach(c => {
    const out = c.from === el.id;
    if (!out && c.to !== el.id) return;
    const other = state.elements[out ? c.to : c.from];
    if (!other) return;
    const label = out ? (connectionLabels[c.relation] || c.relation) : (reverseConnectionLabels[c.relation] || 'from');
    const key = label + other.id;
    if (seen.has(key)) return;
    seen.add(key);
    links.push(`<span class="dt-link"><span class="dt-link-rel">${escapeHtml(label)}</span> <button class="dt-link-el" data-details-action="show-el" data-el="${other.id}" data-type="${other.type}"${externalAttr(other)}>${escapeHtml(other.name)}</button></span>`);
  });
  return links.length ? `<div class="dt-links">${links.join('')}</div>` : '';
}

function renderElement(el, slicesByElement, state) {
  const inSlices = slicesByElement.get(el.id) || [];
  const props = el.properties.length
    ? `<div class="dt-props">
        ${el.properties.map(p => `
          <button class="dt-prop" data-details-action="edit-prop" data-el="${el.id}" data-prop="${p.id}">
            <span class="dt-prop-name">${escapeHtml(propLabel(p))}</span>
            <span class="dt-prop-type">${escapeHtml(p.type || 'string')}</span>
          </button>`).join('')}
      </div>`
    : `<div class="dt-empty">No properties yet</div>`;

  return `
    <article class="dt-card" data-type="${el.type}"${externalAttr(el)}>
      <button class="dt-card-head" data-details-action="element" data-el="${el.id}">
        <span class="dt-kind">${elementLabel(el)}</span>
        <span class="dt-name">${escapeHtml(el.name)}</span>
      </button>
      ${inSlices.length ? `<div class="dt-slices">${inSlices.map(s => `<span class="dt-slice">${escapeHtml(sliceTitle(s, state))}</span>`).join('')}</div>` : ''}
      ${props}
      <button class="dt-add" data-details-action="add-props" data-el="${el.id}">+ Add properties</button>
      ${renderLinks(el, state)}
    </article>`;
}

export function renderDetails() {
  const container = document.getElementById('detailsView');
  if (!container) return;
  const state = projectState();

  // Slices each element appears in, in board order; elements sort by first appearance
  const ordered = getOrderedSlices(state);
  const slicesByElement = new Map();
  ordered.forEach(s => s.elements.forEach(id => {
    if (!slicesByElement.has(id)) slicesByElement.set(id, []);
    slicesByElement.get(id).push(s);
  }));
  const position = id => {
    const first = slicesByElement.get(id)?.[0];
    return first ? ordered.indexOf(first) : Infinity;
  };

  const byType = Object.fromEntries(sections.map(({ type }) => [type,
    Object.values(state.elements)
      .filter(e => e.type === type)
      .sort((a, b) => position(a.id) - position(b.id) || a.name.localeCompare(b.name))
  ]));

  // Scenarios whose slice was deleted: listed first, each with Move to slice…
  const orphans = getScenariosWithoutSlice(state);

  // Scenarios (Given/When/Then), grouped by slice in board order
  const scenarioGroups = ordered
    .map(slice => ({ slice, scenarios: getScenariosForSlice(slice.id, state) }))
    .filter(g => g.scenarios.length);
  const scenarioCount = scenarioGroups.reduce((n, g) => n + g.scenarios.length, 0) + orphans.length;

  const total = Object.values(byType).reduce((n, list) => n + list.length, 0);
  // A filtered type whose last element was deleted falls back to All
  const counts = { ...Object.fromEntries(sections.map(s => [s.type, byType[s.type].length])), scenarios: scenarioCount };
  if (filter !== 'all' && !counts[filter]) filter = 'all';
  const chips = [
    { type: 'all', title: 'All', count: total + scenarioCount },
    ...sections.map(s => ({ ...s, count: byType[s.type].length })),
    { type: 'scenarios', title: 'Scenarios', count: scenarioCount }
  ]
    .filter(c => c.type === 'all' || c.count)
    .map(c => `<button class="dt-filter ${filter === c.type ? 'active' : ''}" data-details-action="filter" data-filter="${c.type}">${c.title} <span>${c.count}</span></button>`)
    .join('');

  let body = sections
    .filter(({ type }) => byType[type].length && (filter === 'all' || filter === type))
    .map(({ type, title }) => `
      <section class="dt-section">
        <h2 class="dt-section-title">${title} <span>${byType[type].length}</span></h2>
        ${byType[type].map(el => renderElement(el, slicesByElement, state)).join('')}
      </section>`).join('');

  if (orphans.length && (filter === 'all' || filter === 'scenarios')) {
    body = `
      <section class="dt-section dt-orphans">
        <h2 class="dt-section-title">Scenarios without a slice <span>${orphans.length}</span></h2>
        <p class="dt-orphans-note">Their slice was deleted. Move each onto a slice to keep it.</p>
        ${orphans.map(scn => `
          <div class="dt-card dt-scenario">
            <span class="dt-name">${escapeHtml(scn.name)}</span>
            ${renderGwt(scn, state)}
            <button class="dt-move" data-details-action="move-scenario" data-scenario="${scn.id}">Move to slice…</button>
          </div>`).join('')}
      </section>` + body;
  }

  if (scenarioCount - orphans.length && (filter === 'all' || filter === 'scenarios')) {
    body += `
      <section class="dt-section">
        <h2 class="dt-section-title">Scenarios <span>${scenarioCount - orphans.length}</span></h2>
        ${scenarioGroups.map(({ slice, scenarios }) => `
          <div class="dt-scenario-slice">${escapeHtml(sliceTitle(slice, state))}</div>
          ${scenarios.map(scn => `
            <button class="dt-card dt-scenario" data-details-action="scenario" data-scenario="${scn.id}">
              <span class="dt-name">${escapeHtml(scn.name)}</span>
              ${renderGwt(scn, state)}
            </button>`).join('')}`).join('')}
      </section>`;
  }

  container.innerHTML = `
    <div class="dt-filters">${chips}</div>
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
    const state = projectState();
    toastWithUndo(`Moved to ${sliceTitle(state.slices[t.dataset.slice], state)}`);
  }
  // A linked element: go to it on the board
  else if (a === 'show-el' && !showElementOnBoard(t.dataset.el)) showToast('Not on the board yet');
}

// Move to slice…: every slice, searchable, its kind and chapter beside it
function openMoveScenario(scenarioId) {
  const state = projectState();
  const scn = state.scenarios[scenarioId];
  if (!scn) return;
  const kind = { SC: 'Change', SV: 'View', AU: 'Automation' };
  const rows = getOrderedSlices(state).map(s => `
    <button class="share-scope-option dt-move-option" data-details-action="move-to" data-scenario="${scenarioId}" data-slice="${s.id}"
      data-key="${escapeHtml(`${sliceTitle(s, state)} ${state.chapters[s.chapterId]?.name || ''}`.toLowerCase())}">
      <b>${escapeHtml(sliceTitle(s, state))}</b>
      <span class="dt-move-meta">${kind[s.type] || s.type}${s.chapterId && state.chapters[s.chapterId] ? ` · ${escapeHtml(state.chapters[s.chapterId].name)}` : ''}</span>
    </button>`).join('');
  openBoardSheet(`
    <div class="sheet-title">Move to slice <span class="bd-sheet-sub">${escapeHtml(scn.name)}</span></div>
    <input type="search" class="sheet-input" id="dtMoveSearch" placeholder="Search slices…" autocomplete="off">
    <div class="share-scope-list dt-move-list" id="dtMoveList">${rows || '<div class="share-scope-none">No slices yet</div>'}</div>`, 'dtMoveSearch');
  document.getElementById('dtMoveSearch').oninput = e => {
    const words = e.target.value.toLowerCase().split(/\s+/).filter(Boolean);
    document.querySelectorAll('#dtMoveList .dt-move-option').forEach(b => { b.hidden = !words.every(w => b.dataset.key.includes(w)); });
  };
}

export function initDetails() {
  document.getElementById('detailsView')?.addEventListener('click', handleClick);
  // Move to slice… lives in the board sheet
  document.getElementById('boardSheetContent')?.addEventListener('click', e => {
    if (e.target.closest('[data-details-action="move-to"]')) handleClick(e);
  });
}
