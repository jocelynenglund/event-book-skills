// ===========================================
// BOARD - Comments (SV: Board Open Threads)
// The comment lane under a slice's scenarios: the slice's open threads, with the line they are about.
// ===========================================

import { sliceComments } from '../comments/read.js';

export function boardOpenThreads(state, col) {
  return { sliceId: col.sliceId, comments: sliceComments(state, col.sliceId).threads.filter(t => !t.resolved) };
}
