// ===========================================
// OUTLINE STEP PLAN (SV) - what ↑ / ↓ on a slice does: step over its neighbour in the chapter, or at the
// chapter's edge step into the neighbouring one (with its automation partner, placed at that end).
// null when it can't move (the first slice of the first chapter has nowhere to go but "no chapter").
// ===========================================

import { outlineMovable } from './outlineMovable.read.js';

// dir: -1 up, 1 down
export function outlineStepPlan(state, sliceId, dir) {
  const { groups, withPartner } = outlineMovable(state);
  const gi = groups.findIndex(g => g.sliceIds.includes(sliceId));
  if (gi < 0) return null;
  const list = groups[gi].sliceIds;
  const neighbour = list[list.indexOf(sliceId) + dir];
  if (neighbour) return { over: neighbour };

  const target = groups[gi + dir];
  // Above the first chapter is "no chapter", even when that group isn't showing
  const chapterId = target ? target.chapterId : (dir < 0 && groups[gi].hasChapter ? null : undefined);
  if (chapterId === undefined) return null;
  const place = !target?.sliceIds.length ? null
    : dir < 0 ? { after: target.sliceIds[target.sliceIds.length - 1] } : { before: target.sliceIds[0] };
  return { chapterId, ids: withPartner[sliceId] || [sliceId], place };
}
