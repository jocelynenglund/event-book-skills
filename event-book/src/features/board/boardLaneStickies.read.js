// ===========================================
// BOARD - Lane (SV: Board Lane Stickies)
// One lane of one slice's column: its stickies (each with its kind, fields and tags), or, for a
// view, one pile of the events it reads, and the ＋ for another. The lane's stickies are the items
// of this list, so the Board card draws from the same view (a list and its item are one unit).
// ===========================================

import { getScenariosForSlice, elementFlow, eventsWithoutScenario, getTodoUpdates } from '../../core/projections.js';
import { elementLabel, externalAttr, propLabel } from '../../core/constants.js';
import { laneOf, laneTypeFor, sliceActor, sliceProcessor, isTrigger } from './command.js';
import { fieldsFolded, foldedLabel } from './foldedFields.js';

const typeNames = { command: 'Command', event: 'Event', readModel: 'Read model', processor: 'Automation', screen: 'Screen' };

// Arrow between lane n-1 and lane n, per slice type
// SC flows down (screen → command → event), SV flows up (event → view → screen),
// AU: processor ↓ command (the trigger event feeds the processor, past the command)
const arrows = { SC: [null, 'down', 'down'], SV: [null, 'up', 'up'], AU: [null, 'down', null] };

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

// An outcome event of another flow than the one shown (on the main line: any flow)
export function otherFlow(el, slice, state, shownFlowId) {
  const f = elementFlow(el, slice, state);
  return !!f && f.id !== (shownFlowId || 'main');
}

// One sticky. trigger: this event wakes the slice's processor up. first: where a to-do list is
// shown in full (later columns that read the same list get a slim reference).
function cardOf(el, slice, state, { trigger, first, shownFlowId }) {
  const todo = el.type === 'readModel' && !!el.todo;
  const base = { elementId: el.id, sliceId: slice.id, type: el.type, name: el.name, todo, tiltKey: slice.id + el.id };
  if (todo && !first) return { ...base, ref: true };
  const tags = cardTags(el, slice, state);
  const outcome = el.type === 'event' ? elementFlow(el, slice, state) : null;
  const props = el.properties || [];
  return {
    ...base, ref: false,
    label: elementLabel(el),
    attrs: externalAttr(el),
    to: el.type === 'event' && el.published && !el.external ? (el.to || []).join(', ') : '',
    trigger: !!trigger,
    list: el.type === 'readModel' && !!el.list && !todo,
    otherFlow: !!outcome && otherFlow(el, slice, state, shownFlowId),
    outcome: outcome ? outcome.name : null,
    foldedProps: props.length && fieldsFolded(el.id) ? foldedLabel(props.length) : null,
    props: props.map(p => ({ id: p.id, label: propLabel(p), generated: !!p.generated })),
    tags
  };
}

// A view only reads its events: on the board they're one pile, not stickies to edit
const piled = (slice, lane, laneEls, state) => lane === 2 && laneEls.length > 0 && slice.type === 'SV' && sliceActor(slice, state) !== 'processor';

// col: the column from the layout ({ slice, … }); lane: 0, 1 or 2; layout: what the layout hands every part
// (the first slice of each to-do list, the flow shown in a chapter)
export function boardLaneStickies(state, col, lane, layout) {
  const slice = col.slice;
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const byLane = [0, 1, 2].map(l => els.filter(e => laneOf[e.type] === l));
  let laneEls = byLane[lane];
  const sliceArrows = arrows[slice.type] || [];
  const flow = sliceArrows[lane] && byLane[lane].length && byLane[lane - 1].length ? sliceArrows[lane] : null;
  const base = { lane, flow };
  if (piled(slice, lane, laneEls, state)) {
    const open = new Set(eventsWithoutScenario(slice.id, state).map(e => e.id));
    const uncovered = laneEls.filter(e => open.has(e.id));
    if (uncovered.length) {
      // The events no scenario starts from yet; the covered ones are in the given stack under the scenarios
      const hasScenarios = getScenariosForSlice(slice.id, state).length > 0;
      return { ...base, sliceId: slice.id, cards: [], add: null, tiltKey: slice.id + 'pile',
        pile: { names: uncovered.map(e => e.name), count: uncovered.length, note: slice.type === 'SV' ? (hasScenarios ? ' with no scenario yet' : ' it reads') : '' } };
    }
    laneEls = [];   // every event is covered: they're in the given stack under the scenarios
  }
  const type = laneTypeFor(slice, lane, state);
  const processor = sliceProcessor(slice, state);
  const shownFlowId = layout.shownFlowId(slice.chapterId);
  const cards = laneEls.map(el => cardOf(el, slice, state,
    { trigger: el.type === 'event' && processor && isTrigger(el.id, processor.id, state), first: layout.todoFirst[el.id] === slice.id, shownFlowId }));
  // Events can stack (a command may emit several, a view may read several), and a
  // processor can read several read models
  const readsMany = lane === 1 && slice.type === 'SV' && sliceActor(slice, state) === 'processor';
  const canAdd = type && !slice.id.startsWith('au_inferred_') && (laneEls.length === 0 || lane === 2 || readsMany);
  return { ...base, sliceId: slice.id, cards, pile: null,
    add: canAdd ? { type, label: typeNames[type] || type, more: laneEls.length > 0 } : null };
}
