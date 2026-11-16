// ===========================================
// LITERATURE - Point Comments (SV: Point Comments)
// The open comments on a paragraph (or on one of its sentences): how many, and each as a line.
// ===========================================

import { commentsOn } from '../comments/read.js';

export function pointComments(state, sliceId, sentenceId = null) {
  const open = commentsOn(state, sliceId, sentenceId).filter(c => !c.resolved);
  return { sliceId, sentenceId, open: open.length, lines: open.map(c => ({ commentId: c.commentId, nickname: c.nickname, text: c.text })) };
}
