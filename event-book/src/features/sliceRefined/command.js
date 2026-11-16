// ===========================================
// SLICE REFINED - Commands
// The outline is for planning, the board for building.
// SC: Mark Slice Refined — a slice with scenarios is explicitly marked refined (planned out).
// SC: Clear Slice Refined — taken back by hand (and built with it).
// A slice with its scenarios waived (features/scenarioWaiver) can be refined with none.
// Built (done) is recorded from Compare (Mark Slices Built, features/compare/command.js).
// Rule: any edit to a Done slice records its own event(s), then SliceBuiltCleared. A refined slice
// that is edited is no longer refined: the projection derives that (core/projections.js, with the
// edit kinds in core/sliceEdits.js), so no event is recorded. The rule sits on
// the event store, so every way of editing is covered (the board, the outline, sheets, the
// MCP server), and the clear lands in the same batch as the edit: one undo takes all back.
// ===========================================

import { appendEvent, setAppendRule, EventTypes } from '../../core/eventStore.js';
import { projectState, getScenariosForSlice } from '../../core/projections.js';
import { isSliceEdit, editedSlices } from '../../core/sliceEdits.js';
import { isLiterature, sentencesOf } from '../literature/rules.js';

// Returns why it was refused ('No such slice', no scenarios or paragraphs and not waived), or null
export function markSliceRefined(sliceId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return 'No such slice';
  if (slice.refined) return null;
  // A literature point is refined by its sentences: no scenarios, so no waiver
  if (isLiterature(state)) {
    if (!sentencesOf(state, sliceId).length && !Object.values(state.paragraphs || {}).some(p => p.sliceId === sliceId)) return 'Write its sentences first';
    appendEvent(EventTypes.SliceMarkedRefined, { sliceId });
    return null;
  }
  // Its content: scenarios (an app), or paragraphs (an article's point); or none needed (waived)
  if (!slice.waived && !getScenariosForSlice(sliceId, state).length && !Object.values(state.paragraphs || {}).some(p => p.sliceId === sliceId)) return 'Write its scenarios (or, in an article, its paragraph) first, or if it needs none, waive them from ⋮';
  appendEvent(EventTypes.SliceMarkedRefined, { sliceId });
  return null;
}

// Built and refined taken back, built first (a slice can be Done without being refined: a followed build marks it)
function unrefine(slice) {
  if (slice.built) appendEvent(EventTypes.SliceBuiltCleared, { sliceId: slice.id });
  if (slice.refined) appendEvent(EventTypes.SliceRefinedCleared, { sliceId: slice.id });
}

export function clearSliceRefined(sliceId) {
  const slice = projectState().slices[sliceId];
  if (slice?.refined) unrefine(slice);
}

// ---------- What counts as an edit, and to which slices ----------

const T = EventTypes;

// Only a model that has ever had a refined slice needs projecting (older models said ready)
const mayBeRefined = e => e.type === T.SliceMarkedRefined || e.type === T.ScenariosWaived || e.type === T.SliceMarkedBuilt || e.type === T.SliceMarkedReady || e.type === T.ModelSnapshot;

setAppendRule((event, before) => {
  if (!isSliceEdit(event)) return;
  const prior = before();
  if (!prior.some(mayBeRefined)) return;
  const state = projectState(prior);
  [...new Set(editedSlices(event, state))]
    .map(id => id && state.slices[id])
    .filter(s => s?.built)
    .forEach(s => appendEvent(T.SliceBuiltCleared, { sliceId: s.id }));
  // A scenario on a waived slice, added or moved there: it needs scenarios after all (the same
  // batch, so one undo takes it back)
  const gained = event.type === T.ScenarioAdded || event.type === T.ScenarioMoved;
  if (gained && state.slices[event.data.sliceId]?.waived) {
    appendEvent(T.ScenarioWaiverLifted, { sliceId: event.data.sliceId, liftedBy: null, why: event.type === T.ScenarioMoved ? 'scenario moved here' : 'scenario added' });
  }
});
