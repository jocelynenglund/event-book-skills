// ===========================================
// COMPARE - Compare Page: everything the "Plan vs built" page shows for two shelves, as one answer: what the
// sides are called, the summary and filter chips, what can be confirmed done, the built-as-planned list, and
// the chapters of rows (each row with its notes, scenarios, extras and fields). The page replays each shelf once.
// ===========================================

import { projectState } from '../../core/projections.js';
import { listModels } from '../../core/eventStore.js';
import { compareModels } from './diff.js';
import { doneToConfirm } from './command.js';
import { ordinal } from '../editions/rules.js';
import { builtAsPlannedList } from '../specs/builtAsPlannedList.read.js';

const KIND = { SC: 'Change', SV: 'View', AU: 'Automation' };

function rowIssues(r) {
  return {
    gwt: r.scenarios.some(x => x.mismatches.length || (x.mustHave && !x.tested && !x.notPassingYet)),
    fields: r.fields.missing.length + r.fields.extra.length > 0
  };
}
const shows = (filter, r) => filter === 'all' ? true
  : filter === 'missing' ? r.status === 'missing'
  : filter === 'new' ? r.status === 'new'
  : filter === 'maybe' ? r.status === 'maybe'
  : filter === 'pending' ? r.scenarios.some(x => x.notPassingYet)
  : filter === 'gwt' ? rowIssues(r).gwt
  : filter === 'fields' ? rowIssues(r).fields : true;

const isBuilt = st => !!st.modelSource?.commit;
const editionTag = st => st.edition?.published && st.edition.edition ? `edition ${st.edition.edition}` : '';
const changedTag = id => {
  const at = listModels().find(m => m.id === id)?.updatedAt, d = at ? new Date(at) : null;
  return d && !isNaN(d) ? `changed ${d.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : '';
};

// Two shelves, A (this one) and B (the other), labelled so it reads for any pair: a plan and
// what was built are Plan and Built; two of a kind with one name, by what differs between them
// (edition, commit, build, when last changed); otherwise by their names
export function sideLabels(a, b, ids = {}) {
  const nameA = a.modelName || 'Untitled model', nameB = b.modelName || 'Untitled model';
  const builtDetail = st => [editionTag(st), st.modelSource?.build ? `build ${st.modelSource.build}` : '', st.modelSource.commit.slice(0, 7)].filter(Boolean).join(' · ');
  if (isBuilt(a) !== isBuilt(b)) {
    const label = st => isBuilt(st) ? 'Built' : 'Plan';
    const books = nameA === nameB ? nameA : `${nameA} ↔ ${nameB}`;
    return { a: label(a), b: label(b), books, detail: `Built · ${builtDetail(isBuilt(a) ? a : b)}` };
  }
  if (nameA !== nameB) return { a: nameA, b: nameB, books: '', detail: '' };
  const tags = [editionTag, st => st.modelSource?.commit?.slice(0, 7) || '', st => st.modelSource?.build ? `build ${st.modelSource.build}` : ''];
  for (const tag of tags) {
    const x = tag(a), y = tag(b);
    if (x && y && x !== y) return { a: x, b: y, books: nameA, detail: '' };
  }
  const x = changedTag(ids.a), y = changedTag(ids.b);
  if (x && y && x !== y) return { a: x, b: y, books: nameA, detail: '' };
  return { a: 'This one', b: 'The other', books: nameA, detail: '' };
}

// A differing scenario part as a diff, one a line: what both have in plain, what only A has (−)
// and what only B has (+), kept in order (longest common run of events)
const same = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
export function lineDiff(a, b) {
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    lcs[i][j] = same(a[i]) === same(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (same(a[i]) === same(b[j])) { out.push({ t: '=', v: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ t: '−', v: a[i++] });
    else out.push({ t: '+', v: b[j++] });
  }
  while (i < n) out.push({ t: '−', v: a[i++] });
  while (j < m) out.push({ t: '+', v: b[j++] });
  return out;
}
const items = s => (!s || s === 'nothing') ? [] : String(s).split(', ');

const mismatchOf = m => ({
  part: m.part,
  lines: m.part === 'Given' ? lineDiff(items(m.planned), items(m.built))
    : [...(m.planned ? [{ t: '−', v: m.planned }] : []), ...(m.built && m.built !== 'nothing' ? [{ t: '+', v: m.built }] : [{ t: '+', v: 'nothing', none: true }])]
});

// One slice of the compare, ready to draw
function rowOf(r, { names, only, decidable }) {
  const scenarios = (r.status === 'new' ? [] : r.scenarios.filter(x => x.mustHave || !x.tested || x.mismatches.length)).map(x => ({
    kind: x.notPassingYet ? 'pending' : !x.tested ? 'minus' : x.mismatches.length ? 'differs' : '',
    sign: x.notPassingYet ? '⏳' : x.tested ? '=' : '−',
    star: x.mustHave ? '★' : '☆', name: x.name, notPassingYet: !!x.notPassingYet,
    mismatches: x.mismatches.map(mismatchOf)
  }));
  const sign = r.status === 'missing' ? '−' : r.status === 'new' ? '+' : r.status === 'pending' ? '⏳' : '';
  return {
    key: r.plan?.id || r.built?.id || r.title, status: r.status, type: r.type, kind: KIND[r.type] || '', title: r.title, sign,
    maybe: r.status === 'maybe' ? {
      from: r.renamed.from, to: r.renamed.to, inChapter: r.builtChapter && r.builtChapter !== r.chapter ? r.builtChapter : null,
      slice: r.plan.id, otherShelf: r.otherShelf, otherName: r.otherSliceName, decidable,
      readOnlyNote: decidable ? null : `${names.a} is read-only here: an answer can't be recorded.`
    } : null,
    renamedNote: r.status !== 'maybe' && r.renamed ? `Renamed in ${names.b}: ${r.renamed.to}.` : null,
    chapterNote: r.status !== 'maybe' && r.builtChapter && r.chapter && r.builtChapter !== r.chapter ? `In another chapter in ${names.b}: ${r.builtChapter}.` : null,
    scenarios,
    extraFolded: r.status !== 'new' && r.extraTests.length ? { summary: `+ ${r.extraTests.length} ${r.extraTests.length === 1 ? 'scenario' : 'scenarios'} ${only('b')}`, lines: r.extraTests } : null,
    extraLines: r.status === 'new' ? r.extraTests : [],
    fieldsMissing: r.fields.missing.length ? { tag: `− fields ${only('a')}`, fields: r.fields.missing } : null,
    fieldsExtra: r.fields.extra.length ? { tag: `+ fields ${only('b')}`, fields: r.fields.extra } : null
  };
}

// planEvents, builtEvents: the two shelves' events. ids: their model ids. filter: all | missing | new | maybe | pending | gwt | fields.
// editable: the plan is the open board and can be changed (answers and confirmations are only offered then).
export function comparePage({ planEvents, builtEvents, ids = {}, filter = 'all', editable = false }) {
  const plan = projectState(planEvents), built = projectState(builtEvents);
  const { rows, summary: s } = compareModels(plan, built);
  const labels = sideLabels(plan, built, ids);
  const names = { a: labels.a, b: labels.b };
  const only = side => `only in ${names[side]}`;
  const gwt = rows.filter(r => rowIssues(r).gwt).length;
  // Generated specs still pending: planned scenarios whose tests aren't passing yet
  const waiting = rows.reduce((n, r) => n + r.scenarios.filter(x => x.notPassingYet).length, 0);
  const chip = (key, text, n) => ({ key, text, on: filter === key, disabled: n === 0 && key !== 'all' });
  const chips = [chip('all', 'All', 1),
    ...(s.maybe ? [chip('maybe', `${s.maybe} maybe renamed`, s.maybe)] : []),
    chip('missing', `− ${s.missing} ${only('a')}`, s.missing),
    chip('new', `+ ${s.new} ${only('b')}`, s.new),
    ...(waiting ? [chip('pending', `⏳ ${waiting} not passing yet`, waiting)] : []),
    chip('gwt', `${gwt} with Given/When/Then differences`, gwt),
    chip('fields', `${s.fieldDiffs} ${s.fieldDiffs === 1 ? 'field' : 'fields'}`, s.fieldDiffs)];

  const sections = [...new Set(rows.map(r => r.chapter))].map(ch => {
    const list = rows.filter(r => r.chapter === ch && shows(filter, r));
    if (!list.length) return null;
    // Slices only on the right are scope creep: folded at the chapter's end (open when filtered to them)
    const draw = r => rowOf(r, { names, only, decidable: editable });
    const extra = list.filter(r => r.status === 'new');
    return { chapter: ch || 'Not in a chapter', rows: list.filter(r => r.status !== 'new').map(draw),
      creep: extra.length ? { summary: `+ ${extra.length} ${extra.length === 1 ? 'slice' : 'slices'} ${only('b')}`, open: filter === 'new', rows: extra.map(draw) } : null };
  }).filter(Boolean);

  // Done is recorded, never assumed: when the other shelf was built from the tests (it has a commit), the plan's
  // refined slices it has are offered as done, to confirm (only on the open, editable plan)
  const done = editable ? doneToConfirm(plan, built) : [];
  const ids2 = new Set(done.map(d => d.sliceId));
  const all = Object.values(plan.slices);
  // Every slice would be Done after this confirm: offer to publish the edition with it
  const complete = !!done.length && all.length && all.every(x => x.built || ids2.has(x.id)) && !plan.edition?.published;
  const confirm = done.length ? {
    note: `Refined in ${names.a} and built in ${names.b} @ ${built.modelSource.commit.slice(0, 7)}:`,
    titles: done.map(d => d.title),
    publishLabel: complete ? `☑ Publish ${ordinal(plan.edition?.edition || 1)} edition` : null,
    confirmLabel: `☑ Confirm ${done.length} done`
  } : null;

  return {
    labels, names, hint: labels.a !== 'This one',
    summaryLine: `${s.built} of ${s.planned} slices are in both${s.pending ? ` · ${s.pending} with specs written, not passing yet` : ''}${s.maybe ? ` · ${s.maybe} maybe renamed` : ''}${s.mustHaves ? ` · ${s.mustHavesTested} of ${s.mustHaves} ★ must haves are in both` : ''}`,
    chips, confirm, planned: builtAsPlannedList(plan, built), sections, empty: !sections.length
  };
}
