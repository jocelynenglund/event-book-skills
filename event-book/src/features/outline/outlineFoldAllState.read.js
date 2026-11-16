// ===========================================
// OUTLINE - Fold all state (SV: Outline Fold All State)
// Whether the bottom bar offers Collapse all or Expand all: Collapse while anything is open (the outline not
// collapsed, or some chapter unfolded), and none at all for a book without slices.
// collapsedAll: the device's setting. folded(id): is this chapter folded (a device setting).
// ===========================================

import { getBoardGroups } from '../../core/projections.js';

export function outlineFoldAllState(state, { collapsedAll = false, folded = () => false } = {}) {
  const chapterIds = state.chapterOrder.filter(id => state.chapters[id]);
  return {
    sliceCount: getBoardGroups(state).flatMap(g => g.slices).filter(s => state.sliceOrder.includes(s.id)).length,
    anyOpen: !collapsedAll || chapterIds.some(id => !folded(id))
  };
}
