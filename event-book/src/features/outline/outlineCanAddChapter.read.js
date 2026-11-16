// ===========================================
// OUTLINE - Can add chapter (SV: Outline Can Add Chapter)
// Whether ＋ Chapter ends the outline: not while searching or showing one stage. layout: the Outline Layout.
// ===========================================

export function outlineCanAddChapter(state, layout) {
  return { canAddChapter: !layout.filtering };
}
