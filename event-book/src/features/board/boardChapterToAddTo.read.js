// ===========================================
// BOARD - Empty chapter (SV: Board Chapter To Add To)
// A chapter with no slices: the chapter the quiet column's ＋ adds the first slice to.
// ===========================================

export function boardChapterToAddTo(state, ch) {
  return { id: ch.id, name: state.chapters[ch.id]?.name || '' };
}
