// SCENARIOS - Scenario Given Pool (SV): every event in the book a scenario can start from, whatever chapter it is in: this
// slice's own first (A to Z), then the rest (A to Z), each saying where it lives ("Chapter · Slice", or "not on the board")
import { byName } from '../../core/constants.js';
import { getOrderedSlices } from '../../core/projections.js';

export function scenarioGivenPool(book, sliceId) {
  const own = new Set(book.slices[sliceId]?.elements || []);
  const seen = new Set();
  const out = [];
  const take = (id, where) => {
    const el = book.elements[id];
    if (el?.type !== 'event' || seen.has(id)) return;
    seen.add(id);
    out.push({ id, name: el.name, external: !!el.external, where });
  };
  own.forEach(id => take(id, ''));
  getOrderedSlices(book).forEach(s => {
    const chapter = s.chapterId && book.chapters[s.chapterId]?.name;
    s.elements.forEach(id => take(id, [chapter, s.name].filter(Boolean).join(' · ')));
  });
  Object.keys(book.elements).forEach(id => take(id, 'not on the board'));
  return [...out.filter(e => own.has(e.id)).sort(byName), ...out.filter(e => !own.has(e.id)).sort(byName)];
}
