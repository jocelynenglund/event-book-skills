// ===========================================
// LITERATURE - Point Sentences (SV: Point Sentences)
// What a paragraph shows under its heading: its sentences, each with its marked words, its comments and its
// Accept / Skip; or, with no sentences, a paragraph an agent wrote, an asked gap, what the point will say, or nothing.
// ===========================================

import { sentencesOf, pointText, isOpenGap, openSuggestions } from './rules.js';
import { sentenceRuns } from './paragraphText.read.js';
import { fixesOf } from './paragraphFixes.read.js';
import { pointComments } from './pointComments.read.js';

export function pointSentences(state, sliceId, { readOnly = false } = {}) {
  const slice = state.slices[sliceId];
  const sentences = sentencesOf(state, sliceId);
  if (!sentences.length) {
    const text = pointText(state, sliceId);
    if (isOpenGap(state, slice)) return { kind: 'gap', question: slice.gap.question };
    if (text) return { kind: 'written', text };
    return slice.description ? { kind: 'thought', thought: slice.description } : { kind: 'empty' };
  }
  const open = openSuggestions(state, sliceId);
  return {
    kind: 'sentences',
    sentences: sentences.map(s => {
      const mine = open.filter(o => o.sentenceId === s.id);
      return { id: s.id, runs: sentenceRuns(s.text, mine, true), comment: pointComments(state, sliceId, s.id), fixes: fixesOf(sliceId, mine, readOnly) };
    })
  };
}
