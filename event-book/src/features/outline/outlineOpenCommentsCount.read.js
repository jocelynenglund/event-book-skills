// ===========================================
// OUTLINE - Open comments count (SV: Outline Open Comments Count)
// How many comments are open on the book: the 💬 N open button along the bottom.
// ===========================================

import { openComments } from '../comments/read.js';

export function outlineOpenCommentsCount(state) {
  return { openComments: openComments(state).length };
}
