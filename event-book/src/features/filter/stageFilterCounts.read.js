// ===========================================
// STAGE FILTER COUNTS (SV) - how many of the slices on show are at each stage, and which stage is chosen:
// To refine, Ready, Done (or, while verifying an edition, To try, Works, Doesn't), and the open comments.
// ===========================================

import { stages, active, isIn } from './stage.js';

// slices: the ones the screen counts (the stage filter must have been told the book: filterFor)
export function stageFilterCounts(slices) {
  const on = active();
  if (!slices.length) return { on, chips: [] };
  const count = k => k === 'all' ? slices.length : slices.filter(s => isIn(s, k)).length;
  // 💬 Open only while something is open (or it's the one chosen)
  return {
    on,
    chips: stages().filter(([k]) => k !== 'talk' || on === k || count(k))
      .map(([key, label]) => ({ key, label, count: key === 'all' ? null : count(key), on: on === key }))
  };
}
