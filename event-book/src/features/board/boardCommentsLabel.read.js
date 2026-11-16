// ===========================================
// BOARD - Comments toggle (SV: Board Comments Label)
// The comment lane's label down the left: how many comments are open, once the book has any
// (nothing before: there is no comment lane).
// ===========================================

import { openComments } from '../comments/read.js';

export function boardCommentsLabel(state) {
  const any = Object.values(state.comments || {}).some(c => !c.deleted);
  return any ? { open: openComments(state).length } : null;
}
