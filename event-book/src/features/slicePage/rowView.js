// ===========================================
// SLICE PAGE - The page's parts, each drawn from its piece of the Slice Page Screen alone
// slicePageNav(nav), slicePagePin(head), slicePageHead(head), slicePageParagraphs(paragraphs),
// slicePageSticky(sticky), slicePageFlow(stickies), slicePageScenario(scenario),
// slicePageScenarios(scenarios), slicePageConversation(conversation). Nothing here reads the book.
// A root carries data-component and data-key; the controls inside belong to it.
// ===========================================

import { pendingMark } from '../scenarios/view.js';
import { waivedMark } from '../scenarioWaiver/view.js';
import { usageLineHtml, usageChipHtml } from '../usage/view.js';
import { specTrailHtml } from '../specs/specs.parts.js';
import { conversationView } from '../comments/comments.parts.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const external = el => `${el.external ? ' data-external="true"' : ''}${el.table ? ' data-table="true"' : ''}${el.published && !el.external ? ' data-published="true"' : ''}`;

// ‹ n / N ›
export function slicePageNav(nav) {
  return `<nav class="sp-nav" data-component="Slice page nav" data-key="nav">
      <button class="sp-nav-btn" data-slice-page="go" data-slice="${nav.prev || ''}" ${nav.prev ? '' : 'disabled'} aria-label="Previous slice">‹</button>
      <span class="sp-pos">${nav.n} / ${nav.of}</span>
      <button class="sp-nav-btn" data-slice-page="go" data-slice="${nav.next || ''}" ${nav.next ? '' : 'disabled'} aria-label="Next slice">›</button>
    </nav>`;
}

// The thin title that stays at the top once the header is scrolled past
export function slicePagePin(head) {
  return `<div class="sp-pin" data-component="Slice page pin" data-key="pin" data-slice-type="${head.type}" data-actor="${head.actor}" aria-hidden="true"><span class="sp-pin-title">${escapeHtml(head.title)}</span></div>`;
}

const kickerOf = k => `${k.ref ? `<span class="sp-num" title="Its number for an agent">${k.ref}</span> · ` : ''}${k.type}${k.chapter ? ` · ${escapeHtml(k.chapter)}` : ''}${k.flow ? ` · ↳ ${escapeHtml(k.flow)}` : ''}`;

// The description's text, "Code: path:line" a link when it has one
const descriptionOf = parts => parts.map(p => p.url
  ? `${p.pre}<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.file)}${p.line ? `:${p.line}` : ''}</a>`
  : escapeHtml(p.text)).join('');

// Kicker, title, usage, spec trail, description and the buttons
export function slicePageHead(head) {
  const button = b => `<button class="sp-tool" data-slice-page="${b.action}" data-slice="${head.sliceId}"${b.pressed === undefined ? '' : ` aria-pressed="${b.pressed}"`}>${escapeHtml(b.label)}</button>`;
  return `<header class="sp-head" data-component="Slice page head" data-key="head" data-slice-type="${head.type}" data-actor="${head.actor}">
      <div class="sp-kicker">${kickerOf(head.kicker)}</div>
      <h1 class="sp-title">${escapeHtml(head.title)}</h1>
      ${usageLineHtml(head.usage)}
      ${specTrailHtml(head.specTrail)}
      ${waivedMark({ waived: head.waived })}
      ${head.description ? `<p class="sp-desc">${descriptionOf(head.description)}</p>` : ''}
      <div class="sp-tools">${head.buttons.map(button).join('\n        ')}</div>
    </header>`;
}

// An article's paragraphs, each tap to edit, ＋ Paragraph when it may add
export function slicePageParagraphs(p) {
  return `<section class="sp-section sp-paras" data-component="Slice page paragraphs" data-key="paragraphs">
      <h2 class="sp-h2">Paragraphs <span>${p.items.length}</span></h2>
      ${p.items.map(x => `<button class="sp-para" data-slice-page="para" data-para="${x.id}" data-text="${escapeHtml(x.text)}" data-slice="${p.sliceId}">${escapeHtml(x.text)}${x.by ? `<span class="sp-para-by">${escapeHtml(x.by)}</span>` : ''}</button>`).join('')}
      ${p.canAdd ? `<button class="sp-add" data-slice-page="para-add" data-slice="${p.sliceId}">＋ Paragraph</button>` : ''}
    </section>`;
}

// One sticky: its kind (and an event's usage), name and fields
export function slicePageSticky(s) {
  return `
    <button class="sp-sticky" data-component="Slice page sticky" data-key="${s.id}" data-type="${s.type}"${external(s)} data-slice-page="element" data-el="${s.id}" data-slice="${s.sliceId}">
      <span class="sp-sticky-kind">${escapeHtml(s.kind)}${usageChipHtml(s.used)}</span>
      <span class="sp-sticky-name">${escapeHtml(s.name)}</span>
      ${s.to ? `<span class="sp-sticky-to">→ ${escapeHtml(s.to)}</span>` : ''}
      ${s.fields.length ? `<span class="sp-props">${s.fields.map(f => `
        <span class="sp-prop"><span>${escapeHtml(f.label)}</span><i>${escapeHtml(f.type)}</i></span>`).join('')}</span>` : ''}
    </button>`;
}

// The stickies in the order data flows, an arrow between
export function slicePageFlow(stickies) {
  return `<section class="sp-section" data-component="Slice page flow" data-key="flow">
      <div class="sp-flow">${stickies.length ? stickies.map(slicePageSticky).join('<span class="sp-arrow" aria-hidden="true">↓</span>') : '<div class="sp-none">No stickies yet</div>'}</div>
    </section>`;
}

const show = v => (typeof v === 'string' ? v : JSON.stringify(v));

// A list read model's rows as a table, one column per field
function rowsHtml(rows) {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r || {})))];
  if (!cols.length) return '';
  // Wide rows don't fit a phone as a table: each row as its own short list instead
  if (cols.length > 3) {
    return rows.map((r, i) => `<div class="sp-record"><div class="sp-record-n">Row ${i + 1}</div>
      <dl class="sp-vals">${Object.entries(r || {}).map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(show(v))}</dd>`).join('')}</dl></div>`).join('');
  }
  return `<div class="sp-table-wrap"><table class="sp-table">
    <thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map(c => `<td>${r?.[c] === undefined ? '' : escapeHtml(show(r[c]))}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

// key / value rows; nothing when there are no values
function valuesHtml(values) {
  if (!values.length) return '';
  return `<dl class="sp-vals">${values.map(v => {
    if (v.alias) return `<dt>${escapeHtml(v.key)}</dt><dd><span class="gwt-id">${escapeHtml(v.text)}</span></dd>`;
    return v.rows
      ? `<dt class="sp-wide">${escapeHtml(v.key)} <i>${v.rows.length} ${v.rows.length === 1 ? 'row' : 'rows'}</i></dt><dd class="sp-wide">${rowsHtml(v.rows)}</dd>`
      : `<dt>${escapeHtml(v.key)}</dt><dd>${escapeHtml(v.text)}</dd>`;
  }).join('')}</dl>`;
}

function refHtml(r) {
  if (r.removed) return '<div class="sp-ref sp-missing">(removed)</div>';
  return `<div class="sp-ref" data-type="${r.type}"${external(r)}><span class="sp-ref-name"><span class="sp-dot" aria-hidden="true"></span>${escapeHtml(r.name)}<span class="sp-ref-kind">${escapeHtml(r.kind)}</span>${r.to ? `<span class="sp-ref-to">→ ${escapeHtml(r.to)}</span>` : ''}</span>${valuesHtml(r.values)}</div>`;
}

// One scenario: its name (tap to edit), source, and the Given / When / Then steps
export function slicePageScenario(scn) {
  const step = (kw, body) => `<div class="sp-step"><div class="sp-kw">${kw}</div><div class="sp-step-body">${body}</div></div>`;
  const given = scn.given.length ? scn.given.map(refHtml).join('') : '<div class="sp-none">Nothing happened yet</div>';
  const t = scn.then;
  let then = '<div class="sp-none">Not set</div>';
  if (t.kind === 'event') then = refHtml(t.ref);
  else if (t.kind === 'rejection') then = `<div class="sp-reject"><b>Refused</b> ${escapeHtml(t.reason)}</div>`;
  else if (t.kind === 'readModel') then = refHtml(t.ref) + (t.rows ? rowsHtml(t.rows) : '');
  const src = scn.source ? (scn.source.url
    ? `<a class="sp-src" href="${escapeHtml(scn.source.url)}" target="_blank" rel="noopener">📄 ${escapeHtml(scn.source.label)}</a>`
    : `<span class="sp-src">📄 ${escapeHtml(scn.source.label)}</span>`) : '';
  return `
    <article class="sp-scn" data-component="Slice page scenario" data-key="${scn.id}">
      <button class="sp-scn-head" data-slice-page="scenario" data-scenario="${scn.id}">
        <span class="sp-scn-name">${scn.mustHave ? '<span class="must-star" title="Must have">★</span> ' : ''}${escapeHtml(scn.name)}${pendingMark({ pending: scn.pending })}</span><span class="sp-edit">Edit</span>
      </button>
      ${src}
      ${step('Given', given)}
      ${scn.when ? step('When', refHtml(scn.when)) : ''}
      ${step('Then', then)}
    </article>`;
}

// The scenarios section: the cards, and ＋ Add scenario
export function slicePageScenarios(sc) {
  return `<section class="sp-section" data-component="Slice page scenarios" data-key="scenarios">
      <h2 class="sp-h2">Scenarios <span>${sc.items.length}</span></h2>
      ${sc.items.map(slicePageScenario).join('')}
      <button class="sp-add" data-slice-page="add-scenario" data-slice="${sc.sliceId}" data-slice-type="${sc.type}">＋ Add scenario</button>
    </section>`;
}

// The conversation under the scenarios: its threads, reply, resolve and the new-thread box
export const slicePageConversation = c => conversationView(c);
