// ===========================================
// OUTLINE - Search field (SV: Outline Search Field)
// What the search box shows: the words typed, and so whether its clear button is there.
// ===========================================

export function outlineSearchField(state, { query = '' } = {}) {
  return { query, searching: query.trim().length > 0 };
}
