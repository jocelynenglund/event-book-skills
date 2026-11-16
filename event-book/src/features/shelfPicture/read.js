// ===========================================
// SHELF PICTURE - the view behind "Share shelf" (a book as a picture of its shelf)
// Only what the picture shows:
//   title        the book's name, on the brass plaque
//   books        one per chapter that has slices, in order (or one for a book without chapters):
//                { key, title, slices, kinds: the first twelve slices as do | see | auto }
//   slices       how many slices the book has; chapters: how many chapters
//   description  hers, without a build book's coverage line, which is its own: coverage
// Jocelyn, 2026-11-08: "let's create a new view model slice for it. look at the data points displayed in
// the image and build only that."
// ===========================================

import { getBoardGroups } from '../../core/projections.js';

const KINDS = 12;
const COVERAGE = /(?:^|\n+)(Coverage: [^\n]*)/;

// A slice's block: an automation (it has a processor, or it's an automation slice), a view, or a change
function kindOf(slice, state) {
  if (slice.type === 'AU' || slice.elements.some(id => state.elements[id]?.type === 'processor')) return 'auto';
  return slice.type === 'SV' ? 'see' : 'do';
}

const book = (key, title, slices, state) => ({ key, title, slices: slices.length, kinds: slices.slice(0, KINDS).map(s => kindOf(s, state)) });

export function shelfPicture(state, key) {
  const title = state.modelName || 'Untitled model';
  const groups = getBoardGroups(state).filter(g => g.slices.length);
  const slices = groups.reduce((n, g) => n + g.slices.length, 0);
  const chapters = state.chapterOrder.length;
  const books = !slices ? [] : !chapters ? [book(key, title, groups.flatMap(g => g.slices), state)]
    : groups.map(g => book(key + (g.chapter?.id || 'loose'), g.chapter ? g.chapter.name : 'Loose slices', g.slices, state));
  const text = state.modelDescription || '';
  const coverage = text.match(COVERAGE)?.[1] || null;
  const description = text.replace(COVERAGE, '').trim() || null;
  return { title, slices, chapters, description, coverage, books };
}
