// ===========================================
// COMMENTS - The thread sheet: a slice's or a scenario's threads, oldest first, each with
// its replies, resolved ones folded away; a box to start one (on the whole scenario, or its
// Given, When or Then line) or to reply to one. The first time, it asks for a nickname.
// Opened from 💬 in the outline, the board's comment lane and the scenario drawer.
// The board chat is the same sheet with no slice: the board's own threads, and above them
// every thread still open elsewhere, a tap from where it is (💬 Chat on the board's bar).
// ===========================================

import { escapeHtml } from '../board/view.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { nickname, setNickname, addComment, replyToThread, resolveComment, deleteComment, commentDeviceId } from './command.js';
import { threadSheet } from './threadSheet.read.js';
import { openCommentNamed } from './commentToReveal.read.js';
import { commentThread, commentOutstanding, commentNicknameForm, commentWriter } from './comments.parts.js';

let at = null;           // { sliceId, scenarioId, part, replyTo } the open thread (sliceId null: the board chat)
let renaming = false;    // asking for (another) nickname

function draw(focus) {
  const sheet = threadSheet(at, { me: commentDeviceId(), nick: nickname(), renaming });
  if (!sheet) return;
  openBoardSheet(`
    <div class="sheet-title">💬 ${sheet.title} <span class="bd-sheet-sub">${escapeHtml(sheet.sub)}</span></div>
    ${sheet.scenarioNote ? `<p class="cm-note">${escapeHtml(sheet.scenarioNote)}</p>` : ''}
    ${sheet.outstanding?.length ? `<div class="cm-outstanding"><div class="bd-sheet-label">Outstanding · ${sheet.outstanding.length}</div>
    ${sheet.outstanding.map(commentOutstanding).join('')}</div>` : ''}
    <div class="cm-list">
      ${sheet.open.length ? sheet.open.map(commentThread).join('') : `<p class="cm-note">${sheet.emptyNote}</p>`}
      ${sheet.done.length ? `<details class="cm-resolved"><summary>${sheet.done.length} resolved</summary>${sheet.done.map(commentThread).join('')}</details>` : ''}
    </div>
    ${sheet.nickname ? commentNicknameForm(sheet.nickname) : commentWriter(sheet.writer)}`, focus);
}

// Open a thread: on a slice (scenarioId null) or one of its scenarios (part: given | when | then)
export function openThread(sliceId, scenarioId = null, part = null) {
  at = { sliceId, scenarioId, part, replyTo: null };
  renaming = false;
  draw(nickname() ? null : 'cmNick');
}

function afterChange() { render(); draw(); }

function onAction(a, t) {
  if (a === 'goto') {
    const c = openCommentNamed(t.dataset.comment);
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
  else if (a === 'reply') { at.replyTo = t.dataset.comment; draw('cmText'); }
  else if (a === 'reply-cancel') { at.replyTo = null; draw('cmText'); }
  else if (a === 'send') {
    const text = document.getElementById('cmText')?.value;
    const why = at.replyTo ? replyToThread({ threadId: at.replyTo, text }) : addComment({ ...at, text });
    if (why) { showToast(why); return; }
    at.replyTo = null;
    afterChange();
  } else if (a === 'resolve') { const why = resolveComment(t.dataset.comment); why ? showToast(why) : afterChange(); }
  else if (a === 'delete') { const why = deleteComment(t.dataset.comment); why ? showToast(why) : afterChange(); }
}

// 💬 Chat: the board chat (its own threads, and every open thread elsewhere, a tap from where
// it is: reveal is the view's own way to unfold, open and scroll to it)
let reveal = null;
export function openCommentsList(onPick) {
  reveal = onPick;
  at = { sliceId: null, scenarioId: null, part: null, replyTo: null };
  renaming = false;
  draw();
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
