// ===========================================
// BOARD SHEETS - New slices: the slice-type sheet and "The system reacts"
// ===========================================

import { projectState } from '../../../core/projections.js';
import { externalAttr, byName } from '../../../core/constants.js';
import { hideAllSheets } from '../../../ui/sheets.js';
import { showToast } from '../../../ui/toast.js';
import { render } from '../../../ui/feed.js';
import { createSlice, createAutomation, addToSlice, placeSlices, setTrigger, linkReads, newId } from '../command.js';
import { appendEvent, EventTypes } from '../../../core/eventStore.js';
import { escapeHtml } from '../view.js';
import { onEnter, openBoardSheet, scrollToSlice, searchKey, sliceTypeHelp } from './shared.js';
import { isReadOnly } from '../../readOnly/sheet.js';

// ---------- New slice ----------

let newSliceChapter = null;
let newSlicePosition = null; // { before | after: sliceId } — null appends at the end

// chapterId: preselected chapter (from a chapter's menu); otherwise the last chapter.
// position: insert next to a slice; the new slice joins that slice's chapter.
export function openNewSliceSheet(chapterId, position = null) {
  if (isReadOnly()) return;   // not checked out here: nothing to change
  const state = projectState();
  newSlicePosition = position;
  const anchor = position && state.slices[position.before || position.after];
  newSliceChapter = anchor ? (anchor.chapterId || null)
    : chapterId !== undefined ? chapterId : (state.chapterOrder[state.chapterOrder.length - 1] || null);
  const where = anchor ? `<span class="bd-sheet-sub">${position.before ? 'before' : 'after'} ${escapeHtml(anchor.name || 'this slice')}</span>` : '';
  openBoardSheet(`
    <div class="sheet-title">New slice ${where}</div>
    <input type="text" class="sheet-input" id="bdSliceName" placeholder="Name it, e.g. Place order">
    ${anchor ? '' : renderChapterChips(state)}
    <div class="sheet-options">
      ${Object.entries(sliceTypeHelp).map(([type, h]) => `
        <div class="sheet-option" data-board-action="create-slice" data-slice-type="${type}">
          <div class="sheet-option-icon bd-type-icon ${type}">${h.icon}</div>
          <div class="sheet-option-text">
            <div class="sheet-option-title">${h.title}</div>
            <div class="sheet-option-desc">${h.desc}</div>
          </div>
        </div>`).join('')}
    </div>`, 'bdSliceName');
}

function renderChapterChips(state) {
  if (!state.chapterOrder.length) return '';
  const chip = (id, label) => `
    <button class="bd-chapter-chip ${newSliceChapter === id ? 'active' : ''}" data-board-action="pick-new-chapter" data-chapter="${id || ''}">${escapeHtml(label)}</button>`;
  return `
    <div class="bd-sheet-label">Chapter</div>
    <div class="bd-chapter-chips">
      ${state.chapterOrder.map(id => chip(id, state.chapters[id].name)).join('')}
      ${chip(null, 'No chapter')}
    </div>`;
}

function submitNewSlice(sliceType) {
  const name = document.getElementById('bdSliceName')?.value.trim() || null;
  if (sliceType === 'AUTO') { openAutomationSheet(name); return; }
  finishNewSlice(createSlice(sliceType, name, { chapterId: newSliceChapter }));
}

// Place the new slice (and an automation's partner) where asked, then show it
function finishNewSlice(sliceId) {
  if (newSlicePosition) {
    const partner = projectState().slices[sliceId]?.pairWith;
    placeSlices([sliceId, partner].filter(Boolean), newSlicePosition);
  }
  hideAllSheets();
  render();
  scrollToSlice(sliceId);
}

// ---------- "The system reacts" ----------
// An automation is a processor reacting to something. What it reads decides the
// columns: a new read model gets its own state view (trigger event → read model
// → processor) beside the state change it drives (processor → command → event);
// an existing read model or none (a translator: an external event in, a command
// out) is one state change, with "reads" / "⚡ on" tags on the processor card.
// A read model can be a to-do list (a saga's work queue), or not.

let autoCtx = null; // { name, event, reads }

function openAutomationSheet(name) {
  const state = projectState();
  autoCtx = { name, event: null, reads: null };
  const events = Object.values(state.elements).filter(e => e.type === 'event').sort(byName);
  const models = Object.values(state.elements).filter(e => e.type === 'readModel').sort(byName);
  const chip = (e, pick) => `<button class="bd-chip" data-type="${e.type}"${externalAttr(e)} data-board-action="auto-pick" data-pick="${pick}" data-el="${e.id}" data-key="${escapeHtml(searchKey(e.name))}">${e.todo ? '☑ ' : ''}${escapeHtml(e.name)}</button>`;
  openBoardSheet(`
    <div class="sheet-title">The system reacts ${name ? `<span class="bd-sheet-sub">${escapeHtml(name)}</span>` : ''}</div>
    <div class="bd-cell-hint" id="bdAutoHint"></div>
    <div class="bd-sheet-label">⚡ Triggered by</div>
    ${events.length > 6 ? `<input type="text" class="sheet-input" id="bdAutoSearch" placeholder="Search events" autocomplete="off">` : ''}
    ${events.length ? `<div class="bd-chips" id="bdAutoEvents">${events.map(e => chip(e, 'event')).join('')}</div>`
      : `<div class="bd-cell-hint">No events yet: add the trigger later.</div>`}
    <div class="bd-sheet-label">📗 What it reads <span class="bd-label-note">optional</span></div>
    ${models.length ? `<div class="bd-chips" id="bdAutoReads">${models.map(e => chip(e, 'reads')).join('')}</div>` : ''}
    <input type="text" class="sheet-input" id="bdAutoRead" placeholder="${models.length ? 'or a new read model, e.g.' : 'a new read model, e.g.'} Orders to allocate" autocomplete="off">
    <label class="bd-check" id="bdAutoTodoRow" hidden><input type="checkbox" id="bdAutoIsTodo"> ☑ It's a to-do list (a queue of work it picks items from)</label>
    <div class="bd-sheet-label">⚙ The processor</div>
    <div class="bd-inline-form">
      <input type="text" class="sheet-input" id="bdAutoProc" placeholder="e.g. Payment translator" autocomplete="off">
      <button class="sheet-btn" data-board-action="auto-create">Add</button>
    </div>
    <div class="bd-cell-hint">Type an existing processor's name to reuse it.</div>`, 'bdAutoProc');
  onEnter('bdAutoProc', createAutomationFromSheet);
  // Typing a new read model drops a picked existing one
  const readInput = document.getElementById('bdAutoRead');
  readInput.oninput = () => { if (readInput.value.trim() && autoCtx.reads) pickAuto('reads', null); updateAutoHint(); };
  updateAutoHint();
  const search = document.getElementById('bdAutoSearch');
  if (search) search.oninput = () => {
    const q = searchKey(search.value);
    document.querySelectorAll('#bdAutoEvents .bd-chip').forEach(c => { c.hidden = !!q && !c.dataset.key.includes(q); });
  };
}

function pickAuto(kind, elementId) {
  autoCtx[kind] = autoCtx[kind] === elementId ? null : elementId;
  document.querySelectorAll(`[data-board-action=auto-pick][data-pick=${kind}]`)
    .forEach(c => c.classList.toggle('linked', c.dataset.el === autoCtx[kind]));
  if (kind === 'reads' && autoCtx.reads) document.getElementById('bdAutoRead').value = '';
  updateAutoHint();
}

function updateAutoHint() {
  const hint = document.getElementById('bdAutoHint');
  if (!hint) return;
  const fresh = !!document.getElementById('bdAutoRead')?.value.trim();
  document.getElementById('bdAutoTodoRow').hidden = !fresh;
  const state = projectState();
  const trigger = autoCtx.event && state.elements[autoCtx.event];
  hint.textContent = fresh
    ? 'Adds 2 slices: a view of the new read model it reads, then what it does.'
    : autoCtx.reads ? 'Adds 1 slice: the read model already has its own view.'
    : trigger?.external ? `Adds 1 slice: it translates ${trigger.name} into a command of your own.`
    : 'Adds 1 slice: it reacts to the event and sends a command. Name a new read model to get its view too.';
}

function createAutomationFromSheet() {
  const state = projectState();
  const procName = document.getElementById('bdAutoProc')?.value.trim();
  const readName = document.getElementById('bdAutoRead')?.value.trim();
  const isTodo = !!document.getElementById('bdAutoIsTodo')?.checked;
  const existingProc = procName && Object.values(state.elements)
    .find(e => e.type === 'processor' && searchKey(e.name) === searchKey(procName));
  const proc = existingProc ? { elementId: existingProc.id } : { name: procName };

  if (readName) {
    // A new read model gets its own view, with the trigger event feeding it
    // The view is named for what it shows; a to-do list keeps "…: to do"
    const svId = createAutomation(autoCtx.name, newSliceChapter, isTodo && autoCtx.name ? `${autoCtx.name}: to do` : readName);
    const procId = procName ? addToSlice(svId, 'processor', proc) : null;
    const rmId = newId('el');
    appendEvent(EventTypes.ElementCreated, { elementId: rmId, elementType: 'readModel', name: readName });
    if (isTodo) appendEvent(EventTypes.ElementTodoSet, { elementId: rmId, todo: true });
    addToSlice(svId, 'readModel', { elementId: rmId });
    if (autoCtx.event) {
      addToSlice(svId, 'event', { elementId: autoCtx.event });
      if (procId) setTrigger(autoCtx.event, procId, true);
    }
    finishNewSlice(svId);
    return;
  }

  // An existing read model, or none (e.g. translating an external event): one column
  if (!procName && (autoCtx.reads || autoCtx.event)) { showToast('Name the processor'); return; }
  const sliceId = createSlice('SC', autoCtx.name, { actor: 'processor', chapterId: newSliceChapter });
  const procId = procName ? addToSlice(sliceId, 'processor', proc) : null;
  if (autoCtx.reads) linkReads(procId, autoCtx.reads);
  if (autoCtx.event) setTrigger(autoCtx.event, procId, true);
  finishNewSlice(sliceId);
}

// Taps in the sheet that belong to adding slices; true when handled
export function onSheetAction(a, t) {
  if (a === 'create-slice') submitNewSlice(t.dataset.sliceType);
  else if (a === 'pick-new-chapter') {
    // Toggle in place so a name already typed isn't lost
    newSliceChapter = t.dataset.chapter || null;
    t.parentElement.querySelectorAll('.bd-chapter-chip').forEach(c => c.classList.toggle('active', c === t));
  }
  else if (a === 'auto-pick') pickAuto(t.dataset.pick, t.dataset.el);
  else if (a === 'auto-create') createAutomationFromSheet();
  else if (a === 'insert') openNewSliceSheet(undefined, t.dataset.before ? { before: t.dataset.before } : { after: t.dataset.after });
  else return false;
  return true;
}
