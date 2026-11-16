// ===========================================
// OUTLINE - Toolbar options (SV: Outline Toolbar Options)
// Above the chapters: how many slices match (while searching or showing one stage), whether Fields and Select
// are offered (not on an empty book; no Select while searching), and the open comments' count.
// layout: the Outline Layout.
// ===========================================

import { openComments } from '../comments/read.js';

export function outlineToolbarOptions(state, layout) {
  return {
    total: layout.filtering ? `${layout.shown} of ${layout.sliceCount} slices` : '',
    fields: layout.sliceCount > 0, select: layout.sliceCount > 0 && !layout.filtering, openComments: openComments(state).length
  };
}
