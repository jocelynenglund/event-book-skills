// ===========================================
// PRODUCT USAGE - Help make Event Book better, on this device
// ☰ → Settings: Off (the default) or On. Switching it on shows the exact payload of the
// last week before anything goes (Send or Cancel); after that first send, a week at a time
// goes by itself while Event Book is open. "See what's sent" shows the next one any time.
// Sent with no sign-in (no token, no account): nothing ties it to her. The device keeps its
// own small log (Opted In / Opted Out / Sent) and a secret that never leaves it.
// ===========================================

import { decideOptIn, decideOptOut, isOn, prepareUsage, usageSummary, sendRefusal, nextSend, retries, dropOff, APP } from './rules.js';
import { listModels, readModelEvents } from '../../core/eventStore.js';
import { syncApiBase, account, api } from '../sync/client.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../board/view.js';

const KEY = 'eventpad_product_usage';
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
const write = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* just this time */ } };
const random = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

function device() {
  const s = read();
  if (!s.secret || !s.deviceId) { s.secret ||= random(); s.deviceId ||= `d_${random().slice(0, 12)}`; s.log ||= []; write(s); }
  return { log: [], ...s };
}
const record = events => { const s = device(); s.log = [...s.log, ...events.map(e => ({ ...e, at: new Date().toISOString() }))]; write(s); };
export const helping = () => isOn(device().log);

let prepared = null;
let openSheet = null;

const books = () => listModels().map(m => ({ id: m.id, events: readModelEvents(m.id) }));

function prepare(since, until = new Date().toISOString()) {
  const r = prepareUsage(books(), { since, until, secret: device().secret });
  prepared = r.payload || null;
  return r;
}

async function send(payload) {
  const why = sendRefusal(device().log, payload);
  if (why) return why;
  let res;
  try {
    res = await fetch(`${syncApiBase()}/usage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  } catch (e) { return 'Offline: it will go next time'; }
  if (!res.ok) return res.status === 429 ? 'Sent enough for now: it will go next time' : 'Couldn’t send it: it will go next time';
  record([{ type: 'ProductUsageSent', data: { since: payload.since, until: payload.until, events: payload.events.length } }]);
  return null;
}

// Settings: the switch, and what's sent
export function productUsageSettings() {
  const s = device(), on = isOn(s.log);
  const last = s.log.filter(e => e.type === 'ProductUsageSent').pop();
  const chip = (v, label) => `<button class="cm-chip ${on === v ? 'on' : ''}" data-pu-action="${v ? 'on' : 'off'}" aria-pressed="${on === v}">${label}</button>`;
  return `
    <div class="bd-sheet-label">Help make Event Book better</div>
    <div class="cm-parts">${chip(false, 'Off')}${chip(true, 'On')}</div>
    <p class="cm-note">${on
      ? `Thank you. Once a week, what kind of things you did in Event Book and when (never names, text or what's in your books) goes, unsigned.${last ? ` Last sent: ${escapeHtml(new Date(last.data.until).toLocaleDateString())}.` : ''}`
      : 'Off. When it’s on, Event Book sends which kinds of things you do in it and when, nothing you wrote, so it can get better. You see exactly what goes first.'}</p>
    ${on ? '<button class="sheet-btn secondary" data-pu-action="preview">See what’s sent</button>' : ''}`;
}

function previewHtml(r, { first = false } = {}) {
  if (r.refused) return `<div class="sheet-title">What’s sent</div><p class="cm-note">${escapeHtml(r.refused)}: nothing to send yet.</p>`;
  return `
    <div class="sheet-title">${first ? 'Before anything goes' : 'What’s sent'} <span class="bd-sheet-sub">${escapeHtml(usageSummary(r.payload))}</span></div>
    <p class="cm-note">Exactly this, and nothing else: each thing you did as its kind, its time and a book token that can’t be traced back. No names, no text, no comments, no sign-in.</p>
    <pre class="pu-json">${escapeHtml(JSON.stringify(r.payload, null, 1))}</pre>
    <div class="bd-scn-actions">
      <button class="sheet-btn" data-pu-action="send">Send</button>
      <button class="sheet-btn secondary" data-pu-action="cancel">Cancel</button>
    </div>`;
}

async function onAction(a) {
  const s = device();
  const now = new Date().toISOString();
  if (a === 'on') {
    const d = decideOptIn(s.log, { deviceId: s.deviceId, at: now });
    if (d.rejected) { showToast(d.rejected); return; }
    record(d.events);
    // The first payload is always shown before it goes
    openSheet(previewHtml(prepare(nextSend(device().log, now).since || new Date(Date.now() - 7 * 86400000).toISOString()), { first: true }));
  } else if (a === 'off') {
    const d = decideOptOut(s.log, { deviceId: s.deviceId, at: now });
    if (!d.rejected) record(d.events);
    prepared = null;
    showToast('Off: nothing more goes');
    openSheet(settingsBack());
  } else if (a === 'preview') {
    const n = nextSend(s.log, now);
    openSheet(previewHtml(prepare(n.since || s.log.filter(e => e.type === 'ProductUsageSent').map(e => e.data.until).pop() || new Date(Date.now() - 7 * 86400000).toISOString())));
  } else if (a === 'send') {
    const why = await send(prepared);
    prepared = null;
    showToast(why || 'Sent: thank you');
    openSheet(settingsBack());
  } else if (a === 'cancel') {
    prepared = null;
    showToast('Nothing was sent');
    openSheet(settingsBack());
  }
}

let settingsBack = () => '';

// Event Book's own build book, for an admin: what the anonymous usage shows (S7 Retries, S8 Drop Off)
export async function fillProductInsight(slot) {
  if (!slot || !account()?.admin) return;
  let r;
  try { r = await api('GET', `/usage/${APP}/events?days=30`); } catch (e) { return; }
  const events = r?.events || [];
  if (!events.length) { slot.innerHTML = '<p class="us-window">No product usage sent yet.</p>'; return; }
  const tries = retries(events), stops = dropOff(events).slice(0, 5);
  const label = t => escapeHtml(String(t).replace(/(?<=[a-z0-9])(?=[A-Z])/g, ' '));
  slot.innerHTML = `
    <div class="us-sub">From Help make Event Book better · ${events.length} events, ${new Set(events.map(e => e.stream)).size} anonymous books</div>
    ${tries.length ? `<div class="us-sub">Retries</div><ul class="us-unused pu-retries">${tries.map(x => `<li>${label(x.type)}: ${x.attempts} times on ${x.streams} ${x.streams === 1 ? 'book' : 'books'}, each within ${escapeHtml(x.within)}</li>`).join('')}</ul>` : ''}
    <div class="us-sub">Where people stop</div><ul class="us-unused pu-stops">${stops.map(x => `<li>${Math.round(x.share * 100)}% stop after ${escapeHtml(x.after)}</li>`).join('')}</ul>`;
}

// openSheet(html): the board sheet; settings(): the settings sheet's html, to go back to
export function initProductUsage({ openSheet: open, settings }) {
  openSheet = open;
  settingsBack = settings;
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-pu-action]');
    if (t) onAction(t.dataset.puAction);
  });
  // Weekly, after the first send she saw: the next week goes by itself
  setTimeout(async () => {
    const n = nextSend(device().log, new Date().toISOString());
    if (!n.due || n.show) return;
    const r = prepare(n.since);
    if (r.payload) await send(r.payload);
    prepared = null;
  }, 4000);
}
