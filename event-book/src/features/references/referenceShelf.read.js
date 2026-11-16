// ===========================================
// REFERENCES - Reference Shelf: the chapters saved for reuse, A to Z, each with how many slices it holds and
// where it came from.
// ===========================================

import { byName } from '../../ui/byName.js';
import { listReferences, referenceState } from './store.js';

// How big a reference is, and where it came from: "3 slices · from Wishbook"
export function referenceSummary(ref) {
  const n = Object.keys(referenceState(ref).state.slices).length;
  return `${n} ${n === 1 ? 'slice' : 'slices'}${ref.from ? ` · from ${ref.from}` : ''}`;
}

// -> [{ id, name, summary }]
export function referenceShelf() {
  return [...listReferences()].sort(byName).map(r => ({ id: r.id, name: r.name, summary: referenceSummary(r) }));
}
