// ===========================================
// REVIEW LINKS - Screens
// Owner: "Review & verify…" on a library book's details: send it out (a review of the plan, or a
// verification of the shipped app; the server calls these purpose feedback and test) — or
// testing an edition), what the reviewer may do, for how long; each link with who joined,
// when they last sent something, Copy link and Revoke.
// Reviewer: ?review=<token> opens a sheet (what it is, a nickname), then the book's outline;
// a chip in the header says it's a review.
// ===========================================

import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { escapeHtml } from '../board/view.js';
import { showToast } from '../../ui/toast.js';
import { copyText } from '../../ui/clipboard.js';
import { getCurrentModelId, openModel, readModelEvents } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { nickname, setNickname, MAX_NICKNAME } from '../comments/command.js';
import { createReview, listReviews, revokeReview, peekReview, joinReview, bookForToken, reviewOf, syncReview } from './client.js';

const purposeText = { feedback: 'Review the plan', test: 'Verify the shipped app' };
const day = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
let form = { modelId: null, purpose: 'feedback', canAddScenarios: true, days: 14 };
let made = null;   // the link just made: shown once, to copy or share

// ---------- The owner ----------

export async function openReviewsSheet(modelId) {
  form = { ...form, modelId };
  const state = projectState(readModelEvents(modelId));
  const published = !!state.edition?.published;
  if (!published && form.purpose === 'test') form.purpose = 'feedback';
  const chip = (attr, value, label, on) => `<button class="cm-chip ${on ? 'on' : ''}" data-review-action="${attr}" data-value="${value}" aria-pressed="${on}">${label}</button>`;
  openBoardSheet(`
    <div class="sheet-title">Review &amp; verify <span class="bd-sheet-sub">${escapeHtml(state.modelName || 'Untitled model')}</span></div>
    <p class="cm-note">A link for someone without an account. They pick a nickname and comment${form.canAddScenarios ? ' and add scenarios' : ''}; it all lands in this book. It ends on the day you pick, or when you revoke it.</p>
    ${made ? `
    <div class="rv-made">
      <div class="bd-sheet-label">Your link</div>
      <input class="sheet-input" id="rvUrl" readonly value="${escapeHtml(made)}">
      <div class="cm-send-row">
        <button class="sheet-btn secondary" data-review-action="copy" data-url="${escapeHtml(made)}">Copy</button>
        ${navigator.share ? `<button class="sheet-btn" data-review-action="share" data-url="${escapeHtml(made)}">Share…</button>` : ''}
      </div>
    </div>` : `
    <div class="bd-sheet-label">For</div>
    <div class="cm-parts">${chip('purpose', 'feedback', purposeText.feedback, form.purpose === 'feedback')}${published ? chip('purpose', 'test', `Verify ${state.edition.edition ? `edition ${state.edition.edition}` : 'the shipped app'}`, form.purpose === 'test') : ''}</div>
    <div class="bd-sheet-label">They can</div>
    <div class="cm-parts">${chip('scenarios', '0', 'Comment', !form.canAddScenarios)}${chip('scenarios', '1', 'Comment and add scenarios', form.canAddScenarios)}</div>
    <div class="bd-sheet-label">For how long</div>
    <div class="cm-parts">${[7, 14, 30, 90].map(d => chip('days', d, `${d} days`, form.days === d)).join('')}</div>
    <button class="sheet-btn" data-review-action="create">Make the link</button>`}
    <div class="bd-sheet-label">Links</div>
    <div id="rvList" class="rv-list"><p class="cm-note">Loading…</p></div>`);
  try { drawList(await listReviews(modelId)); }
  catch (e) { const el = document.getElementById('rvList'); if (el) el.innerHTML = `<p class="cm-note">${escapeHtml(e.message)}</p>`; }
}

function drawList(reviews) {
  const el = document.getElementById('rvList');
  if (!el) return;
  el.innerHTML = reviews.length ? [...reviews].reverse().map(r => `
    <div class="rv-row ${r.live ? '' : 'ended'}">
      <div class="rv-what"><b>${purposeText[r.purpose] || r.purpose}${r.purpose === 'test' && r.edition ? ` · edition ${r.edition}` : ''}</b>
        <span>${r.live ? `until ${day(r.expiresAt)}` : r.revoked ? 'revoked' : `ended ${day(r.expiresAt)}`} · ${r.canAddScenarios ? 'comments and scenarios' : 'comments only'}</span>
        <span>${r.reviewers.length ? escapeHtml(r.reviewers.join(', ')) : 'nobody has opened it yet'}${r.lastChangeAt ? ` · last change ${day(r.lastChangeAt)}` : ''}</span>
      </div>
      ${r.live ? `<div class="rv-acts">
        ${r.url ? `<button class="cm-btn" data-review-action="copy" data-url="${escapeHtml(r.url)}">Copy link</button>` : ''}
        <button class="cm-btn quiet" data-review-action="revoke" data-review="${r.reviewId}">Revoke</button>
      </div>` : ''}
    </div>`).join('') : '<p class="cm-note">No review links yet.</p>';
}

// ---------- The reviewer ----------

let joining = null;   // { token, info }

export async function openReviewFromUrl() {
  const params = new URLSearchParams(location.search);
  const token = params.get('review');
  if (!token) return;
  params.delete('review');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  const known = bookForToken(token);
  if (known) { openModel(known); window.EventPad.showOutline(); syncReview(known).catch(() => {}); return; }
  let info;
  try { info = await peekReview(token); }
  catch (e) {
    openBoardSheet(`
      <div class="sheet-title">${e.status === 410 ? 'This review has ended' : 'That review link doesn’t work'}</div>
      <p class="cm-note">${e.status === 410 ? 'Ask whoever sent it for a new link.' : 'Check the link, or ask for a new one.'}</p>
      <button class="sheet-btn" data-review-action="close">OK</button>`);
    return;
  }
  joining = { token, info };
  openBoardSheet(`
    <div class="sheet-title">${escapeHtml(info.name || 'An event model')} <span class="bd-sheet-sub">${info.purpose === 'test' ? 'verification' : 'review'}</span></div>
    <p class="cm-note">${info.purpose === 'test'
      ? `You’ve been asked to verify the shipped app${info.edition ? ` (edition ${info.edition})` : ''}: go through its scenarios, mark each one works or doesn’t, and comment.`
      : `You’ve been asked to review this plan: are the Given / When / Then scenarios enough? Comment on any of them${info.canAddScenarios ? ', and add the ones that are missing' : ''}.`}
      Open until ${day(info.expiresAt)}. No account needed.</p>
    <label class="bd-sheet-label" for="rvNick">What should we call you?</label>
    <input class="sheet-input" id="rvNick" maxlength="${MAX_NICKNAME}" value="${escapeHtml(nickname() || '')}" placeholder="e.g. Alex" autocomplete="nickname">
    <button class="sheet-btn" data-review-action="join">Start reviewing</button>`, 'rvNick');
}

// The header chip on a book being reviewed here
export function updateReviewChip() {
  let el = document.getElementById('rvChip');
  const r = reviewOf(getCurrentModelId());
  if (!r || document.body.classList.contains('library-mode')) { el?.remove(); return; }
  if (!el) {
    el = document.createElement('button'); el.id = 'rvChip'; el.className = 'sy-chip rv-chip';
    el.dataset.reviewAction = 'about';
    document.getElementById('modelTitle')?.after(el);
  }
  el.textContent = r.ended ? (r.purpose === 'test' ? 'Verification ended' : 'Review ended') : `${r.purpose === 'test' ? '✅ Verifying' : '👀 Reviewing'} as ${nickname() || '…'}`;
}

function aboutReview() {
  const r = reviewOf(getCurrentModelId());
  if (!r) return;
  openBoardSheet(`
    <div class="sheet-title">${r.purpose === 'test' ? 'Verifying' : 'Reviewing'} <span class="bd-sheet-sub">${escapeHtml(r.name || '')}</span></div>
    <p class="cm-note">${r.ended ? 'This review has ended: what you sent is with the owner.' : `${purposeText[r.purpose]} · ${r.canAddScenarios ? 'comments and scenarios' : 'comments'} · open until ${day(r.expiresAt)}.
      What you write goes to the owner a moment later.`}</p>
    ${r.ended ? '' : '<button class="sheet-btn" data-review-action="send">Send now</button>'}`);
}

// ---------- Taps ----------

async function onAction(a, t) {
  if (a === 'close') hideAllSheets();
  else if (a === 'open') { made = null; openReviewsSheet(t.dataset.model); }
  else if (a === 'purpose') { form.purpose = t.dataset.value; openReviewsSheet(form.modelId); }
  else if (a === 'scenarios') { form.canAddScenarios = t.dataset.value === '1'; openReviewsSheet(form.modelId); }
  else if (a === 'days') { form.days = Number(t.dataset.value); openReviewsSheet(form.modelId); }
  else if (a === 'create') {
    t.disabled = true;
    try {
      const state = projectState(readModelEvents(form.modelId));
      const r = await createReview(form.modelId, { purpose: form.purpose, canAddScenarios: form.canAddScenarios, days: form.days,
        edition: form.purpose === 'test' ? state.edition?.edition ?? null : null });
      made = r.url;
      await openReviewsSheet(form.modelId);
      showToast(await copyText(r.url, document.getElementById('rvUrl')) ? 'Link copied' : 'Link ready: copy it');
      made = null;
    } catch (e) { t.disabled = false; showToast(e.message); }
  }
  else if (a === 'copy') showToast(await copyText(t.dataset.url) ? 'Link copied' : 'Select the link and copy it');
  else if (a === 'share') navigator.share?.({ url: t.dataset.url, title: 'Review' }).catch(() => {});
  else if (a === 'revoke') {
    try { await revokeReview(form.modelId, t.dataset.review); showToast('Revoked: the link has stopped working'); drawList(await listReviews(form.modelId)); }
    catch (e) { showToast(e.message); }
  }
  else if (a === 'join') {
    if (!joining) return;
    const name = document.getElementById('rvNick')?.value;
    const why = setNickname(name);
    if (why) { showToast(why); return; }
    t.disabled = true;
    try {
      const id = await joinReview(joining.token, nickname(), joining.info);
      joining = null;
      hideAllSheets();
      openModel(id);
      window.EventPad.showOutline();
      showToast('Tap 💬 by any scenario to comment');
    } catch (e) { t.disabled = false; showToast(e.status === 410 ? 'This review has ended' : e.message); }
  }
  else if (a === 'about') aboutReview();
  else if (a === 'send') {
    try { await syncReview(getCurrentModelId()); showToast('Sent'); hideAllSheets(); }
    catch (e) { showToast(e.status === 410 ? 'This review has ended' : `Not sent: ${e.message}`); updateReviewChip(); }
  }
}

export function initReviewView() {
  document.addEventListener('eventpad:reviews', e => { made = null; openReviewsSheet(e.detail); });
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-review-action]');
    if (t) onAction(t.dataset.reviewAction, t);
  });
  openReviewFromUrl();
}
