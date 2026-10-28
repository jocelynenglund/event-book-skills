// ===========================================
// COMPARE - Plan vs built (SV: View Plan Vs Built)
// Two models side by side: the one outlined (the plan) and the one built from the tests.
// Slices match by their command (a change) or read model (a view), scenarios by name,
// fields by name; case, spaces and punctuation don't count. Pure: two states in, the
// differences out.
// ===========================================

import { getOrderedSlices, getScenariosForSlice, sliceTitle } from '../../core/projections.js';

export const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// What a slice is called for matching: its command, or its read model, else its title
export function sliceKey(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const main = slice.type === 'SV' ? els.find(e => e.type === 'readModel') : els.find(e => e.type === 'command');
  return norm(main?.name || sliceTitle(slice, state));
}

export function fieldsOf(slice, state) {
  const names = new Map();
  slice.elements.map(id => state.elements[id]).filter(Boolean)
    .forEach(el => (el.properties || []).forEach(p => { if (!names.has(norm(p.name))) names.set(norm(p.name), p.name); }));
  return names;
}

// A scenario in words that can be compared: its Given events, When command, Then
function shape(scn, state) {
  const name = id => state.elements[id]?.name || '';
  const t = scn.then;
  return {
    given: (scn.given || []).map(g => name(g.elementId)).filter(Boolean),
    when: scn.when?.commandId ? name(scn.when.commandId) : '',
    then: t?.type === 'event' ? name(t.eventId) : t?.type === 'rejection' ? 'rejected' : t?.type === 'readModel' ? name(t.readModelId) : ''
  };
}

// Where a planned scenario and its test disagree (only what the plan says: an empty plan part isn't a mismatch)
function mismatches(planned, built) {
  const out = [];
  const g1 = planned.given.map(norm).sort().join('|'), g2 = built.given.map(norm).sort().join('|');
  if (planned.given.length && g1 !== g2) out.push({ part: 'Given', planned: planned.given.join(', '), built: built.given.join(', ') || 'nothing' });
  if (planned.when && norm(planned.when) !== norm(built.when)) out.push({ part: 'When', planned: planned.when, built: built.when || 'nothing' });
  if (planned.then && norm(planned.then) !== norm(built.then)) out.push({ part: 'Then', planned: planned.then, built: built.then || 'nothing' });
  return out;
}

// What a slice is called, as shown: its command or read model, else its title
function mainName(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const main = slice.type === 'SV' ? els.find(e => e.type === 'readModel') : slice.type === 'SC' ? els.find(e => e.type === 'command') : null;
  return main?.name || sliceTitle(slice, state);
}

// Which other shelf a decision is about, stable across re-imports: the repo it was built
// from (its last part), else its name
export function shelfKey(state) {
  const repo = String(state?.modelSource?.repo || '').replace(/\/+$/, '').split('/').pop();
  return norm(repo || state?.modelName || '');
}

// ---------- Possible renames ----------
// A slice's shape: the fields of what it records (a change: its events), shows (a view:
// its read model) or holds (an automation: all its stickies). An id field counts as "id"
// whatever it names (todoId, taskId), since a rename renames those too.
const fieldKey = name => { const k = norm(name); return k.length > 2 && k.endsWith('id') ? 'id' : k; };
function shapeFields(slice, state) {
  const want = slice.type === 'SC' ? 'event' : slice.type === 'SV' ? 'readModel' : null;
  const keys = new Set();
  slice.elements.map(id => state.elements[id]).filter(e => e && (!want || e.type === want))
    .forEach(e => (e.properties || []).forEach(p => keys.add(fieldKey(p.name))));
  return keys;
}
const words = s => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

// Two unmatched slices are a possible rename when they're the same kind and their fields
// overlap by at least half of the smaller set, with a field besides an id in common (every
// event has an id). Best first: overlap, then Jaccard, then words their names share, then
// how near they sit among slices of their kind (chapter/slice order, as a fraction).
// Each slice gets at most one candidate.
export const RENAME_MIN_OVERLAP = 0.5;
function renameCandidates(planSlices, builtSlices, plan, built, keptApart) {
  const pos = (list, s) => { const same = list.filter(x => x.type === s.type); return same.length > 1 ? same.indexOf(s) / (same.length - 1) : 0; };
  const pairs = [];
  planSlices.forEach(p => {
    const pf = shapeFields(p, plan);
    if (!pf.size) return;
    builtSlices.forEach(b => {
      if (b.type !== p.type || keptApart(p, b)) return;
      const bf = shapeFields(b, built);
      if (!bf.size) return;
      const shared = [...pf].filter(k => bf.has(k));
      const common = shared.length;
      const overlap = common / Math.min(pf.size, bf.size);
      if (!shared.some(k => k !== 'id') || overlap < RENAME_MIN_OVERLAP) return;
      const pw = words(mainName(p, plan)), bw = words(mainName(b, built));
      pairs.push({ p, b, overlap, jaccard: common / (pf.size + bf.size - common),
        words: [...pw].filter(w => bw.has(w)).length, distance: Math.abs(pos(planSlices, p) - pos(builtSlices, b)) });
    });
  });
  pairs.sort((x, y) => y.overlap - x.overlap || y.jaccard - x.jaccard || y.words - x.words || x.distance - y.distance);
  const taken = new Set(), out = new Map();
  pairs.forEach(c => {
    if (taken.has(c.p.id) || taken.has(c.b.id)) return;
    taken.add(c.p.id); taken.add(c.b.id);
    out.set(c.p.id, c);
  });
  return out;
}

export function compareModels(plan, built) {
  const builtSlices = getOrderedSlices(built);
  const planSlices = getOrderedSlices(plan);
  const byKey = new Map();
  builtSlices.forEach(s => { const k = sliceKey(s, built); if (!byKey.has(k)) byKey.set(k, s); });
  const used = new Set();
  const chapterName = (s, st) => st.chapters[s.chapterId]?.name || '';
  // The plan's answers about this other shelf's slices: the same slice, or kept apart
  const other = shelfKey(built);
  const decisions = (plan.sliceDecisions || []).filter(d => d.otherShelf === other);
  const decided = (p, b, same) => decisions.some(d => d.sliceId === p.id && d.same === same && norm(d.otherSliceName) === sliceKey(b, built));

  // By name first; then renames remembered as the same slice; then possible renames
  const pairOf = new Map();
  planSlices.forEach(p => { const b = byKey.get(sliceKey(p, plan)); if (b) { pairOf.set(p.id, { b }); used.add(b.id); } });
  planSlices.filter(p => !pairOf.has(p.id)).forEach(p => {
    const b = builtSlices.find(x => !used.has(x.id) && x.type === p.type && decided(p, x, true));
    if (b) { pairOf.set(p.id, { b, renamed: true }); used.add(b.id); }
  });
  const maybes = renameCandidates(planSlices.filter(p => !pairOf.has(p.id)), builtSlices.filter(b => !used.has(b.id)), plan, built, (p, b) => decided(p, b, false));
  maybes.forEach(c => used.add(c.b.id));

  const none = () => ({ scenarios: [], extraTests: [], fields: { missing: [], extra: [] } });
  const rows = planSlices.map(p => {
    const pair = pairOf.get(p.id), maybe = maybes.get(p.id);
    const b = pair?.b;
    const row = { key: sliceKey(p, plan), title: sliceTitle(p, plan), chapter: chapterName(p, plan), type: p.type, plan: p, built: b || null };
    if (maybe) {
      return { ...row, built: maybe.b, status: 'maybe', ...none(), builtChapter: chapterName(maybe.b, built),
        renamed: { from: mainName(p, plan), to: mainName(maybe.b, built) }, otherShelf: other, otherSliceName: mainName(maybe.b, built) };
    }
    if (!b) return { ...row, status: 'missing', ...none() };
    // Scenarios: each planned one, with its test (by name) if there is one
    const tests = getScenariosForSlice(b.id, built);
    const testByName = new Map(tests.map(x => [norm(x.name), x]));
    const matched = new Set();
    const scenarios = getScenariosForSlice(p.id, plan).map(x => {
      const test = testByName.get(norm(x.name));
      if (test) matched.add(test.id);
      return { name: x.name, mustHave: !!x.mustHave, tested: !!test, mismatches: test ? mismatches(shape(x, plan), shape(test, built)) : [] };
    });
    const extraTests = tests.filter(x => !matched.has(x.id)).map(x => x.name);
    const pf = fieldsOf(p, plan), bf = fieldsOf(b, built);
    // A plan with no fields for a slice hasn't decided them yet: only compare where it names some
    const fields = pf.size
      ? { missing: [...pf].filter(([k]) => !bf.has(k)).map(([, v]) => v), extra: [...bf].filter(([k]) => !pf.has(k)).map(([, v]) => v) }
      : { missing: [], extra: [] };
    const issues = scenarios.some(x => x.mustHave && !x.tested) || scenarios.some(x => x.mismatches.length) || fields.missing.length || fields.extra.length;
    return { ...row, status: issues ? 'differs' : 'built', builtChapter: chapterName(b, built), scenarios, extraTests, fields,
      ...(pair.renamed ? { renamed: { from: mainName(p, plan), to: mainName(b, built) } } : {}) };
  });

  // Built, not planned: placed in the plan's chapter of the same name, if there is one
  const extra = builtSlices.filter(s => !used.has(s.id)).map(s => ({
    key: sliceKey(s, built), title: sliceTitle(s, built), chapter: chapterName(s, built), type: s.type, plan: null, built: s,
    status: 'new', scenarios: [], extraTests: getScenariosForSlice(s.id, built).map(x => x.name), fields: { missing: [], extra: [] }
  }));

  const all = [...rows, ...extra];
  const musts = rows.flatMap(r => r.scenarios.filter(x => x.mustHave));
  return {
    rows: all,
    summary: {
      planned: rows.length,
      built: rows.filter(r => r.status === 'built' || r.status === 'differs').length,
      missing: rows.filter(r => r.status === 'missing').length,
      maybe: rows.filter(r => r.status === 'maybe').length,
      new: extra.length,
      mustHaves: musts.length,
      mustHavesTested: musts.filter(x => x.tested).length,
      mismatches: rows.reduce((n, r) => n + r.scenarios.filter(x => x.mismatches.length).length, 0),
      fieldDiffs: rows.reduce((n, r) => n + r.fields.missing.length + r.fields.extra.length, 0)
    }
  };
}

// SV: Possible Renames — the plan's unmatched slices that look like the other shelf's, renamed
export function possibleRenames(plan, built) {
  return compareModels(plan, built).rows.filter(r => r.status === 'maybe')
    .map(r => ({ sliceId: r.plan.id, from: r.renamed.from, to: r.renamed.to, type: r.type, otherShelf: r.otherShelf, otherSliceName: r.otherSliceName }));
}

// ---------- Library: which shelf to compare an imported test export with ----------
// SV: Compare Suggestion — a shelf named like the app (a plan called "<app> · something"
// counts; plans before other builds of it); else the one with the most slices in common
// (renames count); else the board open before importing. imported, shelves: { id, state }.
// Null when there's no other shelf with slices.
const appNames = state => {
  const name = String(state?.modelName || '');
  const repo = String(state?.modelSource?.repo || '').replace(/\/+$/, '').split('/').pop();
  return new Set([name, name.split(/\s+[·•|–—:-]\s+/)[0], repo].map(norm).filter(Boolean));
};

export function suggestCompareShelf(imported, shelves, previousId = null) {
  // An empty board (no slices) is nothing to compare with
  const others = shelves.filter(s => s.id !== imported.id && Object.keys(s.state.slices || {}).length);
  if (!others.length) return null;
  const mine = appNames(imported.state);
  const inCommon = s => { const { summary } = compareModels(s.state, imported.state); return summary.built + summary.maybe; };
  const named = others.filter(s => [...appNames(s.state)].some(n => mine.has(n)));
  if (named.length) {
    const best = named.map(s => ({ s, plan: !s.state.modelSource?.commit, n: inCommon(s) }))
      .sort((a, b) => b.plan - a.plan || b.n - a.n)[0];
    return { id: best.s.id, why: 'name' };
  }
  const counted = others.map(s => ({ s, n: inCommon(s) })).filter(x => x.n > 0).sort((a, b) => b.n - a.n);
  if (counted.length) return { id: counted[0].s.id, why: 'matches' };
  const open = others.find(s => s.id === previousId);
  return open ? { id: open.id, why: 'open' } : null;
}
