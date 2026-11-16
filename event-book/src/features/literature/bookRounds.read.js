// ===========================================
// LITERATURE - Book Rounds (SV: Book Rounds)
// Where the book is in its two rounds, for the banner on Read and Outline; while the structure waits it
// offers to approve it (not on a reviewer's copy). null when the book has no rounds.
// ===========================================

import { reviewRounds, inRounds } from '../article/command.js';

export function bookRounds(state, { reviewer = false } = {}) {
  if (!inRounds(state)) return null;
  const r = reviewRounds(state);
  return { text: r.text, approve: r.structure !== 'approved' && !reviewer };
}
