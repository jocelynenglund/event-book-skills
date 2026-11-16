// ===========================================
// SCENARIO WAIVER - Commands
// A slice with nothing to test (a See slice that is only a command's answer) can't be refined,
// since Refined needs scenarios. Waiving says it needs none: it can be refined, and no spec is
// expected for it (generate specs, compare). Both are edits to the slice, like any other: they
// take Refined back (sliceRefined/command.js). Adding a scenario to a waived slice lifts the waiver
// in the same batch (the append rule there), so one undo takes it all back.
// SC: Waive Scenarios — only for a slice with no scenarios.
// SC: Lift Scenario Waiver — it needs scenarios after all.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState, getScenariosForSlice } from '../../core/projections.js';

const record = (type, data) => (appendEvent(type, data) ? null : 'Read only');

// Returns why it was refused, or null
export function waiveScenarios({ sliceId, reason = '', by = null, state = projectState() } = {}) {
  const slice = state.slices[sliceId];
  if (!slice) return 'No such slice';
  if (slice.waived) return 'Already waived';
  if (getScenariosForSlice(sliceId, state).length) return 'It has scenarios: nothing to waive';
  return record(EventTypes.ScenariosWaived, { sliceId, reason: String(reason || '').trim(), waivedBy: by });
}

export function liftScenarioWaiver({ sliceId, by = null, why = 'Needs scenarios after all', state = projectState() } = {}) {
  const slice = state.slices[sliceId];
  if (!slice) return 'No such slice';
  if (!slice.waived) return 'It isn\'t waived';
  return record(EventTypes.ScenarioWaiverLifted, { sliceId, liftedBy: by, why });
}
