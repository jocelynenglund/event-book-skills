// ===========================================
// LITERATURE - The point page's parts, each drawn from its piece of the Point Page view alone
// pointPin, pointNav, pointHead, pointLead, pointGap, pointPlan, pointSuggestions, pointSentencesBlock,
// pointPageHtml (the whole page; paragraphsHtml is what an agent wrote on it, from the slice page).
// Nothing here reads the book. A root carries data-component and data-key.
// ===========================================

import { paragraphRuns, commentButton, commentLines, sentenceList } from './marks.parts.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The thin title that stays at the top once the header is scrolled past
export function pointPin(page) {
  return `<div class="sp-pin" data-component="Point pin" data-key="pin" aria-hidden="true"><span class="sp-pin-title">${esc(page.title)}</span></div>`;
}

// ‹ n / N › (and 💬 next ›: the next paragraph with open comments)
export function pointNav(page) {
  return `<nav class="sp-nav" data-component="Point nav" data-key="nav">
      <button class="sp-nav-btn" data-slice-page="go" data-slice="${page.prev || ''}" ${page.prev ? '' : 'disabled'} aria-label="Previous slice">‹</button>
      <span class="sp-pos">${page.position}</span>
      ${page.talk ? `<button class="sp-nav-btn lt-next-talk" data-slice-page="go" data-slice="${page.talk}" aria-label="Next paragraph with open comments">💬 next ›</button>` : ''}
      <button class="sp-nav-btn" data-slice-page="go" data-slice="${page.next || ''}" ${page.next ? '' : 'disabled'} aria-label="Next slice">›</button>
    </nav>`;
}

// Its chapter, and Park / Unpark, Refined and 💬
export function pointHead(page) {
  const refined = `<button class="sp-tool ol-refined-pill lt-refined ${page.refined ? 'on' : ''}" data-lit-action="refined" data-slice="${page.sliceId}" aria-pressed="${page.refined}"><span class="ol-tick" aria-hidden="true"></span>Refined</button>`;
  return `
    <header class="sp-head lt-head" data-component="Point head" data-key="head">
      <div class="sp-kicker">${esc(page.kicker)}</div>
      <div class="sp-tools lt-page-tools">
        ${page.parked ? `<button class="sp-tool lt-tools" data-lit-action="unpark" data-slice="${page.sliceId}" data-page="1">↩ Unpark</button>`
          : `<button class="sp-tool lt-tools" data-lit-action="park" data-slice="${page.sliceId}" data-page="1">Park</button>${refined}`}
        ${commentButton(page.comment)}
      </div>
    </header>`;
}

// The paragraph at a comfortable measure
export function pointLead(lead) {
  return `<p class="lt-lead" data-component="Point lead" data-key="lead">${paragraphRuns(lead, true)}</p>`;
}

// The question, and (unless read only) a box to write the answer into
export function pointGap(gap) {
  const q = `<p class="lt-gap-q">${esc(gap.question)}</p>`;
  return `<div data-component="Point gap" data-key="gap">${gap.canFill ? `
      ${q}
      <textarea class="sheet-input cm-box lt-fill" id="ltFill" rows="7" aria-label="Your paragraph" placeholder="Write it here, in your own words"></textarea>
      <button class="sheet-btn lt-fill-go" data-lit-action="fill" data-slice="${gap.sliceId}">Save my paragraph</button>` : q}</div>`;
}

// A point not written yet: what the paragraph will say
export function pointPlan(plan) {
  return `<div class="lt-point-plan lt-point-page" data-component="Point plan" data-key="plan"><b>${esc(plan.title)}</b>${plan.description ? `<span>${esc(plan.description)}</span>` : ''}</div>
      <p class="lt-empty">Not written yet: this is what the paragraph will say</p>`;
}

// The suggestions on it, one by one or All in (& refine)
export function pointSuggestions(s) {
  if (!s) return '';
  return `
      <section class="lt-suggs" data-component="Point suggestions" data-key="suggestions"><h2 class="sp-h2">Suggestions <span>${s.count}</span></h2>
        <ol class="lt-sugg-list">${s.items.map(x => `
          <li class="lt-sugg"><span class="lt-sn lt-sn-num">${x.n}</span>
            <div class="lt-sugg-body"><div class="lt-sugg-change"><del class="lt-del">${esc(x.find)}</del> → ${x.replace ? `<ins class="lt-ins">${esc(x.replace)}</ins>` : '<span class="lt-cut">cut</span>'}</div>
              <div class="lt-why">${esc(x.why)}</div>
              ${s.canAct ? `<span class="lt-sugg-tools"><button class="lt-tool" data-lit-action="accept-one" data-n="${x.n}" data-slice="${s.sliceId}">Accept</button><button class="lt-tool" data-lit-action="skip-one" data-n="${x.n}" data-slice="${s.sliceId}">Skip</button></span>` : ''}</div></li>`).join('')}
        </ol>
        ${s.canAct ? `<div class="lt-sugg-all"><button class="lt-allin" data-lit-action="all-in-page" data-slice="${s.sliceId}">All in</button>
          <button class="lt-allin" data-lit-action="all-in-refine" data-slice="${s.sliceId}">All in &amp; refine</button></div>` : ''}
      </section>`;
}

// Its sentences, each with its 💬
export function pointSentencesBlock(s) {
  if (!s) return '';
  return `<h2 class="sp-h2 lt-sentences-h">Sentences <span>${s.count}</span></h2>${sentenceList(s.list)}`;
}

// The whole point page
export function pointPageHtml(page, paragraphsHtml = '') {
  const body = page.lead ? pointLead(page.lead) : page.gap ? pointGap(page.gap) : paragraphsHtml || pointPlan(page.plan);
  return `
    ${pointPin(page)}
    ${pointNav(page)}
    ${pointHead(page)}
    <article class="lt-page">
      ${body}
      ${pointSuggestions(page.suggestions)}
      ${commentLines(page.comment)}
      ${pointSentencesBlock(page.sentences)}
    </article>`;
}
