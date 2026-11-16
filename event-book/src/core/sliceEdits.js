// ===========================================
// What counts as an edit to a slice, and which slices an edit touches.
// Pure: shared by the projection (an edit to a refined slice makes it not refined) and by the
// append rule in features/sliceRefined (an edit to a built slice records SliceBuiltCleared).
// ===========================================

import { EventTypes as T } from './constants.js';

// The slice named in the event
export const sliceEdits = new Set([T.SliceNamed, T.SliceDescribed, T.SliceElementAdded, T.SliceElementRemoved, T.SliceInferred, T.ScenarioAdded, T.SentenceAdded, T.GapFilled, T.ParagraphWritten, T.ScenariosWaived, T.ScenarioWaiverLifted]);
// The slice of the scenario named in the event (as it was before it)
export const scenarioEdits = new Set([T.ScenarioDeleted, T.ScenarioRenamed, T.ScenarioMustHaveSet, T.ScenarioMoved,
  T.GivenSet, T.WhenSet, T.ThenEventSet, T.ThenRejectionSet, T.ThenReadModelSet]);
// Every slice the sticky named in the event sits in: its fields, its name, its kind
export const elementEdits = new Set([T.PropertyAdded, 'PropertyUpdated', T.PropertyRemoved, T.PropertyGeneratedSet,
  T.ElementRenamed, T.ElementListSet, T.ElementTodoSet, T.ElementExternalSet, T.ElementPublishedSet]);

export function isSliceEdit(event) {
  return sliceEdits.has(event.type) || scenarioEdits.has(event.type) || elementEdits.has(event.type) ||
    event.type === T.ParagraphEdited || event.type === T.SuggestionsAccepted;
}

// The slice ids an edit touches, evaluated against the state as it was before the event
export function editedSlices(event, state) {
  const d = event.data || {};
  if (sliceEdits.has(event.type)) return [d.sliceId];
  // A scenario moved changes the slice it left and the one it joined
  if (scenarioEdits.has(event.type)) return [state.scenarios[d.scenarioId]?.sliceId, d.sliceId];
  if (elementEdits.has(event.type)) return Object.values(state.slices).filter(s => s.elements.includes(d.elementId)).map(s => s.id);
  if (event.type === T.ParagraphEdited) return [state.paragraphs?.[d.paragraphId]?.sliceId];
  // Suggestions accepted: the paragraphs whose sentences changed
  if (event.type === T.SuggestionsAccepted) return (d.edits || []).map(x => state.sentences?.[x.sentenceId]?.sliceId);
  return [];
}
