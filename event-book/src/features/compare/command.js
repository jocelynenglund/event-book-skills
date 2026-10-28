// ===========================================
// COMPARE - Commands
// SC: Mark Slices Built — the plan (the open model) compared with a model built from the
// tests (it has a source commit): each refined slice of the plan that the tests have
// (matched as Compare matches: a change by its command, a view by its read model) is
// recorded as built (done) at that commit, once confirmed. Slices already built, or not
// refined, record nothing; a plan checked out elsewhere (read only) quietly records nothing.
// ===========================================

import { appendEvent, canEditCurrent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { compareModels, norm } from './diff.js';
import { adoptBuiltSlice, keepPlannedSlice, settleCompare } from '../editions/command.js';

// SV: Done To Confirm — the plan's refined, not yet built slices that are in the built model
export function doneToConfirm(plan, built) {
  if (!built?.modelSource?.commit) return [];
  return compareModels(plan, built).rows
    .filter(r => r.plan && r.built && r.status !== 'maybe' && r.plan.refined && !r.plan.built)
    .map(r => ({ sliceId: r.plan.id, title: r.title, builtSliceId: r.built.id }));
}

// Records SliceMarkedBuilt for each; returns the slices recorded ([] when there were none
// or the plan is read only), so a later step (adopting the built slice) can follow on
export function markSlicesBuilt(built, plan = projectState()) {
  if (!canEditCurrent()) return [];
  const commit = built?.modelSource?.commit;
  return doneToConfirm(plan, built).filter(d => appendEvent(EventTypes.SliceMarkedBuilt, { sliceId: d.sliceId, commit }));
}


// SC: Confirm Slices Done — each refined slice the tests have takes the built slice's place
// (Adopt Built Slice) and is recorded built at their commit; one Compare Settled at the end
// (the draft goes up once per confirm, not per slice). Returns the slices recorded.
export function confirmSlicesDone(built, plan = projectState()) {
  if (!canEditCurrent()) return [];
  const commit = built?.modelSource?.commit;
  const recorded = doneToConfirm(plan, built).filter(d => {
    if (adoptBuiltSlice(d.sliceId, commit, { state: built, sliceId: d.builtSliceId })) return false;
    return !!appendEvent(EventTypes.SliceMarkedBuilt, { sliceId: d.sliceId, commit });
  });
  if (recorded.length) settleCompare();
  return recorded;
}

// SC: Keep Planned Slices — the difference rejected: the slices stay ☐ Ready, not done; one Compare Settled
export function keepSlicesPlanned(built, plan = projectState()) {
  if (!canEditCurrent()) return [];
  const commit = built?.modelSource?.commit;
  const kept = doneToConfirm(plan, built).filter(d => !keepPlannedSlice(d.sliceId, commit));
  if (kept.length) settleCompare();
  return kept;
}

// SC: Match Slices / Keep Slices Apart — a possible rename answered: the open shelf's slice is
// (or is not) the other shelf's slice of another name. Remembered on the open shelf, against
// the other shelf (shelfKey: its repo or name, the same across re-imports), so the next
// Compare pairs them, or doesn't suggest them again. Returns why nothing was recorded, or null.
function decide(type, sliceId, otherShelf, otherSliceName) {
  if (!canEditCurrent()) return 'Read only';
  const state = projectState();
  if (!state.slices[sliceId]) return 'No such slice';
  if ((state.sliceDecisions || []).some(d => d.sliceId === sliceId && d.otherShelf === otherShelf && norm(d.otherSliceName) === norm(otherSliceName))) return 'Already decided';
  return appendEvent(type, { sliceId, otherShelf, otherSliceName }) ? null : 'Read only';
}
export const matchSlices = (sliceId, otherShelf, otherSliceName) => decide(EventTypes.SlicesMatched, sliceId, otherShelf, otherSliceName);
export const keepSlicesApart = (sliceId, otherShelf, otherSliceName) => decide(EventTypes.SlicesKeptApart, sliceId, otherShelf, otherSliceName);
