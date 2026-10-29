// ===========================================
// BUILD VERSIONS - What an app's build book says (pure, over the book's events)
// One build book per app: the shelf "<app> · built". Every deploy that changes the model adds an
// edition to it: NextDraftStarted (when it isn't the first), the build's ModelSnapshot, then
// EditionPublished { app, edition, commit, build, createdAt, scenarios }. The book is frozen after
// each edition, and a snapshot replaces the model, so "the build at edition N" is the book's
// events up to that EditionPublished. A plan can follow an app's build: its newest edition marks
// the plan's matched slices Done (SliceMarkedBuilt) and takes Done from those gone (SliceBuiltCleared).
// Decision code takes plain histories and states: no store calls.
// ===========================================

import { projectState, getScenariosForSlice, sliceTitle } from '../../core/projections.js';
import { compareModels, fieldsOf } from '../compare/diff.js';
import { snapshotEvents } from '../snapshot/command.js';

const PUBLISHED = 'EditionPublished', NEXT = 'NextDraftStarted', SNAPSHOT = 'ModelSnapshot';
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
  events.forEach((e, i) => {
    if (e.type !== PUBLISHED || !e.data?.commit) return;
    const d = e.data;
    const row = { edition: d.edition, app: d.app || null, commit: short(d.commit), build: d.build ?? null, createdAt: d.createdAt || e.timestamp || null, scenarios: d.scenarios ?? null, at: i + 1 };
    const at = out.findIndex(x => x.edition === row.edition);
    if (at >= 0) out[at] = row; else out.push(row);
  });
  return out;
}

// SV: Build Editions — newest first
export const buildEditions = events => editionsOldestFirst(events).reverse();

// A build book names the app its editions are of
export const isBuildBook = events => editionsOldestFirst(events).some(e => e.app);

// SV: Build At Edition — the build as it was at that edition (the latest by default); null if none
export function buildAt(events, edition = null) {
  const eds = editionsOldestFirst(events);
  const ed = edition == null ? eds[eds.length - 1] : eds.find(e => e.edition === edition);
  return ed ? { ...ed, state: projectState(events.slice(0, ed.at)) } : null;
}

// What two builds' models differ by, going from `from` to `to` (states): the slices and scenarios
// added and removed, and fields added and removed on slices both have
// The file a built slice's code is in ("Code: <file>:<line>" from its test export); the line is left
// out, so code that only moved within its file is no change
const codeFile = s => (s?.description || '').match(/^Code: (\S+?)(?::\d+)?$/m)?.[1] || '';

export function modelChanges(from, to) {
  const out = { slicesAdded: [], slicesRemoved: [], scenariosAdded: [], scenariosRemoved: [], fieldsAdded: [], fieldsRemoved: [], codeAdded: [], codeRemoved: [] };
  const names = (id, st) => getScenariosForSlice(id, st).map(x => x.name);
  compareModels(from, to).rows.forEach(r => {
    const p = r.plan, b = r.built;
    if (p && b && r.status !== 'maybe') {
      r.scenarios.filter(x => !x.tested).forEach(x => out.scenariosRemoved.push(x.name));
      r.extraTests.forEach(n => out.scenariosAdded.push(n));
      const pf = fieldsOf(p, from), bf = fieldsOf(b, to);
      [...pf].filter(([k]) => !bf.has(k)).forEach(([, f]) => out.fieldsRemoved.push(`${r.title}: ${f}`));
      [...bf].filter(([k]) => !pf.has(k)).forEach(([, f]) => out.fieldsAdded.push(`${r.title}: ${f}`));
      const pc = codeFile(p), bc = codeFile(b);
      if (pc !== bc) { if (pc) out.codeRemoved.push(`${r.title}: ${pc}`); if (bc) out.codeAdded.push(`${r.title}: ${bc}`); }
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
export function publishBuildEdition(events, b) {
  const eds = editionsOldestFirst(events);
  const latest = eds[eds.length - 1];
  const commit = short(b.commit);
  const same = eds.find(e => e.commit === commit);
  if (same) return { refused: `Build ${commit} is edition ${same.edition} already` };
  if (latest && b.build != null && latest.build != null && b.build < latest.build) return { refused: `Build ${b.build} is older than edition ${latest.edition} (build ${latest.build})` };
  if (latest && b.snapshot && unchanged(modelChanges(buildAt(events, latest.edition).state, projectState([{ type: SNAPSHOT, data: b.snapshot }]))))
    return { refused: `Build ${b.build ?? commit} changes nothing in the model since edition ${latest.edition}` };
  const edition = (latest?.edition || 0) + 1;
  return { events: [
    ...(latest ? [{ type: NEXT, data: { fromEdition: latest.edition, edition, draft: 1 } }] : []),
    ...(b.snapshot ? [{ type: SNAPSHOT, data: b.snapshot }] : []),
    { type: PUBLISHED, data: { app: b.app, edition, commit, build: b.build ?? null, createdAt: b.createdAt || null, scenarios: b.scenarios ?? null } }
  ] };
}

// A book with more than `keep` editions keeps the newest ones: its events from the snapshot that
// opens the oldest of them (the older ones are let go). The book as it was if it has no more.
export function keepLatestEditions(events, keep = KEEP_EDITIONS) {
  const eds = editionsOldestFirst(events);
  if (eds.length <= keep) return events;
  const oldest = eds[eds.length - keep];
  let from = oldest.at - 1;
  for (let i = oldest.at - 1; i >= 0; i--) if (events[i].type === SNAPSHOT) { from = i; break; }
  return events.slice(from);
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
