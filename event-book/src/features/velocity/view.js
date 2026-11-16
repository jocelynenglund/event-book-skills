// ===========================================
// VELOCITY - View
// SV: Velocity Line — under the bookshelves' header: "🚀 0.9 slices/day · last 7 days" with a bar per
// day. Tap for the last 30 days and each app's share. Hidden until a build book has a second edition.
// ===========================================

import { listModels, readModelEvents } from '../../core/eventStore.js';
import { buildSummary } from './rules.js';
import { velocityOf } from '../library/screen.js';
import { libraryVelocity } from '../library/rowView.js';

// Which window is showing: 7 days, or 30 after a tap (a per-device convenience, not kept)
let open = false;
export const toggleVelocity = () => { open = !open; };

// A book's summary costs a projection per edition, so it's kept, on this device too, while the
// book's events are the same (count and last event). Missing ones are worked out after the
// shelves are shown, a book at a time, then the line fills in: the shelves never wait for it.
const CACHE_KEY = 'eventpad_velocity';
const memo = new Map(Object.entries((() => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch (e) { return {}; } })()));
const stampOf = events => ({ n: events.length, last: events[events.length - 1]?.id ?? null });
function cached(id) {
  const hit = memo.get(id);
  if (!hit) return undefined;
  const { n, last } = stampOf(readModelEvents(id));
  return hit.n === n && hit.last === last ? hit.summary : undefined;
}
function work(id) {
  const events = readModelEvents(id);
  const summary = buildSummary(events);
  memo.set(id, { ...stampOf(events), summary });
  return summary;
}
function save(ids) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(ids.filter(id => memo.has(id)).map(id => [id, memo.get(id)])))); } catch (e) { /* full: worked out again next visit */ }
}
const later = fn => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 200 }) : setTimeout(fn, 0));
let filling = false;
function fillIn() {
  if (filling) return;
  filling = true;
  const step = () => {
    const ids = listModels().map(m => m.id);
    const next = ids.find(id => cached(id) === undefined);
    if (next) { work(next); return later(step); }
    filling = false;
    save(ids);
    const slot = document.querySelector('[data-velocity]');
    if (slot) slot.outerHTML = velocitySection();
  };
  later(step);
}

// The books' summaries, or undefined while some are still being worked out (they fill in, then the line is drawn again)
export function velocitySummaries() {
  const summaries = listModels().map(m => cached(m.id));
  if (summaries.includes(undefined)) { fillIn(); return undefined; }
  return summaries;
}
export const velocityOpen = () => open;

// The line ('' when hidden): drawn by the Library velocity component from the Library screen's part
export const velocitySection = () => libraryVelocity(velocityOf(velocitySummaries(), { open }));
