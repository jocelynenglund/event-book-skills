// ===========================================
// VELOCITY - How fast the apps get built (pure, over the build books' events)
// A slice counts as built on the day of the edition that added it (the book's SlicesBuilt events:
// read.js). An app's first edition is its baseline, not counted (a port of existing code would
// spike otherwise). The day is the edition's createdAt (when the build's tests ran) in the device's time zone.
// Decision code takes plain histories: no store calls.
// ===========================================

import { editionRecords, isBuildBook } from '../buildVersions/rules.js';
import { slicesBuilt } from './read.js';
import { dayOf, localDay } from './days.js';

export { slicesBuilt, dayOf };

// SV: Velocity — slices built per calendar day over the `days` days up to and including `today`,
// across the rows of every build book. perDay is total ÷ days, to a tenth; days without a deploy count zero.
export function velocity(rows, days, today = new Date()) {
  const window = Array.from({ length: days }, (_, i) => localDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1 - i))));
  const count = Object.fromEntries(window.map(d => [d, 0]));
  const apps = new Map();
  rows.filter(r => r.day in count).forEach(r => {
    count[r.day] += r.slices.length;
    apps.set(r.app, (apps.get(r.app) || 0) + r.slices.length);
  });
  const byDay = window.map(day => ({ day, count: count[day] }));
  const total = byDay.reduce((n, d) => n + d.count, 0);
  const byApp = [...apps].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).map(([app, n]) => ({ app, count: n }));
  return { days, total, perDay: Math.round(total / days * 10) / 10, byDay, byApp };
}

// What a book adds to the velocity: { editions, rows } for a build book, null for any other.
// The slow part (a projection per edition); callers can keep it per book while its events are the same.
export const buildSummary = events => isBuildBook(events) ? { editions: editionRecords(events).length, rows: slicesBuilt(events) } : null;

// SV: Velocity Line — the bookshelves' line: "🚀 0.9 slices/day · last 7 days" with a bar per day.
// null (hidden) until some build book has a second edition. `summaries`: the build books' buildSummary.
export function velocityLine(summaries, days = 7, today = new Date()) {
  const builds = summaries.filter(Boolean);
  if (!builds.some(b => b.editions > 1)) return null;
  const v = velocity(builds.flatMap(b => b.rows), days, today);
  return { text: `🚀 ${v.perDay} slices/day · last ${days} days`, sparkline: v.byDay.map(d => d.count), ...v };
}
