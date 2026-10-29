// ===========================================
// USAGE - How much each slice of an app is really used (pure, over a build book's events)
// The nightly job writes an app's stored event counts for a window (latest-used.json:
// { app, at, since, days, total, counts: { "<StoredEventType>": n } }). Import Usage appends them to the
// app's build book as UsageImported { app, at, since, days, total, counts, unmatched }; the newest is the
// book's usage. A count belongs to the model's event of the same name (normalised: lowercase letters and
// digits, so "OrderPlaced" is "Order placed"); a change's or an automation's usage is the sum over the events
// it records, each event counted once (so chapters add up to the real total). A view records nothing: it has
// no count, only what feeds it. Decision code takes plain histories and states: no store calls.
// ===========================================

import { projectState, sliceTitle, getOrderedSlices } from '../../core/projections.js';
import { buildAt, isBuildBook } from '../buildVersions/rules.js';

const IMPORTED = 'UsageImported';
export const BUSIEST = 10;
export const HEAT_LEVELS = 4;

// "Order placed", "OrderPlaced" and "order_placed" are one name
export const normalName = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const eventNames = state => new Set(Object.values(state.elements).filter(e => e.type === 'event').map(e => normalName(e.name)));

// The newest usage a book has (the UsageImported data), or null
export function latestUsage(events) {
  for (let i = events.length - 1; i >= 0; i--) if (events[i].type === IMPORTED) return events[i].data;
  return null;
}

// SC: Import Usage — the usage (the job's file) as the book's newest. Returns { events: [{ type, data }] }
// or { refused }. Needs a build to match the counts to; the same window twice, or an older one, is refused.
export function usageFor(events, used) {
  if (!used?.at) return { refused: 'The usage has no time' };
  if (!isBuildBook(events)) return { refused: 'This book has no build yet' };
  const have = events.filter(e => e.type === IMPORTED).map(e => e.data.at);
  if (have.includes(used.at)) return { refused: `Usage at ${used.at} is in already` };
  const newest = have.sort().pop();
  if (newest && String(used.at) < String(newest)) return { refused: `Usage at ${used.at} is older than the book's (${newest})` };
  const counts = used.counts || {};
  const names = eventNames(buildAt(events).state);
  const unmatched = Object.keys(counts).filter(k => !names.has(normalName(k)));
  const total = used.total ?? Object.values(counts).reduce((a, n) => a + n, 0);
  return { events: [{ type: IMPORTED, data: { app: used.app || null, at: used.at, since: used.since || null, days: used.days ?? null, total, counts, unmatched } }] };
}

const countsByName = usage => {
  const byName = new Map();
  Object.entries(usage?.counts || {}).forEach(([k, n]) => byName.set(normalName(k), (byName.get(normalName(k)) || 0) + n));
  return byName;
};
// The events a slice records: a change's or an automation's own (an automation's trigger is read, not recorded)
const recorded = (slice, state) => slice.elements.map(id => state.elements[id])
  .filter(e => e?.type === 'event' && !(slice.type === 'AU' && state.connections.some(c => c.from === e.id && c.relation === 'trigger')))
  .map(e => normalName(e.name));
// Each event belongs to the first change or automation (board order) that records it, so it counts once
function owners(state) {
  const owner = new Map();
  getOrderedSlices(state).forEach(slice => {
    if (slice.type === 'SV') return;
    recorded(slice, state).forEach(name => { if (!owner.has(name)) owner.set(name, slice.id); });
  });
  return owner;
}

// SV: Slice Usage — { sliceId: n }, the window's count for each change and automation: the events it
// records, each event counted once (its first recorder in board order). Views read and record nothing,
// so they have no count (not in the map): they show what feeds them instead (View Fed By). {} without usage.
export function sliceUsage(state, usage) {
  if (!usage) return {};
  const byName = countsByName(usage);
  const owner = owners(state);
  const out = {};
  getOrderedSlices(state).forEach(slice => {
    if (slice.type === 'SV') return;
    out[slice.id] = [...new Set(recorded(slice, state))].filter(name => owner.get(name) === slice.id).reduce((sum, name) => sum + (byName.get(name) || 0), 0);
  });
  return out;
}

// SV: View Fed By — for a view, the slices that record the events it reads, with their counts:
// [{ sliceId, title, n }] (biggest first; [] without usage or for a slice that isn't a view)
export function viewFedBy(state, usage, sliceId) {
  const slice = state.slices[sliceId];
  if (!usage || slice?.type !== 'SV') return [];
  const byName = countsByName(usage);
  const owner = owners(state);
  const per = new Map();
  [...new Set(slice.elements.map(id => state.elements[id]).filter(e => e?.type === 'event').map(e => normalName(e.name)))].forEach(name => {
    const from = owner.get(name) || null;
    const key = from || `event:${name}`;
    const cur = per.get(key) || { sliceId: from, title: from ? sliceTitle(state.slices[from], state) : name, n: 0 };
    cur.n += byName.get(name) || 0;
    per.set(key, cur);
  });
  return [...per.values()].sort((a, b) => b.n - a.n);
}

// SV: Chapter Usage — { chapterId: n }, the sum over each chapter's slices ({} without usage)
export function chapterUsage(state, sliceN) {
  if (!Object.keys(sliceN || {}).length) return {};
  const out = Object.fromEntries(state.chapterOrder.filter(id => state.chapters[id]).map(id => [id, 0]));
  Object.values(state.slices).forEach(s => { if (s.chapterId in out) out[s.chapterId] += sliceN[s.id] || 0; });
  return out;
}

// How many times an event happened in the window (0 without usage or a match)
export function eventUsage(usage, eventName) {
  if (!usage) return 0;
  const name = normalName(eventName);
  return Object.entries(usage.counts || {}).reduce((sum, [k, n]) => sum + (normalName(k) === name ? n : 0), 0);
}

// SV: Slice Heat — 0 for none, then 1..4 relative to the busiest slice
export const heatOf = (n, max) => (!n || !max ? 0 : Math.min(HEAT_LEVELS, Math.ceil(HEAT_LEVELS * n / max)));

const KIND = { SC: 'change', SV: 'view', AU: 'automation' };

// SV: Usage Insight — the latest build and its usage, for a build book's details (null if it isn't one)
export function usageInsight(events) {
  if (!isBuildBook(events)) return null;
  const build = buildAt(events);
  const usage = latestUsage(events);
  const state = build.state;
  const n = sliceUsage(state, usage);
  const slices = Object.values(state.slices);
  const titles = slices.map(s => sliceTitle(s, state));
  const shared = new Set(titles.filter((t, i) => titles.indexOf(t) !== i));
  const row = s => (t => ({ sliceId: s.id, title: shared.has(t) ? `${t} (${KIND[s.type] || 'slice'})` : t, n: n[s.id] || 0 }))(sliceTitle(s, state));
  const byChapter = chapterUsage(state, n);
  return {
    edition: build.edition, commit: build.commit, build: build.build, slices: slices.length, scenarios: Object.keys(state.scenarios).length,
    usage: usage ? { since: usage.since, at: usage.at, days: usage.days, total: usage.total, keys: Object.keys(usage.counts || {}).length, unmatched: (usage.unmatched || []).length } : null,
    // Only changes and automations count (a view records nothing); each event once
    busiest: usage ? slices.filter(s => s.id in n).map(row).filter(r => r.n > 0).sort((a, b) => b.n - a.n).slice(0, BUSIEST) : [],
    chapters: Object.entries(byChapter).map(([chapterId, c]) => ({ chapterId, name: state.chapters[chapterId].name, n: c })).sort((a, b) => b.n - a.n),
    unused: usage ? slices.filter(s => s.id in n).map(row).filter(r => !r.n).map(r => r.title) : []
  };
}
