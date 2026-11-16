// ===========================================
// OUTLINE MOVABLE (SV) - the slices the outline can move between chapters, as the chapters hold them in
// board order (synthetic automations left out), and the set each one moves with: an automation's slice
// travels with its partner. The step and move plans build on it.
// ===========================================

import { getBoardGroups } from '../../core/projections.js';

export function outlineMovable(state) {
  const groups = getBoardGroups(state).map(g => ({
    chapterId: g.chapter?.id || null,
    hasChapter: !!g.chapter,
    sliceIds: g.slices.filter(s => state.sliceOrder.includes(s.id)).map(s => s.id)
  }));
  const at = id => state.sliceOrder.indexOf(id);
  const withPartner = Object.fromEntries(Object.keys(state.slices).map(id => {
    const partner = state.slices[id]?.pairWith;
    return [id, [id, partner].filter(x => x && state.slices[x]).sort((a, b) => at(a) - at(b))];
  }));
  return { groups, order: groups.flatMap(g => g.sliceIds), withPartner };
}
