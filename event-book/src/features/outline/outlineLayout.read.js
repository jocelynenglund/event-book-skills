// ===========================================
// OUTLINE - Layout (SV: Outline Layout)
// Where things sit on the Outline: which chapters, in what order, which slices each one shows (after a search
// or a stage filter), which slice is first and last, and the lines above (verify, rounds). No component draws
// from this: each part of the screen reads its own view, handed the slices it is about.
// Local UI state (folds) comes in as a question: folded(id).
// ===========================================

import { getBoardGroups } from '../../core/projections.js';
import { reviewRounds, inRounds } from '../article/command.js';
import { verifyingEdition, verificationResults } from '../verify/command.js';
import { shows, filtering as staged, filterFor } from '../filter/status.js';
import { isLiterature } from '../literature/rules.js';
import { slicesFound } from '../search/read.js';

const norm = t => String(t || '').toLowerCase();

// query: the search box. folded(id): is this chapter folded (a device setting).
export function outlineLayout(state, { query = '', folded = () => false } = {}) {
  if (isLiterature(state)) return { literature: true };
  const groups = getBoardGroups(state).map(g => ({ ...g, slices: g.slices.filter(s => state.sliceOrder.includes(s.id)) }));
  const all = groups.flatMap(g => g.slices);
  const firstId = all[0]?.id, lastId = all[all.length - 1]?.id;
  // The first slice can still step up out of a chapter into "no chapter"
  const canLeaveFirst = !!groups[0]?.chapter;
  const words = norm(query).split(/\s+/).filter(Boolean);
  const hits = new Set(words.length ? slicesFound(state, query).map(m => m.sliceId) : []);
  filterFor(state);
  // Searching or showing one stage: chapters open, the ones with nothing to show are left out
  const filtering = !!(words.length || staged());
  let shown = 0;
  const chapters = groups.flatMap(({ chapter, slices: inChapter }) => {
    // Searching: the slices Slices Found names (a chapter's name finds all its slices)
    const found = !words.length ? inChapter : inChapter.filter(sl => hits.has(sl.id));
    const slices = found.filter(shows);
    if (filtering && !slices.length) return [];
    shown += slices.length;
    const index = chapter ? state.chapterOrder.indexOf(chapter.id) : -1;
    return [{
      id: chapter?.id || null,
      name: chapter?.name || 'Not in a chapter',
      loose: !chapter,
      index, first: index === 0, last: index === state.chapterOrder.length - 1,
      folded: !!chapter && !filtering && !!folded(chapter.id),
      inChapter, slices,
      rows: slices.map(s => ({ slice: s, first: s.id === firstId && !canLeaveFirst, last: s.id === lastId }))
    }];
  });
  const chapterIds = state.chapterOrder.filter(id => state.chapters[id]);
  const edition = verifyingEdition(state);
  return {
    searching: words.length > 0,
    filtering,
    hasChapters: state.chapterOrder.length > 0,
    chapters,
    shown,
    sliceCount: all.length,
    chapterIds,
    totals: { slices: all.length, chapters: chapterIds.length, scenarios: Object.keys(state.scenarios).length },
    // The slices the status chips count
    stageSlices: all,
    verify: edition == null ? null : { edition, ...verificationResults(state, edition) },
    rounds: inRounds(state) ? reviewRounds(state).text : null
  };
}
