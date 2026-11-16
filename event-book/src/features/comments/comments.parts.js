// ===========================================
// COMMENTS - Parts of the thread sheet and the slice page's conversation, each drawn from its piece of
// Thread Sheet or Slice Conversation alone. A root carries data-component and data-key.
// ===========================================

import { MAX_NICKNAME } from './command.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A thread: its first comment, its replies under it, and Reply / Resolve for the whole of it
export function commentThread(c) {
  const del = x => x.mine ? `<button class="cm-btn quiet" data-comment-action="delete" data-comment="${x.commentId}" aria-label="Delete your comment">Delete</button>` : '';
  return `
    <div class="cm-comment ${c.resolved ? 'resolved' : ''}" data-component="Comment thread" data-key="${c.commentId}" data-comment="${c.commentId}">
      <div class="cm-meta"><b>${escapeHtml(c.nickname)}</b>${c.partLabel ? ` <span class="cm-part">${c.partLabel}</span>` : ''} <span class="cm-when">${c.whenText}</span></div>
      <div class="cm-text">${escapeHtml(c.text)}</div>
      ${(c.replies || []).map(r => `
      <div class="cm-reply" data-comment="${r.commentId}">
        <div class="cm-meta"><b>${escapeHtml(r.nickname)}</b> <span class="cm-when">${r.whenText}</span> ${del(r)}</div>
        <div class="cm-text">${escapeHtml(r.text)}</div>
      </div>`).join('')}
      <div class="cm-actions">
        <button class="cm-btn quiet" data-comment-action="reply" data-comment="${c.commentId}">↩ Reply</button>
        ${c.resolved ? '<span class="cm-done">✓ Resolved</span>' : `<button class="cm-btn" data-comment-action="resolve" data-comment="${c.commentId}">✓ Resolve</button>`}
        ${del(c)}
      </div>
    </div>`;
}

// A thread still open somewhere in the book, a tap from where it is (the board chat's Outstanding list)
export function commentOutstanding(t) {
  return `<button class="cm-goto" data-component="Comment outstanding" data-key="${t.commentId}" data-comment-action="goto" data-comment="${t.commentId}">
      <span class="cm-meta"><b>${escapeHtml(t.sliceTitle)}</b>${t.scenarioName ? ` · ${escapeHtml(t.scenarioName)}` : ''}${t.partLabel ? ` <span class="cm-part">${t.partLabel}</span>` : ''}</span>
      <span class="cm-text">${escapeHtml(t.nickname)}: ${escapeHtml(t.text)}${t.replies ? ` <span class="cm-when">· ${t.replies} ${t.replies === 1 ? 'reply' : 'replies'}</span>` : ''}</span>
    </button>`;
}

// The first time (or to change it): what should we call you?
export function commentNicknameForm(f) {
  return `
    <div class="cm-nick" data-component="Comment nickname form" data-key="nickname">
      <label class="bd-sheet-label" for="cmNick">${escapeHtml(f.label)}</label>
      <p class="cm-note">Shown with your comments. Kept on this device.</p>
      <input class="sheet-input" id="cmNick" maxlength="${MAX_NICKNAME}" value="${escapeHtml(f.nick)}" placeholder="e.g. Sam" autocomplete="nickname">
      <button class="sheet-btn" data-comment-action="nick">${escapeHtml(f.button)}</button>
    </div>`;
}

// The box to comment in: whom it replies to, the part of a scenario it is about, and Send
export function commentWriter(w) {
  return `
    <div class="cm-write" data-component="Comment writer" data-key="writer">
      ${w.replyingTo ? `<p class="cm-note cm-replying">↩ Replying to <b>${escapeHtml(w.replyingTo)}</b> · <button class="cm-link" data-comment-action="reply-cancel">a new thread instead</button></p>` : ''}
      ${w.parts ? `<div class="cm-parts" role="group" aria-label="About">
        ${w.parts.map(p => `<button class="cm-chip ${p.on ? 'on' : ''}" data-comment-action="part" data-part="${p.value}" aria-pressed="${p.on}">${escapeHtml(p.label)}</button>`).join('\n        ')}
      </div>` : ''}
      <textarea class="sheet-input cm-box" id="cmText" rows="3" placeholder="${escapeHtml(w.placeholder)}"></textarea>
      <div class="cm-send-row">
        <span class="cm-as">as <b>${escapeHtml(w.as)}</b> · <button class="cm-link" data-comment-action="rename">change</button></span>
        <button class="sheet-btn cm-send" data-comment-action="send">${escapeHtml(w.send)}</button>
      </div>
    </div>`;
}

// One thread under a slice's scenarios: what it is about, the thread, and its reply box when being replied to
export function conversationThread(t) {
  return `
  <div class="sp-thread" data-component="Conversation thread" data-key="${t.commentId}" data-thread="${t.commentId}">
    <div class="sp-thread-about">${escapeHtml(t.about)}</div>
    ${commentThread(t)}
    ${t.replying ? `<div class="sp-thread-reply">
      <textarea class="sheet-input cm-box" id="cvReply" rows="3" aria-label="Your reply" placeholder="Your reply"></textarea>
      <div class="cm-send-row"><button class="cm-btn quiet" data-comment-action="reply-cancel">Cancel</button><button class="sheet-btn cm-send" data-comment-action="send-reply" data-comment="${t.commentId}">Reply</button></div>
    </div>` : ''}
  </div>`;
}

// The conversation under a slice's scenarios: its threads (open first, resolved folded) and a box for a new one
export function conversationView(c) {
  const open = c.threads.filter(t => !t.resolved), done = c.threads.filter(t => t.resolved);
  const writer = c.nick ? `
      <textarea class="sheet-input cm-box" id="cvText" rows="3" aria-label="Start a new thread" placeholder="${c.lit ? 'A question or a note on this paragraph' : 'A question or a note on this slice'}"></textarea>
      <div class="cm-send-row"><span class="cm-as">as <b>${escapeHtml(c.nick)}</b></span><button class="sheet-btn cm-send" data-comment-action="send-new" data-slice="${c.sliceId}">Comment</button></div>` : `
      <label class="bd-sheet-label" for="cvNick">What should we call you?</label>
      <p class="cm-note">Shown with your comments. Kept on this device.</p>
      <input class="sheet-input" id="cvNick" maxlength="${MAX_NICKNAME}" placeholder="e.g. Sam" autocomplete="nickname">
      <button class="sheet-btn" data-comment-action="nick-page">Continue</button>`;
  return `<section class="sp-section sp-convo" data-component="Slice page conversation" data-key="conversation" data-convo="${c.sliceId}">
      <h2 class="sp-h2">Conversation <span>${c.open}</span></h2>
      ${open.map(conversationThread).join('')}
      ${c.threads.length ? '' : '<p class="cm-note">No comments yet.</p>'}
      ${done.length ? `<details class="cm-resolved"><summary>${done.length} resolved</summary>${done.map(conversationThread).join('')}</details>` : ''}
      <div class="cm-write sp-convo-box">${writer}</div>
    </section>`;
}
