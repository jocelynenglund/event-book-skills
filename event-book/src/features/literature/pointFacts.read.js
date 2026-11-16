// ===========================================
// LITERATURE - Point Facts, Point Neighbours (SV: Point Facts, Point Neighbours)
// What a tap on a paragraph needs to know: its name, whether it is refined, how many suggestions are open;
// and where it would go if moved up or down (after which paragraph), nowhere at the ends.
// ===========================================

import { getBoardGroups, sliceTitle } from '../../core/projections.js';
import { openSuggestions } from './rules.js';

export function pointFacts(state, sliceId) {
  const slice = state.slices[sliceId];
  return { name: slice ? sliceTitle(slice, state) : '', refined: !!slice?.refined, suggestions: openSuggestions(state, sliceId).length };
}

export function pointNeighbours(state, sliceId) {
  const list = getBoardGroups(state).find(g => g.slices.some(s => s.id === sliceId))?.slices || [];
  const i = list.findIndex(s => s.id === sliceId);
  return {
    up: i > 0 ? { after: list[i - 2]?.id || null } : null,
    down: i >= 0 && list[i + 1] ? { after: list[i + 1].id } : null
  };
}
