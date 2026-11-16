// ===========================================
// OUTLINE MOVE PLAN (SV) - what "move to <chapter>" does with the selected slices: every one of them (and
// each automation's partner) in board order, the chapter they go to, the slice they go after (the last one
// already there that isn't moving; null when none), and the name for the toast.
// ===========================================

import { outlineMovable } from './outlineMovable.read.js';

// selected: slice ids; chapterId: the chapter they go to, null for "no chapter"
export function outlineMovePlan(state, selected, chapterId) {
  const { groups, order, withPartner } = outlineMovable(state);
  const ids = [...new Set(selected.flatMap(id => withPartner[id] || [id]))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const target = groups.find(g => g.chapterId === chapterId);
  return {
    ids, chapterId,
    after: target?.sliceIds.filter(id => !ids.includes(id)).pop() || null,
    chapterName: chapterId ? state.chapters[chapterId]?.name || '' : 'no chapter',
    count: selected.length
  };
}
