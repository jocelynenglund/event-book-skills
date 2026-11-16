// ===========================================
// LITERATURE - Literature Outline (SV: Literature Outline)
// Everything the literature Outline shows, read once from the book: the title and totals, the open
// comments, the bars (suggestions, rounds, unsent), the chapters with a card per paragraph (its number,
// sentences, refined mark, comments), parked paragraphs as snippets. The Outline draws from this alone.
// opts: readOnly, unsent, reviewer.
// ===========================================

import { getBoardGroups, sliceTitle } from '../../core/projections.js';
import { sentencesOf, pointText, isParked, openSuggestions, commentMarks } from './rules.js';
import { openComments } from '../comments/read.js';
import { bookRounds } from './bookRounds.read.js';
import { chapterVoteCount } from './chapterVoteCount.read.js';
import { pointSentences } from './pointSentences.read.js';
import { pointComments } from './pointComments.read.js';

function cardOf(state, slice, { n, first, last }, { readOnly }) {
  const parked = isParked(state, slice);
  const text = pointText(state, slice.id);
  const name = sliceTitle(slice, state);
  const marks = commentMarks(state, slice.id);
  return {
    sliceId: slice.id, parked, n, first, last,
    name: name && !text.startsWith(name.replace(/…$/, '')) ? name : null,
    refined: !!slice.refined,
    ...(parked
      ? { snippet: text.length > 140 ? text.slice(0, 139).trimEnd() + '…' : text }
      : { mark: marks ? { sliceId: slice.id, ...marks } : null, body: pointSentences(state, slice.id, { readOnly }), comment: pointComments(state, slice.id, null) })
  };
}

export function literatureOutline(state, { readOnly = false, unsent = null, reviewer = false } = {}) {
  const groups = getBoardGroups(state).filter(g => g.chapter || g.slices.length);
  const points = groups.filter(g => !g.chapter?.parked).flatMap(g => g.slices);
  const bar = openSuggestions(state).length;
  let n = 0;
  const chapters = groups.map(g => {
    const parked = !!g.chapter?.parked;
    const list = g.slices;
    return {
      chapterId: g.chapter?.id || null,
      name: g.chapter ? g.chapter.name : null,
      parked,
      votes: g.chapter && !parked ? chapterVoteCount(state, g.chapter.id) : 0,
      hasRequirement: !!(g.chapter && state.requirements?.[g.chapter.id]),
      count: list.length,
      points: list.map((s, i) => cardOf(state, s, { n: parked ? 0 : ++n, first: i === 0, last: i === list.length - 1 }, { readOnly }))
    };
  });
  return {
    title: state.modelName || 'Untitled',
    total: { paragraphs: points.length, sentences: points.reduce((sum, s) => sum + sentencesOf(state, s.id).length, 0) },
    openComments: openComments(state).length,
    votes: groups.filter(g => g.chapter && !g.chapter.parked).length > 1,
    suggestions: bar ? { n: bar } : null,
    rounds: bookRounds(state, { reviewer }),
    unsent,
    chapters,
    empty: chapters.length ? null : { canPaste: !readOnly }
  };
}
