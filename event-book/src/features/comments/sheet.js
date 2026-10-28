// ===========================================
// COMMENTS - The thread sheet: a slice's or a scenario's comments, oldest first, with
// resolved ones folded away; a box to write one (on the whole scenario, or its Given,
// When or Then line). The first time, it asks for a nickname. Opened from 💬 in the
// outline, the board's comment lane and the scenario drawer.
// ===========================================

import { projectState, sliceTitle } from '../../core/projections.js';
import { escapeHtml } from '../board/view.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { nickname, setNickname, addComment, resolveComment, deleteComment, commentDeviceId, MAX_NICKNAME, PARTS } from './command.js';
import { commentsOn, openComments } from './read.js';

let at = null;           // { sliceId, scenarioId, part } the open thread
let renaming = false;    // asking for (another) nickname
const partLabel = { given: 'Given', when: 'When', then: 'Then' };

const when = iso => {
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
};

function commentHtml(c, mine) {
  return `
    <div class="cm-comment ${c.resolved ? 'resolved' : ''}" data-comment="${c.commentId}">
      <div class="cm-meta"><b>${escapeHtml(c.nickname)}</b>${c.part ? ` <span class="cm-part">${partLabel[c.part]}</span>` : ''} <span class="cm-when">${when(c.at)}</span></div>
      <div class="cm-text">${escapeHtml(c.text)}</div>
      <div class="cm-actions">
        ${c.resolved ? '<span class="cm-done">✓ Resolved</span>' : `<button class="cm-btn" data-comment-action="resolve" data-comment="${c.commentId}">✓ Resolve</button>`}
        ${mine ? `<button class="cm-btn quiet" data-comment-action="delete" data-comment="${c.commentId}" aria-label="Delete your comment">Delete</button>` : ''}
      </div>
    </div>`;
}

function draw(focus) {
  const state = projectState();
  const slice = state.slices[at.sliceId];
  if (!slice) return;
  const scn = at.scenarioId ? state.scenarios[at.scenarioId] : null;
  const all = commentsOn(state, at.sliceId, at.scenarioId);
  const open = all.filter(c => !c.resolved), done = all.filter(c => c.resolved);
  const me = commentDeviceId();
  const nick = nickname();
  const ask = !nick || renaming;
  const writer = ask ? `
    <div class="cm-nick">
      <label class="bd-sheet-label" for="cmNick">${nick ? 'Your nickname' : 'What should we call you?'}</label>
      <p class="cm-note">Shown with your comments. Kept on this device.</p>
      <input class="sheet-input" id="cmNick" maxlength="${MAX_NICKNAME}" value="${escapeHtml(nick || '')}" placeholder="e.g. Sam" autocomplete="nickname">
      <button class="sheet-btn" data-comment-action="nick">${nick ? 'Save' : 'Continue'}</button>
    </div>` : `
    <div class="cm-write">
      ${scn ? `<div class="cm-parts" role="group" aria-label="About">
        <button class="cm-chip ${!at.part ? 'on' : ''}" data-comment-action="part" data-part="" aria-pressed="${!at.part}">Whole scenario</button>
        ${PARTS.map(p => `<button class="cm-chip ${at.part === p ? 'on' : ''}" data-comment-action="part" data-part="${p}" aria-pressed="${at.part === p}">${partLabel[p]}</button>`).join('')}
      </div>` : ''}
      <textarea class="sheet-input cm-box" id="cmText" rows="3" placeholder="${scn ? 'What should change, or what\'s missing?' : 'A question or a note on this slice'}"></textarea>
      <div class="cm-send-row">
        <span class="cm-as">as <b>${escapeHtml(nick)}</b> · <button class="cm-link" data-comment-action="rename">change</button></span>
        <button class="sheet-btn cm-send" data-comment-action="send">Comment</button>
      </div>
    </div>`;
  openBoardSheet(`
    <div class="sheet-title">💬 Comments <span class="bd-sheet-sub">${escapeHtml(scn ? scn.name || 'Scenario' : sliceTitle(slice, state))}</span></div>
    ${scn ? `<p class="cm-note">${escapeHtml(sliceTitle(slice, state))}</p>` : ''}
    <div class="cm-list">
      ${open.length ? open.map(c => commentHtml(c, c.deviceId === me)).join('') : `<p class="cm-note">${done.length ? 'Nothing open.' : 'No comments yet.'}</p>`}
      ${done.length ? `<details class="cm-resolved"><summary>${done.length} resolved</summary>${done.map(c => commentHtml(c, c.deviceId === me)).join('')}</details>` : ''}
    </div>
    ${writer}`, focus);
}

// Open a thread: on a slice (scenarioId null) or one of its scenarios (part: given | when | then)
export function openThread(sliceId, scenarioId = null, part = null) {
  at = { sliceId, scenarioId, part };
  renaming = false;
  draw(nickname() ? null : 'cmNick');
}

function afterChange() { render(); draw(); }

function onAction(a, t) {
  if (a === 'goto') {
    const c = openComments(projectState()).find(x => x.commentId === t.dataset.comment);
    hideAllSheets();
    if (c && reveal) setTimeout(() => reveal(c), 120);
    return;
  }
  if (!at) return;
  if (a === 'nick') {
    const why = setNickname(document.getElementById('cmNick')?.value);
    if (why) { showToast(why); return; }
    renaming = false;
    draw('cmText');
  } else if (a === 'rename') { renaming = true; draw('cmNick'); }
  else if (a === 'part') { at.part = t.dataset.part || null; const text = document.getElementById('cmText')?.value || ''; draw(); const box = document.getElementById('cmText'); if (box) { box.value = text; box.focus(); } }
  else if (a === 'send') {
    const why = addComment({ ...at, text: document.getElementById('cmText')?.value });
    if (why) { showToast(why); return; }
    afterChange();
  } else if (a === 'resolve') { const why = resolveComment(t.dataset.comment); why ? showToast(why) : afterChange(); }
  else if (a === 'delete') { const why = deleteComment(t.dataset.comment); why ? showToast(why) : afterChange(); }
}

// "💬 N open": a drawer of every open comment, by slice in the book's order; tapping one
// closes it and goes there (reveal: the view's own way to unfold, open and scroll to it)
let reveal = null;
export function openCommentsList(onPick) {
  reveal = onPick;
  const state = projectState();
  const open = openComments(state);
  const bySlice = [];
  open.forEach(c => { const g = bySlice.find(x => x.sliceId === c.sliceId); g ? g.items.push(c) : bySlice.push({ sliceId: c.sliceId, items: [c] }); });
  openBoardSheet(`
    <div class="sheet-title">💬 Open comments <span class="bd-sheet-sub">${open.length}</span></div>
    ${bySlice.length ? bySlice.map(g => `
      <div class="cm-group">
        <div class="cm-group-title">${escapeHtml(sliceTitle(state.slices[g.sliceId], state))}</div>
        ${g.items.map(c => `
          <button class="cm-goto" data-comment-action="goto" data-comment="${c.commentId}">
            <span class="cm-meta"><b>${escapeHtml(c.nickname)}</b>${c.scenarioName ? ` · ${escapeHtml(c.scenarioName)}` : ''}${c.part ? ` <span class="cm-part">${partLabel[c.part]}</span>` : ''}</span>
            <span class="cm-text">${escapeHtml(c.text)}</span>
          </button>`).join('')}
      </div>`).join('') : '<p class="cm-note">No open comments.</p>'}`);
}

export function initComments() {
  const sheet = document.getElementById('boardSheetContent');
  sheet?.addEventListener('click', e => {
    const t = e.target.closest('[data-comment-action]');
    if (t) onAction(t.dataset.commentAction, t);
  });
  sheet?.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.id === 'cmNick') { e.preventDefault(); onAction('nick'); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && e.target.id === 'cmText') { e.preventDefault(); onAction('send'); }
  });
}
