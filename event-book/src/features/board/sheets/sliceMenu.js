// ===========================================
// BOARD SHEETS - A slice's menu, its description, reordering, and the model's name
// ===========================================

import { projectState } from '../../../core/projections.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { normaliseTags } from '../../../core/tags.js';
import { showToast } from '../../../ui/toast.js';
import { render, getStartIn, setStartIn, showOutline, showBoard, showSlicePage, getView } from '../../../ui/feed.js';
import { setModelStartIn, getCurrentModelId, openModel, isFrozenCurrent } from '../../../core/eventStore.js';
import { toastWithUndo } from '../../undo/command.js';
import { secondTap } from '../../../ui/secondTap.js';
import { nameSlice, describeSlice, deleteSlice, moveSlice, nameModel, describeModel, writePreface, tagBook, unlinkProcessor } from '../command.js';
import { escapeHtml } from '../view.js';
import { onEnter, openBoardSheet } from './shared.js';
import { openShareSheet } from '../../shareImage/sheet.js';
import { openThread } from '../../comments/sheet.js';
import { isReadOnly } from '../../readOnly/sheet.js';
import { waiveScenarios, liftScenarioWaiver } from '../../scenarioWaiver/command.js';
import { nickname } from '../../comments/command.js';
import { runSliceFromAutomation, runSliceByPerson } from '../../automate/command.js';
import { sliceMenuView, automateView, waiveView, sliceInfoView, reorderView, modelNameView } from './read.js';
import { sliceMenuScenario, reorderRow } from './parts.js';
import { readOnlySliceMenu } from '../../readOnly/readOnlySliceMenu.read.js';
import { readOnlySliceMenuBox } from '../../readOnly/readOnly.parts.js';

// The book, through one sheet's view: the sheets read nothing of it but what their view holds
const viewOf = (view, ...args) => view(projectState(), ...args);

// ---------- Slice menu ----------

let menuSliceId = null;

export function openSliceMenu(sliceId) {
  // Not checked out here: nothing to change, only to share
  if (isReadOnly()) {
    const ro = viewOf(readOnlySliceMenu, sliceId);
    if (ro) openBoardSheet(readOnlySliceMenuBox(ro));
    return;
  }
  const v = viewOf(sliceMenuView, sliceId);
  if (!v) return;
  menuSliceId = sliceId;
  const { synthetic, scenarios } = v;

  openBoardSheet(`
    <div class="sheet-title">${v.typeLabel}</div>
    ${synthetic ? '' : `
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdRenameSlice" value="${escapeHtml(v.name)}" placeholder="Slice name">
      <button class="sheet-btn" data-board-action="rename-slice">Save</button>
    </div>
    <textarea class="sheet-input bd-slice-desc" id="bdSliceDesc" rows="2" placeholder="What happens here? (optional, shown behind ⓘ)">${escapeHtml(v.description)}</textarea>
    ${getView() === 'slice' ? '' : `<button class="sheet-btn secondary bd-open-slice" data-board-action="open-slice">Open slice page</button>`}`}
    <div class="bd-sheet-label">Scenarios (${scenarios.length})</div>
    <div class="sheet-options">
      ${scenarios.map(sliceMenuScenario).join('')}
      <div class="sheet-option" data-board-action="add-scenario">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">＋</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Add scenario</div>
          <div class="sheet-option-desc">Given / When / Then</div>
        </div>
      </div>
      ${v.waive === 'ask' ? `
      <div class="sheet-option" data-board-action="waive-ask">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">∅</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">No scenario needed</div>
          <div class="sheet-option-desc">Nothing to test here: it can be refined without any</div>
        </div>
      </div>` : v.waive === 'lift' ? `
      <div class="sheet-option" data-board-action="waive-lift">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">∅</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Needs scenarios after all</div>
          <div class="sheet-option-desc">No scenario (waived)${v.waivedReason ? `: ${escapeHtml(v.waivedReason)}` : ''}</div>
        </div>
      </div>` : ''}
      ${synthetic ? `
      <div class="sheet-option" data-board-action="unlink-inferred">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">✕</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Remove from board</div>
          <div class="sheet-option-desc">Unlinks the processor from its trigger and command; nothing is deleted</div>
        </div>
      </div>` : `
      <div class="bd-move-row">
        <button class="sheet-btn secondary" data-board-action="insert" data-before="${sliceId}">＋ Slice before</button>
        <button class="sheet-btn secondary" data-board-action="insert" data-after="${sliceId}">＋ Slice after</button>
      </div>
      ${!v.automation ? '' : v.automation === 'by a person' ? `
      <div class="sheet-option" data-board-action="automate-ask">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⚙</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Run it from an automation…</div>
          <div class="sheet-option-desc">A processor does this step when an event happens, instead of a person</div>
        </div>
      </div>` : `
      <div class="sheet-option" data-board-action="by-person">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">👤</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">A person does this</div>
          <div class="sheet-option-desc">Not run by a processor any more; its view slice stays</div>
        </div>
      </div>`}
      <div class="sheet-option" data-board-action="slice-comment">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">💬</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Comment on this slice</div>
          <div class="sheet-option-desc">About the slice as a whole, not one scenario</div>
        </div>
      </div>
      <div class="sheet-option" data-board-action="share-slice">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↗</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Share this slice…</div>
          <div class="sheet-option-desc">A picture of just this slice, scenarios too if you like</div>
        </div>
      </div>
      <div class="sheet-option" data-board-action="chapter" data-slice="${sliceId}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">§</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Chapter: ${escapeHtml(v.chapterName)}</div>
          <div class="sheet-option-desc">Group it, e.g. MVP or Additional features</div>
        </div>
      </div>
      ${v.hasChapter ? `
      <div class="sheet-option" data-board-action="flow" data-slice="${sliceId}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↳</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Flow: ${escapeHtml(v.flowName)}</div>
          <div class="sheet-option-desc">An alternate ending, e.g. Capture failed</div>
        </div>
      </div>` : ''}`}
      <div class="sheet-option" data-board-action="reorder">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⇄</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Reorder slices</div>
          <div class="sheet-option-desc">Change where things happen on the timeline</div>
        </div>
      </div>
      ${synthetic ? '' : `
      <div class="sheet-option" data-board-action="delete-slice" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
        <div class="sheet-option-icon" style="background: #c0392b;">🗑️</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title" style="color: #e74c3c;">Delete slice</div>
          <div class="sheet-option-desc">Its elements stay in the model</div>
        </div>
      </div>`}
    </div>`);
  onEnter('bdRenameSlice', submitRenameSlice);
}

// Run it from an automation: the event that starts it, the processor, and its first half
function openAutomateSheet(sliceId) {
  const v = viewOf(automateView, sliceId);
  if (!v) return;
  menuSliceId = sliceId;
  const names = list => list.map(n => `<option value="${escapeHtml(n)}"></option>`).join('');
  const views = v.views;
  openBoardSheet(`
    <div class="sheet-title">Run it from an automation <span class="bd-sheet-sub">${escapeHtml(v.title)}</span></div>
    <label class="bd-sheet-label" for="bdAutoWhen">When this happens</label>
    <input type="text" class="sheet-input" id="bdAutoWhen" list="bdAutoEvents" placeholder="An event, e.g. Signed Up">
    <datalist id="bdAutoEvents">${names(v.events)}</datalist>
    <label class="bd-sheet-label" for="bdAutoProc">this processor does it</label>
    <input type="text" class="sheet-input" id="bdAutoProc" list="bdAutoProcs" placeholder="e.g. Reminder Sender">
    <datalist id="bdAutoProcs">${names(v.processors)}</datalist>
    ${views.length ? `<label class="bd-sheet-label" for="bdAutoView">What it waits in</label>
    <select class="sheet-input" id="bdAutoView">
      <option value="">A new view slice, just before it</option>
      ${views.map(w => `<option value="${w.id}">${escapeHtml(w.title)}</option>`).join('')}
    </select>` : ''}
    <button class="sheet-btn" data-board-action="automate">Run it from the automation</button>`, 'bdAutoWhen');
}

function submitAutomate() {
  const processor = document.getElementById('bdAutoProc')?.value ?? '';
  const why = runSliceFromAutomation({
    sliceId: menuSliceId, processor, whenEvent: document.getElementById('bdAutoWhen')?.value ?? '',
    viewSliceId: document.getElementById('bdAutoView')?.value || null
  });
  if (why) return showToast(why);
  hideAllSheets();
  render();
  toastWithUndo(`Run by ${processor.trim()}`);
}

// Why it needs no scenario (optional), then waive
function openWaiveSheet(sliceId) {
  const v = viewOf(waiveView, sliceId);
  if (!v) return;
  menuSliceId = sliceId;
  openBoardSheet(`
    <div class="sheet-title">No scenario needed <span class="bd-sheet-sub">${escapeHtml(v.title)}</span></div>
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdWaiveReason" placeholder="Why? (optional) e.g. It's the command's answer">
      <button class="sheet-btn" data-board-action="waive">Waive</button>
    </div>`, 'bdWaiveReason');
  onEnter('bdWaiveReason', submitWaive);
}

function submitWaive() {
  const reason = document.getElementById('bdWaiveReason')?.value.trim() ?? '';
  const refused = waiveScenarios({ sliceId: menuSliceId, reason, by: nickname() });
  hideAllSheets();
  render();
  if (refused) showToast(refused);
  else toastWithUndo('No scenario needed: waived');
}

function submitRenameSlice() {
  const was = viewOf(sliceMenuView, menuSliceId);
  const name = document.getElementById('bdRenameSlice')?.value.trim();
  const description = document.getElementById('bdSliceDesc')?.value.trim() ?? '';
  if (!was || !name) return;
  if (name !== was.name) nameSlice(menuSliceId, name);
  if (description !== was.description) describeSlice(menuSliceId, description);
  hideAllSheets();
  render();
}

// A slice's description, from the ⓘ on its header
export function openSliceInfo(sliceId) {
  const v = viewOf(sliceInfoView, sliceId);
  if (!v) return;
  menuSliceId = sliceId;
  openBoardSheet(`
    <div class="sheet-title">${escapeHtml(v.title)} <span class="bd-sheet-sub">${v.typeLabel}</span></div>
    <p class="bd-slice-info">${escapeHtml(v.description)}</p>
    <div class="bd-move-row">
      <button class="sheet-btn secondary" data-board-action="edit-slice-info">Edit</button>
      <button class="sheet-btn" data-board-action="close">Close</button>
    </div>`);
}

// ---------- Reorder ----------

// Slices move within their chapter here; a slice's menu moves it between chapters
export function openReorderSheet() {
  const { chapters } = viewOf(reorderView);
  openBoardSheet(`
    <div class="sheet-title">Reorder slices <span class="bd-sheet-sub">left → right</span></div>
    ${chapters.map(({ name, rows }) => `
    ${name !== null ? `<div class="bd-sheet-label">${escapeHtml(name)}</div>` : ''}
    <div class="bd-reorder">
      ${rows.map(reorderRow).join('')}
    </div>`).join('')}
    <button class="sheet-btn" data-board-action="close">Done</button>`);
}

// ---------- Model title ----------

// isNew: a new model also asks how you like to start — 📋 plotter (the outline)
// or 🌀 pantser (straight on the board); the pick is remembered on this device
// returnTo: the model to open again after saving (naming one from the library)
let nameReturnTo = null;
export function openModelNameSheet({ isNew = false, returnTo = null } = {}) {
  nameReturnTo = returnTo;
  const v = viewOf(modelNameView);
  const start = getStartIn();
  const startChip = (where, label, note) => `
      <button class="bd-start ${start === where ? 'active' : ''}" data-board-action="start-in" data-start="${where}">
        <b>${label}</b><span>${note}</span>
      </button>`;
  openBoardSheet(`
    <div class="sheet-title">${isNew ? 'New model' : 'Model'}</div>
    ${isNew && !v.literature ? `
    <div class="bd-sheet-label">How do you start?</div>
    <div class="bd-start-row">
      ${startChip('outline', '📋 Plotter', 'Outline the journey first')}
      ${startChip('board', '🌀 Pantser', 'Straight onto the board')}
    </div>` : ''}
    <div class="bd-sheet-label">Name</div>
    <input type="text" class="sheet-input" id="bdModelName" value="${escapeHtml(v.name)}" placeholder="e.g. Coffee shop orders">
    <div class="bd-sheet-label">Description</div>
    <textarea class="sheet-input bd-model-desc" id="bdModelDesc" rows="2" placeholder="What is this system for? A sentence: on its card, in the catalog and on the shared image.">${escapeHtml(v.description)}</textarea>
    <div class="bd-sheet-label">Preface</div>
    <textarea class="sheet-input bd-model-desc" id="bdModelPreface" rows="3" placeholder="Why is this book being written? The first page the first time it is opened.">${escapeHtml(v.preface)}</textarea>
    <div class="bd-sheet-label">Tags</div>
    <input type="text" class="sheet-input" id="bdModelTags" value="${escapeHtml(v.tags.join(', '))}" placeholder="a few, separated by commas: devlog, wishbook, article" autocapitalize="none" autocomplete="off">
    <button class="sheet-btn" data-board-action="name-model">Save</button>`, 'bdModelName');
  onEnter('bdModelName', submitModelName);
  for (const box of ['bdModelDesc', 'bdModelPreface'].map(id => document.getElementById(id)).filter(Boolean)) {
    fitToText(box); box.addEventListener('input', () => fitToText(box));
  }
  // Published (a build book's every edition): its description, preface and tags can change, its name can't
  const nameBox = document.getElementById('bdModelName');
  if (nameBox && isFrozenCurrent()) { nameBox.readOnly = true; nameBox.title = 'Published: the name stays'; }
}

// The description grows with its text (up to the cap in styles.css, then scrolls inside)
function fitToText(el) {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}

// Records only what changed
function submitModelName() {
  const was = viewOf(modelNameView);
  const name = document.getElementById('bdModelName')?.value.trim();
  const description = document.getElementById('bdModelDesc')?.value.trim() || '';
  if (name && name !== was.name) nameModel(name);
  if (description !== was.description) describeModel(description);
  const preface = document.getElementById('bdModelPreface')?.value.trim() || '';
  if (preface !== was.preface) writePreface(preface);
  const tags = normaliseTags(document.getElementById('bdModelTags')?.value);
  if (tags.join(',') !== was.tags.join(',')) tagBook(tags);
  hideAllSheets();
  if (nameReturnTo) { openModel(nameReturnTo); nameReturnTo = null; }
  render();
}

// Taps in the sheet that belong to a slice's menu, reordering or the model's name; true when handled
export function onSheetAction(a, t) {
  if (a === 'start-in') {
    setStartIn(t.dataset.start);
    setModelStartIn(getCurrentModelId(), t.dataset.start);
    document.querySelectorAll('.bd-start').forEach(b => b.classList.toggle('active', b === t));
    t.dataset.start === 'outline' ? showOutline() : showBoard();
  }
  else if (a === 'rename-slice') submitRenameSlice();
  else if (a === 'waive-ask') openWaiveSheet(menuSliceId);
  else if (a === 'automate-ask') openAutomateSheet(menuSliceId);
  else if (a === 'automate') submitAutomate();
  else if (a === 'by-person') {
    const why = runSliceByPerson({ sliceId: menuSliceId });
    hideAllSheets();
    render();
    if (why) showToast(why); else toastWithUndo('A person does it now');
  }
  else if (a === 'waive') submitWaive();
  else if (a === 'waive-lift') {
    const refused = liftScenarioWaiver({ sliceId: menuSliceId, by: nickname() });
    hideAllSheets();
    render();
    if (refused) showToast(refused);
    else toastWithUndo('Needs scenarios after all');
  }
  else if (a === 'edit-slice-info') openSliceMenu(menuSliceId);
  else if (a === 'unlink-inferred' && menuSliceId?.startsWith('au_inferred_')) {
    unlinkProcessor(menuSliceId.slice('au_inferred_'.length));
    hideAllSheets();
    render();
    showToast('Removed from the board');
  }
  else if (a === 'name-model') submitModelName();
  else if (a === 'open-slice') {
    const id = menuSliceId;
    hideAllSheets();
    showSlicePage(id);
  }
  else if (a === 'slice-comment') {
    const id = menuSliceId;
    hideAllSheets();
    setTimeout(() => openThread(id, null), 150);
  }
  else if (a === 'share-slice') {
    const id = menuSliceId;
    hideAllSheets();
    setTimeout(() => openShareSheet(null, { sliceId: id }), 150);
  }
  else if (a === 'add-scenario') {
    const v = viewOf(sliceMenuView, menuSliceId);
    hideAllSheets();
    if (v) setTimeout(() => window.EventPad.addScenario(v.sliceId, v.type), 150);
  }
  else if (a === 'edit-scenario') {
    hideAllSheets();
    setTimeout(() => window.EventPad.editScenario(t.dataset.scenario), 150);
  }
  else if (a === 'reorder') openReorderSheet();
  else if (a === 'reorder-move') {
    if (moveSlice(t.dataset.slice, t.dataset.to)) { render(); openReorderSheet(); }
  }
  else if (a === 'delete-slice') {
    if (!secondTap(t)) return true;
    const v = viewOf(sliceMenuView, menuSliceId);
    if (v) {
      // Its scenarios go with it: say so, while Undo is right there
      const scenarios = v.scenarios.length;
      deleteSlice(menuSliceId);
      hideAllSheets();
      render();
      toastWithUndo(`Slice "${v.title}"${scenarios ? ` and its ${scenarios} ${scenarios === 1 ? 'scenario' : 'scenarios'}` : ''} deleted`);
    }
  }
  else return false;
  return true;
}
