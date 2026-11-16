// ===========================================
// SEARCH - Slices Found (view)
// The slices that match what was typed, best first. Every word must match the slice somewhere:
// its S-number, its name, a sticky's name, its description (which holds a build book's
// "Code: file:line"), or its chapter's name. `why` is the best reason found. Searching records nothing.
// ===========================================

import { getOrderedSlices, sliceRef, sliceTitle } from '../../core/projections.js';

// Best reason first
const REASONS = ['number', 'name', 'sticky', 'description', 'chapter'];
const norm = t => String(t || '').toLowerCase();

// Why one word matches this slice: the best reason, or null
function reasonFor(word, { ref, title, stickies, description, chapter }) {
  const number = norm(ref);
  if (word === number || word === number.slice(1)) return 'number';
  if (norm(title).includes(word)) return 'name';
  if (stickies.some(s => norm(s).includes(word))) return 'sticky';
  if (norm(description).includes(word)) return 'description';
  if (norm(chapter).includes(word)) return 'chapter';
  return null;
}

export function slicesFound(state, query) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  return getOrderedSlices(state)
    .filter(s => state.sliceOrder.includes(s.id))
    .map((slice, order) => {
      const found = {
        ref: sliceRef(state, slice.id), title: sliceTitle(slice, state), description: slice.description,
        stickies: slice.elements.map(id => state.elements[id]?.name), chapter: state.chapters[slice.chapterId]?.name || ''
      };
      const reasons = words.map(w => reasonFor(w, found));
      if (reasons.includes(null)) return null;
      const why = REASONS.find(r => reasons.includes(r));
      return { order, why, hit: { sliceId: slice.id, ref: found.ref, title: found.title, chapter: found.chapter || null, chapterId: slice.chapterId || null, why } };
    })
    .filter(Boolean)
    .sort((a, b) => REASONS.indexOf(a.why) - REASONS.indexOf(b.why) || a.order - b.order)
    .map(m => m.hit);
}
