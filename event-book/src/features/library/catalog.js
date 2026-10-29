// ===========================================
// LIBRARY - The card catalog: look a book up by what it's called, what it's about, or a chapter
// Pure. books: [{ id, name, description, chapters: [name], shelf, slices, remote? }] → the ones
// every word of the query is found in, best first: the name starting with it, then the name
// holding it, then a chapter, then the description; alphabetical within each.
// ===========================================

const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export const queryWords = q => fold(q).split(/[^a-z0-9]+/).filter(Boolean);

export function searchBooks(books, query, { limit = 30 } = {}) {
  const words = queryWords(query);
  if (!words.length) return [];
  const scored = [];
  for (const b of books) {
    const name = fold(b.name), chapters = (b.chapters || []).map(fold), desc = fold(b.description);
    let score = 0, ok = true;
    for (const w of words) {
      const s = name.split(/[^a-z0-9]+/).some(t => t.startsWith(w)) ? (name.startsWith(w) ? 4 : 3)
        : name.includes(w) ? 2 : chapters.some(c => c.includes(w)) ? 1 : desc.includes(w) ? 0.5 : 0;
      if (!s) { ok = false; break; }
      score += s;
    }
    if (ok) scored.push({ ...b, score, why: chapters.length && !words.every(w => name.includes(w)) ? (b.chapters || []).find(c => words.some(w => fold(c).includes(w))) || null : null });
  }
  return scored.sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name), undefined, { numeric: true, sensitivity: 'base' })).slice(0, limit);
}
