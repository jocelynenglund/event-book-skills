// ===========================================
// USAGE - Events used: the window's plain totals per event type, for the build book's Built · Used details
// Not attributed to a slice: each event with the changes the build book says record it (in board order).
// Jocelyn, 2026-11-08: "we should instead have events counted" … "let's not fix it if we can't derive it
// by code." The slices' own counts stay as the build book derives them (usage/rules.js).
// ===========================================

import { projectState, getOrderedSlices, sliceTitle } from '../../core/projections.js';
import { latestUsage, normalName } from './rules.js';

// A usage key the model has no event for keeps its own words: PaymentTaken → Payment Taken
const spaced = key => String(key).replace(/[_-]+/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').trim();

// [{ name, count, recordedBy: [slice titles] }], biggest first ([] without usage); state: the book as it is, if known
export function eventsUsed(events, state = projectState(events)) {
  const usage = latestUsage(events);
  if (!usage) return [];
  const counts = new Map();
  Object.entries(usage.counts || {}).forEach(([key, n]) => {
    const k = normalName(key);
    const cur = counts.get(k) || { key, n: 0 };
    cur.n += n;
    counts.set(k, cur);
  });
  // The model's names for its events, and which changes (and automations) record each
  const names = new Map(), by = new Map();
  Object.values(state.elements).forEach(e => { if (e.type === 'event' && !names.has(normalName(e.name))) names.set(normalName(e.name), e.name); });
  getOrderedSlices(state).forEach(slice => {
    if (slice.type === 'SV') return;
    const triggers = new Set(state.connections.filter(c => c.relation === 'trigger').map(c => c.from));
    const own = new Set(slice.elements.map(id => state.elements[id])
      .filter(e => e?.type === 'event' && !(slice.type === 'AU' && triggers.has(e.id))).map(e => normalName(e.name)));
    own.forEach(k => { if (!by.has(k)) by.set(k, []); by.get(k).push(sliceTitle(slice, state)); });
  });
  return [...counts].map(([k, { key, n }]) => ({ name: names.get(k) || spaced(key), count: n, recordedBy: by.get(k) || [] }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
