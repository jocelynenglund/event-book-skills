// ===========================================
// LIBRARY - Books found: what the card catalog answers to what was typed
// Pure. books: [{ id, name, description, tags, chapters, shelf, slices, remote?, updatedAt? }] (this device's, then the
// library's others); query: what was typed; library: { [id]: { kept, mine } } (the sync's side, gathered by the screen:
// kept = on the library, mine = checked out on this device); now: for the "updated today" label.
// → { hint, hits: [{ id, name, where, updated, actions, remote }] }. The ranking is catalog.js's.
// ===========================================
import { searchBooks } from './catalog.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const two = n => String(n).padStart(2, '0');

// "updated today, 18:05" / "updated 9 Nov, 18:05" in local time; '' when the time isn't known
export function updatedLabel(at, now = new Date()) {
  const d = at ? new Date(at) : null;
  if (!d || isNaN(d)) return '';
  const n = new Date(now);
  const today = d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
  return `updated ${today ? 'today' : `${d.getDate()} ${MONTHS[d.getMonth()]}`}, ${two(d.getHours())}:${two(d.getMinutes())}`;
}

export function booksFound(books, query, library = {}, now = new Date()) {
  if (!String(query || '').trim()) return { hint: 'TYPE A NAME, A CHAPTER OR A WORD FROM THE DESCRIPTION', hits: [] };
  const hits = searchBooks(books, query).map(b => {
    const side = library[b.id] || {};
    const inLibrary = !!(b.remote || side.kept), mine = !b.remote && !!side.mine;
    const label = updatedLabel(b.updatedAt, now);
    const where = [b.shelf, mine ? 'checked out here' : null, b.slices != null ? `${b.slices} ${b.slices === 1 ? 'slice' : 'slices'}` : null,
      b.why ? `chapter: ${b.why}` : null, label || null].filter(Boolean).join(' · ');
    return { id: b.id, name: b.name, where, updated: b.updatedAt || null,
      actions: [b.remote ? 'download-open' : 'open', ...(inLibrary && !mine ? ['checkout'] : [])], remote: !!b.remote };
  });
  return hits.length ? { hint: null, hits } : { hint: 'NO BOOK FOUND', hits: [] };
}
