// ===========================================
// REVIEWERS ON A BOOK - The owner's "People…" sheet: invite someone by email (comment, or
// comment and add scenarios), who's invited or has joined and when they last commented,
// Remove. Members only (a reviewing-only account has no books of its own).
// ===========================================

import { openBoardSheet } from '../board/sheets/shared.js';
import { escapeHtml } from '../board/view.js';
import { showToast } from '../../ui/toast.js';
import { projectState } from '../../core/projections.js';
import { readModelEvents } from '../../core/eventStore.js';
import { listPeople, invitePerson, removePerson } from './client.js';

let modelId = null;
let canAdd = false;
let role = 'reviewer';
const day = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };

export async function openPeopleSheet(id) {
  modelId = id; role = 'reviewer';
  const name = projectState(readModelEvents(id)).modelName || 'Untitled model';
  const roleChip = (v, label) => `<button class="cm-chip ${role === v ? 'on' : ''}" data-people-action="role" data-value="${v}" aria-pressed="${role === v}">${label}</button>`;
  const chip = (v, label) => `<button class="cm-chip ${canAdd === v ? 'on' : ''}" data-people-action="can" data-value="${v ? 1 : 0}" aria-pressed="${canAdd === v}">${label}</button>`;
  openBoardSheet(`
    <div class="sheet-title">People <span class="bd-sheet-sub">${escapeHtml(name)}</span></div>
    <p class="cm-note">Invite someone by email to review or edit this book. They sign in with a code, find it under "Shared with me", and can comment on anything, any time, until you remove them.</p>
    <label class="bd-sheet-label" for="ppEmail">Email</label>
    <input class="sheet-input" id="ppEmail" type="email" placeholder="name@example.com" autocomplete="email">
    <div class="bd-sheet-label">As</div>
    <div class="cm-parts">${roleChip('reviewer', 'Reviewer')}${roleChip('editor', 'Editor')}</div>
    <p class="cm-note" id="ppRoleNote"></p>
    <div id="ppCan"><div class="bd-sheet-label">They can</div>
    <div class="cm-parts">${chip(false, 'Comment')}${chip(true, 'Comment and add scenarios')}</div></div>
    <button class="sheet-btn" data-people-action="invite">Invite</button>
    <div class="bd-sheet-label">On this book</div>
    <div id="ppList" class="rv-list"><p class="cm-note">Loading…</p></div>`, 'ppEmail');
  showRole();
  drawList();
}

// An editor can always add scenarios, so only a reviewer is asked what they can do
function showRole() {
  document.querySelectorAll('[data-people-action=role]').forEach(b => { const on = b.dataset.value === role; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const can = document.getElementById('ppCan'); if (can) can.hidden = role === 'editor';
  const note = document.getElementById('ppRoleNote');
  if (note) note.textContent = role === 'editor' ? 'An editor can also rename slices, stickies and fields, add scenarios, and tick or clear Refined. Structure stays yours.' : '';
}

async function drawList() {
  const el = document.getElementById('ppList');
  if (!el) return;
  try {
    const people = await listPeople(modelId);
    el.innerHTML = people.length ? people.map(p => `
      <div class="rv-row">
        <div class="rv-what"><b>${escapeHtml(p.email)}</b>
          <span>${p.joined ? 'joined' : 'invited, not signed in yet'} · ${p.role === 'editor' ? 'editor' : p.canAddScenarios ? 'comments and scenarios' : 'comments'}${p.lastCommentAt ? ` · last comment ${day(p.lastCommentAt)}` : ''}</span>
        </div>
        <div class="rv-acts"><button class="cm-btn quiet" data-people-action="remove" data-email="${escapeHtml(p.email)}">Remove</button></div>
      </div>`).join('') : '<p class="cm-note">Nobody yet.</p>';
  } catch (e) { el.innerHTML = `<p class="cm-note">${escapeHtml(e.message)}</p>`; }
}

async function onAction(a, t) {
  if (a === 'open') openPeopleSheet(t.dataset.model);
  else if (a === 'role') { role = t.dataset.value; showRole(); }
  else if (a === 'can') {
    canAdd = t.dataset.value === '1';
    document.querySelectorAll('[data-people-action=can]').forEach(b => { const on = (b.dataset.value === '1') === canAdd; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  }
  else if (a === 'invite') {
    const box = document.getElementById('ppEmail');
    const email = box?.value.trim();
    if (!email) { showToast('Write their email first'); return; }
    t.disabled = true;
    try { await invitePerson(modelId, email, canAdd, role); showToast(`Invited ${email}: they'll get an email`); if (box) box.value = ''; drawList(); }
    catch (e) { showToast(e.message); }
    finally { t.disabled = false; }
  }
  else if (a === 'remove') {
    try { await removePerson(modelId, t.dataset.email); showToast(`${t.dataset.email} removed: the book is gone from their shelves`); drawList(); }
    catch (e) { showToast(e.message); }
  }
}

export function initPeopleView() {
  document.addEventListener('eventpad:people', e => openPeopleSheet(e.detail));
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-people-action]');
    if (t) onAction(t.dataset.peopleAction, t);
  });
  document.getElementById('boardSheetContent')?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'ppEmail') { e.preventDefault(); document.querySelector('[data-people-action=invite]')?.click(); }
  });
}
