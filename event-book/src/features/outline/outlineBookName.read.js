// ===========================================
// OUTLINE - Book name (SV: Outline Book Name)
// The book's title along the bottom.
// ===========================================

export function outlineBookName(state) {
  return { title: state.modelName || 'Untitled model' };
}
