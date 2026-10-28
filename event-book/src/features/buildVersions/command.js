// ===========================================
// BUILD VERSIONS - Commands
// SC: Publish Build Edition — a build book gets a build as its next edition (the deploy script's).
// SC: Follow Build / Unfollow Build — a plan follows an app's build, or stops (Done stays).
// SC: Mark Slice Built (from the build) — a followed app's newest edition marks the plan's Done.
// Each command returns why it was refused, or null (it recorded its events).
// ===========================================

import { appendEvent, getEventStream, createModel, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { publishBuildEdition as decidePublish, followRefusal, doneFromBuild, planFromBuild } from './rules.js';

const record = list => {
  for (const e of list) if (!appendEvent(e.type, e.data)) return 'Read only';
  return null;
};

// build: { app, commit, build, createdAt, scenarios, snapshot } (rules.js)
export function publishBuildEdition(build) {
  const r = decidePublish(getEventStream(), build);
  return r.refused || record(r.events);
}

// shelves: the library's [{ name }], to tell whether the app has a build book
export function followBuild(app, followedBy, shelves) {
  const why = followRefusal(projectState(), app, shelves);
  return why || (appendEvent(EventTypes.BuildFollowed, { app, followedBy: followedBy || null }) ? null : 'Read only');
}

export function unfollowBuild() {
  const follow = projectState().follow;
  if (!follow) return "This plan doesn't follow a build";
  return appendEvent(EventTypes.BuildUnfollowed, { app: follow.app }) ? null : 'Read only';
}

// edition: { app, edition, commit, state } (rules.js buildAt of the app's build book, with its app)
export function markDoneFromBuild(edition) {
  const plan = projectState();
  if (!plan.follow) return 'This plan follows no build';
  if (plan.follow.app !== edition.app) return 'Not the app this plan follows';
  return record(doneFromBuild(plan, edition.state, edition));
}

// A new plan from the open build book's current model, following its app, and open (names: the shelves' names).
// Returns why it can't, or null.
export function startPlanFromBuild(names) {
  const r = planFromBuild(getEventStream(), names);
  if (r.refused) return r.refused;
  const at = Date.now();
  createModel(r.events.map((e, i) => ({ id: `evt_${at}_${i}`, type: e.type, data: e.data, batch: `b_plan_${at.toString(36)}`, timestamp: new Date(at).toISOString() })));
  return null;
}
