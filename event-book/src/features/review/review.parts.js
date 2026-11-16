// ===========================================
// REVIEW LINKS - Parts of the review sheets, each drawn from its piece of Review Link Form, Review Link List,
// Review Join Offer or Review About Link alone. A root carries data-component and data-key.
// ===========================================

import { MAX_NICKNAME } from '../comments/command.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One choice in the owner's sheet (a chip of Review Link Form): who it is for, what they can do, for how long
export function reviewChoice(chip) {
  return `<button class="cm-chip ${chip.on ? 'on' : ''}" data-component="Review choice" data-key="${chip.attr}-${chip.value}" data-review-action="${chip.attr}" data-value="${chip.value}" aria-pressed="${chip.on}">${escapeHtml(chip.label)}</button>`;
}

// The link just made, shown once, to copy or share
export function reviewMade(made) {
  return `
    <div class="rv-made" data-component="Review link made" data-key="made">
      <div class="bd-sheet-label">Your link</div>
      <input class="sheet-input" id="rvUrl" readonly value="${escapeHtml(made.url)}">
      <div class="cm-send-row">
        <button class="sheet-btn secondary" data-review-action="copy" data-url="${escapeHtml(made.url)}">Copy</button>
        ${made.canShare ? `<button class="sheet-btn" data-review-action="share" data-url="${escapeHtml(made.url)}">Share…</button>` : ''}
      </div>
    </div>`;
}

// A link made for the book: what it is for, who joined, Copy link and Revoke while it lives
export function reviewLinkRow(r) {
  return `
    <div class="rv-row ${r.live ? '' : 'ended'}" data-component="Review link" data-key="${escapeHtml(r.reviewId)}">
      <div class="rv-what"><b>${escapeHtml(r.what)}</b>
        <span>${escapeHtml(r.when)}</span>
        <span>${escapeHtml(r.who)}</span>
      </div>
      ${r.live ? `<div class="rv-acts">
        ${r.url ? `<button class="cm-btn" data-review-action="copy" data-url="${escapeHtml(r.url)}">Copy link</button>` : ''}
        <button class="cm-btn quiet" data-review-action="revoke" data-review="${escapeHtml(r.reviewId)}">Revoke</button>
      </div>` : ''}
    </div>`;
}

// What a reviewer is told when they open a link, and the nickname to start with
export function reviewJoinForm(offer) {
  return `
    <div data-component="Review join form" data-key="join">
    <div class="sheet-title">${escapeHtml(offer.title)} <span class="bd-sheet-sub">${offer.sub}</span></div>
    <p class="cm-note">${escapeHtml(offer.text)}</p>
    <label class="bd-sheet-label" for="rvNick">What should we call you?</label>
    <input class="sheet-input" id="rvNick" maxlength="${MAX_NICKNAME}" value="${escapeHtml(offer.nick)}" placeholder="e.g. Alex" autocomplete="nickname">
    <button class="sheet-btn" data-review-action="join">Start reviewing</button>
    </div>`;
}

// The reviewer's sheet about the review they are in, with Send now while it is open
export function reviewAbout(about) {
  return `
    <div data-component="Review about" data-key="about">
    <div class="sheet-title">${about.title} <span class="bd-sheet-sub">${escapeHtml(about.name)}</span></div>
    <p class="cm-note">${escapeHtml(about.text)}</p>
    ${about.ended ? '' : '<button class="sheet-btn" data-review-action="send">Send now</button>'}
    </div>`;
}
