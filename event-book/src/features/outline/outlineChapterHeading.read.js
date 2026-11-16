// ===========================================
// OUTLINE - Chapter heading (SV: Outline Chapter Heading)
// What a chapter's header draws: its name, where it stands among the chapters, whether it is folded, the
// count under the name (how far its slices are, what a build book holds, or what a search matched), and
// the bands a folded chapter shows for its slices. chapter: one of the Outline Layout's chapters.
// built: a build book. searching: the search box has words.
// ===========================================

import { getScenariosForSlice, refinedLabel } from '../../core/projections.js';
import { sliceActor } from '../board/command.js';

// The chapter's count line: how far its slices are (a plan), or what it holds (a build book)
function metaOf(inChapter, state, built) {
  if (built) {
    const scenarios = inChapter.reduce((n, s) => n + getScenariosForSlice(s.id, state).length, 0);
    return { built: true, slices: inChapter.length, scenarios };
  }
  const refined = inChapter.filter(s => s.refined).length;
  return { built: false, slices: inChapter.length, refined, label: refinedLabel(refined, inChapter.length), all: refined === inChapter.length };
}

export function outlineChapterHeading(state, chapter, { built = false, searching = false } = {}) {
  const { id, name, loose, index, first, last, folded, inChapter, slices } = chapter;
  return {
    id, name, loose, index, first, last, folded,
    shown: slices.length,
    // Under the name: the whole chapter's count, or (searching) what matched
    count: inChapter.length && !searching ? metaOf(inChapter, state, built) : { slices: slices.length },
    bands: slices.map(s => sliceActor(s, state) === 'processor' ? 'AU' : s.type)
  };
}
