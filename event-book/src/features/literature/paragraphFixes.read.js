// ===========================================
// LITERATURE - Paragraph Fixes (SV: Paragraph Fixes)
// The Accept / Skip a paragraph (or a sentence) offers for its open suggestions: which numbers, and whether
// they are numbered (only when there is more than one). Nothing when the book is read only.
// ===========================================

import { openSuggestions } from './rules.js';

export function fixesOf(sliceId, list, readOnly = false) {
  if (readOnly || !list.length) return null;
  return { sliceId, ns: list.map(x => x.n), many: list.length > 1 };
}

export const paragraphFixes = (state, sliceId, { readOnly = false } = {}) => fixesOf(sliceId, openSuggestions(state, sliceId), readOnly);
