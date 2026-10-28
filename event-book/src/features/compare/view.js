// ===========================================
// COMPARE - The "Plan vs built" page, and choosing what to compare with
// ===========================================

import { projectState } from '../../core/projections.js';
import { listModels, readModelEvents, getCurrentModelId, openModel, canEditCurrent } from '../../core/eventStore.js';
import { compareModels } from './diff.js';
import { doneToConfirm, confirmSlicesDone, keepSlicesPlanned, matchSlices, keepSlicesApart } from './command.js';
import { publishEdition } from '../editions/command.js';
import { ordinal } from '../editions/rules.js';
import { showToast } from '../../ui/toast.js';
import { sourceSummary } from '../../core/source.js';
import { escapeHtml } from '../board/view.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';

const PAIR_KEY = 'eventpad_compare_pairs';   // plan model id → built model id, per device
const pairs = () => { try { return JSON.parse(localStorage.getItem(PAIR_KEY) || '{}'); } catch (e) { return {}; } };
export function rememberPair(planId, builtId) {
  try { localStorage.setItem(PAIR_KEY, JSON.stringify({ ...pairs(), [planId]: builtId })); } catch (e) { /* just this time */ }
}
export const pairedWith = planId => pairs()[planId] || null;
const nameOf = id => projectState(readModelEvents(id)).modelName || 'Untitled model';

let filter = 'all';
let current = null;   // { planId, builtId }

const kind = { SC: 'Change', SV: 'View', AU: 'Automation' };

function rowIssues(r) {
  return {
    gwt: r.scenarios.some(x => x.mismatches.length || (x.mustHave && !x.tested)),
    fields: r.fields.missing.length + r.fields.extra.length > 0
  };
}
const shows = r => filter === 'all' ? true
  : filter === 'missing' ? r.status === 'missing'
  : filter === 'new' ? r.status === 'new'
  : filter === 'maybe' ? r.status === 'maybe'
  : filter === 'gwt' ? rowIssues(r).gwt
  : filter === 'fields' ? rowIssues(r).fields : true;

// Two shelves, A (this one) and B (the other): named, so it reads for any pair, a plan and
// what was built, two releases, or two ideas
let names = { a: 'A', b: 'B' };
const only = side => `only in ${escapeHtml(names[side])}`;

// A possible rename: the same slice under another name? Answered on the open shelf (the
// left), so only there and when it's editable
const canDecide = () => current && getCurrentModelId() === current.planId && canEditCurrent();
function renderMaybe(r) {
  const ok = canDecide();
  const data = `data-slice="${escapeHtml(r.plan.id)}" data-other-shelf="${escapeHtml(r.otherShelf)}" data-other-name="${escapeHtml(r.otherSliceName)}"`;
  return `
    <p class="cp-note cp-maybe-note">Maybe renamed: <b>${escapeHtml(r.renamed.from)}</b> → <b>${escapeHtml(r.renamed.to)}</b>${r.builtChapter && r.builtChapter !== r.chapter ? ` <span>(in ${escapeHtml(r.builtChapter)})</span>` : ''}</p>
    <div class="cp-scns">${line('−', escapeHtml(r.renamed.from))}${line('+', escapeHtml(r.renamed.to))}</div>
    <div class="cp-maybe-actions">
      <button class="cp-maybe-btn same" data-compare-action="same" ${data} ${ok ? '' : 'disabled'}>Same slice</button>
      <button class="cp-maybe-btn" data-compare-action="apart" ${data} ${ok ? '' : 'disabled'}>Different</button>
    </div>
    ${ok ? '' : `<p class="cp-note">${escapeHtml(names.a)} is read-only here: an answer can't be recorded.</p>`}`;
}

// A differing scenario part as a diff, one a line: what both have in plain, what only A has (−)
// and what only B has (+), kept in order (longest common run of events)
const same = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function lineDiff(a, b) {
  const n = a.length, m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    lcs[i][j] = same(a[i]) === same(b[j]) ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (same(a[i]) === same(b[j])) { out.push({ t: '=', v: a[i] }); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ t: '−', v: a[i++] });
    else out.push({ t: '+', v: b[j++] });
  }
  while (i < n) out.push({ t: '−', v: a[i++] });
  while (j < m) out.push({ t: '+', v: b[j++] });
  return out;
}
const items = s => (!s || s === 'nothing') ? [] : String(s).split(', ');

function renderMismatch(m) {
  const lines = m.part === 'Given' ? lineDiff(items(m.planned), items(m.built))
    : [...(m.planned ? [{ t: '−', v: m.planned }] : []), ...(m.built && m.built !== 'nothing' ? [{ t: '+', v: m.built }] : [{ t: '+', v: 'nothing', none: true }])];
  const cls = { '=': '', '−': 'minus', '+': 'plus' };
  return `<div class="cp-diff">
    <div class="cp-diff-part"><b>${m.part}</b></div>
    <ul class="cp-diff-lines">${lines.map(l => `<li class="${cls[l.t]}${l.none ? ' none' : ''}"><i>${l.t === '=' ? '' : l.t}</i>${escapeHtml(l.v)}</li>`).join('')}</ul>
  </div>`;
}

// A line of the compare, as the outline reads: − only on the left (planned, not built),
// + only on the right, nothing for what both have. Muted red and green, no other marks.
const mark = t => t === '−' ? 'minus' : t === '+' ? 'plus' : '';
const line = (t, html, extra = '') => `<div class="cp-line ${mark(t)}${extra}"><i>${t === '=' ? '' : t}</i><span>${html}</span></div>`;
const star = x => x.mustHave ? '★' : '☆';

function renderRow(r) {
  const parts = [];
  if (r.status === 'maybe') parts.push(renderMaybe(r));
  else if (r.renamed) parts.push(`<p class="cp-note">Renamed in ${escapeHtml(names.b)}: ${escapeHtml(r.renamed.to)}.</p>`);
  if (r.status !== 'maybe' && r.builtChapter && r.chapter && r.builtChapter !== r.chapter) parts.push(`<p class="cp-note">In another chapter in ${escapeHtml(names.b)}: ${escapeHtml(r.builtChapter)}.</p>`);
  // Its scenarios: the ones in both plain, the ones only on the left −, a differing one with its lines
  const scn = r.status === 'new' ? [] : r.scenarios.filter(x => x.mustHave || !x.tested || x.mismatches.length);
  if (scn.length) parts.push(`<div class="cp-scns">${scn.map(x => `
    <div class="cp-scn ${!x.tested ? 'minus' : x.mismatches.length ? 'differs' : ''}">
      ${line(x.tested ? '=' : '−', `${star(x)} ${escapeHtml(x.name)}`)}
      ${x.mismatches.map(renderMismatch).join('')}
    </div>`).join('')}</div>`);
  // Only on the right: folded (what was built beyond the plan)
  if (r.status !== 'new' && r.extraTests.length) parts.push(`<details class="cp-extra plus"><summary>+ ${r.extraTests.length} ${r.extraTests.length === 1 ? 'scenario' : 'scenarios'} ${only('b')}</summary>
    ${r.extraTests.map(t => line('+', escapeHtml(t))).join('')}</details>`);
  if (r.status === 'new' && r.extraTests.length) parts.push(r.extraTests.map(t => line('+', escapeHtml(t))).join(''));
  if (r.fields.missing.length) parts.push(`<p class="cp-fields minus"><span class="cp-tag">− fields ${only('a')}</span>${r.fields.missing.map(f => `<code>${escapeHtml(f)}</code>`).join(' ')}</p>`);
  if (r.fields.extra.length) parts.push(`<p class="cp-fields plus"><span class="cp-tag">+ fields ${only('b')}</span>${r.fields.extra.map(f => `<code>${escapeHtml(f)}</code>`).join(' ')}</p>`);
  const sign = r.status === 'missing' ? '−' : r.status === 'new' ? '+' : '';
  return `
    <article class="cp-row ${mark(sign)}" data-status="${r.status}">
      <div class="cp-head"><i class="cp-sign">${sign}</i><span class="cp-dot" data-slice-type="${r.type}"></span>
        <span class="cp-title">${escapeHtml(r.title)}</span><span class="cp-kind">${kind[r.type] || ''}</span></div>
      ${parts.join('')}
    </article>`;
}

export function renderCompare() {
  const root = document.getElementById('compareView');
  if (!root || !current) return;
  const plan = projectState(readModelEvents(current.planId));
  const built = projectState(readModelEvents(current.builtId));
  const { rows, summary: s } = compareModels(plan, built);
  names = { a: plan.modelName || 'Untitled model', b: built.modelName || 'Untitled model' };
  // Same name (a plan and its tests): tell them apart by which is which
  if (names.a === names.b) names = { a: `${names.a} (this one)`, b: `${names.b} (the other)` };
  const chip = (key, text, n) => `<button class="cp-chip ${filter === key ? 'on' : ''}" data-compare-filter="${key}" ${n === 0 && key !== 'all' ? 'disabled' : ''}>${text}</button>`;
  const gwt = rows.filter(r => rowIssues(r).gwt).length;
  const chapters = [...new Set(rows.map(r => r.chapter))];
  const sections = chapters.map(ch => {
    const list = rows.filter(r => r.chapter === ch && shows(r));
    if (!list.length) return '';
    // Slices only on the right are scope creep: folded at the chapter's end (open when filtered to them)
    const kept = list.filter(r => r.status !== 'new'), extra = list.filter(r => r.status === 'new');
    const creep = extra.length ? `<details class="cp-new plus"${filter === 'new' ? ' open' : ''}><summary>+ ${extra.length} ${extra.length === 1 ? 'slice' : 'slices'} ${only('b')}</summary>${extra.map(renderRow).join('')}</details>` : '';
    return `<section class="cp-section"><h2 class="cp-ch">${escapeHtml(ch || 'Not in a chapter')}</h2>${kept.map(renderRow).join('')}${creep}</section>`;
  }).join('');
  root.innerHTML = `
    <header class="cp-header">
      <div class="sp-kicker">Compare</div>
      <h1 class="cp-h1">${escapeHtml(plan.modelName || 'Untitled model')} <span>↔</span> ${escapeHtml(built.modelName || 'Untitled model')}</h1>
      <p class="cp-sum">${s.built} of ${s.planned} slices are in both${s.maybe ? ` · ${s.maybe} maybe renamed` : ''}${s.mustHaves ? ` · ${s.mustHavesTested} of ${s.mustHaves} ★ must haves are in both` : ''}</p>
      <div class="cp-chips">
        ${chip('all', 'All', 1)}
        ${s.maybe ? chip('maybe', `${s.maybe} maybe renamed`, s.maybe) : ''}
        ${chip('missing', `− ${s.missing} ${only('a')}`, s.missing)}
        ${chip('new', `+ ${s.new} ${only('b')}`, s.new)}
        ${chip('gwt', `${gwt} with Given/When/Then differences`, gwt)}
        ${chip('fields', `${s.fieldDiffs} ${s.fieldDiffs === 1 ? 'field' : 'fields'}`, s.fieldDiffs)}
      </div>
      ${renderConfirmDone(plan, built)}
      <button class="cp-change" data-compare-action="change">Compare with another book…</button>
    </header>
    ${sections || '<p class="cp-note cp-empty">Nothing here.</p>'}`;
}

export function initCompare({ showCompare }) {
  const root = document.getElementById('compareView');
  root?.addEventListener('click', e => {
    const f = e.target.closest('[data-compare-filter]');
    if (f && !f.disabled) { filter = f.dataset.compareFilter === filter ? 'all' : f.dataset.compareFilter; renderCompare(); return; }
    if (e.target.closest('[data-compare-action=change]') && current) openComparePicker(current.planId, showCompare);
    if (e.target.closest('[data-compare-action=confirm-done]') && current) confirmDone();
    if (e.target.closest('[data-compare-action=keep-planned]') && current) keepPlanned();
    const d = e.target.closest('[data-compare-action=same], [data-compare-action=apart]');
    if (d && !d.disabled && current) decideRename(d);
  });
  document.getElementById('boardSheetContent')?.addEventListener('click', e => {
    // After importing a test export: pick its plan (the left side) from the other shelves
    const other = e.target.closest('[data-compare-pick-plan]');
    if (other) { openComparePicker(null, showCompare, { builtId: other.dataset.comparePickPlan }); return; }
    const t = e.target.closest('[data-compare-with]');
    if (!t) return;
    rememberPair(t.dataset.plan, t.dataset.compareWith);
    hideAllSheets();
    // The left side is always the open board: open it if it isn't (after an import, the plan)
    if (getCurrentModelId() !== t.dataset.plan) openModel(t.dataset.plan);
    showCompare(t.dataset.plan, t.dataset.compareWith);
  });
}

// Done is recorded, never assumed: when the other shelf was built from the tests (it has a
// commit), the plan's refined slices it has are offered as done, to confirm. Only when the
// plan is the open board and editable (checked out elsewhere: not offered).
function confirmable(plan, built) {
  if (getCurrentModelId() !== current.planId || !canEditCurrent()) return [];
  return doneToConfirm(plan, built);
}

function renderConfirmDone(plan, built) {
  const done = confirmable(plan, built);
  if (!done.length) return '';
  // Every slice would be Done after this confirm: offer to publish the edition with it
  const ids = new Set(done.map(d => d.sliceId));
  const all = Object.values(plan.slices);
  const complete = all.length && all.every(s => s.built || ids.has(s.id)) && !plan.edition?.published;
  return `
      <div class="cp-done">
        <p class="cp-done-note">Refined in ${escapeHtml(names.a)} and built in ${escapeHtml(names.b)} @ ${escapeHtml(built.modelSource.commit.slice(0, 7))}:</p>
        <ul class="cp-done-list">${done.map(d => `<li>${escapeHtml(d.title)}</li>`).join('')}</ul>
        ${complete ? `<label class="cp-publish"><input type="checkbox" id="cpPublish"> ☑ Publish ${ordinal(plan.edition?.edition || 1)} edition</label>` : ''}
        <button class="cp-done-btn" data-compare-action="confirm-done">☑ Confirm ${done.length} done</button>
        <button class="cp-keep-btn" data-compare-action="keep-planned">Keep as planned</button>
      </div>`;
}

// Steps after done is recorded, each given the slices recorded and the built model
const afterDone = [];

function confirmDone() {
  const built = projectState(readModelEvents(current.builtId));
  const publish = !!document.getElementById('cpPublish')?.checked;
  const recorded = confirmSlicesDone(built);
  afterDone.forEach(step => step(recorded, built));
  if (recorded.length) showToast(`${recorded.length} ${recorded.length === 1 ? 'slice' : 'slices'} built`);
  if (publish && recorded.length) {
    const why = publishEdition();
    showToast(why || `Published: ${ordinal(projectState().edition.edition)} edition`);
  }
  renderCompare();
}

// Rejecting the difference: the slices stay ☐ Ready
function keepPlanned() {
  const built = projectState(readModelEvents(current.builtId));
  const kept = keepSlicesPlanned(built);
  if (kept.length) showToast(`${kept.length} ${kept.length === 1 ? 'slice' : 'slices'} kept as planned`);
  renderCompare();
}

// Same slice / Different: remembered on the open shelf (Match Slices / Keep Slices Apart)
function decideRename(btn) {
  if (!canDecide()) { showToast('Read-only here: nothing recorded'); return; }
  const { slice, otherShelf, otherName } = btn.dataset;
  const same = btn.dataset.compareAction === 'same';
  const why = (same ? matchSlices : keepSlicesApart)(slice, otherShelf, otherName);
  if (!why) showToast(same ? 'Compared as one slice' : 'Kept apart');
  renderCompare();
}

export function setCompare(planId, builtId) { current = { planId, builtId }; filter = 'all'; }

// Which model to compare the plan with: the rest of the library, a same-named one first
// { builtId }: pick the left side (the plan) for this shelf instead (after importing a test export)
export function openComparePicker(planId, showCompare, { builtId = null } = {}) {
  if (builtId) planId = builtId;
  const name = nameOf(planId).toLowerCase();
  // Each with what tells same-named ones apart: the commit, build and time it was built
  // from, or when it was last edited
  const others = listModels().filter(m => m.id !== planId)
    .map(m => {
      const st = projectState(readModelEvents(m.id));
      const edited = m.updatedAt ? new Date(m.updatedAt).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      const slices = Object.keys(st.slices).length;
      return { id: m.id, name: st.modelName || 'Untitled model',
        meta: [sourceSummary(st) || (edited ? `edited ${edited}` : ''), `${slices} ${slices === 1 ? 'slice' : 'slices'}`].filter(Boolean).join(' · ') };
    })
    .sort((a, b) => (b.name.toLowerCase() === name) - (a.name.toLowerCase() === name));
  if (!others.length) {     openBoardSheet('<div class="sheet-title">Compare shelves</div><p class="cp-note">You need a second shelf to compare with: make one, or import one (☰ → Import…), e.g. a model built from the tests.</p>'); return; }
  openBoardSheet(`
    <div class="sheet-title">Compare ${escapeHtml(nameOf(planId))} with… </div>
    <p class="cp-note">${builtId ? `Pick the plan: it opens on the left, ${escapeHtml(nameOf(builtId))} on the right.` : 'The open board is on the left. Pick any other shelf: what was built from the tests, an older version, another idea.'}</p>
    <div class="share-scope-list">${others.map(o => `
      <button class="share-scope-option cp-pick" data-compare-with="${builtId || o.id}" data-plan="${builtId ? o.id : planId}"><b>${escapeHtml(o.name)}${pairedWith(planId) === o.id ? ' <span class="dt-move-meta">last time</span>' : ''}</b><span class="cp-pick-meta">${escapeHtml(o.meta)}</span></button>`).join('')}</div>`);
}
