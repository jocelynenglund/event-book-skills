// ===========================================
// SYNC - Keep shelves on the server (docs/server-sync-plan.md)
// Sign in by email (invite only), then a shelf marked ☁ syncs its events: the ones
// the server lacks go up, the ones this device lacks come down, merged by id and
// time; an action undone on another device is dropped here too.
// Kept per device: the account (token), and per kept shelf its position and the ids
// the server already has.
// ===========================================

import { keptAfterKeep } from '../library/sections.js';
import { readModelEvents, replaceModelEvents, listModels, getCurrentModelId, createModel, onAppend, setEditGuard, deleteModel } from '../../core/eventStore.js';
import { isBuildBook } from '../buildVersions/rules.js';

// Told when an edit was refused because the shelf isn't checked out here (the view offers to check out)
let onBlocked = () => {};
export function onEditBlocked(fn) { onBlocked = fn; }
let lastBlocked = 0;
function blocked(id) { if (Date.now() - lastBlocked > 1500) { lastBlocked = Date.now(); onBlocked(id); } }
import { projectState } from '../../core/projections.js';
import { commentEventTypes } from '../../core/constants.js';

const LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
let apiBase = LOCAL ? 'http://localhost:5199/api/eventpad'
  : 'https://labsapi-hmeva5cfhdfkejhz.westeurope-01.azurewebsites.net/api/eventpad';
export function setSyncApi(base) { apiBase = base; }   // tests

const ACCOUNT_KEY = 'eventpad_account';      // { token, email, accountId, admin }
const KEPT_KEY = 'eventpad_kept';            // modelId → { serverId, position, synced: [event ids], holder }
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full: next time */ } };

export const account = () => read(ACCOUNT_KEY, null);
export const kept = () => read(KEPT_KEY, {});
export const isKept = id => !!kept()[id];
// A build book is only read (and talked on): it is never checked out, a plan starts from it instead
export const isBuildShelf = id => isBuildBook(readModelEvents(id));
export const isReviewerAccount = () => account()?.kind === 'reviewer';
// The model's id on the server. Every device's first model is called 'default', so that
// one gets an id of its own when it's first kept; shelves downloaded keep the server's.
const serverIdOf = id => kept()[id]?.serverId || id;
const path = id => `/models/${encodeURIComponent(serverIdOf(id))}`;
export const serverIds = () => Object.entries(kept()).map(([id, k]) => k.serverId || id);

export class SyncError extends Error {
  constructor(status, body) { super(body?.error || `Server said ${status}`); this.status = status; this.body = body; }
}

async function call(method, path, body) {
  const a = account();
  let res;
  try {
    res = await fetch(apiBase + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(a?.token ? { Authorization: `Bearer ${a.token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) { throw new SyncError(0, { error: 'Offline: will try again' }); }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && a) { write(ACCOUNT_KEY, null); notify(); }   // signed out elsewhere
  if (!res.ok) throw new SyncError(res.status, data);
  return data;
}

// The same calls for other features (review links): signed in when there's an account
export const api = call;
export const serverIdOfModel = id => serverIdOf(id);

// ---------- Signing in ----------

export const startSignIn = (email, invite) => call('POST', '/auth/start', { email, ...(invite ? { invite } : {}) });

export async function verifySignIn(email, code) {
  const deviceName = /iPhone|iPad/.test(navigator.userAgent) ? 'iPhone' : /Android/.test(navigator.userAgent) ? 'Android phone' : 'Browser';
  const r = await call('POST', '/auth/verify', { email, code, deviceName });
  // kind: 'member' (makes books) or 'reviewer' (invited to review books, none of its own)
  write(ACCOUNT_KEY, { token: r.token, email: r.email || email, accountId: r.accountId, admin: !!r.admin, kind: r.kind || 'member' });
  notify();
  return r;
}

export async function signOut() {
  try { await call('POST', '/auth/signout'); } catch (e) { /* signed out here either way */ }
  write(ACCOUNT_KEY, null);
  notify();
}

export const listDevices = () => call('GET', '/devices');
export const revokeDevice = id => call('DELETE', `/devices/${encodeURIComponent(id)}`);
export const createInvite = () => call('POST', '/invites');
export const serverLibrary = () => call('GET', '/library');

// ---------- Check out / check in ----------
// One device edits a kept shelf at a time. holder: { deviceId, deviceName, since, you } or
// null (checked in). A shelf kept on the server is read-only here unless it's checked out here.

export const holderOf = id => kept()[id]?.holder || null;
export const canEdit = id => !account() || !isKept(id) || !!holderOf(id)?.you;
function setHolder(id, holder) {
  const k = kept();
  if (!k[id]) return;
  k[id] = { ...k[id], holder: holder || null };
  write(KEPT_KEY, k);
}

export async function checkOut(modelId) {
  try {
    const r = await call('POST', `${path(modelId)}/checkout`);
    setHolder(modelId, r.holder);
  } catch (e) {
    if (e.status === 409 && e.body?.holder) setHolder(modelId, e.body.holder);
    notify();
    throw e;
  }
  notify();
  return syncModel(modelId);   // the latest, now that it's yours
}

export async function checkIn(modelId) {
  await syncModel(modelId);    // send the last changes first
  const r = await call('POST', `${path(modelId)}/checkin`);
  setHolder(modelId, r.holder);
  notify();
}

export async function takeOver(modelId) {
  const r = await call('POST', `${path(modelId)}/takeover`);
  setHolder(modelId, r.holder);
  notify();
  return syncModel(modelId);
}

// Before changing a library book from its menu (rename): checked in, it's checked out here
// first; held by another device, it can't be. Resolves to null when it can be changed now,
// or the reason it can't.
export async function readyToChange(modelId) {
  if (canEdit(modelId)) return null;
  const h = holderOf(modelId);
  if (h && !h.you) return `Checked out on ${h.deviceName || 'another device'}: change it there, or take it over`;
  try { await checkOut(modelId); } catch (e) { return e.status === 409 ? `Checked out on ${e.body?.holder?.deviceName || 'another device'}` : `Couldn't check it out: ${e.message}`; }
  return null;
}

// A library book returned (taken off this device): whatever is only here goes up first, then it's
// checked in (if it was out here) and unlinked, so it shows as in the library, not on this
// device. Throws when the server can't be reached: deleting then would lose those changes.
export async function forgetHere(modelId) {
  if (!isKept(modelId)) return;
  if (holderOf(modelId)?.you) await checkIn(modelId);
  const k = kept();
  delete k[modelId];
  write(KEPT_KEY, k);
  delete status[modelId];
  notify();
}

// ---------- Shelves ----------

const status = {};            // modelId → 'syncing' | 'ok' | 'error: …'
export const shelfStatus = id => status[id] || (isKept(id) ? 'ok' : null);
const listeners = new Set();
export function onSyncChange(fn) { listeners.add(fn); }
function notify() { listeners.forEach(fn => { try { fn(); } catch (e) { /* a view's problem */ } }); }

export async function keepOnServer(modelId) {
  const serverId = modelId === 'default' ? 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) : modelId;
  // Keeping it checks it out here (the server does that on the first push): borrowed straight away
  write(KEPT_KEY, keptAfterKeep(kept(), modelId, serverId));
  notify();
  return syncModel(modelId);
}

export async function stopKeeping(modelId) {
  const target = path(modelId);
  const k = kept();
  delete k[modelId];
  write(KEPT_KEY, k);
  delete status[modelId];
  notify();
  await call('DELETE', target);
}

// A shelf only on the server: fetch it onto this device (same id, so it stays in step)
// A second tap while it downloads, or a book already here, makes no second copy
const downloading = new Map();
export function download(modelId) {
  const here = Object.entries(kept()).find(([id, k]) => (k.serverId || id) === modelId && listModels().some(m => m.id === id));
  if (here) return Promise.resolve(here[0]);
  if (!downloading.has(modelId)) downloading.set(modelId, fetchShelf(modelId).finally(() => downloading.delete(modelId)));
  return downloading.get(modelId);
}
async function fetchShelf(modelId) {
  const r = await call('GET', `/models/${encodeURIComponent(modelId)}/events?after=0`);
  const events = dropUndone(r.events, r.undone);
  const localId = createModel(events, { id: modelId });
  const k = kept();
  k[localId] = { serverId: modelId, position: r.position, synced: r.events.map(e => e.id), holder: r.holder || null };
  write(KEPT_KEY, k);
  notify();
}

// Events in parts of at most ~800 KB of JSON (always at least one part, so an empty push still fetches)
function parts(events, max = 800_000) {
  const out = [[]];
  let size = 0;
  for (const e of events) {
    const n = JSON.stringify(e).length + 1;
    if (size + n > max && out[out.length - 1].length) { out.push([]); size = 0; }
    out[out.length - 1].push(e);
    size += n;
  }
  return out;
}

const byTime = (a, b) => String(a.timestamp || '').localeCompare(String(b.timestamp || ''));
const dropUndone = (events, undone = []) => { const u = new Set(undone); return events.filter(e => !u.has(e.batch)); };

// Up what the server lacks, down what this device lacks, then drop undone batches
const running = new Map();
export function syncModel(modelId) {
  if (!account() || !isKept(modelId)) return Promise.resolve();
  if (running.has(modelId)) return running.get(modelId);
  const job = (async () => {
    status[modelId] = 'syncing'; notify();
    try {
      const k = kept()[modelId];
      const synced = new Set(k.synced);
      const local = readModelEvents(modelId);
      const fresh = local.filter(e => !synced.has(e.id));
      const name = projectState(local).modelName || null;
      // The server takes up to 1 MB a request: a big first upload goes in parts
      let r = null, after = k.position;
      const got = [];
      // Changes go up only from the device that has it checked out; anyone can fetch.
      // Comments are talk, not changes: they go up from any device
      const mine = !k.holder || k.holder.you;
      const sendable = mine ? fresh : fresh.filter(e => commentEventTypes.has(e.type));
      let sentOk = true;
      for (const part of parts(sendable)) {
        try {
          r = await call('POST', `${path(modelId)}/events`, { after, events: part, ...(name ? { name } : {}) });
        } catch (e) {
          if (e.status !== 409) throw e;
          // Checked out elsewhere meanwhile: fetch instead; our changes stay here, unsent
          if (e.body?.holder !== undefined) setHolder(modelId, e.body.holder);
          sentOk = false;
          r = await call('POST', `${path(modelId)}/events`, { after, events: [] });
        }
        got.push(...(r.events || []));
        after = r.position;
      }
      const have = new Set(local.map(e => e.id));
      const incoming = [...new Map(got.filter(e => !have.has(e.id)).map(e => [e.id, e])).values()];
      let merged = incoming.length ? [...local, ...incoming].sort(byTime) : local;
      merged = dropUndone(merged, r.undone);
      if (incoming.length || merged.length !== local.length) replaceModelEvents(modelId, merged);
      const now = kept();
      if (now[modelId]) {
        const sent = sentOk ? sendable.map(e => e.id) : [];
        now[modelId] = { ...now[modelId], serverId: k.serverId || modelId, position: r.position,
          synced: [...new Set([...k.synced, ...sent, ...incoming.map(e => e.id)])],
          ...(r.holder !== undefined ? { holder: r.holder } : {}) };
        write(KEPT_KEY, now);
      }
      status[modelId] = 'ok';
      return { up: fresh.length, down: incoming.length };
    } catch (e) {
      status[modelId] = `error: ${e.message}`;
      throw e;
    } finally {
      running.delete(modelId);
      notify();
    }
  })();
  running.set(modelId, job);
  return job;
}

export async function syncAll() {
  if (!account()) return;
  // Who holds what, from the library listing
  try {
    const rows = await serverLibrary();
    const byServerId = new Map(rows.map(r => [r.modelId, r.holder || null]));
    const gone = [];
    Object.entries(kept()).forEach(([id, k]) => {
      const sid = k.serverId || id;
      if (byServerId.has(sid)) setHolder(id, byServerId.get(sid));
      // Let go on the server (a replaced build book, released from another device): this copy
      // stays here as a private book, and nothing is pushed back, which would keep it again
      else if (k.position > 0 || k.synced?.length) gone.push(id);
    });
    if (gone.length) {
      const links = kept();
      gone.forEach(id => {
        // A replaced build book with nothing unsent goes too: the new one is in the library
        const events = readModelEvents(id);
        if (isBuildBook(events) && events.every(e => links[id].synced?.includes(e.id))) deleteModel(id);
        delete links[id];
      });
      write(KEPT_KEY, links);
    }
    notify();
  } catch (e) { /* offline: the shelves say so */ }
  const ids = Object.keys(kept()).filter(id => listModels().some(m => m.id === id));
  for (const id of ids) { try { await syncModel(id); } catch (e) { /* shown on the shelf */ } }
}

// An action undone here that the server already has: undone on every device
export async function undoBatch(modelId, batch, poppedIds) {
  const k = kept()[modelId];
  if (!account() || !k || !batch || !poppedIds.some(id => k.synced.includes(id))) return;
  try { await call('POST', `${path(modelId)}/undo`, { batchId: batch }); } catch (e) { status[modelId] = `error: ${e.message}`; notify(); }
}

// After a change: sync the open shelf a few seconds later; and when the tab comes back
let timer = null;
export function initSync() {
  // A shelf kept on the server changes only where it's checked out
  setEditGuard(id => canEdit(id), id => blocked(id));
  onAppend(event => {
    const id = getCurrentModelId();
    if (!isKept(id) || !account() || (!canEdit(id) && !commentEventTypes.has(event?.type))) return;
    clearTimeout(timer);
    timer = setTimeout(() => syncModel(id).catch(() => {}), 3000);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncAll(); });
  syncAll();
}
