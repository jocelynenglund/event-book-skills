// ===========================================
// VELOCITY - Slices Built (the read slice)
// SV: Slices Built — per edition of a build book (oldest first), the slices it added:
// [{ app, day, edition, slices: [name] }]. Editions that add none are left out.
// It reads the book's SlicesBuilt events (one small event per edition, kept when old snapshots are
// let go), not the snapshots. The baseline edition (the app's first) is not counted.
// Editions from before SlicesBuilt existed (a book with none, or the ones before its first) are worked
// out the old way, from the snapshots still kept: a slice counts on the day it first appears in an
// edition, the oldest edition kept being the baseline.
// ===========================================

import { projectState, getOrderedSlices, sliceTitle } from '../../core/projections.js';
import { sliceKey } from '../compare/diff.js';
import { editionRecords, isBuildBook } from '../buildVersions/rules.js';
import { dayOf } from './days.js';

// The old way, for editions before `before`: compare each kept snapshot with the ones before it
function fromSnapshots(events, before) {
  const seen = new Set();
  const out = [];
  editionRecords(events).filter(ed => ed.kept).forEach((ed, i) => {
    const state = projectState(events.slice(0, ed.at));
    const fresh = [];
    getOrderedSlices(state).forEach(s => {
      const k = sliceKey(s, state);
      if (seen.has(k)) return;
      seen.add(k);
      fresh.push(sliceTitle(s, state));
    });
    const day = dayOf(ed.createdAt);
    if (i && ed.edition < before && fresh.length && day) out.push({ app: ed.app, day, edition: ed.edition, slices: fresh });
  });
  return out;
}

export function slicesBuilt(events) {
  if (!isBuildBook(events)) return [];
  const logged = events.filter(e => e.type === 'SlicesBuilt' && e.data);
  const first = logged.length ? Math.min(...logged.map(e => e.data.edition)) : Infinity;
  const out = first > 1 ? fromSnapshots(events, first) : [];
  logged.forEach(({ data: d, timestamp }) => {
    const day = dayOf(d.at || timestamp);
    if (d.baseline || !d.slices?.length || !day) return;
    const row = { app: d.app, day, edition: d.edition, slices: d.slices };
    const at = out.findIndex(r => r.edition === d.edition);
    if (at >= 0) out[at] = row; else out.push(row);
  });
  return out.sort((a, b) => a.edition - b.edition);
}
