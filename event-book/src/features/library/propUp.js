import { NAME_ORDER } from '../../core/constants.js';
// ===========================================
// LIBRARY - Prop up: a book on a little brass stand at the start of its shelf, cover out,
// until it's put back. Kept with the shelves on this device (like the stack of books opened
// last and the tag filter), as a short log of its own events: a published book is frozen and a
// library book is edited where it's checked out, so a prop can't go into the book itself.
// SC: Prop Up Book, Put Book Back · SV: Shelf Order
// ===========================================

export const ShelfEventTypes = { BookProppedUp: 'BookProppedUp', BookPutBack: 'BookPutBack' };
export const SHELF_EVENTS_KEY = 'eventpad_shelf_events';
const MAX_LOG = 200;

// ---------- Rules (pure: the shelf's events in) ----------

// The books propped up, in the order they were propped
export function proppedUp(history) {
  const out = [];
  for (const e of history) {
    const id = e.data?.bookId;
    if (e.type === ShelfEventTypes.BookProppedUp && !out.includes(id)) out.push(id);
    else if (e.type === ShelfEventTypes.BookPutBack && out.includes(id)) out.splice(out.indexOf(id), 1);
  }
  return out;
}

export function decidePropUp(history, { bookId, proppedBy = null }) {
  if (proppedUp(history).includes(bookId)) return { refused: 'Already propped up' };
  return { event: { type: ShelfEventTypes.BookProppedUp, data: { bookId, proppedBy } } };
}

export function decidePutBack(history, { bookId }) {
  if (!proppedUp(history).includes(bookId)) return { refused: 'Not propped up' };
  return { event: { type: ShelfEventTypes.BookPutBack, data: { bookId } } };
}

// SV: Shelf Order — propped-up books first (the order they were propped), then the stack of the
// few opened last (a propped-up one isn't on it too), then the rest in line, A–Z
export function shelfOrder({ ids, titleOf, opened = {}, propped = [], stackSize = 3, stack = true }) {
  const up = propped.filter(id => ids.includes(id));
  const rest = ids.filter(id => !up.includes(id));
  const recent = !stack ? [] : rest.filter(id => opened[id]).sort((a, b) => opened[b].localeCompare(opened[a])).slice(0, stackSize);
  const title = new Map(rest.map(id => [id, String(titleOf(id))]));
  const inLine = rest.filter(id => !recent.includes(id)).sort((a, b) => NAME_ORDER.compare(title.get(a), title.get(b)));
  return { proppedUp: up, stack: recent, inLine };
}

// ---------- This device's shelf log ----------

export function shelfEvents() {
  try { return JSON.parse(localStorage.getItem(SHELF_EVENTS_KEY) || '[]'); } catch (e) { return []; }
}

// Recorded, or why not. A long log is folded down to the books still propped up.
function record(decision) {
  if (decision.refused) return decision.refused;
  let log = [...shelfEvents(), { ...decision.event, timestamp: new Date().toISOString() }];
  if (log.length > MAX_LOG) log = proppedUp(log).map(bookId => ({ type: ShelfEventTypes.BookProppedUp, data: { bookId } }));
  try { localStorage.setItem(SHELF_EVENTS_KEY, JSON.stringify(log)); } catch (e) { return 'Not saved: this device is out of room'; }
  return null;
}

// ---------- Commands (null when recorded, else why not) ----------

export const propUpBook = (bookId, proppedBy = null) => record(decidePropUp(shelfEvents(), { bookId, proppedBy }));
export const putBookBack = bookId => record(decidePutBack(shelfEvents(), { bookId }));
export const isProppedUp = bookId => proppedUp(shelfEvents()).includes(bookId);
