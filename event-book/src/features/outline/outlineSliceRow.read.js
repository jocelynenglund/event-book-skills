// ===========================================
// OUTLINE - Slice row (SV: Outline Slice Row)
// One slice as the Outline's row draws it: number, title, kind, chain, description, paragraphs, refined,
// verdict while verifying, usage, waiver, fields, scenarios (each with its open comments and verdicts), open
// comments, and whether it can step up or down. slice: one of the Outline Layout's rows; first/last: its place.
// ===========================================

import { getScenariosForSlice, sliceTitle, sliceRef, refinedState } from '../../core/projections.js';
import { hasValues } from '../scenarios/view.js';
import { paragraphsOf } from '../article/command.js';
import { verifyingEdition } from '../verify/command.js';
import { scenarioVerdict } from '../verify/scenarioVerdict.read.js';
import { scenarioOwnVerdict } from '../verify/scenarioOwnVerdict.read.js';
import { scenarioTesters } from '../verify/scenarioTesters.read.js';
import { sliceVerdict } from '../verify/sliceVerdict.read.js';
import { nickname } from '../comments/command.js';
import { sliceActor } from '../board/command.js';
import { sliceComments } from '../comments/read.js';
import { usageBadge } from '../usage/view.js';
import { sliceProgress } from '../buildProgress/sliceProgress.read.js';

// Short enough to leave the slice name room on a phone; the colour bar says the rest
const shortKind = { SC: 'Change', SV: 'View', AU: 'Automation' };
// Read order of a slice: the way its story flows through the lanes
const laneFlow = { SC: [0, 1, 2], SV: [2, 1, 0], AU: [2, 0, 1] };
const laneOf = { screen: 0, processor: 0, command: 1, readModel: 1, event: 2 };

// command → event → view, in read order
function chainOf(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  return (laneFlow[slice.type] || [0, 1, 2]).flatMap(l => els.filter(e => laneOf[e.type] === l)).map(e => e.name);
}

// A slice's fields, each name once. One that only some of its stickies carry wears their types.
function fieldsOf(slice, state) {
  const carriers = slice.elements.map(id => state.elements[id]).filter(e => e?.properties?.length);
  const byName = new Map();
  carriers.forEach(el => el.properties.forEach(p => {
    const key = p.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { prop: p, on: [] });
    byName.get(key).on.push(el);
  }));
  // The ones every sticky shares first, then the marked ones
  return [...byName.values()].map(({ prop, on }) => ({
    prop,
    marks: carriers.length > 1 && on.length < carriers.length ? [...new Set(on.map(el => el.type))] : []
  })).sort((a, b) => !!a.marks.length - !!b.marks.length);
}

// A slice's scenarios, each with its open comments and verdict, and the stickies they name
function scenariosOf(slice, state, edition, threads) {
  const elements = {};
  const scenarios = getScenariosForSlice(slice.id, state).map(scn => {
    [...(scn.given || []).map(g => g.elementId), scn.when?.commandId, scn.then?.eventId, scn.then?.readModelId]
      .filter(Boolean).forEach(id => { if (state.elements[id]) elements[id] = state.elements[id]; });
    return {
      id: scn.id, name: scn.name, mustHave: !!scn.mustHave, scn, hasValues: hasValues(scn),
      comments: threads.filter(t => t.scenarioId === scn.id && !t.resolved),
      // While verifying: the overall verdict on the left, this device's own on the buttons, the testers behind a tap
      verdict: edition == null ? null : scenarioVerdict(state, edition, scn.id),
      own: edition == null ? null : scenarioOwnVerdict(state, edition, slice.id, scn.id, nickname()),
      testers: edition == null ? null : scenarioTesters(state, edition, scn.id)
    };
  });
  return { scenarios, elements };
}

export function outlineSliceRow(state, slice, { first = false, last = false } = {}) {
  const edition = verifyingEdition(state);
  const threads = sliceComments(state, slice.id).threads;
  const { scenarios, elements } = scenariosOf(slice, state, edition, threads);
  const actor = sliceActor(slice, state);
  return {
    sliceId: slice.id,
    ref: sliceRef(state, slice.id),
    title: sliceTitle(slice, state),
    type: slice.type,
    actor,
    kind: `${actor === 'processor' && slice.type !== 'AU' ? '⚙ ' : ''}${shortKind[slice.type] || slice.type}`,
    chain: chainOf(slice, state),
    description: slice.description || '',
    paragraphs: paragraphsOf(state, slice.id).map(p => p.text),
    refined: !!refinedState(state, slice.id)?.refined,
    progress: sliceProgress(state, slice.id),
    sliceVerdict: edition == null ? null : sliceVerdict(state, edition, slice.id),
    usage: usageBadge(slice, state),
    waived: slice.waived || null,
    fields: fieldsOf(slice, state),
    scenarios, elements,
    comments: threads.filter(t => !t.scenarioId && !t.resolved),
    canMoveUp: !first, canMoveDown: !last
  };
}
