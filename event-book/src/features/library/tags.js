// ===========================================
// LIBRARY - Books by tag: the chips on the bookshelves and what a tag shows
// Pure, but for the per-device choice. books: [{ id, name, tags: [] }]
// ===========================================

export const booksByTag = (books, tag) => ({ tag, books: books.filter(b => (b.tags || []).includes(tag)).map(b => b.name) });

// Every tag in use, most used first (then alphabetical), with how many books wear it
export function tagCounts(books) {
  const n = new Map();
  books.forEach(b => (b.tags || []).forEach(t => n.set(t, (n.get(t) || 0) + 1)));
  return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag, count]) => ({ tag, count }));
}
export const tagsInUse = books => tagCounts(books).map(x => x.tag);

// The tag the shelves are filtered by: a per-device convenience
const KEY = 'eventpad_shelf_tag';
export function shelfTag() { try { return localStorage.getItem(KEY) || null; } catch (e) { return null; } }
export function setShelfTag(tag) {
  try { tag ? localStorage.setItem(KEY, tag) : localStorage.removeItem(KEY); } catch (e) { /* just this time */ }
}
