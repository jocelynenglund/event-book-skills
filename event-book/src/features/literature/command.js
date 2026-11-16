// ===========================================
// LITERATURE - Fact books and literature (plan "Edit my own draft", stage 1)
// SC: Choose Book Kind — when a book is made: fact (today's Event Book) or literature (a story).
// SC: Import Draft — her Markdown becomes a literature book: each heading starts a chapter named by it (the
//     text before the first is the book's own chapter), each paragraph a point named by its first words, each
//     sentence a line of it, verbatim, in order, signed as hers. A "> **Requirement:** …" blockquote is its
//     chapter's requirement (votes.js), not a paragraph.
//     Allowed before Approve Structure: it's her own text. (The approval gate in features/article is
//     for agents writing paragraphs.)
// SC: Move Point — a paragraph to a new place (after another, or first). It is a slice move, so it
//     takes Approve Structure back, as the article rounds do.
// SC: Park Point / Unpark Point — set aside in a Parked chapter that stays in the book but never in the
//     story or the post; unparking puts it back where it was.
// SC: Add Gap — an empty point where a line is needed, named by its question. Agents and she can ask.
// SC: Fill Gap — she writes the paragraph herself; it is split into sentences like an import, signed as
//     hers. An agent never fills a gap (it suggests in a comment), nor does a reviewer's account. A person
//     does when they are the author (who imported the book, else signed its first sentence), or this device
//     is signed in to a non-reviewer account and the book is kept in her library, or the book is only on this
//     device (her local draft): so a changed nickname can't lock her out.
// (Suggesting and accepting edits are in suggestions.js.)
// Each command returns null when it recorded its event(s), else why it was refused.
// ===========================================

import { appendEvent, EventTypes, getCurrentModelId, canEditCurrent } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { isParked, parkedChapter, isLiterature, authorOf } from './rules.js';
import { splitParagraphs, splitSentences, pointName, isHeading } from './sentences.js';

const record = (type, data) => (appendEvent(type, data) ? null : 'Read only');
const id = prefix => prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function chooseBookKind({ kind, state = projectState() } = {}) {
  if (kind !== 'fact' && kind !== 'literature') return 'A book is a fact book or literature';
  if (state.bookKind) return 'This book already has a kind';
  return record(EventTypes.BookKindChosen, { bookId: getCurrentModelId(), kind });
}

// A blockquote that starts "**Requirement:**" (any case): its text without the > and the label; else null
const REQUIREMENT = /^\*\*requirement:?\*\*:?\s*/i;
function requirementOf(block) {
  const lines = String(block).split('\n');
  if (!lines.every(l => /^\s*>/.test(l))) return null;
  const text = lines.map(l => l.replace(/^\s*>\s?/, '')).join('\n').trim();
  return REQUIREMENT.test(text) ? text.replace(REQUIREMENT, '').trim() : null;
}

// A leading "# Title" line is the draft's title, not a paragraph of it
export function importDraft({ markdown, title = null, fallbackTitle = null, author = null, state = projectState() } = {}) {
  let blocks = splitParagraphs(markdown);
  const h1 = /^#\s+(.+)$/.exec(blocks[0] || '');
  if (h1) blocks = blocks.slice(1);
  if (!blocks.length) return 'There\'s no text in that draft yet';
  if (Object.keys(state.slices).length) return 'A draft comes into a new book';
  const name = String(title || '').trim() || h1?.[1].trim() || String(fallbackTitle || '').trim() || 'Untitled draft';
  const by = String(author || '').trim() || null;
  // A heading starts a chapter named by it; the text before the first heading is the book's own chapter
  const chapters = [];
  blocks.forEach(text => {
    if (isHeading(text)) { chapters.push({ name: text.replace(/^#{1,6}\s+/, '').replace(/\s+/g, ' ').trim(), paragraphs: [], requirement: [] }); return; }
    if (!chapters.length) chapters.push({ name, paragraphs: [], requirement: [] });
    const at = chapters[chapters.length - 1];
    // "> **Requirement:** …" is the chapter's requirement (votes.js), not a paragraph; several are joined
    const req = requirementOf(text);
    if (req !== null) at.requirement.push(req);
    else at.paragraphs.push({ text, sentences: splitSentences(text) });
  });
  const paragraphs = chapters.flatMap(c => c.paragraphs);
  if (!paragraphs.length) return 'There\'s no text in that draft yet';

  const sentenceCount = paragraphs.reduce((n, p) => n + p.sentences.length, 0);
  if (!canEditCurrent()) return 'Read only';
  // Into an empty book that is already named, or already literature, it adds only what's missing
  if (name !== state.modelName) appendEvent(EventTypes.ModelNamed, { name });
  if (state.bookKind !== 'literature') appendEvent(EventTypes.BookKindChosen, { bookId: getCurrentModelId(), kind: 'literature' });
  appendEvent(EventTypes.DraftImported, { title: name, author: by, paragraphs: paragraphs.length, sentences: sentenceCount, chapters: chapters.length });
  chapters.forEach(c => {
    const chapterId = id('chapter');
    appendEvent(EventTypes.ChapterCreated, { chapterId, name: c.name });
    if (c.requirement.length) appendEvent(EventTypes.RequirementSet, { chapterId, text: c.requirement.join('\n\n'), by });
    c.paragraphs.forEach(p => {
      const sliceId = id('slice');
      appendEvent(EventTypes.SliceCreated, { sliceId, sliceType: 'SC', name: pointName(p.text), chapterId });
      p.sentences.forEach(text => appendEvent(EventTypes.SentenceAdded, { sentenceId: id('sentence'), sliceId, text, by }));
    });
  });
  return null;
}

// Right after another point (afterSliceId), or first in the chapter (null); into that point's chapter
export function movePoint({ sliceId, afterSliceId = null, state = projectState() } = {}) {
  const slice = state.slices[sliceId];
  if (!slice) return 'No such point';
  const after = afterSliceId ? state.slices[afterSliceId] : null;
  if (afterSliceId && !after) return 'No such point to place it after';
  if (afterSliceId === sliceId) return null;
  const chapterId = after ? after.chapterId : slice.chapterId;
  if (isParked(state, { chapterId }) && !isParked(state, slice)) return 'Park a point to put it in Parked';
  const rest = state.sliceOrder.filter(x => x !== sliceId);
  const first = rest.findIndex(x => state.slices[x]?.chapterId === chapterId);
  const toIndex = after ? rest.indexOf(after.id) + 1 : Math.max(0, first);
  if (chapterId === slice.chapterId && toIndex === state.sliceOrder.indexOf(sliceId)) return null;
  if (chapterId !== slice.chapterId) appendEvent(EventTypes.SliceChapterSet, { sliceId, chapterId });
  return record(EventTypes.SliceMoved, { sliceId, toIndex });
}

export function parkPoint({ sliceId, state = projectState() } = {}) {
  const slice = state.slices[sliceId];
  if (!slice) return 'No such point';
  if (isParked(state, slice)) return 'Already parked';
  const inChapter = state.sliceOrder.filter(x => state.slices[x]?.chapterId === slice.chapterId);
  const after = inChapter[inChapter.indexOf(sliceId) - 1] || null;
  let parked = parkedChapter(state);
  if (!parked) {
    const chapterId = id('chapter');
    if (!appendEvent(EventTypes.ChapterCreated, { chapterId, name: 'Parked', parked: true })) return 'Read only';
    parked = { id: chapterId };
  }
  appendEvent(EventTypes.SliceChapterSet, { sliceId, chapterId: parked.id });
  return record(EventTypes.PointParked, { sliceId, from: slice.chapterId, after });
}

// Back to the chapter it came from (else the first one), after the point it followed there
export function unparkPoint({ sliceId, state = projectState() } = {}) {
  const slice = state.slices[sliceId];
  if (!slice) return 'No such point';
  if (!isParked(state, slice)) return 'Not parked';
  const from = slice.parkedFrom;
  const live = id => state.chapters[id] && !state.chapters[id].parked;
  const chapterId = live(from?.chapterId) ? from.chapterId : state.chapterOrder.find(live);
  if (!chapterId) return 'There\'s no chapter to put it back in';
  appendEvent(EventTypes.SliceChapterSet, { sliceId, chapterId });
  const after = from?.afterSliceId && state.slices[from.afterSliceId]?.chapterId === chapterId ? from.afterSliceId : null;
  // Back in its place: after the point it followed, else at the front of the chapter
  const moved = movePoint({ sliceId, afterSliceId: after, state: projectState() });
  if (moved) return moved;
  return record(EventTypes.PointUnparked, { sliceId });
}

// Right after another point (afterSliceId), first in the chapter (null), or at the end of the draft (left out)
export function addGap({ question, afterSliceId, by = null, state = projectState() } = {}) {
  const q = String(question || '').replace(/\s+/g, ' ').trim();
  if (!q) return 'Say what the gap is: the question she will answer';
  if (!isLiterature(state)) return 'Gaps are for literature books';
  const after = afterSliceId ? state.slices[afterSliceId] : null;
  if (afterSliceId && !after) return 'No such point to put it after';
  if (after && isParked(state, after)) return 'A gap goes in the story, not in Parked';
  const live = chapterId => state.chapters[chapterId] && !state.chapters[chapterId].parked;
  const chapterId = after ? after.chapterId : [...state.chapterOrder].reverse().find(live);
  if (!chapterId) return 'There\'s no chapter to put it in';
  if (!canEditCurrent()) return 'Read only';
  const sliceId = id('slice');
  appendEvent(EventTypes.SliceCreated, { sliceId, sliceType: 'SC', name: q, chapterId });
  appendEvent(EventTypes.GapAdded, { sliceId, afterSliceId: afterSliceId ?? null, question: q, by: by || null });
  if (afterSliceId !== undefined) movePoint({ sliceId, afterSliceId, state: projectState() });
  return null;
}

export const ONLY_THE_AUTHOR = 'Only the author fills a gap: suggest it in a comment instead';

const stored = key => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } };

// Whether this device is hers for this book: the library is hers, so a signed-in device is her (a reviewer's
// account is not); a book not kept is a local draft
function deviceIsHers() {
  if (!stored('eventpad_kept')?.[getCurrentModelId()]) return true;
  const account = stored('eventpad_account');
  return !!account && account.kind !== 'reviewer';
}

// by: who is writing (this device's nickname or account); agent: an agent is asking (always refused)
export function fillGap({ sliceId, text, by = null, agent = false, state = projectState() } = {}) {
  if (agent) return ONLY_THE_AUTHOR;
  const slice = state.slices[sliceId];
  if (!slice) return 'No such point';
  if (!slice.gap) return 'That point isn\'t a gap';
  if (slice.gap.filled) return 'That gap is filled already';
  const author = authorOf(state), who = String(by || '').trim();
  if (author && who.toLowerCase() !== author.toLowerCase() && !deviceIsHers()) return ONLY_THE_AUTHOR;
  const body = String(text || '').replace(/\s+/g, ' ').trim();
  if (!body) return 'Write the paragraph first';
  return record(EventTypes.GapFilled, { sliceId, by: who || null, text: body,
    sentences: (isHeading(body) ? [body] : splitSentences(body)).map(t => ({ sentenceId: id('sentence'), text: t })) });
}
