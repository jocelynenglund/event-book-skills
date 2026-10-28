// ===========================================
// BOARD SHEETS - A slice's events: the board folds them into a pile, this
// drawer shows each one and adds another. Tapping an event goes to the command
// that produces it; ✎ edits it.
// ===========================================

import { projectState, sliceTitle, getOrderedSlices, givenEventsOf } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showElementOnBoard } from '../../../ui/feed.js';
import { elementLabel, externalAttr, propLabel } from '../../../core/constants.js';
import { openElementMenu } from '../../elementMenu/sheet.js';
import { escapeHtml } from '../view.js';
import { openCellSheet } from './cell.js';
import { openBoardSheet } from './shared.js';
import { openElementReadSheet } from '../../readOnly/sheet.js';

// Where an event comes from: the first change (or automation) slice that has it and a command
function producerOf(eventId, state) {
  const isCommand = id => state.elements[id]?.type === 'command';
  const slice = getOrderedSlices(state).find(s => s.type !== 'SV' && s.elements.includes(eventId) && s.elements.some(isCommand));
  return slice ? { slice, commandId: slice.elements.find(isCommand) } : null;
}

// readOnly: not checked out here, so no ✎ and no + (an event nothing produces reads its sticky)
// givens: the events its scenarios start from (tap one: the command that produces it)
export function openEventsSheet(sliceId, { readOnly = false, givens = false } = {}) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return;
  const given = givens ? givenEventsOf(sliceId, state) : [];
  const events = givens ? given.map(g => g.element) : slice.elements.map(id => state.elements[id]).filter(el => el?.type === 'event');
  const reads = slice.type === 'SV';
  const used = id => given.find(g => g.element.id === id)?.scenarios || 0;
  // A view's events in two groups once it has scenarios: what none of them starts from, and what some do
  const covered = new Set(givenEventsOf(sliceId, state).map(g => g.element.id));
  const split = !givens && reads && covered.size > 0;
  const groups = split
    ? [{ title: 'No scenario yet', items: events.filter(e => !covered.has(e.id)) }, { title: 'With scenarios', items: events.filter(e => covered.has(e.id)) }].filter(g => g.items.length)
    : [{ title: '', items: events }];
  if (givens) readOnly = true;   // these events belong to other slices: read, go to their command
  openBoardSheet(`
    <div class="sheet-title">${givens ? 'Given in its scenarios' : reads ? 'Events it reads' : 'Events'} <span class="bd-sheet-sub">${escapeHtml(sliceTitle(slice, state))}</span></div>
    <div class="bd-events">${groups.map(g => (g.title ? `<div class="bd-sheet-label">${g.title}</div>` : '') + g.items.map(el => {
      const from = producerOf(el.id, state);
      const go = from ? `data-board-action="event-go" data-el="${from.commandId}" data-slice="${from.slice.id}"`
        : `data-board-action="${readOnly ? 'event-read' : 'event-edit'}" data-el="${el.id}" data-slice="${slice.id}"`;
      return `
      <div class="bd-event-row">
        <button class="bd-card" data-type="event"${externalAttr(el)} ${go}>
          <span class="bd-card-kind">${escapeHtml(elementLabel(el))} · ${from ? `↳ from ${escapeHtml(sliceTitle(from.slice, state))}` : 'nothing produces it yet'}${givens ? ` · in ${used(el.id)} ${used(el.id) === 1 ? 'scenario' : 'scenarios'}` : ''}</span>
          <span class="bd-card-name">${escapeHtml(el.name)}</span>
          ${el.properties?.length ? `<div class="bd-props">${el.properties.map(p => `<span>${escapeHtml(propLabel(p))}</span>`).join('')}</div>` : ''}
        </button>
        ${readOnly ? '' : `<button class="bd-event-edit" data-board-action="event-edit" data-el="${el.id}" data-slice="${slice.id}" aria-label="Edit ${escapeHtml(el.name)}">✎</button>`}
      </div>`;
    }).join('')).join('')}
    </div>
    ${readOnly ? '' : `<button class="sheet-btn secondary" data-board-action="event-add" data-slice="${slice.id}">+ ${reads ? 'An event it reads' : 'Event'}</button>`}`);
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
