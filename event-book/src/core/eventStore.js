// ===========================================
// EVENT STORE - Source of Truth
// One event stream per model. The library index lists the models on this
// device (in localStorage: it's small).
//
// Where the streams live: IndexedDB once initStore() has opened it (phones cap
// localStorage at ~5 MB a site). Every stream is loaded into memory at boot, so
// everything here stays synchronous: reads come from memory, writes change memory
// straight away and are written through to IndexedDB, coalesced (one transaction
// per turn of the event loop). Without IndexedDB (some private modes, and plain
// Node: the GWT tests and the MCP server) the streams stay in localStorage as
// before, where the first model keeps the original 'eventpad_events' key.
// ===========================================

import { EventTypes, commentEventTypes } from './constants.js';
import { isFrozen } from '../features/editions/rules.js';

// Re-export for convenience
export { EventTypes };

const INDEX_KEY = 'eventpad_models';          // [{ id, createdAt, updatedAt }]
const CURRENT_KEY = 'eventpad_current_model';
const FIRST_MODEL = 'default';

const streamKey = id => id === FIRST_MODEL ? 'eventpad_events' : 'eventpad_events_' + id;

// Event stream (source of truth) of the open model
let eventStream = [];
let currentModelId = FIRST_MODEL;

// ---------- Where the streams are kept ----------

const DB_NAME = 'eventpad';
const DB_STORE = 'streams';                    // model id → its events, as JSON text
let db = null;                                 // null: streams live in localStorage
const streams = new Map();                     // IndexedDB mode: model id → events, in memory
const sizes = new Map();                       // model id → JSON length, as last written
let roomLeft = Infinity;                       // bytes left, from navigator.storage.estimate

const isStreamKey = k => k === 'eventpad_events' || (typeof k === 'string' && k.startsWith('eventpad_events_') && k.length > 16);
const idOfKey = k => k === 'eventpad_events' ? FIRST_MODEL : k.slice('eventpad_events_'.length);
const request = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
const completed = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
});

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined' || !indexedDB) return reject(new Error('No IndexedDB'));
    const timer = setTimeout(() => reject(new Error('IndexedDB took too long')), 4000);
    let r;
    try { r = indexedDB.open(DB_NAME, 1); } catch (e) { clearTimeout(timer); return reject(e); }
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE); };
    r.onsuccess = () => { clearTimeout(timer); resolve(r.result); };
    r.onerror = () => { clearTimeout(timer); reject(r.error); };
    r.onblocked = () => { clearTimeout(timer); reject(new Error('IndexedDB blocked')); };
  });
}

function refreshRoom() {
  try {
    navigator.storage?.estimate?.().then(e => {
      if (e && e.quota) roomLeft = Math.max(0, e.quota - (e.usage || 0));
    }).catch(() => {});
  } catch (e) { /* no estimate: as far as we know there's room */ }
}

// Open IndexedDB, move any streams still in localStorage into it, and load every
// model's stream into memory. Await it once, before the first render. Resolves to
// true on IndexedDB; false means everything carries on in localStorage.
let initStarted = null;
export function initStore() {
  return initStarted ||= (async () => {
    let opened;
    try { opened = await openDb(); } catch (e) { return false; }
    try {
      const tx = opened.transaction(DB_STORE, 'readonly');
      const store = tx.objectStore(DB_STORE);
      const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())]);
      keys.forEach((id, i) => {
        const json = values[i] || '[]';
        try { streams.set(id, JSON.parse(json)); sizes.set(id, json.length); } catch (e) { /* unreadable: skip it */ }
      });

      // One-time move: streams still in localStorage (newer than anything here, if both)
      const legacy = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (isStreamKey(k)) legacy.push(k);
      }
      if (legacy.length) {
        const wtx = opened.transaction(DB_STORE, 'readwrite');
        const moving = [];
        for (const k of legacy) {
          const json = localStorage.getItem(k) || '[]';
          let events;
          try { events = JSON.parse(json); } catch (e) { continue; }
          if (!Array.isArray(events)) continue;
          wtx.objectStore(DB_STORE).put(json, idOfKey(k));
          moving.push([k, events, json.length]);
        }
        await completed(wtx);
        // Only once IndexedDB has them
        moving.forEach(([k, events, n]) => { streams.set(idOfKey(k), events); sizes.set(idOfKey(k), n); localStorage.removeItem(k); });
      }
    } catch (e) {
      // Couldn't read or move: stay on localStorage, as before
      streams.clear(); sizes.clear();
      try { opened.close(); } catch (err) { /* already closed */ }
      return false;
    }
    db = opened;
    try { navigator.storage?.persist?.()?.catch?.(() => {}); } catch (e) { /* asked once; the answer doesn't matter */ }
    refreshRoom();
    return true;
  })();
}

// On IndexedDB (true) or localStorage (false)?
export const usingIndexedDb = () => !!db;

function readStream(id) {
  if (db) return streams.get(id) || [];
  try { return JSON.parse(localStorage.getItem(streamKey(id)) || '[]'); } catch (e) { return []; }
}

// Write-through: the models changed in one turn of the event loop go to IndexedDB
// together, in one transaction, each written once
const pending = new Map();                     // id → 'put' | 'delete'
let flushQueued = false;
let flushing = Promise.resolve();
function queueWrite(id, op = 'put') {
  pending.set(id, op);
  if (flushQueued) return;
  flushQueued = true;
  queueMicrotask(() => { flushQueued = false; flushing = flushing.then(flush, flush); });
}

async function flush() {
  if (!db || !pending.size) return;
  const batch = [...pending];
  pending.clear();
  let tx;
  try {
    tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const written = [];
    for (const [id, op] of batch) {
      if (op === 'delete') { store.delete(id); continue; }
      const json = JSON.stringify(streams.get(id) || []);
      store.put(json, id);
      written.push([id, json.length]);
    }
    await completed(tx);
    batch.forEach(([id, op]) => { if (op === 'delete') sizes.delete(id); });
    written.forEach(([id, n]) => sizes.set(id, n));
    warnedFull = false;
    refreshRoom();
  } catch (e) {
    try { tx?.abort(); } catch (err) { /* already over */ }
    // Not saved: these go again with the next write (once a delete has made room, say)
    for (const [id, op] of batch) if (!pending.has(id)) pending.set(id, op);
    if (isQuota(e)) warnFull();
    else console.error('Saving to IndexedDB failed', e);
  }
}

// Resolves once everything changed so far is in IndexedDB (or has failed to be)
export async function flushStore() {
  await new Promise(r => queueMicrotask(r));
  await flushing;
}

// A model's size on this device, in bytes (its events as JSON)
export function modelSize(id) {
  if (db) return sizes.has(id) && !pending.has(id) ? sizes.get(id) : JSON.stringify(streams.get(id) || []).length;
  return (localStorage.getItem(streamKey(id)) || '[]').length;
}

// What eventPAD uses on this device, in bytes: the browser's estimate when it gives one,
// else the models' streams added up
export async function storageUsage() {
  try {
    const e = await navigator.storage?.estimate?.();
    if (e && typeof e.usage === 'number') return e.usage;
  } catch (e) { /* add up the streams */ }
  return listModels().reduce((n, m) => n + modelSize(m.id), 0);
}

// ---------- The library index ----------

function readIndex() {
  try {
    const index = JSON.parse(localStorage.getItem(INDEX_KEY) || 'null');
    if (Array.isArray(index) && index.length) return index;
  } catch (e) { /* fall through to the first model */ }
  return [{ id: FIRST_MODEL, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function touch(id) {
  const index = readIndex();
  const entry = index.find(m => m.id === id);
  if (entry) entry.updatedAt = new Date().toISOString();
  writeIndex(index);
}

// History: a model started from a snapshot (imported or shared without history) only
// has its changes since; otherwise every event since it was made
export function historyOf(events) {
  const snapshot = events[0]?.type === EventTypes.ModelSnapshot;
  return { snapshot, changes: snapshot ? events.length - 1 : events.length };
}

// Any model's events, without opening it (for the library)
export function readModelEvents(id) {
  return db ? [...readStream(id)] : readStream(id);
}

// Models on this device, most recently edited first
export function listModels() {
  return [...readIndex()].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

export function getCurrentModelId() {
  return currentModelId;
}

// Replay (scrubbing through history): everything reads the model as it was after this
// many events; null is now. Nothing is removed: it's only how the model is read.
let replayLimit = null;
export function setReplayLimit(n) { replayLimit = n; }

// Get current stream (read-only copy)
export function getEventStream() {
  return replayLimit === null ? [...eventStream] : eventStream.slice(0, replayLimit);
}

// Replace a model's events wholesale (the live view, kept in step with an agent's model)
export function replaceModelEvents(id, events) {
  if (db) {
    streams.set(id, [...events]);
    queueWrite(id);
  } else {
    localStorage.setItem(streamKey(id), JSON.stringify(events));
  }
  touch(id);
  if (id === currentModelId) eventStream = [...events];
}

// Load the open model (from memory, or from localStorage without IndexedDB)
export function loadEventStream() {
  replayLimit = null;
  const index = readIndex();
  const saved = localStorage.getItem(CURRENT_KEY);
  currentModelId = index.some(m => m.id === saved) ? saved : index[0].id;
  writeIndex(index);
  eventStream = readModelEvents(currentModelId);
  return eventStream;
}

export function openModel(id) {
  if (!readIndex().some(m => m.id === id)) return false;
  localStorage.setItem(CURRENT_KEY, id);
  loadEventStream();
  return true;
}

// When each book was last opened to read or work in (the board, the outline): the shelves
// lay the most recent few flat. Per device.
const OPENED_KEY = 'eventpad_opened';
export function openedAt() { try { return JSON.parse(localStorage.getItem(OPENED_KEY) || '{}'); } catch (e) { return {}; } }
export function markOpened(id) {
  const all = openedAt();
  all[id] = new Date().toISOString();
  try { localStorage.setItem(OPENED_KEY, JSON.stringify(all)); } catch (e) { /* this time only */ }
}

// A new model, optionally seeded with events (import, duplicate, shared link); opens it
// The events go in first: if the device is out of room, it throws a StorageFullError
// and the library is left as it was (no empty shelf)
export class StorageFullError extends Error {}
const isQuota = e => e?.name === 'QuotaExceededError' || e?.code === 22 || /quota/i.test(e?.message || '');

const newModelId = () => 'm_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

// id: keep a given one (a shelf downloaded from the server keeps its id, so it stays in step)
export function createModel(events = [], { id: givenId = null } = {}) {
  const id = givenId && !readIndex().some(m => m.id === givenId) ? givenId : newModelId();
  const now = new Date().toISOString();
  if (db) {
    // IndexedDB writes after this returns, so go by the room the browser says is left
    if (roomLeft !== Infinity && JSON.stringify(events).length > roomLeft) throw new StorageFullError('This device has no room for that model');
    streams.set(id, [...events]);
    queueWrite(id);
  } else {
    try {
      localStorage.setItem(streamKey(id), JSON.stringify(events));
    } catch (e) {
      localStorage.removeItem(streamKey(id));
      throw isQuota(e) ? new StorageFullError('This device has no room for that model') : e;
    }
  }
  writeIndex([...readIndex(), { id, createdAt: now, updatedAt: now }]);
  openModel(id);
  return id;
}

// How a model was started: 'outline' (a plotter's) or 'board' (a pantser's)
export function setModelStartIn(id, where) {
  const index = readIndex();
  const entry = index.find(m => m.id === id);
  if (!entry) return;
  entry.startIn = where;
  writeIndex(index);
}

export function duplicateModel(id) {
  return createModel(readModelEvents(id));
}

// Remove a model from this device; opens another (or a fresh one) if it was open
export function deleteModel(id) {
  const rest = readIndex().filter(m => m.id !== id);
  if (db) { streams.delete(id); queueWrite(id, 'delete'); } else localStorage.removeItem(streamKey(id));
  if (!rest.length) {
    // The library is never empty: one blank model takes the last one's place
    // (not createModel: an empty index reads as the original first model, which would make two)
    const id = newModelId(), now = new Date().toISOString();
    if (db) { streams.set(id, []); queueWrite(id); } else localStorage.setItem(streamKey(id), '[]');
    writeIndex([{ id, createdAt: now, updatedAt: now }]);
    openModel(id);
    return;
  }
  writeIndex(rest);
  if (id === currentModelId) openModel(listModels()[0].id);
}

// Save the open model (to memory and IndexedDB, or to localStorage)
// Out of room: say so (once until a save works again) rather than silently not saving
let warnedFull = false;
function warnFull() {
  if (warnedFull) return;
  warnedFull = true;
  import('../ui/toast.js').then(t => t.showToast("This device is out of room: changes aren't saved. Delete a model from your bookshelves to make space."));
}

// Building a whole model at once (an import): saved once at the end, not after every event
let holdSave = false;
export function withoutSaving(fn) {
  holdSave = true;
  try { return fn(); } finally { holdSave = false; saveEventStream(); }
}

export function saveEventStream() {
  if (holdSave) return;
  if (db) {
    streams.set(currentModelId, eventStream);
    queueWrite(currentModelId);
    try { touch(currentModelId); } catch (e) { if (!isQuota(e)) throw e; }
    return;
  }
  try {
    localStorage.setItem(streamKey(currentModelId), JSON.stringify(eventStream));
    touch(currentModelId);
    warnedFull = false;
  } catch (e) {
    if (!isQuota(e)) throw e;
    warnFull();
  }
}

// One tap can write several events (an element, its slice placement, its
// connections). Everything appended in the same turn of the event loop shares a
// batch id, so undo takes back the whole action.
let batchId = null;
function currentBatch() {
  if (!batchId) {
    batchId = 'b_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    setTimeout(() => { batchId = null; }, 0);
  }
  return batchId;
}

// Append event to stream
// A model kept on the server is edited where it's checked out: elsewhere a change is refused
// (guard(id) false), and blocked(id) says so. Set by sync; none means every model is editable.
let editGuard = null, editBlocked = null;
export function setEditGuard(guard, blocked) { editGuard = guard; editBlocked = blocked; }
// A published edition is frozen too: only the next draft (a copy) can be changed.
// Frozen is read from the history itself, so it follows the model wherever it goes.
export const isFrozenCurrent = () => isFrozen(eventStream);
export function canEditCurrent() {
  if (typeGuard(currentModelId, null) === false) return false;
  return (!editGuard || editGuard(currentModelId)) && !isFrozen(eventStream);
}

// A book opened for someone else's review: only some kinds of change may go onto it.
// fn(modelId, type) → true (allowed, whatever else holds), false (refused), or null (not
// such a book: the usual rules). With type null it answers "may anything be changed".
// Several kinds of such books (a review link's, a book shared with your account): each adds
// its guard, and the first that knows the book answers
const typeGuards = [];
export function setTypeGuard(fn) { typeGuards.push(fn); }
function typeGuard(id, type) {
  for (const g of typeGuards) { const v = g(id, type); if (v !== null && v !== undefined) return v; }
  return null;
}

let lastReviewBlocked = 0;
function reviewBlocked() {
  if (Date.now() - lastReviewBlocked < 1500) return;
  lastReviewBlocked = Date.now();
  import('../ui/toast.js').then(t => t.showToast('Here only comments (and scenarios or edits, if you are allowed) can change')).catch(() => {});
}

function frozenBlocked() {
  import('../ui/toast.js').then(t => t.showToast('Published: start the next draft to change it')).catch(() => {});
}

// Told after every new event (sync uses it to send changes a few seconds later)
const appendListeners = new Set();
export function onAppend(fn) { appendListeners.add(fn); }

// A rule that may record follow-on events right after one is recorded (in the same batch,
// so one undo takes both back): fn(event, before) where before() gives the stream as it was before it.
// Set once, by the slice-refined rule (an edit to a refined slice clears it, and built).
let appendRule = null;
export function setAppendRule(fn) { appendRule = fn; }

export function appendEvent(type, data) {
  // A comment is talk, not a change: it goes onto a read-only or published book too
  const allowed = typeGuard(currentModelId, type);
  if (allowed === false) { reviewBlocked(); return null; }
  const talk = allowed === true || commentEventTypes.has(type);
  if (!talk && editGuard && !editGuard(currentModelId)) { editBlocked?.(currentModelId); return null; }
  // Frozen: only the event that starts the next draft (and an app's usage: no change to the model) goes onto a published book's history
  if (!talk && type !== EventTypes.NextDraftStarted && type !== EventTypes.UsageImported && isFrozen(eventStream)) { frozenBlocked(); return null; }
  // A change made while scrubbing goes onto now, not the past
  replayLimit = null;
  const event = {
    id: 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
    type,
    data,
    batch: currentBatch(),
    timestamp: new Date().toISOString()
  };
  eventStream.push(event);
  saveEventStream();
  console.log('📌 Event:', type, data);
  appendListeners.forEach(fn => { try { fn(event); } catch (e) { /* a listener's problem */ } });
  if (appendRule) {
    const at = eventStream.length - 1;
    appendRule(event, () => eventStream.slice(0, at));
  }
  return event;
}

// Pop last event (undo)
export function popEvent() {
  if (eventStream.length === 0) return null;
  const popped = eventStream.pop();
  saveEventStream();
  return popped;
}

// Pop the last user action: every event of the latest batch (older events
// without a batch id go one at a time)
export function popBatch() {
  if (eventStream.length === 0 || isFrozen(eventStream)) return [];
  const last = eventStream[eventStream.length - 1];
  const popped = [];
  while (eventStream.length && (popped.length === 0 || (last.batch && eventStream[eventStream.length - 1].batch === last.batch))) {
    popped.push(eventStream.pop());
  }
  saveEventStream();
  return popped;
}

// Clear all events
export function clearEvents() {
  const count = eventStream.length;
  eventStream = [];
  saveEventStream();
  return count;
}

// Get event count
export function getEventCount() {
  return eventStream.length;
}
