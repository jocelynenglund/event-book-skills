// ===========================================
// BUILD VERSIONS - What an app's build book says (pure, over the book's events)
// One build book per app: the shelf "<app> · built". Every deploy that changes the model adds an
// edition to it: NextDraftStarted (when it isn't the first), the build's ModelSnapshot, then
// SlicesBuilt { app, commit, build, edition, at, slices, baseline } (the slices the edition added since the
// one before; baseline: true on the first, which is not counted) and EditionPublished { app, edition,
// commit, build, createdAt, scenarios }. keepLatestEditions lets old snapshots go but keeps every
// SlicesBuilt and EditionPublished, so the book's stream stays the app's build log (velocity reads it). The book is frozen after
// each edition, and a snapshot replaces the model, so "the build at edition N" is the book's
// events up to that EditionPublished. A plan can follow an app's build: its newest edition marks
// the plan's matched slices Done (SliceMarkedBuilt) and takes Done from those gone (SliceBuiltCleared).
// Decision code takes plain histories and states: no store calls.
// ===========================================

import { projectState, getScenariosForSlice, getOrderedSlices, sliceTitle } from '../../core/projections.js';
import { compareModels, contractChanges, fieldsOf, sliceKey } from '../compare/diff.js';
import { snapshotEvents } from '../snapshot/command.js';

const PUBLISHED = 'EditionPublished', BUILT_LOG = 'SlicesBuilt', NEXT = 'NextDraftStarted', SNAPSHOT = 'ModelSnapshot';
export const KEEP_EDITIONS = 10;
export const buildBookName = app => `${app} · built`;

// The app a plan is about, guessed from its name ("eventPAD · plan: x" → eventPAD) or its repo
export function appOfPlan(state) {
  const name = String(state.modelName || '').split(/\s+[·•|–—:-]\s+/)[0].trim();
  const repo = String(state.modelSource?.repo || '').replace(/\/+$/, '').split('/').pop();
  return name || repo || '';
}
// A shelf name → the app it is the build book of (or null)
export const buildBookApp = name => /^(.+) · built$/.exec(String(name || ''))?.[1] || null;
const short = c => String(c || '').slice(0, 7);

// The editions of a build book, oldest first: { edition, app, commit, build, createdAt, scenarios, at (events up to it) }
function editionsOldestFirst(events) {
  const out = [];
  let snapshotSeen = false;
  events.forEach((e, i) => {
    if (e.type === SNAPSHOT) snapshotSeen = true;
    if (e.type !== PUBLISHED || !e.data?.commit) return;
    const d = e.data;
    // kept: its snapshot is still in the book (an edition whose snapshot was let go sits before every snapshot)
    const row = { edition: d.edition, app: d.app || null, commit: short(d.commit), build: d.build ?? null, createdAt: d.createdAt || e.timestamp || null, scenarios: d.scenarios ?? null, kept: snapshotSeen, at: i + 1 };
    const at = out.findIndex(x => x.edition === row.edition);
    if (at >= 0) out[at] = row; else out.push(row);
  });
  return out;
}

// SV: Build Editions — newest first, the ones whose snapshot is still in the book (those can be opened)
export const buildEditions = events => editionsOldestFirst(events).filter(e => e.kept).reverse();

// SV: Edition Records — every edition ever published, oldest first, and whether its snapshot is kept.
export const editionRecords = events => editionsOldestFirst(events);

// A build book names the app its editions are of
export const isBuildBook = events => editionsOldestFirst(events).some(e => e.app);

// The latest edition's build number, without projecting it (a spine's small print); null if none
export const latestBuild = events => editionsOldestFirst(events).at(-1)?.build ?? null;

// SV: Build At Edition — the build as it was at that edition (the latest by default); null if none
export function buildAt(events, edition = null) {
  const eds = editionsOldestFirst(events);
  const ed = edition == null ? eds[eds.length - 1] : eds.find(e => e.edition === edition);
  return ed?.kept ? { ...ed, state: projectState(events.slice(0, ed.at)) } : null;
}

// What two builds' models differ by, going from `from` to `to` (states): the slices and scenarios
// added and removed, and fields added and removed on slices both have
// The file a built slice's code is in ("Code: <file>:<line>" from its test export); the line is left
// out, so code that only moved within its file is no change
const codeFile = s => (s?.description || '').match(/^Code: (\S+?)(?::\d+)?$/m)?.[1] || '';
// The screens a built slice is on ("Used by: …" and "Seen on: …" lines, from the export's usedBy/seenOn)
const screenLines = s => (s?.description || '').split('\n').filter(l => /^(Used by|Seen on): /.test(l));

export function modelChanges(from, to) {
  const out = { slicesAdded: [], slicesRemoved: [], scenariosAdded: [], scenariosRemoved: [], fieldsAdded: [], fieldsRemoved: [], codeAdded: [], codeRemoved: [], screensChanged: [], contractChanged: contractChanges(from, to) };
  const names = (id, st) => getScenariosForSlice(id, st).map(x => x.name);
  // Each slice counts once, by its key (as Compare matches): a name in several chapters is one slice, so a
  // build compared with itself is unchanged
  const rows = compareModels(from, to).rows;
  const seen = new Set(rows.filter(r => r.plan).map(r => r.key)), counted = new Set();
  rows.forEach(r => {
    const p = r.plan, b = r.built;
    // a built slice whose name the plan side already has (or an earlier built one) is the same slice
    if (!p && seen.has(r.key)) return;
    if (counted.has(r.key)) return;
    counted.add(r.key);
    if (p && b && r.status !== 'maybe') {
      r.scenarios.filter(x => !x.tested).forEach(x => out.scenariosRemoved.push(x.name));
      r.extraTests.forEach(n => out.scenariosAdded.push(n));
      const pf = fieldsOf(p, from), bf = fieldsOf(b, to);
      [...pf].filter(([k]) => !bf.has(k)).forEach(([, f]) => out.fieldsRemoved.push(`${r.title}: ${f}`));
      [...bf].filter(([k]) => !pf.has(k)).forEach(([, f]) => out.fieldsAdded.push(`${r.title}: ${f}`));
      const pc = codeFile(p), bc = codeFile(b);
      if (pc !== bc) { if (pc) out.codeRemoved.push(`${r.title}: ${pc}`); if (bc) out.codeAdded.push(`${r.title}: ${bc}`); }
      const ps = screenLines(p), bs = screenLines(b);
      bs.filter(l => !ps.includes(l)).forEach(l => out.screensChanged.push(`${r.title}: ${l}`));
      ps.filter(l => !bs.includes(l) && !bs.some(x => x.split(':')[0] === l.split(':')[0])).forEach(l => out.screensChanged.push(`${r.title}: no longer ${l}`));
      return;
    }
    // Missing in `to`, new in `to`; a possible rename is the old one removed and the new one added
    if (p) { out.slicesRemoved.push(sliceTitle(p, from)); out.scenariosRemoved.push(...names(p.id, from)); }
    if (b) { out.slicesAdded.push(sliceTitle(b, to)); out.scenariosAdded.push(...names(b.id, to)); }
  });
  return out;
}
export const unchanged = c => Object.values(c).every(l => !l.length);

// SV: Build Changes between two editions of a book (null when either isn't there)
export function buildChanges(events, from, to) {
  const a = buildAt(events, from), b = buildAt(events, to);
  if (!a || !b) return null;
  return { from, to, ...modelChanges(a.state, b.state) };
}

// SC: Publish Build Edition — the build (app, commit, build, createdAt, scenarios, and snapshot:
// the ModelSnapshot event data of its model) as the book's next edition. Returns { events: [{ type, data }] }
// or { refused }. Only a build that changes the model is a new edition.
// The book's description, preface and tags are the person's, not the build's: the build's snapshot
// keeps them. A description that is the text builds used to write there (before it went with the
// build's source) isn't hers: it isn't kept
const BUILT_TEXT = /event model, built from its Given \/ When \/ Then tests/;
// A "Coverage: …" paragraph is the build's too (Event Book's own book, tools/coverage.mjs): each edition
// carries its own build's line, after the rest of her description
const COVERAGE = /(?:^|\n+)Coverage: [^\n]*/g;
function keepPrefaceAndTags(snapshot, events) {
  const book = events.length ? projectState(events) : null;
  if (!book) return snapshot;
  const hers = (book.modelDescription || '').replace(COVERAGE, '').trim();
  const description = !hers || BUILT_TEXT.test(hers) ? null : hers;
  if (!description && !book.preface && !book.tags?.length) return snapshot;
  const coverage = (snapshot.state?.modelDescription || '').match(/Coverage: [^\n]*/)?.[0] || null;
  const modelDescription = description ? [description, coverage].filter(Boolean).join('\n\n') : snapshot.state?.modelDescription || null;
  return { ...snapshot, state: { ...snapshot.state, modelDescription, preface: book.preface || null, tags: book.tags || [] } };
}

// The slices a model has that the one before hasn't (null: none before), matched as Compare matches them
function slicesAddedSince(prevState, state) {
  const had = new Set(prevState ? getOrderedSlices(prevState).map(s => sliceKey(s, prevState)) : []);
  const seen = new Set();
  return getOrderedSlices(state).filter(s => {
    const k = sliceKey(s, state);
    if (had.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map(s => sliceTitle(s, state));
}

export function publishBuildEdition(events, b) {
  const eds = editionsOldestFirst(events);
  const latest = eds[eds.length - 1];
  const commit = short(b.commit);
  // Every commit an edition was ever at, a moved edition's earlier one too
  const same = events.find(e => e.type === PUBLISHED && short(e.data?.commit) === commit);
  if (same) return { refused: `Build ${commit} is edition ${same.data.edition} already` };
  // Run numbers can come in as text ("23" < "7" as text): compare them as numbers
  if (latest && b.build != null && latest.build != null && Number(b.build) < Number(latest.build)) return { refused: `Build ${b.build} is older than edition ${latest.edition} (build ${latest.build})` };
  // A newer build that changes nothing in the model: the latest edition moves to it (same edition, its
  // commit and build), so the book's code links follow the deployed commit; no new snapshot
  if (latest && b.snapshot && unchanged(modelChanges(buildAt(events, latest.edition).state, projectState([{ type: SNAPSHOT, data: b.snapshot }])))) {
    const was = projectState(events).modelSource || {};
    const repo = b.snapshot.state?.modelSource?.repo || was.repo || null;
    return { events: [
      { type: 'ModelSourceSet', data: { repo, commit: b.commit, createdAt: b.createdAt || null, build: b.build ?? null } },
      { type: PUBLISHED, data: { app: b.app, edition: latest.edition, commit, build: b.build ?? null, createdAt: b.createdAt || null, scenarios: b.scenarios ?? latest.scenarios ?? null, moved: true } }
    ] };
  }
  const edition = (latest?.edition || 0) + 1;
  // The slices this edition added; the app's first edition is the baseline (flagged, not counted)
  const state = b.snapshot ? projectState([{ type: SNAPSHOT, data: b.snapshot }]) : null;
  const slices = state && latest ? slicesAddedSince(latest ? buildAt(events, latest.edition).state : null, state) : [];
  const built = { app: b.app, commit, build: b.build ?? null, edition, at: b.createdAt || null, slices, ...(latest ? {} : { baseline: true }) };
  return { events: [
    ...(latest ? [{ type: NEXT, data: { fromEdition: latest.edition, edition, draft: 1 } }] : []),
    ...(b.snapshot ? [{ type: SNAPSHOT, data: keepPrefaceAndTags(b.snapshot, events) }] : []),
    { type: BUILT_LOG, data: built },
    { type: PUBLISHED, data: { app: b.app, edition, commit, build: b.build ?? null, createdAt: b.createdAt || null, scenarios: b.scenarios ?? null } }
  ] };
}

// A book with more than `keep` editions keeps the newest ones: its events from the snapshot that
// opens the oldest of them (the older snapshots are let go). Every EditionPublished and SlicesBuilt stays (they are
// small), so velocity's history survives. The book as it was if it has no more to let go.
export function keepLatestEditions(events, keep = KEEP_EDITIONS) {
  const eds = editionsOldestFirst(events).filter(e => e.kept);
  if (eds.length <= keep) return events;
  const oldest = eds[eds.length - keep];
  let from = oldest.at - 1;
  for (let i = oldest.at - 1; i >= 0; i--) if (events[i].type === SNAPSHOT) { from = i; break; }
  return [...events.slice(0, from).filter(e => e.type === PUBLISHED || e.type === BUILT_LOG), ...events.slice(from)];
}

// SC: Follow Build — why a plan can't follow `app`'s build (or null); shelves: the library's [{ name }]
export function followRefusal(plan, app, shelves) {
  if (plan.follow?.app === app) return `This plan follows ${app}'s build already`;
  if (!shelves.some(s => s.name === buildBookName(app))) return `${app} has no build book yet: deploy it once first`;
  return null;
}

// SC: Mark Slice Built (from a followed build) — what a build's edition does to a plan following
// the app: each matched slice is Done at the build's commit (SliceMarkedBuilt, with the edition),
// each Done slice that isn't in the build any more loses it (SliceBuiltCleared). Slices already
// Done at that commit, and ones unmatched but not Done, record nothing.
export function doneFromBuild(plan, built, { edition = null, commit = null } = {}) {
  const at = short(commit || built.modelSource?.commit);
  const out = [];
  compareModels(plan, built).rows.forEach(r => {
    if (!r.plan) return;
    const matched = r.built && (r.status === 'built' || r.status === 'differs');
    if (matched && !(r.plan.built && r.plan.builtCommit === at)) out.push({ type: 'SliceMarkedBuilt', data: { sliceId: r.plan.id, commit: at, ...(edition != null ? { edition } : {}) } });
    else if (r.status === 'missing' && r.plan.built) out.push({ type: 'SliceBuiltCleared', data: { sliceId: r.plan.id } });
  });
  return out;
}

// A free name for a plan started from an app's build: "<app> · plan", then "plan 2", "plan 3"…
export function planName(app, names) {
  const taken = new Set(names);
  const base = `${app} · plan`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

// SC: Start Plan From Build — a new plan whose start is the build's current model (not the
// editions or the usage), named "<app> · plan" and following the app's build. Returns
// { name, events: [{ type, data }] } or { refused }. names: the shelves' names, to keep the plan's free.
export function planFromBuild(events, names = []) {
  const build = isBuildBook(events) && buildAt(events);
  if (!build) return { refused: 'This book is no build' };
  const app = build.app;
  const name = planName(app, names);
  const { state } = snapshotEvents(events.slice(0, build.at))[0].data;
  return { name, events: [
    { type: SNAPSHOT, data: { state: { ...state, modelName: name, follow: null }, events: 1 } },
    { type: 'BuildFollowed', data: { app, followedBy: null } }
  ] };
}
