// ===========================================
// SLICE PAGE - One slice with room to breathe (SV: View Slice)
// Its stickies with their properties, in the order data flows, then each
// Given / When / Then scenario with its values as rows. ‹ › (or a swipe)
// steps to the neighbouring slices.
// ===========================================

import { projectState, getOrderedSlices, getScenariosForSlice, sliceTitle, sliceFlow } from '../../core/projections.js';
import { elementLabel, externalAttr, propLabel } from '../../core/constants.js';
import { filled } from '../scenarios/view.js';
import { idsHidden, setIdsHidden, aliaser, shownEntries, scenarioHasIds } from '../scenarios/ids.js';
import { sourceUrl, sourceLabel } from '../../core/source.js';
import { escapeHtml, sliceTypeLabels } from '../board/view.js';
import { sliceUsageLine, eventUsageChip } from '../usage/view.js';
import { laneOf, sliceActor } from '../board/command.js';
import { openElementMenu } from '../elementMenu/sheet.js';
import { openSliceMenu } from '../board/sheets/sliceMenu.js';
import { openShareSheet } from '../shareImage/sheet.js';

// A change reads top-down (screen → command → event); a view the other way (events → read model → screen)
function inFlowOrder(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const lanes = slice.type === 'SV' ? [2, 1, 0] : [0, 1, 2];
  return lanes.flatMap(l => els.filter(e => laneOf[e.type] === l));
}

// "Code: path:line" in a description becomes a link when the model knows its repo
function linkCode(text, state) {
  return escapeHtml(text).replace(/(Code: )([^\s:]+)(?::(\d+))?/g, (m, pre, file, line) => {
    const url = sourceUrl(state, file, line);
    return url ? `${pre}<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${file}${line ? `:${line}` : ''}</a>` : m;
  });
}

function renderSticky(el, sliceId, state) {
  return `
    <button class="sp-sticky" data-type="${el.type}"${externalAttr(el)} data-slice-page="element" data-el="${el.id}" data-slice="${sliceId}">
      <span class="sp-sticky-kind">${escapeHtml(elementLabel(el))}${eventUsageChip(el, state)}</span>
      <span class="sp-sticky-name">${escapeHtml(el.name)}</span>
      ${el.properties?.length ? `<span class="sp-props">${el.properties.map(p => `
        <span class="sp-prop"><span>${escapeHtml(propLabel(p))}</span><i>${escapeHtml(p.type || 'string')}</i></span>`).join('')}</span>` : ''}
    </button>`;
}

const show = v => (typeof v === 'string' ? v : JSON.stringify(v));

// Values often arrive as JSON text (from tests): a list of rows reads better as a table
function parsed(v) {
  if (typeof v !== 'string' || !/^\s*[\[{]/.test(v)) return v;
  try { return JSON.parse(v); } catch (e) { return v; }
}
const isRows = v => Array.isArray(v) && v.length > 0 && v.every(r => r && typeof r === 'object' && !Array.isArray(r));

// key / value rows; nothing when there are no values
// Ids are aliases (#1, #2: the same alias for the same value in a scenario), or left out
let alias = aliaser(), hideIds = false;
function renderValues(values, el = null) {
  const entries = shownEntries(Object.entries(values || {}).filter(([, v]) => filled(parsed(v))), el, alias, hideIds);
  if (!entries.length) return '';
  return `<dl class="sp-vals">${entries.map(([k, v, isAlias]) => {
    if (isAlias) return `<dt>${escapeHtml(k)}</dt><dd><span class="gwt-id">${escapeHtml(v)}</span></dd>`;
    const p = parsed(v);
    return isRows(p)
      ? `<dt class="sp-wide">${escapeHtml(k)} <i>${p.length} ${p.length === 1 ? 'row' : 'rows'}</i></dt><dd class="sp-wide">${renderRows(p)}</dd>`
      : `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(show(p))}</dd>`;
  }).join('')}</dl>`;
}

function renderRef(el, values) {
  if (!el) return '<div class="sp-ref sp-missing">(removed)</div>';
  return `<div class="sp-ref" data-type="${el.type}"${externalAttr(el)}><span class="sp-ref-name"><span class="sp-dot" aria-hidden="true"></span>${escapeHtml(el.name)}<span class="sp-ref-kind">${escapeHtml(elementLabel(el))}</span></span>${renderValues(values, el)}</div>`;
}

// A list read model's rows as a table, one column per field
function renderRows(rows) {
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

function renderScenario(scn, state) {
  alias = aliaser(); hideIds = idsHidden();
  const step = (kw, body) => `<div class="sp-step"><div class="sp-kw">${kw}</div><div class="sp-step-body">${body}</div></div>`;
  const given = scn.given?.length
    ? scn.given.map(g => renderRef(state.elements[g.elementId], g.values)).join('')
    : '<div class="sp-none">Nothing happened yet</div>';
  const t = scn.then;
  let then = '<div class="sp-none">Not set</div>';
  if (t?.type === 'event') then = renderRef(state.elements[t.eventId], t.values);
  else if (t?.type === 'rejection') then = `<div class="sp-reject"><b>Refused</b> ${escapeHtml(t.reason || '')}</div>`;
  else if (t?.type === 'readModel') then = renderRef(state.elements[t.readModelId], t.rows?.length ? null : t.values) + (t.rows?.length ? renderRows(t.rows) : '');
  return `
    <article class="sp-scn">
      <button class="sp-scn-head" data-slice-page="scenario" data-scenario="${scn.id}">
        <span class="sp-scn-name">${scn.mustHave ? '<span class="must-star" title="Must have">★</span> ' : ''}${escapeHtml(scn.name)}</span><span class="sp-edit">Edit</span>
      </button>
      ${scn.source?.file ? (() => {
        const url = sourceUrl(state, scn.source.file, scn.source.line);
        return url ? `<a class="sp-src" href="${escapeHtml(url)}" target="_blank" rel="noopener">📄 ${escapeHtml(sourceLabel(scn.source))}</a>`
          : `<span class="sp-src">📄 ${escapeHtml(sourceLabel(scn.source))}</span>`;
      })() : ''}
      ${step('Given', given)}
      ${scn.when?.commandId ? step('When', renderRef(state.elements[scn.when.commandId], scn.when.values)) : ''}
      ${step('Then', then)}
    </article>`;
}

// A page turn in progress: the direction ('next' | 'prev') and the slice it turns from
let turn = null;

export function renderSlicePage(sliceId) {
  const root = document.getElementById('sliceView');
  if (!root) return;
  const turning = turn && turn.from !== sliceId ? turn : null;
  turn = null;
  const state = projectState();
  const slice = state.slices[sliceId];
  const order = getOrderedSlices(state);
  if (!slice) { root.innerHTML = '<p class="sp-none sp-gone">This slice was deleted.</p>'; return; }
  const at = order.findIndex(s => s.id === sliceId);
  const prev = order[at - 1], next = order[at + 1];
  const chapter = state.chapters[slice.chapterId];
  const flow = sliceFlow(slice, state);
  // Must haves (acceptance criteria) first, then the nice to haves
  const scenarios = [...getScenariosForSlice(sliceId, state)].sort((a, b) => !!b.mustHave - !!a.mustHave);
  const stickies = inFlowOrder(slice, state);

  root.innerHTML = `
    <div class="sp-pin" data-slice-type="${slice.type}" data-actor="${sliceActor(slice, state)}" aria-hidden="true"><span class="sp-pin-title">${escapeHtml(sliceTitle(slice, state))}</span></div>
    <nav class="sp-nav">
      <button class="sp-nav-btn" data-slice-page="go" data-slice="${prev?.id || ''}" ${prev ? '' : 'disabled'} aria-label="Previous slice">‹</button>
      <span class="sp-pos">${at + 1} / ${order.length}</span>
      <button class="sp-nav-btn" data-slice-page="go" data-slice="${next?.id || ''}" ${next ? '' : 'disabled'} aria-label="Next slice">›</button>
    </nav>
    <header class="sp-head" data-slice-type="${slice.type}" data-actor="${sliceActor(slice, state)}">
      <div class="sp-kicker">${sliceTypeLabels[slice.type] || slice.type}${chapter ? ` · ${escapeHtml(chapter.name)}` : ''}${flow ? ` · ↳ ${escapeHtml(flow.name)}` : ''}</div>
      <h1 class="sp-title">${escapeHtml(sliceTitle(slice, state))}</h1>
      ${sliceUsageLine(slice, state)}
      ${slice.description ? `<p class="sp-desc">${linkCode(slice.description, state)}</p>` : ''}
      <div class="sp-tools">
        <button class="sp-tool" data-slice-page="menu" data-slice="${slice.id}">Edit slice</button>
        <button class="sp-tool" data-slice-page="board" data-slice="${slice.id}">↗ On the board</button>
        <button class="sp-tool" data-slice-page="share" data-slice="${slice.id}">Share…</button>
        ${scenarios.some(s => scenarioHasIds(s, state)) ? `<button class="sp-tool" data-slice-page="ids" data-slice="${slice.id}" aria-pressed="${idsHidden()}">${idsHidden() ? 'Show ids' : 'Hide ids'}</button>` : ''}
      </div>
    </header>
    <section class="sp-section">
      <div class="sp-flow">${stickies.length ? stickies.map(el => renderSticky(el, slice.id, state)).join('<span class="sp-arrow" aria-hidden="true">↓</span>') : '<div class="sp-none">No stickies yet</div>'}</div>
    </section>
    <section class="sp-section">
      <h2 class="sp-h2">Scenarios <span>${scenarios.length}</span></h2>
      ${scenarios.map(scn => renderScenario(scn, state)).join('')}
      <button class="sp-add" data-slice-page="add-scenario" data-slice="${slice.id}">＋ Add scenario</button>
    </section>`;
  if (turning) {
    // The page comes in from the side it was turned to; into another chapter, its name shows as it turns
    root.classList.remove('sp-turn-next', 'sp-turn-prev');
    void root.offsetWidth;
    root.classList.add(`sp-turn-${turning.dir}`);
    const from = state.slices[turning.from];
    if (from && from.chapterId !== slice.chapterId) {
      root.insertAdjacentHTML('afterbegin', `<div class="sp-turn-chapter" aria-hidden="true">${chapter ? escapeHtml(chapter.name) : 'Not in a chapter'}</div>`);
    }
  }
  pinTitle(root);
}

// Scrolled past the slice's header, its title stays at the top as a thin line
let pinWatch = null;
function pinTitle(root) {
  pinWatch?.disconnect();
  const head = root.querySelector('.sp-head');
  if (!head || !('IntersectionObserver' in window)) return;
  const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-h')) || 56;
  pinWatch = new IntersectionObserver(([e]) => root.classList.toggle('sp-pinned', !e.isIntersecting && e.boundingClientRect.top < top),
    { rootMargin: `-${top}px 0px 0px 0px` });
  pinWatch.observe(head);
}

// Clicks and swipes; the feed decides which slice is shown (go → showSlicePage)
export function initSlicePage({ showSlicePage, showSliceOnBoard }) {
  const root = document.getElementById('sliceView');
  if (!root) return;
  // Turn to the next or previous slice in the book's order (across chapters)
  const turnPage = dir => {
    const btn = root.querySelector(`.sp-nav-btn[aria-label="${dir === 'next' ? 'Next' : 'Previous'} slice"]`);
    if (!btn || btn.disabled || !btn.dataset.slice) return;
    turn = { dir, from: root.querySelector('.sp-tools [data-slice]')?.dataset.slice || null };
    showSlicePage(btn.dataset.slice);
  };
  root.addEventListener('click', e => {
    const t = e.target.closest('[data-slice-page]');
    if (!t || t.disabled) return;
    const a = t.dataset.slicePage, id = t.dataset.slice;
    if (a === 'go' && id) turnPage(t.getAttribute('aria-label') === 'Next slice' ? 'next' : 'prev');
    else if (a === 'element') openElementMenu(t.dataset.el, id);
    else if (a === 'scenario') window.EventPad.editScenario(t.dataset.scenario);
    else if (a === 'add-scenario') { const s = projectState().slices[id]; if (s) window.EventPad.addScenario(s.id, s.type); }
    else if (a === 'menu') openSliceMenu(id);
    else if (a === 'board') showSliceOnBoard(id);
    else if (a === 'share') openShareSheet(null, { sliceId: id });
    else if (a === 'ids') { setIdsHidden(!idsHidden()); showSlicePage(id); }
  });
  // A clearly sideways swipe turns the page: left for the next slice, right for the previous.
  // Not while scrolling a wide table, and never on a pinch or while zoomed in.
  let start = null;
  const zoomed = () => (window.visualViewport?.scale || 1) > 1.01;
  root.addEventListener('touchstart', e => {
    start = e.target.closest('.sp-table-wrap') || e.touches.length > 1 || zoomed() ? null
      : { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  root.addEventListener('touchmove', e => { if (e.touches.length > 1) start = null; }, { passive: true });
  root.addEventListener('touchend', e => {
    if (!start || e.touches.length) { if (e.touches.length) start = null; return; }
    const dx = e.changedTouches[0].clientX - start.x, dy = e.changedTouches[0].clientY - start.y;
    start = null;
    if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy) || zoomed()) return;
    turnPage(dx < 0 ? 'next' : 'prev');
  }, { passive: true });
  // Arrow keys turn the page on a keyboard (not while typing or with a sheet open)
  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || !root.getClientRects().length) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (document.querySelector('.sheet.active, .bottom-sheet.active, .sheet-overlay.active')) return;
    e.preventDefault();
    turnPage(e.key === 'ArrowRight' ? 'next' : 'prev');
  });
}
