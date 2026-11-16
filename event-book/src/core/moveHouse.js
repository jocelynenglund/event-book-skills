// ===========================================
// MOVING HOUSE - eventpad.itsybit.se → eventbook.itsybit.se (the Event Book rebrand, 2026-11-07)
// A device keeps its books where it opened Event Book: localStorage (the index, sign-in, settings, sync state)
// and IndexedDB (each book's events), both tied to the address. So on its first visit to the new address,
// a device fetches what it kept at the old one: a hidden frame opens the old address's handover.html, which
// sends it (and only to the new address); it's merged in before the books load: nothing here is overwritten,
// the book index and the library's kept books are joined. Once moved in, never again; if the hand-over fails,
// the next visit tries again. The old address sends every visit to the new one, link and all (?stay: don't).
// ===========================================

export const OLD_ORIGIN = 'https://eventpad.itsybit.se';
export const NEW_ORIGIN = 'https://eventbook.itsybit.se';
const MOVED_KEY = 'eventbook_moved_in';
const DB_NAME = 'eventpad', DB_STORE = 'streams';

// On the old address: go to the new one, keeping the link (?book=, ?m=, ?review=…). True when it went.
// It adds ?moved, so the browser asks the new address afresh: until 2026-11-07 the new address served
// a page forwarding back here with no caching rule, and a browser that kept it bounced between the two.
export function leaveOldAddress(loc = location) {
  if (loc.origin !== OLD_ORIGIN || /[?&]stay\b/.test(loc.search) || /handover\.html$/.test(loc.pathname)) return false;
  loc.replace(NEW_ORIGIN + loc.pathname + (loc.search ? loc.search + '&moved' : '?moved') + loc.hash);
  return true;
}

// On the new address: take ?moved back out of the address bar (it only had to dodge a kept page)
export function tidyMovedMark(loc = location, hist = history) {
  if (!/[?&]moved\b/.test(loc.search)) return;
  const search = loc.search.replace(/([?&])moved\b(=[^&]*)?&?/, '$1').replace(/[?&]$/, '');
  hist.replaceState(hist.state, '', loc.pathname + search + loc.hash);
}

const LIST_KEYS = { eventpad_models: 'id' };            // a list joined by id
const MAP_KEYS = new Set(['eventpad_kept']);            // an object joined by key

// What the old address handed over → this device: localStorage keys it lacks, the lists and maps joined,
// and each book it lacks into IndexedDB. Returns how many books came over.
export async function importHandover({ local = {}, streams = {} } = {}) {
  for (const [k, v] of Object.entries(local)) {
    if (k === MOVED_KEY) continue;
    const mine = localStorage.getItem(k);
    if (mine === null) { localStorage.setItem(k, v); continue; }
    try {
      if (LIST_KEYS[k]) {
        const id = LIST_KEYS[k], have = JSON.parse(mine), theirs = JSON.parse(v);
        if (Array.isArray(have) && Array.isArray(theirs))
          localStorage.setItem(k, JSON.stringify([...have, ...theirs.filter(t => !have.some(h => h?.[id] === t?.[id]))]));
      } else if (MAP_KEYS.has(k)) {
        localStorage.setItem(k, JSON.stringify({ ...JSON.parse(v), ...JSON.parse(mine) }));
      }
    } catch (e) { /* unreadable: keep this device's */ }
  }
  const ids = Object.keys(streams);
  if (!ids.length || typeof indexedDB === 'undefined') return 0;
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(DB_STORE)) r.result.createObjectStore(DB_STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    const have = new Set(await new Promise((resolve, reject) => {
      const q = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAllKeys();
      q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error);
    }));
    const missing = ids.filter(id => !have.has(id));
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      missing.forEach(id => tx.objectStore(DB_STORE).put(streams[id], id));
      tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    return missing.length;
  } finally { db.close(); }
}

// On the new address, once: fetch what the old one kept (from: its handover.html), merge it in. Resolves to how many
// books came over, or null when there was nothing to do (moved in already, not the new address) or it didn't answer.
export async function moveIn({ from = `${OLD_ORIGIN}/handover.html`, expectOrigin = OLD_ORIGIN, timeout = 10000, here = location.origin } = {}) {
  if (here !== NEW_ORIGIN && expectOrigin === OLD_ORIGIN) return null;
  if (localStorage.getItem(MOVED_KEY)) return null;
  const data = await new Promise(resolve => {
    const frame = Object.assign(document.createElement('iframe'), { src: from, hidden: true, title: 'Moving your books' });
    const done = value => { clearTimeout(timer); window.removeEventListener('message', onMessage); frame.remove(); resolve(value); };
    const onMessage = e => { if (e.origin === expectOrigin && e.data?.type === 'eventbook-handover') done(e.data); };
    const timer = setTimeout(() => done(null), timeout);
    window.addEventListener('message', onMessage);
    document.body.append(frame);
  });
  if (!data) return null;
  const books = await importHandover(data);
  localStorage.setItem(MOVED_KEY, new Date().toISOString());
  return books;
}
