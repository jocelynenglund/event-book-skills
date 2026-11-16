// ===========================================
// DETAILS - Moved To Slice: the words that say where a scenario went ("Moved to Place order").
// ===========================================

import { projectState, sliceTitle } from '../../core/projections.js';

export function movedToSlice(sliceId) {
  const state = projectState();
  return `Moved to ${sliceTitle(state.slices[sliceId], state)}`;
}
