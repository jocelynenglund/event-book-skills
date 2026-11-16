// ===========================================
// LITERATURE - Read models (pure, over a projected state)
// A book is a fact book (the model: board, stickies, scenarios, specs, compare: today's Event Book) or
// literature (a story). In literature a point is a paragraph and its sentences sit where scenarios would:
// their own records (state.sentences), so comments land on them and Refined looks at them, while
// scenarios, specs and Compare never see them.
// SV: Book Screens — what a kind of book shows.
// SV: Reading View — the piece as prose in order; Parked left out; an open gap is a quiet [question] line
//     (an empty point nobody asked about is left out and counted).
// SV: Draft Markdown — the same, as Markdown, for the writing vault and wp-publish.py; gaps stay out.
// SV: Open Suggestions — the edits suggested and not yet accepted or skipped, numbered per book.
// SV: Waiting For Her — the open comments and suggestions in reading order, for the Read / Outline pill.
// ===========================================

import { getBoardGroups } from '../../core/projections.js';
import { isHeading } from './sentences.js';
import { sliceComments } from '../comments/read.js';

export const isLiterature = state => state?.kind === 'literature';

export function bookScreens(state) {
  return isLiterature(state)
    ? { kind: 'literature', views: ['Read', 'Outline'], screens: ['Read (full width)', 'Outline', 'Point page: paragraph first, comments'], scenarios: false }
    : { kind: 'fact', views: ['Board', 'Outline'], screens: ['Board', 'Outline', 'Slice page', 'Compare'], scenarios: true };
}

// A point's sentences, in the order they were added
export const sentencesOf = (state, sliceId) => Object.values(state.sentences || {}).filter(s => s.sliceId === sliceId);

// What a point says: its sentences joined; else the paragraphs an agent wrote on it (an article's second round)
export function pointText(state, sliceId) {
  const sentences = sentencesOf(state, sliceId);
  if (sentences.length) return sentences.map(s => s.text).join(' ');
  return Object.values(state.paragraphs || {}).filter(p => p.sliceId === sliceId).map(p => p.text).join('\n\n');
}

// Who the text is by: who imported it, else whoever signed its first sentence; null when nobody did
export function authorOf(state) {
  if (state.author) return state.author;
  return Object.values(state.sentences || {}).find(s => s.by)?.by || null;
}

// An asked gap nobody has filled yet
export const isOpenGap = (state, slice) => !!slice?.gap && !slice.gap.filled && !sentencesOf(state, slice.id).length;

// The edits suggested and still open, in number order; of one paragraph when sliceId is given
export const openSuggestions = (state, sliceId = null) => Object.values(state.suggestions || {})
  .filter(x => x.status === 'open' && (!sliceId || x.sliceId === sliceId)).sort((a, b) => a.n - b.n)
  .map(x => ({ ...x, sentence: state.sentences?.[x.sentenceId]?.text ?? '' }));

// How many times find is in text (not overlapping)
export const occurrences = (text, find) => (find ? String(text).split(find).length - 1 : 0);

export const parkedChapter = state => Object.values(state.chapters || {}).find(c => c.parked) || null;
export const isParked = (state, slice) => !!(slice?.chapterId && state.chapters?.[slice.chapterId]?.parked);

// The story: sections in order, each with its paragraphs. A section's heading is its chapter's name,
// except a first chapter named as the book (an import's text before its first heading): the title stands above it already.
export function readingView(state) {
  const groups = getBoardGroups(state).filter(g => !g.chapter?.parked);
  const live = groups.map(g => ({ chapter: g.chapter, points: g.slices.map(s => ({ sliceId: s.id, text: pointText(state, s.id), ...(isOpenGap(state, s) ? { gap: s.gap.question } : {}) })) }))
    .filter(g => g.chapter || g.points.length);
  const openGaps = live.reduce((n, g) => n + g.points.filter(p => !p.text && !p.gap).length, 0);
  const sections = live.map((g, i) => ({
    heading: g.chapter && !(i === 0 && g.chapter.name === state.modelName) ? g.chapter.name : null,
    chapterId: g.chapter?.id || null,
    requirement: (g.chapter && state.requirements?.[g.chapter.id]) || null,
    paragraphs: g.points.filter(p => p.text || p.gap).map(p => ({ ...p, heading: isHeading(p.text) }))
  })).filter(s => s.paragraphs.length || s.requirement);
  return { title: state.modelName || 'Untitled draft', sections, openGaps };
}

// SV: Waiting For Her — what is waiting on her, in reading order: open comment threads (on a paragraph
// or a sentence; resolved ones and replies don't count) and open edit suggestions. Parked points are left out.
// Within a paragraph: comments on the paragraph, then each sentence's comments and suggestions.
export function waitingItems(state) {
  const points = getBoardGroups(state).filter(g => !g.chapter?.parked).flatMap(g => g.slices);
  const suggestions = openSuggestions(state);
  const snippet = (text, max = 80) => { const t = String(text).replace(/\s+/g, ' ').trim(); return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t; };
  return points.flatMap((slice, i) => {
    const sentences = sentencesOf(state, slice.id);
    const threads = sliceComments(state, slice.id).threads.filter(t => !t.resolved);
    const known = new Set(sentences.map(s => s.id));
    const where = `¶ ${i + 1}`;
    const comment = t => ({ kind: 'comment', id: t.commentId, sliceId: slice.id, sentenceId: known.has(t.scenarioId) ? t.scenarioId : null, who: t.nickname, snippet: snippet(t.text), where });
    const suggestion = x => ({ kind: 'suggestion', id: x.id, sliceId: slice.id, sentenceId: x.sentenceId, who: x.by || 'Suggestion', snippet: `${x.find} → ${x.replace || 'cut'}`, where });
    return [
      ...threads.filter(t => !known.has(t.scenarioId)).map(comment),
      ...sentences.flatMap(s => [...threads.filter(t => t.scenarioId === s.id).map(comment), ...suggestions.filter(x => x.sentenceId === s.id).map(suggestion)])
    ];
  });
}

// SV: Comment Marks — a paragraph's comment threads (on it and on its sentences; replies are part of their
// thread): how many are open and resolved, and the first open one in reading order. null: none at all.
export function commentMarks(state, sliceId) {
  const threads = sliceComments(state, sliceId).threads;
  if (!threads.length) return null;
  const order = sentencesOf(state, sliceId).map(s => s.id);
  const place = t => { const i = order.indexOf(t.scenarioId); return i < 0 ? -1 : i; };
  const open = threads.filter(t => !t.resolved).sort((a, b) => place(a) - place(b));
  const first = open[0] ? { sentenceId: place(open[0]) < 0 ? null : open[0].scenarioId } : null;
  return { open: open.length, resolved: threads.length - open.length, first };
}

// ## per chapter (the same rule as the story's headings), paragraphs joined from their sentences
export function draftMarkdown(state) {
  const { title, sections } = readingView(state);
  const blocks = sections.flatMap(s => {
    const written = s.paragraphs.filter(p => !p.gap);
    const req = s.requirement ? [`> **Requirement:** ${s.requirement.split('\n').join('\n> ')}`] : [];
    return written.length || req.length ? [...(s.heading ? [`## ${s.heading}`] : []), ...written.map(p => p.text), ...req] : [];
  });
  return { title, markdown: blocks.length ? blocks.join('\n\n') + '\n' : '' };
}
