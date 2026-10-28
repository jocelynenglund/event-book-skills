// ===========================================
// SYNC - Signing in, the account, invites, and ☁ on the library's shelves
// ===========================================

import { account, kept, isKept, shelfStatus, startSignIn, verifySignIn, signOut, listDevices, revokeDevice, createInvite,
  serverLibrary, keepOnServer, download, onSyncChange, syncAll, serverIds,
  holderOf, checkOut, checkIn, takeOver, onEditBlocked, isBuildShelf } from './client.js';
import { getCurrentModelId, isFrozenCurrent, canEditCurrent, openModel } from '../../core/eventStore.js';
import { sectionHead, sectionBody } from '../library/folds.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { escapeHtml } from '../board/view.js';
import { showToast } from '../../ui/toast.js';
import { copyText } from '../../ui/clipboard.js';
import { setReadOnly } from '../readOnly/sheet.js';
import { isAgent } from '../library/sections.js';
import { itsybitMark } from '../../ui/itsybitMark.js';

const APP_URL = 'https://eventpad.itsybit.se/';

// The line under "Bookshelves": sign in, or who's signed in
export function accountBar() {
  const a = account();
  return `<div class="sy-bar" id="syBar">${a
    ? `<button class="sy-account" data-sync-action="account">☁ ${escapeHtml(a.email)}</button><span class="sy-note" id="syServerOnly"></span>`
    : `<button class="sy-account" data-sync-action="signin">☁ Sign in to your library</button>`}</div>`;
}

// Where a kept shelf is checked out: here (✏️), on another device (🔒), to an agent
// (the itsyBIT mark), or nowhere (☁). icon is HTML.
function holderLabel(modelId) {
  const h = holderOf(modelId);
  if (!h) return { icon: '☁', text: 'Checked in', cls: 'in' };
  if (h.you) return { icon: '✏️', text: 'Checked out here', cls: 'here' };
  if (isAgent(h)) return { icon: itsybitMark({ size: 13 }), text: `On loan to ${h.deviceName || 'an agent'}`, cls: 'away agent' };
  return { icon: '🔒', text: `On loan to ${h.deviceName || 'another device'}`, cls: 'away' };
}

// "Claude on itsybit" → "Claude": who the banner says is editing
const agentName = h => (h?.deviceName || '').replace(/\s+on\s+.*$/i, '').trim() || 'An agent';

// On a library book: borrowed here, checked in, or on loan to another device, plus
// syncing or couldn't (and why). A private book needs none: its section says so.
export function shelfBadge(modelId) {
  const s = shelfStatus(modelId);
  if (!s) return '';
  // Who has it stays readable when a sync fails: the ! says why (offline, …)
  const l = holderLabel(modelId);
  const bad = s.startsWith('error');
  const title = bad ? `Couldn't sync: ${s.replace(/^error: /, '')}` : s === 'syncing' ? 'Syncing' : 'A library book: kept on the server';
  return `<span class="sy-badge ${l.cls}${bad ? ' bad' : ''}" title="${escapeHtml(title)}">${l.icon}${l.cls.includes('agent') ? '' : ' '}${escapeHtml(l.text)}${s === 'syncing' ? ' …' : ''}${bad ? ' <b>!</b>' : ''}</span>`;
}

// The one tiny mark at a book's foot, only when it matters: none = yours to edit (private
// or borrowed), ☁ checked in (read only), 🔒 on loan to a device, the itsyBIT mark on loan
// to Claude. A failed sync adds a !.
// A library book's foot mark, coloured by who has it: ✏️ checked out here (green), ☁ checked in,
// 🔒 or the itsyBIT mark on loan (amber). label: a few words after it, for a book lying flat.
export function footMark(modelId, { label = false } = {}) {
  if (!account() || !isKept(modelId)) return '';
  const h = holderOf(modelId);
  const l = holderLabel(modelId);
  const s = shelfStatus(modelId) || '';
  const bad = s.startsWith('error');
  const words = !h ? 'checked in' : h.you ? 'out here' : isAgent(h) ? agentName(h) : (h.deviceName || 'another device');
  return `<span class="ed-foot-mark ${l.cls}${bad ? ' bad' : ''}" title="${escapeHtml(l.text)}${bad ? ` (couldn't sync: ${escapeHtml(s.replace(/^error: /, ''))})` : ''}" aria-label="${escapeHtml(l.text)}">${l.icon}${label ? `<span class="ed-foot-words">${escapeHtml(words)}</span>` : ''}</span>`;
}

// Just the icon of the foot mark, as text (for the bookcase picture, which names no devices)
export function footIcon(modelId) {
  if (!account() || !isKept(modelId)) return '';
  const h = holderOf(modelId);
  return !h ? '☁' : h.you ? '✏️' : isAgent(h) ? '✦' : '🔒';
}

// Where a book lives, in words, for its details sheet
export function locationText(modelId) {
  if (!account() || !isKept(modelId)) return 'only on this device';
  return holderLabel(modelId).text;
}

// For the shelf's ⋯ menu
export function shelfMenuOption(modelId) {
  const keptHere = isKept(modelId);
  if (keptHere) return account() && !isBuildShelf(modelId) ? checkoutOption(modelId) : '';
  return `
    <div class="sheet-option" data-sync-action="keep" data-model="${modelId}">
      <div class="sheet-option-icon" style="background: var(--surface-hover);">☁</div>
      <div class="sheet-option-text">
        <div class="sheet-option-title">Keep on the server</div>
        <div class="sheet-option-desc">${account() ? 'Syncs with your other devices' : 'Sign in first (email, invite only)'}</div>
      </div>
    </div>`;
}

function checkoutOption(modelId) {
  const h = holderOf(modelId);
  const [action, icon, title, desc] = !h ? ['checkout', '✏️', 'Check out to edit', 'Your other devices can look but not change it']
    : h.you ? ['checkin', '☁', 'Check in', 'Sends your changes; then any device can check it out']
    : ['takeover', '🔒', 'Take over', `Checked out on ${escapeHtml(h.deviceName || 'another device')}`];
  return `
    <div class="sheet-option" data-sync-action="${action}" data-model="${modelId}">
      <div class="sheet-option-icon" style="background: var(--surface-hover);">${icon}</div>
      <div class="sheet-option-text"><div class="sheet-option-title">${title}</div><div class="sheet-option-desc">${desc}</div></div>
    </div>`;
}

// Taking over from another device: what they haven't sent yet stays there.
// From an agent it's taking it back: the agent's next change is refused.
function openTakeOver(modelId) {
  const h = holderOf(modelId);
  if (isAgent(h)) return openBoardSheet(`
    <div class="sheet-title">Take back from ${escapeHtml(h.deviceName || 'the agent')}?</div>
    <p class="sy-p">Its next change will be refused. What it sent already is here.</p>
    <button class="sheet-btn" data-sync-action="takeover-yes" data-model="${modelId}">Take back</button>
    <button class="sheet-btn secondary" data-sync-action="close">Not now</button>`);
  openBoardSheet(`
    <div class="sheet-title">Take over from ${escapeHtml(h?.deviceName || 'the other device')}?</div>
    <p class="sy-p">It's checked out there${h?.since ? ` since ${escapeHtml(new Date(h.since).toLocaleString())}` : ''}. Changes made there that haven't reached the server yet stay on that device and won't come here.</p>
    <button class="sheet-btn" data-sync-action="takeover-yes" data-model="${modelId}">Take over</button>
    <button class="sheet-btn secondary" data-sync-action="close">Not now</button>`);
}

// Read-only, tried to change it: offer to check it out
function openBlocked(modelId) {
  if (isBuildShelf(modelId)) return openBoardSheet(`
    <div class="sheet-title">A build is read only</div>
    <p class="sy-p">It is what the app was built as. Start a plan from it and edit that.</p>
    <button class="sheet-btn" data-title-action="plan" data-model="${modelId}">Start a plan from this build</button>
    <button class="sheet-btn secondary" data-sync-action="close">Not now</button>`);
  const h = holderOf(modelId);
  if (h && !h.you) return openTakeOver(modelId);
  openBoardSheet(`
    <div class="sheet-title">Check it out to edit</div>
    <p class="sy-p">This model is kept on the server, and one device edits it at a time. Check it out here; your other devices can still look at it.</p>
    <button class="sheet-btn" data-sync-action="checkout" data-model="${modelId}">Check out</button>
    <button class="sheet-btn secondary" data-sync-action="close">Not now</button>`);
}

// A small chip in the header (beside the title) of an open model kept on the server: who has it; a tap
// does the one thing to do (check out, check in, or offer to take over)
export function updateCheckoutBanner() {
  let el = document.getElementById('syCheckout');
  const id = getCurrentModelId();
  const show = account() && isKept(id) && !isBuildShelf(id) && !document.body.classList.contains('library-mode');
  // A published edition is frozen, kept on the server or not
  if (!show) { el?.remove(); agentBanner(null, id); setReadOnly(!canEditCurrent() && !document.body.classList.contains('library-mode')); return; }
  if (!el) {
    el = document.createElement('button'); el.id = 'syCheckout'; el.className = 'sy-chip';
    document.getElementById('modelTitle').after(el);
  }
  const l = holderLabel(id);
  const h = holderOf(id);
  const [action, label, title] = !h ? ['checkout', '☁ Check out', 'Checked in: check it out to edit']
    : h.you ? ['checkin', '✏️ Check in', 'Checked out here: check it in when you’re done']
    : isAgent(h) ? ['takeover', h.deviceName || 'An agent', `${h.deviceName || 'An agent'} is editing it: tap to take it back`]
    : ['takeover', `🔒 ${h.deviceName || 'Other device'}`, `Checked out on ${h.deviceName || 'another device'}: tap to take over`];
  el.dataset.state = l.cls;
  el.dataset.syncAction = action;
  el.dataset.model = id;
  el.title = title;
  el.setAttribute('aria-label', title);
  if (h && !h.you && isAgent(h)) el.innerHTML = `${itsybitMark({ size: 13 })} ${escapeHtml(label)}`;
  else el.textContent = label;
  agentBanner(h, id);
  // Not checked out here: taps only read (features/readOnly)
  setReadOnly(!h?.you || isFrozenCurrent(), action, h && !h.you && isAgent(h) ? agentName(h) : null);
}

// An agent has it checked out: a banner under the header says so, with Take back
function agentBanner(h, modelId) {
  let el = document.getElementById('syAgentBanner');
  if (!h || h.you || !isAgent(h)) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'syAgentBanner'; el.className = 'sy-agent-banner'; el.setAttribute('role', 'status');
    document.querySelector('.header')?.append(el);
  }
  el.innerHTML = `${itsybitMark({ size: 22 })}<span class="sy-agent-text"><b>${escapeHtml(agentName(h))} is editing</b>, read only here</span>
    <button class="sy-agent-back" data-sync-action="takeover" data-model="${escapeHtml(modelId)}">Take back</button>`;
}

// After the library is drawn: the shelves on the server that this device doesn't have
async function fillServerOnly() {
  const slot = document.getElementById('syServerOnly');
  if (!slot || !account()) return;
  try {
    // On this device already: kept here, by their server id. A private book that happens to
    // have the same id (an old import) isn't it: downloading gives the shelf a book of its own
    const here = new Set(serverIds());
    const missing = (await serverLibrary()).filter(m => !here.has(m.modelId));
    const box = document.getElementById('syMissing');
    if (box) box.innerHTML = sectionHead('missing', 'In your library, not on this device', String(missing.length), missing.length)
      + sectionBody('missing', missing.length, (missing.length > 1 ? `<button class="sy-download-all" data-sync-action="download-all">⬇ Download all ${missing.length}</button>` : '') + missing.map(m => `<button class="sy-missing" data-sync-action="download" data-model="${escapeHtml(m.modelId)}" title="${escapeHtml(m.name || 'Untitled model')} · ${m.count} events${m.updatedAt ? ` · changed ${escapeHtml(new Date(m.updatedAt).toLocaleString())}` : ''}">⬇ ${escapeHtml(m.name || 'Untitled model')} <span>${m.count} events</span></button>`).join(''));
    // The "Not here" chip at the top
    const chip = document.querySelector('[data-jump-count="missing"]');
    if (chip) { chip.textContent = missing.length; chip.parentElement.disabled = !missing.length; chip.parentElement.classList.toggle('empty', !missing.length); }
  } catch (e) { /* offline: the bar still works */ }
}
export function afterLibraryRender() { fillServerOnly(); }

// ---------- Sheets ----------

let pendingEmail = null;
let inviteFromLink = null;

function openSignIn(invite = inviteFromLink) {
  openBoardSheet(`
    <div class="sheet-title">Sign in <span class="bd-sheet-sub">keep models on the server</span></div>
    <p class="sy-p">We email you a 6-digit code. New here? You need an invite code from Jocelyn.</p>
    <label class="ol-add-label" for="syEmail">Email</label>
    <input class="sheet-input" id="syEmail" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com">
    <label class="ol-add-label" for="syInvite">Invite code <span class="ol-add-note">only the first time</span></label>
    <input class="sheet-input" id="syInvite" autocomplete="off" autocapitalize="characters" value="${escapeHtml(invite || '')}" placeholder="e.g. K7M2QX9PRT">
    <button class="sheet-btn" data-sync-action="send">Email me a code</button>`, 'syEmail');
}

function openCode(email) {
  pendingEmail = email;
  openBoardSheet(`
    <div class="sheet-title">Check your email</div>
    <p class="sy-p">A 6-digit code is on its way to <b>${escapeHtml(email)}</b>. It works for 15 minutes.</p>
    <input class="sheet-input sy-code" id="syCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456">
    <button class="sheet-btn" data-sync-action="verify">Sign in</button>
    <button class="sheet-btn secondary" data-sync-action="signin">Use another email</button>`, 'syCode');
}

async function openAccount() {
  const a = account();
  if (!a) return openSignIn();
  openBoardSheet(`
    <div class="sheet-title">☁ ${escapeHtml(a.email)}</div>
    <p class="sy-p">Shelves marked “Keep on the server” sync with your other devices.</p>
    ${a.admin ? '<button class="sheet-btn" data-sync-action="invite">Invite someone</button>' : ''}
    <button class="sheet-btn secondary" data-sync-action="sync">Sync now</button>
    <div class="bd-sheet-label">Signed-in devices</div>
    <div id="syDevices" class="sy-devices"><span class="sy-p">Loading…</span></div>
    <button class="sheet-btn secondary sy-signout" data-sync-action="signout">Sign out on this device</button>`);
  try {
    const devices = await listDevices();
    const box = document.getElementById('syDevices');
    if (box) box.innerHTML = devices.map(d => `
      <div class="sy-device"><span>${escapeHtml(d.deviceName || 'Device')}${d.current ? ' <b>(this one)</b>' : ''}<small>${new Date(d.signedInAt).toLocaleDateString()}</small></span>
        ${d.current ? '' : `<button data-sync-action="revoke" data-device="${escapeHtml(d.deviceId)}">Sign out</button>`}</div>`).join('');
  } catch (e) { const box = document.getElementById('syDevices'); if (box) box.innerHTML = `<span class="sy-p">${escapeHtml(e.message)}</span>`; }
}

async function openInvite() {
  try {
    const { code, expiresAt } = await createInvite();
    const link = `${APP_URL}?invite=${encodeURIComponent(code)}`;
    openBoardSheet(`
      <div class="sheet-title">An invite</div>
      <p class="sy-p">Works once, until ${new Date(expiresAt).toLocaleDateString()}. Send the link (or the code).</p>
      <div class="sy-invite-code">${escapeHtml(code)}</div>
      <input class="sheet-input" id="syInviteLink" readonly value="${escapeHtml(link)}">
      <button class="sheet-btn" data-sync-action="copy-invite">Copy the link</button>
      ${navigator.share ? '<button class="sheet-btn secondary" data-sync-action="share-invite">Share…</button>' : ''}`);
  } catch (e) { showToast(e.status === 403 ? 'Only Jocelyn can invite people' : e.message); }
}

async function handle(t) {
  const a = t.dataset.syncAction;
  try {
    if (a === 'signin') openSignIn();
    else if (a === 'account') openAccount();
    else if (a === 'send') {
      const email = document.getElementById('syEmail').value.trim();
      const invite = document.getElementById('syInvite').value.trim();
      if (!/^\S+@\S+\.\S+$/.test(email)) { showToast('That email doesn’t look right'); return; }
      t.disabled = true;
      await startSignIn(email, invite || null);
      openCode(email);
    }
    else if (a === 'verify') {
      const code = document.getElementById('syCode').value.trim();
      t.disabled = true;
      const r = await verifySignIn(pendingEmail, code);
      inviteFromLink = null;
      hideAllSheets();
      showToast(`Signed in as ${r.email || pendingEmail}`);
      window.EventPad.showLibrary();
    }
    else if (a === 'signout') { await signOut(); hideAllSheets(); showToast('Signed out on this device'); }
    else if (a === 'revoke') { await revokeDevice(t.dataset.device); openAccount(); }
    else if (a === 'invite') await openInvite();
    else if (a === 'copy-invite') { const ok = await copyText(document.getElementById('syInviteLink').value); showToast(ok ? 'Invite link copied' : 'Copy it from the box'); }
    else if (a === 'share-invite') navigator.share({ title: 'Event Book invite', url: document.getElementById('syInviteLink').value }).catch(() => {});
    else if (a === 'sync') {
      t.classList.add('spinning');
      await syncAll();
      showToast('In step with your library');
      if (document.body.classList.contains('library-mode')) window.EventPad.showLibrary();
    }
    else if (a === 'download-all') {
      // Every book in the library that isn't here yet, one after another
      const ids = [...document.querySelectorAll('.sy-missing[data-sync-action=download]')].map(b => b.dataset.model);
      t.disabled = true;
      let done = 0;
      for (const id of ids) {
        t.textContent = `⬇ Downloading ${done + 1} of ${ids.length}…`;
        try { await download(id); done++; } catch (e) { /* the rest still come */ }
      }
      showToast(done === ids.length ? `Downloaded ${done} ${done === 1 ? 'book' : 'books'}` : `Downloaded ${done} of ${ids.length}: try again for the rest`);
      window.EventPad.showLibrary();
    }
    else if (a === 'keep') {
      if (!account()) { openSignIn(); return; }
      hideAllSheets();
      const r = await keepOnServer(t.dataset.model);
      showToast(`Donated to your library: borrowed here${r?.up ? ` (${r.up} events sent)` : ''}`);
    }
    else if (a === 'checkout') { hideAllSheets(); await checkOut(t.dataset.model); showToast('Checked out here: edit away'); }
    else if (a === 'checkin') { hideAllSheets(); await checkIn(t.dataset.model); showToast('Checked in: any device can check it out'); }
    else if (a === 'takeover') { openTakeOver(t.dataset.model); return; }
    else if (a === 'takeover-yes') { hideAllSheets(); await takeOver(t.dataset.model); showToast('Checked out here'); }
    else if (a === 'close') hideAllSheets();
    else if (a === 'download') {
      // One book: it opens straight away (no scrolling the shelves to find it)
      await download(t.dataset.model);
      hideAllSheets();
      openModel(t.dataset.model);
      window.EventPad.showStart();
      showToast('Downloaded to this device');
    }
  } catch (e) {
    t.disabled = false;
    const triesLeft = e.body?.triesLeft;
    showToast(e.status === 409 && a === 'checkout' ? `Checked out on ${e.body?.holder?.deviceName || 'another device'}`
      : e.status === 404 && a === 'send' ? 'Keeping models on the server isn’t switched on yet'
      : e.status === 429 ? 'Too many tries: wait a little and try again'
      : e.status === 403 ? (e.body?.error || 'That invite code doesn’t work')
      : triesLeft !== undefined ? `Wrong code (${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left)`
      : e.message);
  }
}

export function initSyncView() {
  const params = new URLSearchParams(location.search);
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-sync-action]');
    if (t) handle(t);
  });
  onEditBlocked(id => openBlocked(id));
  // Which section each book is in (private or library) and who has it: a change
  // redraws the bookshelves; otherwise the badges update in place
  const sectionsKey = () => account() ? JSON.stringify(Object.entries(kept()).map(([id, k]) => [id, k.holder ? (k.holder.you ? 'you' : `${k.holder.deviceKind || ''}:${k.holder.deviceName}`) : null])) : '';
  let lastSections = sectionsKey();
  onSyncChange(() => {
    updateCheckoutBanner();
    const now = sectionsKey();
    const moved = now !== lastSections;
    lastSections = now;
    if (document.body.classList.contains('library-mode')) {
      if (moved) { window.EventPad.showLibrary(); return; }
      document.querySelectorAll('[data-sync-shelf]').forEach(el => { el.innerHTML = footMark(el.dataset.syncShelf); });
      const bar = document.getElementById('syBar');
      if (bar) bar.outerHTML = accountBar();
    }
  });
  // An invite link: open sign-in with the code filled in
  if (params.get('invite')) {
    inviteFromLink = params.get('invite');
    params.delete('invite');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
    setTimeout(() => openSignIn(inviteFromLink), 300);
  }
}
