// ===========================================
// BOARD - Layout (SV: Board Layout)
// Where things sit on the Board: the chapters in order (a folded one is a spine), the slices that
// make each one's columns, each column's neighbours for the moves, and the few facts the screen's
// grid needs (is there a comment lane, is the book empty). No component draws from it: the screen
// reads it once per draw and hands each part's own view the chapter or column it is about. Local UI
// state is not here: folds and the flow shown come in as questions.
// ===========================================

import { getBoardGroups, chapterFlows, sliceFlow } from '../../core/projections.js';
import { shows, filtering as staged, emptyText, filterFor } from '../filter/status.js';

// Each to-do list's first slice, left to right (shared with the poster)
export function firstAppearances(groups, state) {
  const first = {};
  groups.flatMap(g => g.slices).forEach(s => s.elements.forEach(id => {
    if (state.elements[id]?.todo && !first[id]) first[id] = s.id;
  }));
  return first;
}

// A chapter with flows shows its main line (the happy case) or one flow: the
// main line plus that flow's slices, in order. Always read left to right.
// flowOf(chapterId, state): the flow shown there, or null.
export function withFlows(groups, state, flowOf) {
  return groups.map(g => {
    if (!g.chapter || !chapterFlows(g.chapter.id, state).length) return g;
    const flow = flowOf(g.chapter.id, state);
    return { ...g, flow, slices: g.slices.filter(s => { const f = sliceFlow(s, state); return !f || f.id === flow?.id; }) };
  });
}

// folded(id): is this chapter folded (a device setting). flowOf(id, state): the flow shown in a chapter, or null.
export function boardLayout(state, { folded = () => false, flowOf = () => null } = {}) {
  filterFor(state);
  const allGroups = withFlows(getBoardGroups(state), state, flowOf);
  // Moving still steps past the slices a stage hides, so neighbours come from the whole chapter
  const neighbours = new Map(allGroups.map(g => [g.chapter?.id ?? '', g.slices.filter(s => state.sliceOrder.includes(s.id))]));
  // Showing one stage: just its slices (chapters opened, the ones with none left out)
  const filtering = !!staged();
  const groups = filtering ? allGroups.map(g => ({ ...g, slices: g.slices.filter(shows) })).filter(g => g.slices.length) : allGroups;
  const sliceCount = groups.reduce((n, g) => n + g.slices.length, 0);
  const hasComments = Object.values(state.comments || {}).some(c => !c.deleted);

  const chapters = groups.map(({ chapter, slices }) => {
    const base = { id: chapter?.id || null, loose: !chapter, slices };
    if (chapter && !filtering && folded(chapter.id)) return { ...base, folded: true, empty: false, columns: [] };
    const movable = neighbours.get(chapter?.id ?? '') || [];
    return { ...base, folded: false, empty: !!chapter && !slices.length,
      columns: slices.map(s => {
        const i = movable.indexOf(s);
        return { sliceId: s.id, slice: s, prev: movable[i - 1]?.id || null, next: movable[i + 1]?.id || null };
      }) };
  });

  return {
    filtering, hasChapters: state.chapterOrder.length > 0, hasComments, chapters,
    // What the parts need to draw their own views: the first slice of each to-do list, the flow shown in a chapter
    todoFirst: firstAppearances(groups, state),
    shownFlowId: chapterId => flowOf(chapterId, state)?.id,
    // Nothing to show: a stage with nothing in it says so; a book with no chapter yet points at the +
    emptyHint: sliceCount === 0 && filtering ? emptyText() : null,
    firstRun: sliceCount === 0 && !filtering && !state.chapterOrder.length
  };
}
