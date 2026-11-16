// ===========================================
// COMPARE - Compare Picker: which shelf to compare with. The rest of the library, a same-named one first,
// each with what tells same-named ones apart (the commit, build and time it was built from, or when it was
// last edited) and how many slices it has.
// ===========================================

import { projectState } from '../../core/projections.js';
import { listModels, readModelEvents } from '../../core/eventStore.js';
import { sourceSummary } from '../../core/source.js';
import { byName } from '../../ui/byName.js';

const nameOf = id => projectState(readModelEvents(id)).modelName || 'Untitled model';

// planId: the shelf to compare. builtId: pick the left side (the plan) for this shelf instead (after importing
// a test export). pairedId: the shelf it was compared with last time.
// -> { none: true } when there is no other shelf, else { title, note, choices: [{ id, name, meta, search, last, builtId, planId }] }
export function comparePicker({ planId, builtId = null, pairedId = null }) {
  const from = builtId || planId;
  const name = nameOf(from).toLowerCase();
  const others = listModels().filter(m => m.id !== from)
    .map(m => {
      const st = projectState(readModelEvents(m.id));
      const edited = m.updatedAt ? new Date(m.updatedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const slices = Object.keys(st.slices).length;
      return { id: m.id, name: st.modelName || 'Untitled model',
        meta: [sourceSummary(st) || (edited ? `edited ${edited}` : ''), `${slices} ${slices === 1 ? 'slice' : 'slices'}`].filter(Boolean).join(' · ') };
    })
    // Same-named books first (likely the other side), then the rest alphabetically
    .sort((a, b) => (b.name.toLowerCase() === name) - (a.name.toLowerCase() === name) || byName(a, b));
  if (!others.length) return { none: true };
  return {
    none: false,
    title: `Compare ${nameOf(from)} with… `,
    note: builtId ? `Pick the plan: it opens on the left, ${nameOf(builtId)} on the right.` : 'The open board is on the left. Pick any other shelf: what was built from the tests, an older version, another idea.',
    choices: others.map(o => ({ id: o.id, name: o.name, meta: o.meta, search: `${o.name} ${o.meta}`.toLowerCase(), last: pairedId === o.id,
      builtId: builtId || o.id, planId: builtId ? o.id : planId }))
  };
}
