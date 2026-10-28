// ===========================================
// REVIEWERS ON A BOOK - Client (docs/server-sync-plan.md → "Reviewers on a book")
// The owner invites people to a library book by email; they sign in and find it on
// their bookshelves under "Shared with me", read-only but for comments (and scenarios
// when allowed; an editor also names things and ticks Refined), which go to the owner's book whoever has it checked out. Removed, it
// leaves their shelves. Like a review link, but for a named person and lasting.
// ===========================================

import { api, account, serverIdOfModel } from '../sync/client.js';
import { readModelEvents, replaceModelEvents, createModel, listModels, setTypeGuard, onAppend, getCurrentModelId, openModel, deleteModel } from '../../core/eventStore.js';
import { commentEventTypes } from '../../core/constants.js';

const SHARED_KEY = 'eventpad_shared';   // local model id → { key, modelId, name, owner, role, canAddScenarios, position, synced }
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full: next time */ } };

export const sharedBooks = () => read(SHARED_KEY, {});
export const sharedOf = id => sharedBooks()[id] || null;
const setShared = (id, v) => { const all = sharedBooks(); if (v) all[id] = v; else delete all[id]; write(SHARED_KEY, all); };

// ---------- The owner ----------

const peoplePath = modelId => `/models/${encodeURIComponent(serverIdOfModel(modelId))}/people`;
export const listPeople = modelId => api('GET', peoplePath(modelId));
export const invitePerson = (modelId, email, canAddScenarios, role = 'reviewer') => api('POST', peoplePath(modelId), { email, role, canAddScenarios: !!canAddScenarios });
export const removePerson = (modelId, email) => api('POST', `${peoplePath(modelId)}/remove`, { email });

// ---------- The reviewer ----------

const scenarioTypes = new Set(['ScenarioAdded', 'ScenarioDeleted', 'ScenarioRenamed', 'ScenarioMustHaveSet', 'GivenSet', 'WhenSet',
  'ThenEventSet', 'ThenRejectionSet', 'ThenReadModelSet', 'SliceRefinedCleared', 'SliceBuiltCleared', 'SliceReadyCleared']);
// An editor also names slices, stickies and fields, adds a sticky to a slice and ticks Refined
// (the server's EventTypes.Editing); not deleting, moving, chapters, the book's name or editions
const editorTypes = new Set(['SliceNamed', 'ElementCreated', 'ElementRenamed', 'SliceElementAdded', 'SliceInferred', 'ProducerSet', 'ConsumerAdded',
  'PropertyAdded', 'PropertyUpdated', 'SliceMarkedRefined']);
export const isEditor = s => s?.role === 'editor';
export function sharedAllows(s, type) {
  if (type === 'ScenarioTested') return false;
  if (commentEventTypes.has(type)) return true;
  if (isEditor(s)) return scenarioTypes.has(type) || editorTypes.has(type);
  return !!s.canAddScenarios && scenarioTypes.has(type);
}
export const isEditorHere = () => isEditor(sharedOf(getCurrentModelId()));
export const canAddScenariosShared = () => { const s = sharedOf(getCurrentModelId()); return !!s && (isEditor(s) || !!s.canAddScenarios); };

const sharedPath = key => `/shared/${encodeURIComponent(key)}/events`;
const undoneOut = (events, undone) => { const u = new Set(undone || []); return (events || []).filter(e => !u.has(e.batch)); };

// The books shared with this account onto this device: new ones fetched, removed ones gone.
// Returns true when the shelf changed.
let refreshing = null;
export function refreshShared() {
  if (!account()) return Promise.resolve(false);
  return refreshing ||= (async () => {
    let rows;
    try { rows = await api('GET', '/shared'); } catch (e) { return false; }
    const here = sharedBooks();
    const byKey = new Map(Object.entries(here).map(([id, s]) => [s.key, id]));
    let changed = false;
    const open = getCurrentModelId();
    for (const r of rows) {
      const id = byKey.get(r.key);
      if (id && listModels().some(m => m.id === id)) { setShared(id, { ...here[id], name: r.name, owner: r.owner, role: r.role, canAddScenarios: !!r.canAddScenarios }); continue; }
      try {
        const got = await api('GET', `${sharedPath(r.key)}?after=0`);
        const localId = createModel(undoneOut(got.events, got.undone));
        setShared(localId, { key: r.key, modelId: r.modelId, name: r.name, owner: r.owner, role: r.role, canAddScenarios: !!r.canAddScenarios,
          position: got.position, synced: (got.events || []).map(e => e.id) });
        changed = true;
      } catch (e) { /* next time */ }
    }
    // No longer shared with us: off the shelf
    const live = new Set(rows.map(r => r.key));
    for (const [id, s] of Object.entries(sharedBooks())) {
      if (!live.has(s.key)) { setShared(id, null); if (listModels().some(m => m.id === id)) deleteModel(id); changed = true; }
    }
    if (listModels().some(m => m.id === open)) openModel(open);
    return changed;
  })().finally(() => { refreshing = null; });
}

// Up the comments (and scenarios) made here, down what's new
const running = new Map();
export function syncShared(id) {
  const s = sharedOf(id);
  if (!s || !account()) return Promise.resolve();
  if (running.has(id)) return running.get(id);
  const job = (async () => {
    const local = readModelEvents(id);
    const synced = new Set(s.synced);
    const fresh = local.filter(e => !synced.has(e.id) && sharedAllows(s, e.type));
    let res;
    try {
      res = fresh.length
        ? await api('POST', sharedPath(s.key), { after: s.position, events: fresh })
        : await api('GET', `${sharedPath(s.key)}?after=${s.position}`);
    } catch (e) {
      // Removed meanwhile: the book leaves the shelf on the next refresh
      if (e.status === 403 || e.status === 404) refreshShared();
      throw e;
    }
    const have = new Set(local.map(e => e.id));
    const incoming = (res.events || []).filter(e => !have.has(e.id));
    const undone = new Set(res.undone || []);
    if (incoming.length || undone.size) {
      const merged = [...local, ...incoming].sort((a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || ''))).filter(e => !undone.has(e.batch));
      replaceModelEvents(id, merged);
    }
    setShared(id, { ...sharedOf(id), position: res.position, synced: [...new Set([...s.synced, ...fresh.map(e => e.id), ...incoming.map(e => e.id)])] });
  })().finally(() => running.delete(id));
  running.set(id, job);
  return job;
}

export function initSharedClient() {
  // A book shared with this account: only comments (and scenarios when allowed) change it; an editor's is editable, for the types they may send
  setTypeGuard((id, type) => {
    const s = sharedOf(id);
    if (!s) return null;
    return type === null ? isEditor(s) : sharedAllows(s, type);
  });
  let timer = null;
  onAppend(() => {
    const id = getCurrentModelId();
    if (!sharedOf(id)) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncShared(id).catch(() => {}), 2000);
  });
  document.addEventListener('visibilitychange', () => {
    const id = getCurrentModelId();
    if (document.visibilityState === 'visible' && sharedOf(id)) syncShared(id).catch(() => {});
  });
}
