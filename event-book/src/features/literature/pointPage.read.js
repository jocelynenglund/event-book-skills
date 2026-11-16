// ===========================================
// LITERATURE - Point Page (SV: Point Page)
// Everything the point page shows of one paragraph, read once from the book: its place among the
// paragraphs, its chapter, the paragraph (or the gap to write into, or what it will say), the suggestions
// on it, its comments and its sentences. A paragraph that is gone is null. opts: readOnly.
// ===========================================

import { getOrderedSlices, sliceTitle } from '../../core/projections.js';
import { sentencesOf, isParked, isOpenGap, openSuggestions, commentMarks } from './rules.js';
import { paragraphText } from './paragraphText.read.js';
import { pointSentences } from './pointSentences.read.js';
import { pointComments } from './pointComments.read.js';

export function pointPage(state, sliceId, { readOnly = false } = {}) {
  const slice = state.slices[sliceId];
  if (!slice) return null;
  const order = getOrderedSlices(state).filter(s => !isParked(state, s));
  const parked = isParked(state, slice);
  const at = order.findIndex(s => s.id === slice.id);
  const prev = at > 0 ? order[at - 1] : null, next = at >= 0 ? order[at + 1] : null;
  // The next paragraph with an open comment, after this one (wrapping): where the conversation is
  const later = [...order.slice(at + 1), ...order.slice(0, Math.max(0, at))];
  const talk = later.find(s => commentMarks(state, s.id)?.open);
  const chapter = state.chapters[slice.chapterId];
  const sentences = sentencesOf(state, slice.id);
  const open = openSuggestions(state, slice.id);
  const gap = isOpenGap(state, slice);
  return {
    sliceId: slice.id,
    title: sliceTitle(slice, state),
    position: parked ? 'Parked' : `${at + 1} / ${order.length}`,
    prev: prev?.id || null,
    next: next?.id || null,
    talk: talk?.id || null,
    kicker: chapter ? chapter.name : 'Paragraph',
    parked,
    refined: !!slice.refined,
    comment: pointComments(state, slice.id, null),
    lead: sentences.length ? paragraphText(state, slice.id, true) : null,
    gap: gap ? { sliceId: slice.id, question: slice.gap.question, canFill: !readOnly } : null,
    plan: { title: sliceTitle(slice, state), description: slice.description || null },
    suggestions: open.length ? { sliceId: slice.id, count: open.length, canAct: !readOnly, items: open.map(x => ({ n: x.n, find: x.find, replace: x.replace, why: x.why })) } : null,
    sentences: sentences.length ? { count: sentences.length, list: pointSentences(state, slice.id, { readOnly }) } : null
  };
}
