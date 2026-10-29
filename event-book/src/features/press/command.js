// ===========================================
// PRESS - A plan being built (commands and read models)
// SC: Send To Press — the owner's final go for a plan: its ☑ Refined slices are to be built.
//     Refused with nothing refined, or when it's at the press (or being built) already.
// SC: Stop The Press — taken back before a builder takes it.
// SC: Start Building Plan — a builder (an agent, ItsyBOT · ‹session›) takes a plan at the press:
//     it's checked out to the builder (the library holds it), so nobody else edits it.
// SC: Attach Build — the deploy's build edition of that app goes onto the plan being built.
// SC: Check In Built Plan — the builder brings it back with the build: the slices it sent to
//     press that the build has go Done; the rest wait.
// SV: Plan Status, Build Summary — on the shelf and the book's details.
// Each command returns null when it recorded its event, else why it was refused.
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState, getOrderedSlices, sliceTitle } from '../../core/projections.js';
import { compareModels } from '../compare/diff.js';
import { appOfPlan } from '../buildVersions/rules.js';

const refinedIds = state => getOrderedSlices(state).filter(s => s.refined).map(s => s.id);
const appOf = state => state.follow?.app || appOfPlan(state);
const atPress = state => state.press && state.press.stage !== 'built' ? state.press : null;
const record = (type, data) => (appendEvent(type, data) ? null : 'Read only');

// ---------- Rules (pure: the plan's state in, the refusal or null out) ----------

export function sendRefusal(state) {
  const p = atPress(state);
  if (p) return p.stage === 'building' ? `Being built by ${p.builder}` : 'Already at the press';
  if (!refinedIds(state).length) return 'Nothing refined to build yet';
  return null;
}

export function startRefusal(state, { holder = null } = {}) {
  if (holder && !holder.you) return `On loan to ${holder.deviceName || 'another device'}: check it in first`;
  const p = atPress(state);
  if (!p) return 'Not sent to press yet';
  if (p.stage === 'building') return `Being built by ${p.builder}`;
  if (!refinedIds(state).length) return 'Nothing refined to build yet';
  return null;
}

export function attachRefusal(state, app) {
  const p = state.press;
  if (p?.stage !== 'building') return 'Nobody is building this plan';
  if (p.app && app && String(p.app).toLowerCase() !== String(app).toLowerCase()) return `This plan is being built for ${p.app}, not ${app}`;
  return null;
}

export function checkInRefusal(state, by) {
  const p = state.press;
  if (p?.stage !== 'building') return 'Nobody is building this plan';
  if (by && p.builder && by !== p.builder) return `Being built by ${p.builder}`;
  if (!p.build) return 'Attach the build first (or give the plan back unbuilt)';
  return null;
}

// The press's slices the build has (matched as Compare matches them), and the ones it hasn't yet
function builtRows(state, built) {
  const sent = new Set(state.press?.slices || []);
  const rows = built ? compareModels(state, built).rows : [];
  const has = rows.filter(r => r.plan && sent.has(r.plan.id) && r.built && (r.status === 'built' || r.status === 'differs'));
  const hasIds = new Set(has.map(r => r.plan.id));
  return { has, missing: [...sent].filter(id => !hasIds.has(id)), extra: rows.filter(r => r.status === 'new') };
}

// ---------- Commands (on the open plan) ----------

export function sendToPress({ by = null, state = projectState() } = {}) {
  const refused = sendRefusal(state);
  if (refused) return refused;
  return record(EventTypes.PlanSentToPress, { app: appOf(state), slices: refinedIds(state), sentBy: by });
}

export function stopPress({ state = projectState() } = {}) {
  const p = atPress(state);
  if (!p) return 'Not at the press';
  if (p.stage === 'building') return `Being built by ${p.builder}`;
  return record(EventTypes.PressStopped, {});
}

export function startBuilding({ builder, fromCommit = null, holder = null, state = projectState() } = {}) {
  const refused = startRefusal(state, { holder });
  if (refused) return refused;
  return record(EventTypes.PlanCheckedOutForBuild, { app: state.press.app || appOf(state), builder, fromCommit });
}

export function attachBuild({ app, edition = null, commit = null, build = null, scenarios = null, repo = null, workflow = null, state = projectState() } = {}) {
  const refused = attachRefusal(state, app);
  if (refused) return refused;
  const data = { app, edition, commit, build, scenarios };
  if (repo) data.repo = repo;
  if (workflow) data.workflow = workflow;
  return record(EventTypes.BuildAttached, data);
}

// built: the build book's state at the attached edition
export function checkInBuiltPlan({ by = null, built = null, state = projectState() } = {}) {
  const refused = checkInRefusal(state, by);
  if (refused) return refused;
  const { edition, commit } = state.press.build;
  const { has, missing } = builtRows(state, built);
  for (const r of has) {
    if (r.plan.built && r.plan.builtCommit === commit) continue;
    if (!appendEvent(EventTypes.SliceMarkedBuilt, { sliceId: r.plan.id, commit, edition })) return 'Read only';
  }
  return record(EventTypes.PlanCheckedInWithBuild, { edition, commit, done: has.length, missing: missing.length });
}

// ---------- Read models ----------

// SV: Plan Status — what the shelf and the card say (null: not at the press, never built)
export function planStatus(state) {
  const p = state.press;
  if (!p) return null;
  if (p.stage === 'press') return 'At the press: waiting for a builder';
  if (p.stage === 'building') return `Being built by ${p.builder}`;
  return `Built (edition ${p.back?.edition ?? p.build?.edition ?? '?'}): checked in`;
}

// SV: Build Summary — what came back with the build (null until it's back)
export function buildSummary(state, built) {
  const p = state.press;
  if (p?.stage !== 'built') return null;
  const { missing, extra } = builtRows(state, built);
  return {
    edition: p.build?.edition ?? p.back?.edition ?? null,
    commit: p.build?.commit ?? p.back?.commit ?? null,
    build: p.build?.build ?? null,
    slicesDone: (p.slices || []).filter(id => state.slices[id]?.built).length,
    slicesStillToBuild: missing.map(id => state.slices[id]).filter(Boolean).map(s => sliceTitle(s, state)),
    slicesBuiltButNotPlanned: extra.map(r => r.title),
    scenariosPassing: p.build?.scenarios ?? null
  };
}
