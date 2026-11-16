// ===========================================
// SHARE IMAGE - Share Scopes: what the scope picker offers, the whole model (only while the book is small)
// and its chapters, each with its slice count
// Jocelyn, 2026-11-08: "if it gets to a number of x slices maybe 20, we don't offer the whole model as an option."
// ===========================================

import { getBoardGroups } from '../../core/projections.js';
import { scopeOf } from './scope.js';

// The whole model is offered while the book has this many slices or fewer
const WHOLE_MAX = 20;

// picked: the scope the sheet has now ('' / null: whole model; 'slice:<id>'; chapter ids joined by commas).
// It stays when it still makes sense; otherwise the whole model for a small book, else the first chapter.
export function shareScopes(state, picked = null) {
  const groups = getBoardGroups(state).filter(g => g.slices.length);
  const chapters = groups.filter(g => g.chapter).map(g => ({ chapterId: g.chapter.id, name: g.chapter.name, slices: g.slices.length }));
  const total = groups.reduce((n, g) => n + g.slices.length, 0);
  // A big book with no chapters has nothing to split into: it stays whole (a slice at a time from the slice's menu)
  const whole = total <= WHOLE_MAX || !chapters.length;
  const scope = scopeOf(picked);
  const known = (scope.chapters || []).filter(id => chapters.some(c => c.chapterId === id));
  const keep = scope.slices ? picked : known.length ? known.join(',') : null;
  return { whole, picked: keep || (whole ? null : chapters[0].chapterId), chapters };
}
