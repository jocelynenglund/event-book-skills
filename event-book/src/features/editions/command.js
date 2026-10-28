// ===========================================
// EDITIONS - Commands
// A book (the whole model) is a draft until a build has been compared and every slice
// confirmed Done; Publish Edition then freezes it as an edition. Changing a published book
// starts the next draft as a copy (a new model); the edition stays as it was.
// Each command returns why it was refused, or null (it recorded its event).
// ===========================================

import { appendEvent, getEventStream, getCurrentModelId, createModel, setModelStartIn, listModels, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { editionOf, publishRefusal, ordinal } from './rules.js';
import { adoptBuiltContent } from './adopt.js';
import { markSliceRefined, clearSliceRefined } from '../sliceRefined/command.js';
import { verificationResults } from '../verify/command.js';

const T = EventTypes;
const record = (type, data) => (appendEvent(type, data) ? null : 'Read only');

// SC: Publish Edition — every slice Done (sketches too), against a compared build
export function publishEdition() {
  const events = getEventStream();
  const state = projectState(events);
  const e = state.edition;
  const why = publishRefusal(events, state);
  if (why) return why;
  return record(T.EditionPublished, { edition: e.edition || 1, commit: e.lastBuild });
}

// SC: Start Next Draft — a copy of the published book (a new model, opened) takes the next
// edition's draft 1. The published one is untouched. Returns why it was refused, or null.
export function startNextDraft() {
  const events = getEventStream();
  const e = editionOf(events);
  if (!e.published) {
    return events.some(ev => ev.type === T.NextDraftStarted) ? `Already drafting the ${ordinal(e.edition)} edition` : 'Publish an edition first';
  }
  const from = getCurrentModelId();
  const startIn = listModels().find(m => m.id === from)?.startIn;
  // The feedback comes along: open comments are in the copy already; scenarios that failed
  // verification of this edition take their slices back to not Refined (and not Done)
  const before = projectState(events);
  const failing = verificationResults(before, e.edition).failing;
  const openComments = Object.values(before.comments || {}).filter(c => !c.deleted && !c.resolved).length;
  const copy = createModel(events.map(ev => ({ ...ev })));
  if (startIn) setModelStartIn(copy, startIn);
  const refused = record(T.NextDraftStarted, { fromEdition: e.edition, edition: e.edition + 1, draft: 1, fromModel: from,
    ...(openComments ? { carriedComments: openComments } : {}), ...(failing.length ? { failingScenarios: failing.length } : {}) });
  if (!refused) [...new Set(failing.map(f => f.sliceId))].forEach(clearSliceRefined);
  return refused;
}

// SC: Settle Compare — a compare confirmed or rejected: the draft goes up by one
export function settleCompare() {
  const { draft } = projectState().edition;
  return record(T.CompareSettled, { draft: draft + 1 });
}

// SC: Adopt Built Slice — confirming a refined slice done takes the built one in its place.
// built (optional): { state, sliceId } of the built model's slice, whose content replaces the
// planned slice's. THE SEAM: the replacing is adoptBuiltContent (editions/adopt.js), the only
// place that decides how a built slice takes a planned one's place (swap it for "supersede,
// don't replace" there). The slice is refined again afterwards (an edit clears it).
export function adoptBuiltSlice(sliceId, commit, built = null) {
  const slice = projectState().slices[sliceId];
  if (!slice) return 'No such slice';
  if (slice.built) return 'Already done';
  if (!slice.refined) return 'Only refined slices can be confirmed done';
  if (built) {
    adoptBuiltContent(sliceId, built.state, built.sliceId);
    markSliceRefined(sliceId);
  }
  return record(T.SliceAdopted, { sliceId, commit });
}

// SC: Keep Planned Slice — a difference rejected: the slice stays ready, not done
export function keepPlannedSlice(sliceId, commit) {
  const slice = projectState().slices[sliceId];
  if (!slice?.refined) return 'Only refined slices can be compared';
  return record(T.SliceKeptAsPlanned, { sliceId, commit });
}
