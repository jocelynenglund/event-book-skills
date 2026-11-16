// ===========================================
// SHARE IMAGE - What the share sheet's scope says
// The sheet keeps its scope as one string: null (the whole model), 'slice:<id>', or chapter ids
// joined by commas. The share views take that, or the same as { chapters, slices } (a slide's pair).
// ===========================================

// -> { chapters: [ids] | null, slices: [ids] | null }; null for both is the whole model
export function scopeOf(scope) {
  if (scope && typeof scope === 'object') return { chapters: scope.chapters?.length ? scope.chapters : null, slices: scope.slices?.length ? scope.slices : null };
  if (!scope) return { chapters: null, slices: null };
  if (scope.startsWith('slice:')) return { chapters: null, slices: [scope.slice(6)] };
  return { chapters: scope.split(',').filter(Boolean), slices: null };
}
