// ===========================================
// BOARD - View (SV: View Board)
// Time flows left → right, one column per slice, three swimlanes:
// UI / automation · commands & views · events
// ===========================================

import { statusChips, shows, filtering, emptyText, filterFor } from '../filter/status.js';
import { isNeat } from '../../ui/settings.js';
import { fieldsFolded, foldedLabel } from './foldedFields.js';
import { projectState, givenEventsOf, eventsWithoutScenario, getBoardGroups, getTodoUpdates, sliceFlow, chapterFlows, elementFlow, sliceTitle } from '../../core/projections.js';
import { getScenariosForSlice } from '../../core/projections.js';
import { typeLabels, elementLabel, externalAttr, propLabel } from '../../core/constants.js';
import { laneOf, laneTypeFor, sliceActor, sliceProcessor, isTrigger } from './command.js';
import { renderGwt } from '../scenarios/view.js';
import { sliceComments, openComments } from '../comments/read.js';
import { getEventStream, historyOf } from '../../core/eventStore.js';
import { usageBadge, usageButton, chapterMeter } from '../usage/view.js';

export const sliceTypeLabels = { SC: 'State change', SV: 'State view', AU: 'Automation' };
export const laneLabels = ['UI · Automation', 'Commands · Views', 'Events'];
// The board's lanes can be short; automations read as such from their purple notes
const boardLaneLabels = ['UI', 'Commands · Views', 'Events'];

// Folded chapters show as a book spine. A per-device view preference, so it
// lives in localStorage rather than the model's event stream.
// Folded chapters, and ones opened by hand. A chapter nobody has touched is folded
// when its model is big (more than 20 slices), so a big model opens as a row of books.
const FOLD_KEY = 'eventpad_folded_chapters';
const OPEN_KEY = 'eventpad_opened_chapters';
const BIG_MODEL = 20;
let folded = new Set();
let opened = new Set();
try { folded = new Set(JSON.parse(localStorage.getItem(FOLD_KEY) || '[]')); } catch (e) { /* storage blocked */ }
try { opened = new Set(JSON.parse(localStorage.getItem(OPEN_KEY) || '[]')); } catch (e) { /* storage blocked */ }
let foldByDefault = false;

// Called with the open model's slice count before the board or outline draws
export function setModelSize(sliceCount) { foldByDefault = sliceCount > BIG_MODEL; }

export function isChapterFolded(chapterId) {
  if (folded.has(chapterId)) return true;
  if (opened.has(chapterId)) return false;
  return foldByDefault;
}

// Which flow each chapter shows (none: all its slices). Per device, like folds.
const FLOW_KEY = 'eventpad_chapter_flow';
let shownFlow = {};
try { shownFlow = JSON.parse(localStorage.getItem(FLOW_KEY) || '{}') || {}; } catch (e) { /* storage blocked */ }

export function shownFlowOf(chapterId, state) {
  const id = shownFlow[chapterId];
  return id && state.flows?.[id]?.chapterId === chapterId ? state.flows[id] : null;
}

export function showFlow(chapterId, flowId) {
  if (flowId) shownFlow[chapterId] = flowId; else delete shownFlow[chapterId];
  try { localStorage.setItem(FLOW_KEY, JSON.stringify(shownFlow)); } catch (e) { /* storage blocked */ }
  renderBoard();
}

// A chapter with flows shows its main line (the happy case) or one flow: the
// main line plus that flow's slices, in order. Always read left to right.
export function applyFlows(groups, state) {
  return groups.map(g => {
    if (!g.chapter || !chapterFlows(g.chapter.id, state).length) return g;
    const flow = shownFlowOf(g.chapter.id, state);
    return { ...g, flow, slices: g.slices.filter(s => { const f = sliceFlow(s, state); return !f || f.id === flow?.id; }) };
  });
}

// An outcome event of another flow than the one shown (on the main line: any flow)
export function otherFlowOutcome(el, slice, state) {
  const f = elementFlow(el, slice, state);
  return !!f && f.id !== (shownFlowOf(slice.chapterId, state)?.id || 'main');
}

// The scenarios lane under the events: open shows each slice's Given / When /
// Then, closed is a slim strip with counts. Closed whenever the app opens.
let gwtOpen = false;

export function toggleGwtLane() {
  gwtOpen = !gwtOpen;
  renderBoard();
}

function renderGwtCell(slice, col, state) {
  const scenarios = getScenariosForSlice(slice.id, state);
  if (!gwtOpen) {
    // A slice's scenarios open in a drawer (sheets/scenarios.js); the lane's label opens them all
    const count = scenarios.length
      ? `<button class="bd-gwt-count" data-action="gwt-drawer" data-slice="${slice.id}">✓ ${scenarios.length} ${scenarios.length === 1 ? 'scenario' : 'scenarios'}</button>`
      : slice.id.startsWith('au_inferred_') ? '' : `<button class="bd-gwt-count add" data-action="gwt-drawer" data-slice="${slice.id}">＋ Scenario</button>`;
    // Below the count: the events their Givens start from, as a small stack (tap: the drawer)
    const givens = givenEventsOf(slice.id, state);
    const stack = givens.length
      ? `<button class="bd-card bd-pile bd-givens" data-type="event" data-layers="${Math.min(givens.length, 3)}" data-action="givens" data-slice="${slice.id}" aria-label="${givens.length} events the scenarios start from">
           <span class="bd-card-kind">Given · ${givens.length} ${givens.length === 1 ? 'event' : 'events'} ▸</span>
           <span class="bd-givens-names">${stackNames(givens.map(g => g.element.name))}</span>
         </button>` : '';
    return `<div class="bd-cell lane-3 closed" ${at(col, 6)}>${count}${stack}</div>`;
  }
  const cards = scenarios.map(scn => `
    <button class="bd-gwt" data-action="scenario" data-scenario="${scn.id}">
      <span class="bd-gwt-name">${scn.mustHave ? '<span class="must-star" title="Must have">★</span> ' : ''}${escapeHtml(scn.name || 'Scenario')}</span>
      ${renderGwt(scn, state)}
    </button>`).join('');
  const add = slice.id.startsWith('au_inferred_') ? ''
    : `<button class="bd-add ${scenarios.length ? 'more' : ''}" data-action="add-scenario" data-slice="${slice.id}">+ ${scenarios.length ? '' : 'Scenario'}</button>`;
  return `<div class="bd-cell lane-3" ${at(col, 6)}>${cards}${add}</div>`;
}

// Close (or open) every book at once
export function setAllChaptersFolded(chapterIds, fold) {
  chapterIds.forEach(id => {
    if (fold) { opened.delete(id); folded.add(id); } else { folded.delete(id); opened.add(id); }
  });
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify([...folded]));
    localStorage.setItem(OPEN_KEY, JSON.stringify([...opened]));
  } catch (e) { /* storage blocked: just this time */ }
}

// Bookmarked chapters stay open. On a phone, opening a chapter folds the other open ones
// (one at a time), but not the bookmarked ones. Per device, like folds.
const MARK_KEY = 'eventpad_bookmarked_chapters';
let marked = new Set();
try { marked = new Set(JSON.parse(localStorage.getItem(MARK_KEY) || '[]')); } catch (e) { /* storage blocked */ }
const onPhone = () => !!window.matchMedia?.('(max-width: 700px)').matches;

export const isChapterBookmarked = chapterId => marked.has(chapterId);

export function toggleChapterBookmark(chapterId) {
  if (marked.has(chapterId)) marked.delete(chapterId); else marked.add(chapterId);
  try { localStorage.setItem(MARK_KEY, JSON.stringify([...marked])); } catch (e) { /* storage blocked */ }
  renderBoard();
}

export function toggleChapterFolded(chapterId) {
  if (isChapterFolded(chapterId)) {
    folded.delete(chapterId); opened.add(chapterId);
    if (onPhone()) projectState().chapterOrder
      .filter(id => id !== chapterId && !marked.has(id) && !isChapterFolded(id))
      .forEach(id => { opened.delete(id); folded.add(id); });
  }
  else { opened.delete(chapterId); folded.add(chapterId); }
  try {
    localStorage.setItem(FOLD_KEY, JSON.stringify([...folded]));
    localStorage.setItem(OPEN_KEY, JSON.stringify([...opened]));
  } catch (e) { /* storage blocked */ }
  renderBoard();
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Arrow between lane n-1 and lane n, per slice type
// SC flows down (screen → command → event), SV flows up (event → view → screen),
// AU: processor ↓ command (the trigger event feeds the processor, past the command)
const flows = {
  SC: [null, 'down', 'down'],
  SV: [null, 'up', 'up'],
  AU: [null, 'down', null]
};

// Sticky notes sit slightly askew; derived from ids so a note keeps its angle (straight when Neat)
const tilts = [-1.2, 0.8, -0.5, 1.1, -0.9];
export function noteTilt(key) {
  if (isNeat()) return 0;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return tilts[Math.abs(h) % tilts.length];
}

// Small tags under a card, shared by the board and the poster:
// - a to-do list: the events that add (+) or tick off (✓) its items
// - a processor: the read models it reads and the events that trigger it, when
//   they aren't in this column, so a one-slice automation still says what drives it
export function cardTags(el, slice, state) {
  if (el.type === 'readModel' && el.todo) {
    // Start to finish: what adds an item first, then what ticks it off
    return getTodoUpdates(el.id, state)
      .sort((a, b) => (a.role === 'completes') - (b.role === 'completes'))
      .map(({ event, role }) => ({
        text: `${role === 'completes' ? '✓' : '+'} ${event.name}`, kind: role, flip: event.id, external: !!event.external
      }));
  }
  if (el.type === 'processor') {
    // An automation pair's halves sit side by side, so the partner counts as "here"
    const partner = slice?.pairWith && state.slices[slice.pairWith];
    // ...and the processor's inputs are said once, on the view half (the left one)
    if (slice?.type === 'SC' && partner?.type === 'SV' && partner.elements.includes(el.id)) return [];
    const here = new Set([...(slice?.elements || []), ...(partner?.elements || [])]);
    const reads = state.connections
      .filter(c => c.from === el.id && c.relation === 'context' && !here.has(c.to) && state.elements[c.to])
      .map(c => ({ text: `${state.elements[c.to].todo ? '☑ ' : ''}reads ${state.elements[c.to].name}`, kind: 'reads' }));
    const triggers = state.connections
      .filter(c => c.to === el.id && c.relation === 'trigger' && !here.has(c.from) && state.elements[c.from])
      .map(c => ({ text: `⚡ on ${state.elements[c.from].name}`, kind: 'trigger', external: !!state.elements[c.from].external }));
    return [...reads, ...triggers];
  }
  return [];
}

// Each to-do list's first slice, left to right (shared with the poster)
export function firstAppearances(groups, state) {
  const first = {};
  groups.flatMap(g => g.slices).forEach(s => s.elements.forEach(id => {
    if (state.elements[id]?.todo && !first[id]) first[id] = s.id;
  }));
  return first;
}

// A saga's to-do list shows in full where it first appears; later columns that
// read the same list get a slim reference. Set per render.
let todoFirstSlice = {};

// trigger: this event wakes the slice's processor up (not just feeds its read models)
function renderCard(el, sliceId, trigger = false, state = null) {
  const todo = el.type === 'readModel' && el.todo;
  if (todo && todoFirstSlice[el.id] !== sliceId) {
    return `
    <button class="bd-card bd-card-ref" data-type="${el.type}" data-todo="true" data-action="element" data-el="${el.id}" data-slice="${sliceId}">
      <span class="bd-card-name">☑ ${escapeHtml(el.name)} <span class="bd-ref-mark" title="Same to-do list as before">↺</span></span>
    </button>`;
  }
  const props = el.properties?.length && fieldsFolded(el.id)
    ? `<div class="bd-props bd-props-folded">${foldedLabel(el.properties.length)}</div>`
    : el.properties?.length
    ? `<div class="bd-props">${el.properties.map(p => `<span data-prop="${p.id}"${p.generated ? ' class="bd-prop-generated" title="Generated"' : ''}>${p.generated ? '⚙' : ''}${escapeHtml(propLabel(p))}</span>`).join('')}</div>`
    : '';
  // A to-do list's updates (tap a tag to flip + ⇄ ✓); a processor's inputs from elsewhere
  const tags = state ? cardTags(el, state.slices[sliceId], state) : [];
  const updates = tags.length ? `<div class="bd-todo-tags">${tags.map(tag =>
    `<span class="bd-todo-tag" data-role="${tag.kind}"${tag.flip ? ` data-flip="${tag.flip}"` : ''}>${escapeHtml(tag.text)}</span>`).join('')}</div>${todo ? '<div class="bd-todo-hint">＋ adds · ✓ ticks off · tap a tag to switch</div>' : ''}` : '';
  const slice = state?.slices[sliceId];
  const outcome = state && el.type === 'event' ? elementFlow(el, slice, state) : null;
  const other = outcome && otherFlowOutcome(el, slice, state);
  return `
    <button class="bd-card" style="--tilt: ${noteTilt(sliceId + el.id)}deg" data-type="${el.type}"${externalAttr(el)}${other ? ' data-other-flow="true"' : ''}${trigger ? ' data-trigger="true"' : ''}${todo ? ' data-todo="true"' : ''}${el.type === 'readModel' && el.list && !todo ? ' data-list="true"' : ''} data-action="element-read" data-el="${el.id}" data-slice="${sliceId}">
      <span class="bd-card-kind">${trigger ? '⚡ Trigger · ' : ''}${todo ? '☑ To-do list' : elementLabel(el)}${outcome ? ` · ↳ ${escapeHtml(outcome.name)}` : ''}</span>
      <span class="bd-card-title"><span class="bd-card-more" role="button" aria-label="Edit ${escapeHtml(el.name)}" data-action="element" data-el="${el.id}" data-slice="${sliceId}">⋮</span><span class="bd-card-name">${escapeHtml(el.name)}</span></span>
      ${props}
      ${updates}
    </button>`;
}


// Every cell is placed explicitly so a chapter header can span its slices' columns.
// Rows: 1 chapter · 2 slice header · 3–5 lanes
const at = (col, row, span = 1) => `style="grid-column: ${col} / span ${span}; grid-row: ${row}"`;

// A view only reads its events: on the board they're one pile, not stickies to
// edit. Tap it for the events drawer (sheets/events.js). A change's events stay
// out (flows mark their outcomes), and so do a processor's (⚡ trigger).
const piled = (slice, lane, laneEls, state) => lane === 2 && laneEls.length > 0 && slice.type === 'SV' && sliceActor(slice, state) !== 'processor';

// Every event, one a line while the list is short; flowing inline (smaller) once it's long
const LONG_STACK = 6;
const stackNames = names => names.length > LONG_STACK
  ? `<span class="bd-names-inline">${names.map(escapeHtml).join(' · ')}</span>`
  : names.map(n => `<span>${escapeHtml(n)}</span>`).join('');

// The events a view reads that no scenario starts from yet; the covered ones are in the given
// stack under the scenarios. With no scenarios at all it's still "the events it reads".
function renderPile(slice, laneEls, flow, col, state) {
  const names = stackNames(laneEls.map(el => el.name));
  const more = '';
  const hasScenarios = getScenariosForSlice(slice.id, state).length > 0;
  const kind = `${laneEls.length} ${laneEls.length === 1 ? 'event' : 'events'}${slice.type === 'SV' ? (hasScenarios ? ' with no scenario yet' : ' it reads') : ''}`;
  return `<div class="bd-cell lane-2" ${at(col, 5)} ${flow ? `data-flow="${flow}"` : ''}>
    <button class="bd-card bd-pile" data-type="event" data-layers="${Math.min(laneEls.length, 3)}" style="--tilt: ${noteTilt(slice.id + 'pile')}deg" data-action="events" data-slice="${slice.id}" aria-label="${kind}: open the events">
      <span class="bd-card-kind">${kind} ▸</span>
      <span class="bd-pile-names">${names}${more}</span>
    </button></div>`;
}

function renderLane(slice, lane, laneEls, flow, state, col) {
  if (piled(slice, lane, laneEls, state)) {
    const open = new Set(eventsWithoutScenario(slice.id, state).map(e => e.id));
    const uncovered = laneEls.filter(e => open.has(e.id));
    if (uncovered.length) return renderPile(slice, uncovered, flow, col, state);
    laneEls = [];   // every event is covered: they're in the given stack under the scenarios
  }
  const type = laneTypeFor(slice, lane, state);
  const processor = sliceProcessor(slice, state);
  const cards = laneEls.map(el =>
    renderCard(el, slice.id, el.type === 'event' && processor && isTrigger(el.id, processor.id, state), state)).join('');
  // Events can stack (a command may emit several, a view may read several), and a
  // processor can read several read models
  const readsMany = lane === 1 && slice.type === 'SV' && sliceActor(slice, state) === 'processor';
  const canAdd = type && !slice.id.startsWith('au_inferred_') && (laneEls.length === 0 || lane === 2 || readsMany);
  const add = canAdd
    ? `<button class="bd-add ${laneEls.length ? 'more' : ''}" data-type="${type}" data-action="add" data-slice="${slice.id}" data-lane-type="${type}">
         + ${laneEls.length ? '' : typeLabels[type]}
       </button>`
    : '';
  return `<div class="bd-cell lane-${lane}" ${at(col, lane + 3)} ${flow ? `data-flow="${flow}"` : ''}>${cards}${add}</div>`;
}

// prev/next: neighbouring slices in the same group, for ◀ ▶ (null at the edges).
// A "+" on the divider between two slices of a group inserts one there; the
// chapter header's ＋ and the floating button cover the edges.
// The board is for building: a refined slice is ready to build (an open box) until it's
// confirmed built from the tests (ticked: done). A slice not refined yet shows nothing.
function buildChip(slice) {
  if (!slice.refined) return '';
  return slice.built
    ? '<span class="bd-build bd-done" aria-label="Done"><span class="ol-tick on" aria-hidden="true"></span>Done</span>'
    : '<span class="bd-build bd-ready" aria-label="Ready to build"><span class="ol-tick" aria-hidden="true"></span>Ready</span>';
}

function renderColumn(slice, col, prev, next, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const byLane = [0, 1, 2].map(l => els.filter(e => laneOf[e.type] === l));
  const movable = state.sliceOrder.includes(slice.id);
  const scenarios = getScenariosForSlice(slice.id, state).length;
  const sliceFlows = flows[slice.type] || [];

  const head = `
    <div class="bd-head" ${at(col, 2)} data-slice-type="${slice.type}" data-actor="${sliceActor(slice, state)}">
      ${movable && prev ? `<button class="bd-insert" aria-label="Add a slice here" data-action="insert" data-before="${slice.id}">+</button>` : ''}
      <button class="bd-head-name" data-action="slice-page" data-slice="${slice.id}">
        <span class="bd-head-type">${sliceTypeLabels[slice.type] || slice.type}${scenarios ? ` · ${scenarios} ✓` : ''}</span>
        ${sliceFlow(slice, state) ? `<span class="bd-head-flow">↳ ${escapeHtml(sliceFlow(slice, state).name)}</span>` : ''}
        <span class="bd-head-title"><span class="bd-head-text">${escapeHtml(sliceTitle(slice, state))}</span>${usageBadge(slice, state)}${buildChip(slice)}</span>
      </button>
      <button class="bd-more" aria-label="Edit this slice" data-action="slice-menu" data-slice="${slice.id}">⋮</button>
      <div class="bd-head-tools">
        ${movable ? `
        <div class="bd-move">
          <button aria-label="Move left" data-action="move" data-slice="${slice.id}" data-to="${prev || ''}" ${prev ? '' : 'disabled'}>◀</button>
          <button aria-label="Move right" data-action="move" data-slice="${slice.id}" data-to="${next || ''}" ${next ? '' : 'disabled'}>▶</button>
        </div>` : ''}
      </div>
    </div>`;

  const lanes = [0, 1, 2].map(l => {
    const flow = sliceFlows[l] && byLane[l].length && byLane[l - 1].length ? sliceFlows[l] : null;
    return renderLane(slice, l, byLane[l], flow, state, col);
  }).join('');

  return head + lanes + renderGwtCell(slice, col, state) + (hasComments ? renderCommentCell(slice, col, state) : '');
}

// The comment lane, under the scenarios (only when the book has comments): each slice's open
// threads, with the line they're about; tap one for the thread, the label jumps to the next
let hasComments = false;
const partLabel = { given: 'Given', when: 'When', then: 'Then' };
function renderCommentCell(slice, col, state) {
  const open = sliceComments(state, slice.id).threads.filter(t => !t.resolved);
  const threads = open.map(t => `
    <button class="bd-cm" data-action="comment" data-slice="${slice.id}"${t.scenarioId ? ` data-scenario="${t.scenarioId}"` : ''} data-cm-anchor="${t.commentId}">
      <span class="bd-cm-meta"><b>${escapeHtml(t.nickname)}</b>${t.scenarioName ? ` · ${escapeHtml(t.scenarioName)}` : ''}${t.part ? ` <span class="cm-part">${partLabel[t.part]}</span>` : ''}</span>
      <span class="bd-cm-text">${escapeHtml(t.text)}</span>
    </button>`).join('');
  return `<div class="bd-cell lane-cm" ${at(col, 7)}>${threads}</div>`;
}

function renderChapterHead(chapter, col, span, count, state) {
  const flows = chapterFlows(chapter.id, state);
  const shown = shownFlowOf(chapter.id, state);
  const chips = flows.length ? `
      <div class="bd-flows">
        <button class="bd-flow ${shown ? '' : 'active'}" data-action="show-flow" data-chapter="${chapter.id}" data-flow="">Main</button>
        ${flows.map(f => `<button class="bd-flow ${shown?.id === f.id ? 'active' : ''}" data-action="show-flow" data-chapter="${chapter.id}" data-flow="${f.id}">↳ ${escapeHtml(f.name)}</button>`).join('')}
      </div>` : '';
  return `
    <div class="bd-chapter ${flows.length ? 'has-flows' : ''}" ${at(col, 1, span)}>
      <button class="bd-chapter-fold" aria-label="Fold ${escapeHtml(chapter.name)}" data-action="fold" data-chapter="${chapter.id}">‹</button>
      <button class="bd-chapter-label" data-action="chapter-menu" data-chapter="${chapter.id}">
        <span class="bd-chapter-name">${isChapterBookmarked(chapter.id) ? '<span class="ch-mark" aria-label="Bookmarked">🔖</span> ' : ''}${escapeHtml(chapter.name)}</span>
        <span class="bd-chapter-count">${count} ${count === 1 ? 'slice' : 'slices'}</span>
      </button>
      <button class="bd-chapter-add" aria-label="Add a slice to ${escapeHtml(chapter.name)}" data-action="new-slice" data-chapter="${chapter.id}">＋</button>${chips}
    </div>`;
}

// Long names get smaller lettering so the whole title fits down the spine
// (about 16 characters at full size); very long ones also wrap onto a second line
function spineFontSize(name) {
  return Math.round(Math.max(13, Math.min(20, 20 * 16 / Math.max(name.length, 1))));
}

// A folded chapter: a book spine with its name down the side and a coloured band
// per slice. Tap to open it again.
function renderSpine(chapter, slices, col, state) {
  const bands = slices.map(s => {
    const kind = sliceActor(s, state) === 'processor' ? 'AU' : s.type;
    return `<span class="bd-spine-band" data-slice-type="${kind}"></span>`;
  }).join('');
  return `
    <button class="bd-spine" style="grid-column: ${col}; grid-row: 1 / span 6" data-action="fold" data-chapter="${chapter.id}" aria-label="Open ${escapeHtml(chapter.name)}">
      <span class="bd-spine-name" style="font-size: ${spineFontSize(chapter.name)}px">${escapeHtml(chapter.name)}</span>
      ${chapterMeter(chapter, state)}
      <span class="bd-spine-bands">${bands}</span>
      <span class="bd-spine-count">${slices.length}</span>
    </button>`;
}

// The book's name, first in the bottom bar (the header keeps its buttons); a tap opens its details
export const bookTitle = state => `<button class="bd-book-title" data-book-title>${escapeHtml(state.modelName || 'Untitled model')}</button>`;

// Quick stats above the board: how big the model is, by kind (all of it, whatever flow is shown)
function renderStats(state) {
  const box = document.getElementById('boardStats');
  if (!box) return;
  const slices = Object.keys(state.slices).length;
  if (!slices) { box.innerHTML = bookTitle(state); return; }
  const of = type => Object.values(state.elements).filter(e => e.type === type).length;
  const n = (count, one, many) => `${count} ${count === 1 ? one : many}`;
  const stat = (count, one, many, type) => `<span class="bd-stat"${type ? ` data-type="${type}"` : ''}>${n(count, one, many)}</span>`;
  // Close all chapters (or open them all again once they're closed)
  const chapters = state.chapterOrder.filter(id => state.chapters[id]);
  const anyOpen = chapters.some(id => !isChapterFolded(id));
  const books = chapters.length > 1
    ? `<button class="bd-fold-all" data-fold-all="${anyOpen ? 'close' : 'open'}">${anyOpen ? '▾ Close all chapters' : '▸ Open all chapters'}</button>`
    : '';
  const replay = getEventStream().length > 1 && !document.body.classList.contains('replaying')
    ? '<button class="bd-fold-all bd-replay" data-replay>⏱ Replay</button>' : '';
  // Open comments: the drawer of them, each one tap from where it is
  const open = openComments(state).length;
  const comments = open ? `<button class="bd-fold-all bd-cm-open" data-comments-open aria-label="${open} open comments">💬 ${open} open</button>` : '';
  box.innerHTML = bookTitle(state) + books + replay + comments + usageButton(getEventStream()) + statusChips(getBoardGroups(state).flatMap(g => g.slices)) + [
    stat(slices, 'slice', 'slices'),
    state.chapterOrder.length ? stat(state.chapterOrder.length, 'chapter', 'chapters') : '',
    stat(of('event'), 'event', 'events', 'event'),
    stat(of('command'), 'command', 'commands', 'command'),
    stat(of('readModel'), 'read model', 'read models', 'readModel'),
    of('processor') ? stat(of('processor'), 'automation', 'automations', 'processor') : '',
    of('screen') ? stat(of('screen'), 'screen', 'screens', 'screen') : '',
    stat(Object.keys(state.scenarios).length, 'scenario', 'scenarios'),
    // Started from a snapshot: there's no history before it (Undo stops there)
    historyOf(getEventStream()).snapshot ? `<span class="bd-stat" title="Imported or shared without history: there is no history before the snapshot">📸 snapshot${state.modelSource?.commit
      ? ` @ ${escapeHtml(state.modelSource.commit.slice(0, 7))}${state.modelSource.build ? ` · build ${escapeHtml(state.modelSource.build)}` : ''}` : ''}</span>` : ''
  ].filter(Boolean).join('');
}

// Scrolled down past the slice headers: a translucent line over the top of the board names the
// slices in view, each over its column, the first of each chapter led by the chapter's name. It
// sits outside the grid and never changes a size, so scrolling can't shift anything
function pinHeads(board) {
  let ov = document.getElementById('boardOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'boardOverlay'; ov.setAttribute('aria-hidden', 'true'); document.body.appendChild(ov); }
  const r = board.getBoundingClientRect();
  const head = board.querySelector('.bd-head');
  const past = r.width > 0 && head && head.getBoundingClientRect().bottom <= r.top + 1;
  ov.classList.toggle('on', !!past);
  if (!past) return;
  ov.style.cssText = `top:${r.top}px;left:${r.left}px;width:${board.clientWidth}px`;
  const lane = 26, w = board.clientWidth;
  const chapters = [...board.querySelectorAll('.bd-chapter')].map(el => ({ b: el.getBoundingClientRect(), name: el.querySelector('.bd-chapter-name')?.textContent || '', named: false }));
  const slices = [...board.querySelectorAll('.bd-head')].map(el => {
    const b = el.getBoundingClientRect();
    const x0 = Math.max(b.left - r.left, lane), x1 = Math.min(b.right - r.left, w);
    if (x1 - x0 <= 24) return '';
    const mid = (b.left + b.right) / 2;
    const ch = chapters.find(c => !c.named && mid >= c.b.left && mid <= c.b.right);
    if (ch) ch.named = true;
    return `<span class="bo-slice" style="left:${x0}px;width:${x1 - x0}px">${ch ? `<i class="bo-chapter">${escapeHtml(ch.name)} ›</i> ` : ''}${escapeHtml(el.querySelector('.bd-head-text')?.textContent || '')}</span>`;
  });
  ov.innerHTML = `<div class="bo-row">${slices.join('')}</div>`;
}
let pinning = false;
function onBoardScroll(e) {
  if (pinning) return;
  pinning = true;
  requestAnimationFrame(() => { pinning = false; pinHeads(e.target); });
}

export function renderBoard() {
  const board = document.getElementById('board');
  if (!board) return;
  if (!board.dataset.pinned) { board.dataset.pinned = '1'; board.addEventListener('scroll', onBoardScroll, { passive: true }); }
  const state = projectState();
  // Showing one stage: just its slices (chapters opened, the ones with none left out); moving
  // still steps past the hidden ones, so neighbours come from the whole chapter
  const allGroups = applyFlows(getBoardGroups(state), state);
  const neighbours = new Map(allGroups.map(g => [g.chapter?.id ?? '', g.slices.filter(s => state.sliceOrder.includes(s.id))]));
  const groups = filtering() ? allGroups.map(g => ({ ...g, slices: g.slices.filter(shows) })).filter(g => g.slices.length) : allGroups;
  todoFirstSlice = firstAppearances(groups, state);
  const sliceCount = groups.reduce((n, g) => n + g.slices.length, 0);

  filterFor(state);
  board.classList.toggle('has-chapters', state.chapterOrder.length > 0);
  board.classList.toggle('gwt-open', gwtOpen);
  renderStats(state);

  let html = `
    <div class="bd-label-head" ${at(1, 2)}></div>
    ${boardLaneLabels.map((l, i) => `<div class="bd-label lane-${i}" ${at(1, i + 3)}><span>${l}</span></div>`).join('')}
    <button class="bd-label lane-3 bd-gwt-toggle" ${at(1, 6)} data-action="toggle-gwt" aria-expanded="${gwtOpen}" aria-label="${gwtOpen ? 'Hide' : 'Show'} scenarios"><span>${gwtOpen ? 'GWT ▾' : 'GWT ▸'}</span></button>`;
  const openCount = openComments(state).length;
  hasComments = Object.values(state.comments || {}).some(c => !c.deleted);
  if (hasComments) html += `<button class="bd-label lane-cm" ${at(1, 7)} data-action="next-comment" aria-label="${openCount} open comments: go to the next"><span>💬 ${openCount}</span></button>`;

  // Column widths: lane labels, then a slice width per column or a narrow spine
  const widths = ['26px'];
  let col = 2;
  groups.forEach(({ chapter, slices }) => {
    const movable = neighbours.get(chapter?.id ?? '') || [];
    if (chapter && !filtering() && isChapterFolded(chapter.id)) {
      html += renderSpine(chapter, slices, col++, state);
      // Sized to the spine, which widens if its name needs a second line
      widths.push('max-content');
      return;
    }
    widths.push(...Array(Math.max(slices.length, 1)).fill('var(--col-w)'));
    if (chapter) html += renderChapterHead(chapter, col, Math.max(slices.length, 1), slices.length, state);
    if (chapter && !slices.length) {
      // An empty chapter keeps a quiet column so there's somewhere to add its first slice
      html += `
        <div class="bd-head bd-new-head" ${at(col, 2)}></div>
        <button class="bd-chapter-empty" style="grid-column: ${col}; grid-row: 3 / span 3" data-action="new-slice" data-chapter="${chapter.id}">＋ Slice</button>`;
      col++;
      return;
    }
    slices.forEach(s => {
      const i = movable.indexOf(s);
      html += renderColumn(s, col++, movable[i - 1]?.id, movable[i + 1]?.id, state);
    });
  });

  // New slices and chapters come from the floating + button; an empty board points at it
  if (sliceCount === 0 && filtering()) {
    html += `<div class="bd-new" style="grid-column: ${col}; grid-row: 3 / span 3"><span class="bd-new-hint">${emptyText()}</span></div>`;
    widths.push('var(--col-w)');
  } else if (sliceCount === 0 && !state.chapterOrder.length) {
    html += `
      <div class="bd-new" style="grid-column: ${col}; grid-row: 3 / span 3">
        <span class="bd-new-hint">Tap <b>＋</b> to add your first slice. Start with something a user <b>does</b>: that's a state change.</span>
      </div>`;
    widths.push('var(--col-w)');
  } else {
    // Room to scroll the last column clear of the floating button
    widths.push('64px');
  }

  board.style.gridTemplateColumns = widths.join(' ');
  board.innerHTML = html;
  pinHeads(board);
}
