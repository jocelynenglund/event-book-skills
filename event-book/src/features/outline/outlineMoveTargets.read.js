// ===========================================
// OUTLINE - Move targets (SV: Outline Move Targets)
// Selecting: the chapters the selected slices can move to, and whether there are any (then "No chapter" is one).
// ===========================================

export function outlineMoveTargets(state) {
  return {
    chapters: state.chapterOrder.map(id => ({ id, name: state.chapters[id].name })),
    hasChapters: state.chapterOrder.length > 0
  };
}
