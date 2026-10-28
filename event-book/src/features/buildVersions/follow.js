// ===========================================
// BUILD VERSIONS - Following an app's build, in the app
// The plan's title ⋮ menu: Follow <app>'s build / Stop following. A plan that follows an app,
// opened where it can be edited, reads the app's build book from the library and lets its
// newest edition mark Done (Mark Slice Built from the build). Read only: it changes nothing.
// Idempotent: an edition already applied records nothing, so it runs on every open.
// ===========================================

import { listModels, readModelEvents, getCurrentModelId, canEditCurrent } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { account, api, serverLibrary } from '../sync/client.js';
import { buildAt, buildBookApp, buildBookName, isBuildBook } from './rules.js';
import { followBuild, unfollowBuild, markDoneFromBuild, startPlanFromBuild } from './command.js';
import { norm } from '../compare/diff.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../board/view.js';
import { onRender, render } from '../../ui/feed.js';

// The app a plan is about, guessed from its name ("eventPAD · plan: x" → eventPAD) or its repo
export function appOfPlan(state) {
  const name = String(state.modelName || '').split(/\s+[·•|–—:-]\s+/)[0].trim();
  const repo = String(state.modelSource?.repo || '').replace(/\/+$/, '').split('/').pop();
  return name || repo || '';
}

// Every shelf the library has by name: on the server, and on this device
async function shelves() {
  const local = listModels().map(m => ({ id: m.id, name: projectState(readModelEvents(m.id)).modelName || '' }));
  let remote = [];
  if (account()) { try { remote = (await serverLibrary()).map(r => ({ id: r.modelId, name: r.name, remote: true, updatedAt: r.updatedAt })); } catch (e) { /* offline */ } }
  return [...remote, ...local];
}
const appsOf = list => [...new Set(list.map(s => buildBookApp(s.name)).filter(Boolean))];

// The app's build book events: from the server when signed in (the latest), else the copy on this device
async function bookOf(app, list) {
  const name = buildBookName(app);
  const remote = list.filter(s => s.remote && s.name === name).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  if (remote) {
    try {
      const r = await api('GET', `/models/${encodeURIComponent(remote.id)}/events?after=0`);
      const undone = new Set(r.undone || []);
      return r.events.filter(e => !undone.has(e.batch));
    } catch (e) { /* fall back to the copy here */ }
  }
  const here = list.find(s => !s.remote && s.name === name);
  const events = here ? readModelEvents(here.id) : null;
  return events && isBuildBook(events) ? events : null;
}

// ---------- Applying the newest edition ----------

const checked = new Map();   // plan id → when it last read the build book
let running = false;
export async function applyFollowedBuild() {
  const id = getCurrentModelId();
  const follow = projectState().follow;
  if (!follow || running || !canEditCurrent()) return;
  if (Date.now() - (checked.get(id) || 0) < 60_000) return;
  checked.set(id, Date.now());
  running = true;
  try {
    const events = await bookOf(follow.app, await shelves());
    const latest = events && buildAt(events);
    if (!latest || getCurrentModelId() !== id || !canEditCurrent()) return;
    const before = readModelEvents(id).length;
    markDoneFromBuild({ ...latest, app: latest.app || follow.app });
    if (readModelEvents(id).length !== before) render();
  } catch (e) { /* the next open tries again */ } finally { running = false; }
}

// ---------- The title menu ----------

// Menu text for the open plan: null when it can't follow (a build book, or read only)
export function followMenu() {
  const state = projectState();
  // On any plan, checked out here or not: following checks it out first, as renaming does
  if (isBuildBook(readModelEvents(getCurrentModelId()))) return null;
  return state.follow ? { following: true, app: state.follow.app } : { following: false, app: appOfPlan(state) };
}

// The open book is a build book: its title menu offers a plan from it
export const isOpenBuild = () => isBuildBook(readModelEvents(getCurrentModelId()));

// Start a plan from the open build: a new book (opened), toast; resolves to why it can't, or null
export async function startPlanFromThisBuild() {
  const app = buildBookApp(projectState().modelName) || '';
  const why = startPlanFromBuild((await shelves()).map(s => s.name));
  if (!why) showToast(`A plan from ${app}’s build: edit away`);
  return why;
}

function chooseApp(apps) {
  openBoardSheet(`
    <div class="sheet-title">Follow which build?</div>
    <div class="bv-picks">${apps.map(a => `<button class="bv-pick" data-bv-follow-app="${escapeHtml(a)}"><b>${escapeHtml(a)}</b><span>${escapeHtml(buildBookName(a))}</span></button>`).join('')}</div>`);
}

async function follow(app) {
  const why = followBuild(app, account()?.email, await shelves());
  if (why) { showToast(why); return; }
  showToast(`Following ${app}'s build`);
  checked.delete(getCurrentModelId());
  render();
}

export async function followFromMenu() {
  const list = await shelves();
  const apps = appsOf(list);
  const guess = appOfPlan(projectState());
  const app = apps.find(a => norm(a) === norm(guess));
  if (app || !apps.length) return follow(app || guess);
  chooseApp(apps);
}

export function stopFollowing() {
  const was = projectState().follow?.app;
  const why = unfollowBuild();
  showToast(why || `Stopped following ${was}'s build: Done stays`);
  if (!why) render();
}

export function initFollow() {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-bv-follow-app]');
    if (t) { hideAllSheets(); follow(t.dataset.bvFollowApp); }
  });
  onRender(() => { if (document.body.classList.contains('library-mode')) return; applyFollowedBuild(); });
}
