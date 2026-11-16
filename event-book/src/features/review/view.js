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
import { getCurrentModelId, openModel } from '../../core/eventStore.js';
import { nickname, setNickname } from '../comments/command.js';
import { reviewLinkForm } from './reviewLinkForm.read.js';
import { reviewLinkList } from './reviewLinkList.read.js';
import { reviewJoinOffer } from './reviewJoinOffer.read.js';
import { reviewAboutLink } from './reviewAboutLink.read.js';
import { reviewChoice, reviewMade, reviewLinkRow, reviewJoinForm, reviewAbout } from './review.parts.js';
import { createReview, listReviews, revokeReview, peekReview, joinReview, bookForToken, reviewOf, syncReview } from './client.js';

let form = { modelId: null, purpose: 'feedback', canAddScenarios: true, days: 14 };
let made = null;   // the link just made: shown once, to copy or share

// ---------- The owner ----------

export async function openReviewsSheet(modelId) {
  form = { ...form, modelId };
  const v = reviewLinkForm(modelId, form);
  form.purpose = v.purpose;
  openBoardSheet(`
    <div class="sheet-title">Review &amp; verify <span class="bd-sheet-sub">${escapeHtml(v.name)}</span></div>
    <p class="cm-note">A link for someone without an account. They pick a nickname and comment${v.addsScenarios ? ' and add scenarios' : ''}; it all lands in this book. It ends on the day you pick, or when you revoke it.</p>
    ${made ? reviewMade({ url: made, canShare: !!navigator.share }) : `
    <div class="bd-sheet-label">For</div>
    <div class="cm-parts">${v.purposes.map(reviewChoice).join('')}</div>
    <div class="bd-sheet-label">They can</div>
    <div class="cm-parts">${v.scenarios.map(reviewChoice).join('')}</div>
    <div class="bd-sheet-label">For how long</div>
    <div class="cm-parts">${v.days.map(reviewChoice).join('')}</div>
    <button class="sheet-btn" data-review-action="create">Make the link</button>`}
    <div class="bd-sheet-label">Links</div>
    <div id="rvList" class="rv-list"><p class="cm-note">Loading…</p></div>`);
  try { drawList(await listReviews(modelId)); }
  catch (e) { const el = document.getElementById('rvList'); if (el) el.innerHTML = `<p class="cm-note">${escapeHtml(e.message)}</p>`; }
}

function drawList(reviews) {
  const el = document.getElementById('rvList');
  if (!el) return;
  el.innerHTML = reviews.length ? reviewLinkList(reviews).map(reviewLinkRow).join('') : '<p class="cm-note">No review links yet.</p>';
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
  openBoardSheet(reviewJoinForm(reviewJoinOffer(info, nickname())), 'rvNick');
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
  openBoardSheet(reviewAbout(reviewAboutLink(r)));
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
      const r = await createReview(form.modelId, { purpose: form.purpose, canAddScenarios: form.canAddScenarios, days: form.days,
        edition: form.purpose === 'test' ? reviewLinkForm(form.modelId, form).edition : null });
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
