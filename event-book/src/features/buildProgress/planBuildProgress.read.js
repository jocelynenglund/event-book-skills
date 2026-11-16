// ===========================================
// BUILD PROGRESS - Plan Build Progress (SV): how far the build of a plan has got, for its spine on the bookshelves.
// While a builder has the plan and some slice has a report and not every slice is Done: "4 of 7 green · PR #290".
// A slice counts as green when its latest step is green or pr, or it is Done.
// ===========================================

import { getOrderedSlices } from '../../core/projections.js';

// -> null, or { bookId, green, total, pr, stuck, text }
export function planBuildProgress(state, bookId) {
  const p = state.press;
  if (p?.stage !== 'building') return null;
  const ids = (p.slices?.length ? p.slices : getOrderedSlices(state).filter(s => s.refined).map(s => s.id)).filter(id => state.slices[id]);
  if (!ids.length || ids.every(id => state.slices[id].built)) return null;
  if (!ids.some(id => state.progress?.[id])) return null;
  const green = ids.filter(id => state.slices[id].built || ['green', 'pr'].includes(state.progress?.[id]?.step)).length;
  const stuck = ids.filter(id => !state.slices[id].built && state.progress?.[id]?.step === 'stuck').length;
  // The newest pull request reported on any of them
  const prs = ids.flatMap(id => state.progress?.[id]?.history || []).filter(r => r.pr?.number).sort((a, b) => String(a.at).localeCompare(String(b.at)));
  const pr = prs.length ? prs[prs.length - 1].pr.number : null;
  const text = `${green} of ${ids.length} green${pr ? ` · PR #${pr}` : ''}${stuck ? ` · ${stuck} stuck` : ''}`;
  return { bookId, green, total: ids.length, pr, stuck, text };
}
