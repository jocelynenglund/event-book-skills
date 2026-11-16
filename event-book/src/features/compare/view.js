// ===========================================
// COMPARE - The "Plan vs built" page, and choosing what to compare with
// ===========================================

import { readModelEvents, getCurrentModelId, openModel, canEditCurrent } from '../../core/eventStore.js';
import { comparePage } from './comparePage.read.js';
import { compareContract } from './compareContract.read.js';
import { comparePicker } from './comparePicker.read.js';
import { compareBuiltBook } from './compareBuiltBook.read.js';
import { comparePublishedEdition } from './comparePublishedEdition.read.js';
import { compareHeading, compareChip, compareConfirmDone, compareChangeButton, compareContractWarning, compareRow, comparePick } from './compare.parts.js';
import { confirmSlicesDone, keepSlicesPlanned, matchSlices, keepSlicesApart } from './command.js';
import { publishEdition } from '../editions/command.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../board/view.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { builtAsPlannedSection } from '../specs/specs.parts.js';

const PAIR_KEY = 'eventpad_compare_pairs';   // plan model id → built model id, per device
const pairs = () => { try { return JSON.parse(localStorage.getItem(PAIR_KEY) || '{}'); } catch (e) { return {}; } };
export function rememberPair(planId, builtId) {
  try { localStorage.setItem(PAIR_KEY, JSON.stringify({ ...pairs(), [planId]: builtId })); } catch (e) { /* just this time */ }
}
export const pairedWith = planId => pairs()[planId] || null;
let filter = 'all';
let current = null;   // { planId, builtId }

// A possible rename is answered on the open shelf (the left), so only there and when it's editable
const canDecide = () => current && getCurrentModelId() === current.planId && canEditCurrent();

export function renderCompare() {
  const root = document.getElementById('compareView');
  if (!root || !current) return;
  const page = comparePage({ planEvents: readModelEvents(current.planId), builtEvents: readModelEvents(current.builtId),
    ids: { a: current.planId, b: current.builtId }, filter, editable: canDecide() });
  const sections = page.sections.map(sec => `<section class="cp-section"><h2 class="cp-ch">${escapeHtml(sec.chapter)}</h2>${sec.rows.map(compareRow).join('')}${sec.creep
    ? `<details class="cp-new plus"${sec.creep.open ? ' open' : ''}><summary>${escapeHtml(sec.creep.summary)}</summary>${sec.creep.rows.map(compareRow).join('')}</details>` : ''}</section>`).join('');
  root.innerHTML = `
    <header class="cp-header">
      ${compareHeading(page)}
      <div class="cp-chips">
        ${page.chips.map(compareChip).join('\n        ')}
      </div>
      ${compareContractWarning(compareContract({ planEvents: readModelEvents(current.planId), builtEvents: readModelEvents(current.builtId) }))}
      ${compareConfirmDone(page.confirm)}
      ${builtAsPlannedSection(page.planned)}
      ${compareChangeButton()}
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
    startCompare(t.dataset.plan, t.dataset.compareWith, showCompare);
  });
}

// Compare a plan (the left side) with another book; the left side is always the open board,
// so the plan opens if it isn't (after an import, from the import's toast)
export function startCompare(planId, builtId, showCompare) {
  rememberPair(planId, builtId);
  hideAllSheets();
  if (getCurrentModelId() !== planId) openModel(planId);
  showCompare(planId, builtId);
}

// Steps after done is recorded, each given the slices recorded and the built model
const afterDone = [];

function confirmDone() {
  const built = compareBuiltBook(current.builtId);
  const publish = !!document.getElementById('cpPublish')?.checked;
  const recorded = confirmSlicesDone(built);
  afterDone.forEach(step => step(recorded, built));
  if (recorded.length) showToast(`${recorded.length} ${recorded.length === 1 ? 'slice' : 'slices'} built`);
  if (publish && recorded.length) {
    const why = publishEdition();
    showToast(why || `Published: ${comparePublishedEdition()}`);
  }
  renderCompare();
}

// Rejecting the difference: the slices stay ☐ Ready
function keepPlanned() {
  const built = compareBuiltBook(current.builtId);
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
  const pick = comparePicker({ planId, builtId, pairedId: pairedWith(builtId || planId) });
  if (pick.none) { openBoardSheet('<div class="sheet-title">Compare shelves</div><p class="cp-note">You need a second shelf to compare with: make one, or import one (☰ → Import…), e.g. a model built from the tests.</p>'); return; }
  openBoardSheet(`
    <div class="sheet-title">${escapeHtml(pick.title)}</div>
    <p class="cp-note">${escapeHtml(pick.note)}</p>
    <input type="search" class="sheet-input cp-pick-search" id="cpPickSearch" placeholder="Search shelves" autocomplete="off" aria-label="Search shelves">
    <div class="share-scope-list" id="cpPickList">${pick.choices.map(comparePick).join('')}
      <p class="cp-note cp-pick-none" hidden>No shelf matches that.</p></div>`);
  wirePickSearch();
}

// The picker's search: every word typed must be in a shelf's name or its line (commit, build,
// date); Enter picks the first one left. Not focused on its own, so a phone's keyboard stays down
function wirePickSearch() {
  const input = document.getElementById('cpPickSearch');
  if (!input) return;
  const picks = () => [...document.querySelectorAll('#cpPickList .cp-pick')];
  input.addEventListener('input', () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    picks().forEach(b => { const hit = words.every(w => b.dataset.search.includes(w)); b.hidden = !hit; shown += hit; });
    document.querySelector('#cpPickList .cp-pick-none').hidden = shown > 0;
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter') picks().find(b => !b.hidden)?.click(); });
}
