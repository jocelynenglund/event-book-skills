// ===========================================
// LITERATURE - Reading Page (SV: Reading Page)
// Everything the Read screen shows, read once from the book: title, rounds banner, standfirst, the
// suggestions bar, the top row (open comments, votes), the sections with their paragraphs (comment marks,
// Accept / Skip, chapter votes and requirements), what an unwritten outline will say, and the footer counts.
// Read draws from this and reads nothing else of the book. opts: readOnly, unsent (this device's comments
// the server hasn't got: { n, why }), reviewer.
// ===========================================

import { getBoardGroups, sliceTitle } from '../../core/projections.js';
import { readingView, commentMarks, openSuggestions } from './rules.js';
import { openComments } from '../comments/read.js';
import { bookRounds } from './bookRounds.read.js';
import { chapterRequirement } from './chapterRequirement.read.js';
import { chapterVoteCount } from './chapterVoteCount.read.js';
import { paragraphText } from './paragraphText.read.js';
import { paragraphFixes } from './paragraphFixes.read.js';

const words = text => (String(text).match(/\S+/g) || []).length;
const headingText = text => String(text).replace(/^#{1,6}\s+/, '');

// An outline with nothing written yet (an agent's article outline): its points, the claim and the thought
function planOf(state) {
  const groups = getBoardGroups(state).filter(g => !g.chapter?.parked && g.slices.length);
  if (!groups.length) return null;
  return {
    note: state.structure?.approved ? 'Structure approved: the paragraphs come next.' : 'Not written yet: approve the structure first, then the paragraphs come.',
    groups: groups.map((g, i) => ({
      heading: g.chapter && !(i === 0 && g.chapter.name === state.modelName) ? g.chapter.name : null,
      points: g.slices.map(sl => ({ sliceId: sl.id, title: sliceTitle(sl, state), description: sl.description || null }))
    }))
  };
}

export function readingPage(state, { readOnly = false, unsent = null, reviewer = false } = {}) {
  const { title, sections, openGaps } = readingView(state);
  const flat = sections.flatMap(s => s.paragraphs);
  const open = openComments(state).length;
  const bar = openSuggestions(state).length;
  const chapterCount = sections.filter(s => s.chapterId).length;
  const shown = sections.map(s => ({
    heading: s.heading,
    chapterId: s.chapterId,
    votes: s.chapterId ? chapterVoteCount(state, s.chapterId) : 0,
    requirement: s.requirement ? chapterRequirement(state, s.chapterId) : null,
    paragraphs: s.paragraphs.map(p => p.heading ? { kind: 'heading', sliceId: p.sliceId, text: headingText(p.text) }
      : p.gap ? { kind: 'gap', sliceId: p.sliceId, gap: p.gap }
      : { kind: 'text', sliceId: p.sliceId, runs: paragraphText(state, p.sliceId, false),
          mark: commentMarks(state, p.sliceId) ? { sliceId: p.sliceId, ...commentMarks(state, p.sliceId) } : null,
          fixes: paragraphFixes(state, p.sliceId, { readOnly }) })
  }));
  const plan = shown.length ? null : planOf(state);
  return {
    title,
    rounds: bookRounds(state, { reviewer }),
    unsent,
    standfirst: state.modelDescription || null,
    suggestions: bar ? { n: bar } : null,
    top: open || chapterCount > 1 ? { comments: open, votes: chapterCount > 1 } : null,
    sections: shown,
    plan,
    empty: shown.length || plan ? null : { canPaste: !readOnly },
    foot: { paragraphs: flat.filter(p => !p.heading && !p.gap).length, words: words(flat.map(p => p.text).join(' ')), gaps: flat.filter(p => p.gap).length, emptyPoints: openGaps, comments: open }
  };
}
