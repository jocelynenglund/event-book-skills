// ===========================================
// SLICE REFINED - Commands
// The outline is for planning, the board for building.
// SC: Mark Slice Refined — a slice with scenarios is explicitly marked refined (planned out).
// SC: Clear Slice Refined — taken back by hand (and built with it).
// Built (done) is recorded from Compare (Mark Slices Built, features/compare/command.js).
// Rule: any edit to a refined or Done slice records its own event(s), then SliceBuiltCleared (if it
// was built) and SliceRefinedCleared (if refined): it should be explicitly refined again. The rule sits on
// the event store, so every way of editing is covered (the board, the outline, sheets, the
// MCP server), and the clears land in the same batch as the edit: one undo takes all back.
// ===========================================

import { appendEvent, setAppendRule, EventTypes } from '../../core/eventStore.js';
import { projectState, getScenariosForSlice } from '../../core/projections.js';

// Returns why it was refused ('No such slice', 'No scenarios yet'), or null
export function markSliceRefined(sliceId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (!slice) return 'No such slice';
  if (slice.refined) return null;
  if (!getScenariosForSlice(sliceId, state).length) return 'No scenarios yet';
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
// The slice named in the event
const sliceEdits = new Set([T.SliceNamed, T.SliceDescribed, T.SliceElementAdded, T.SliceElementRemoved, T.SliceInferred, T.ScenarioAdded]);
// The slice of the scenario named in the event (as it was before it)
const scenarioEdits = new Set([T.ScenarioDeleted, T.ScenarioRenamed, T.ScenarioMustHaveSet, T.ScenarioMoved,
  T.GivenSet, T.WhenSet, T.ThenEventSet, T.ThenRejectionSet, T.ThenReadModelSet]);
// Every slice the sticky named in the event sits in: its fields, its name, its kind
const elementEdits = new Set([T.PropertyAdded, 'PropertyUpdated', T.PropertyRemoved, T.PropertyGeneratedSet,
  T.ElementRenamed, T.ElementListSet, T.ElementTodoSet, T.ElementExternalSet]);

function editedSlices(event, state) {
  const d = event.data || {};
  if (sliceEdits.has(event.type)) return [d.sliceId];
  // A scenario moved changes the slice it left and the one it joined
  if (scenarioEdits.has(event.type)) return [state.scenarios[d.scenarioId]?.sliceId, d.sliceId];
  if (elementEdits.has(event.type)) return Object.values(state.slices).filter(s => s.elements.includes(d.elementId)).map(s => s.id);
  return [];
}

// Only a model that has ever had a refined slice needs projecting (older models said ready)
const mayBeRefined = e => e.type === T.SliceMarkedRefined || e.type === T.SliceMarkedBuilt || e.type === T.SliceMarkedReady || e.type === T.ModelSnapshot;

setAppendRule((event, before) => {
  if (!sliceEdits.has(event.type) && !scenarioEdits.has(event.type) && !elementEdits.has(event.type)) return;
  const prior = before();
  if (!prior.some(mayBeRefined)) return;
  const state = projectState(prior);
  [...new Set(editedSlices(event, state))]
    .map(id => id && state.slices[id])
    .filter(s => s?.refined || s?.built)
    .forEach(unrefine);
});
