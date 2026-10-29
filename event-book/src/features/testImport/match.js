// ===========================================
// IMPORT MATCH - Rules (pure)
// SV: Import Match — before an import settles: the shelf it is the same book as, if any.
//   The same book: its first event is the shelf's first event (an export of that shelf), else
//   (built from tests) the same repo or the same app's build book, else the same name, for the
//   same kind of book (a build named like a plan is its build, for Compare, not the same book).
// SC: Keep Both — the import's name, free on these shelves: "‹name› (2)", "(3)"…
// ===========================================

import { projectState } from '../../core/projections.js';
import { buildBookApp } from '../buildVersions/rules.js';

const norm = s => String(s || '').trim().toLowerCase();
const repoOf = st => String(st.modelSource?.repo || '').replace(/\.git$|\/+$/g, '').toLowerCase().split('/').slice(-2).join('/');

// imported: { id, events }; shelves: [{ id, events }] (the import's own shelf is skipped)
// → { shelfId, name, matchedBy: 'id' | 'name' | 'app' } or null
export function importMatch(imported, shelves) {
  const others = shelves.filter(s => s.id !== imported.id).map(s => ({ ...s, state: projectState(s.events) }));
  const state = projectState(imported.events);
  const first = imported.events[0]?.id;
  const name = norm(state.modelName);
  const repo = repoOf(state);
  const app = norm(buildBookApp(state.modelName || '') || state.modelName);
  const hit = (s, matchedBy) => s && { shelfId: s.id, name: s.state.modelName || 'Untitled model', matchedBy };
  const byId = () => hit(first && others.find(s => s.events[0]?.id === first), 'id');
  // Named alike counts only for the same kind of book: a build named like a plan is that plan's
  // build (today's Compare offer), not the same book
  const built = st => !!st.modelSource?.commit;
  const byName = () => hit(name && others.find(s => norm(s.state.modelName) === name && built(s.state) === built(state)), 'name');
  // A build (from the tests) is first the app's build book, then a shelf named like it
  const byApp = () => state.modelSource?.commit
    ? hit(others.find(s => buildBookApp(s.state.modelName || '') && ((repo && repoOf(s.state) === repo) || (app && norm(buildBookApp(s.state.modelName)) === app))), 'app')
    : null;
  return byId() || byApp() || byName() || null;
}

// Keep both: the first "‹name› (n)" no shelf has
export function keepBothName(name, names) {
  const taken = new Set(names.map(norm));
  let n = 2;
  while (taken.has(norm(`${name} (${n})`))) n++;
  return `${name} (${n})`;
}
