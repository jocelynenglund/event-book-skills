// ===========================================
// OUTLINE - View (SV: View Outline)
// The model as a table of contents: chapters with their slices. Reorder with
// ↑ ↓ (stepping across chapter edges), or select several and move them to a
// chapter in one go. Tap a slice to jump to it on the board. ＋ Add step under a
// chapter sketches the journey from here: a change (command → event), a view
// (read model) or an automation, named after its command or read model.
// ===========================================

import { statusChips, filtering as staged, emptyText } from '../filter/status.js';
import { projectState } from '../../core/projections.js';
import { openProgressHistory } from '../buildProgress/sheet.js';
import { refinedPillTap } from './refinedPill.js';
import { outlineLayout } from './outlineLayout.read.js';
import { outlineSliceRow } from './outlineSliceRow.read.js';
import { outlineChapterHeading } from './outlineChapterHeading.read.js';
import { outlineSearchField } from './outlineSearchField.read.js';
import { outlineToolbarOptions } from './outlineToolbarOptions.read.js';
import { outlineAddKinds } from './outlineAddKinds.read.js';
import { outlineCanAddChapter } from './outlineCanAddChapter.read.js';
import { outlineBookName } from './outlineBookName.read.js';
import { outlineFoldAllState } from './outlineFoldAllState.read.js';
import { outlineOpenCommentsCount } from './outlineOpenCommentsCount.read.js';
import { outlineMoveTargets } from './outlineMoveTargets.read.js';
import { outlineRow, outlineChapterHead, outlineSearchBox, outlineToolbar, outlineAddButtons, outlineNewChapterButton, outlineBookTitle,
  outlineFoldAll, outlineBarComments, outlineMoveBar, outlineAddSheet, outlineEditSheet, outlineVerdictSheet, scenarioTestersSheet } from './outline.parts.js';
import { outlineStepPlan } from './outlineStepPlan.read.js';
import { outlineMovePlan } from './outlineMovePlan.read.js';
import { outlineAddForm } from './outlineAddForm.read.js';
import { outlineAddHint } from './outlineAddHint.read.js';
import { outlineEditForm } from './outlineEditForm.read.js';
import { outlineAutomationPartner } from './outlineAutomationPartner.read.js';
import { outlineVerdictForm } from './outlineVerdictForm.read.js';
import { setMustHave } from '../scenarios/command.js';
import { render, showSlicePage } from '../../ui/feed.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml, isChapterFolded, toggleChapterFolded, setAllChaptersFolded, isChapterBookmarked } from '../board/view.js';
import { moveSlice, placeSlices, setSliceChapter, moveChapter, createChapter, createSlice, addToSlice, describeSlice,
  createAutomation, setTrigger, linkReads, setTodo, newId, markSliceRefined, clearSliceRefined } from '../board/command.js';
import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { addOutlineProperties, reoutlineSlice } from './command.js';
import { toastWithUndo } from '../undo/command.js';
import { openChapterMenu, openChapterPicker, openSliceMenu } from '../board/sheets.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { openShareSheet } from '../shareImage/sheet.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { isReadOnly } from '../readOnly/sheet.js';
import { openScenariosSheet } from '../board/sheets/scenarios.js';
import { openThread, openCommentsList } from '../comments/sheet.js';
import { canAddScenariosHere, reviewOf } from '../review/client.js';
import { recordVerdict } from '../verify/command.js';
import { getCurrentModelId, getEventStream } from '../../core/eventStore.js';
import { isBuildBook } from '../buildVersions/rules.js';
import { usageButton } from '../usage/view.js';
import { renderLiteratureOutline } from '../literature/view.js';

let selecting = false;
let query = '';            // the search box: filters slices (and opens folded chapters while it does)
let selected = new Set();
// Scenarios show under every slice unless the outline is collapsed (Collapse outline, kept
// per device); a slice tapped open or shut goes the other way from that
const COLLAPSED_KEY = 'eventpad_outline_collapsed';
let collapsedAll = (() => { try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch (e) { return false; } })();
const toggled = new Set();
const gwtOpen = id => collapsedAll ? toggled.has(id) : !toggled.has(id);
let screenNow = null;      // the Outline as last drawn (its layout and the row views): what a tap reads
let addForm = null;        // the add sheet's view as it was opened
let adding = null;         // chapter id ('' for no chapter) the add sheet adds to
let addKind = 'SC';        // Do (state change), See (state view) or Auto (automation)

// Fields (stickies' properties, scenario values) only when asked for: per device
const FIELDS_KEY = 'eventpad_outline_fields';
let showFields = false;
try { showFields = localStorage.getItem(FIELDS_KEY) === '1'; } catch (e) { /* storage blocked */ }
const allScenarios = new Set(); // slices showing their nice to haves too
const openFields = new Set();   // slices showing their fields
const openValues = new Set();   // slices showing their scenarios' values

// What the last draw showed of a slice (its row), or null
const rowNow = id => screenNow?.rows[id] || null;

// ↑ / ↓ within a chapter; at a chapter's edge, step into the neighbouring one
function stepSlice(sliceId, dir) {
  const plan = outlineStepPlan(projectState(), sliceId, dir);
  if (!plan) return;
  if (plan.over) { moveSlice(sliceId, plan.over); return; }
  setSliceChapter(sliceId, plan.chapterId);
  if (plan.place) placeSlices(plan.ids, plan.place);
}

// Move every selected slice to the end of a chapter, keeping their order
function moveSelected(chapterId) {
  const plan = outlineMovePlan(projectState(), [...selected], chapterId);
  plan.ids.forEach(id => setSliceChapter(id, chapterId));
  if (plan.after) placeSlices(plan.ids, { after: plan.after });
  showToast(`${plan.count} moved to ${plan.chapterName}`);
  selected.clear();
  selecting = false;
}

const fieldValue = id => document.getElementById(id)?.value.trim() || '';
const checked = id => !!document.getElementById(id)?.checked;

// The forms open in a sheet (a drawer): the page's stuck tabs can't cover them, and sheets sit above the keyboard.
function openAddSheet() {
  addForm = outlineAddForm(projectState(), { chapterId: adding, kind: addKind });
  openBoardSheet(outlineAddSheet(addForm), 'olAddFirst');
}

// The element a name in the sheet stands for, when the book already has one (any case)
const knownIn = (form, type, name) => form.known[type]?.[name.trim().toLowerCase()] || null;

// Make the step: an existing element with the same name is reused, not copied
function saveStep() {
  const form = addForm;
  if (!form) return;
  const missing = form.fields.find(f => f.required && !fieldValue(f.id));
  if (missing) {
    document.getElementById(missing.id)?.focus();
    showToast(`Name the ${missing.label.replace(/^\W+/, '').toLowerCase()} first`);
    return;
  }
  const as = (type, name) => {
    const same = knownIn(form, type, name);
    return same ? { elementId: same.id } : { name };
  };
  let sliceId;
  if (form.kind === 'AU') sliceId = saveAutomation(form, as);
  else {
    sliceId = createSlice(form.kind, null, { chapterId: adding || null });
    form.fields.forEach(f => { if (fieldValue(f.id)) addToSlice(sliceId, f.type, as(f.type, fieldValue(f.id))); });
  }
  // Properties go on the step's command and event (an automation's trigger keeps its own)
  addOutlineProperties(sliceId, fieldValue('olAddProps'));
  const description = fieldValue('olAddDesc');
  if (description) describeSlice(sliceId, description);
  const title = fieldValue(form.fields.find(f => f.required).id);
  render();
  openAddSheet();
  showToast(`Added ${title}`);
}

// When [event] using [read model] ⚙ [processor] does [command] → [result]
function saveAutomation(form, as) {
  const chapterId = adding || null;
  const when = fieldValue('olAddFirst'), using = fieldValue('olAddUsing');
  const known = using ? knownIn(form, 'readModel', using) : null;

  // The trigger: an event already in the model, or a new one
  let triggerId = when ? knownIn(form, 'event', when)?.id : null;
  if (when && !triggerId) {
    triggerId = newId('el');
    appendEvent(EventTypes.ElementCreated, { elementId: triggerId, elementType: 'event', name: when });
  }
  if (triggerId && checked('olAddExternal')) appendEvent(EventTypes.ElementExternalSet, { elementId: triggerId, external: true });

  // A new read model gets its own view (the trigger feeding it), beside what it does
  let sliceId, viewId = null;
  if (using && !known) {
    viewId = createAutomation(null, chapterId);
    sliceId = outlineAutomationPartner(projectState(), viewId);
  } else {
    sliceId = createSlice('SC', null, { actor: 'processor', chapterId });
  }
  const procId = addToSlice(viewId || sliceId, 'processor', as('processor', fieldValue('olAddProc')));
  if (viewId) {
    const rmId = addToSlice(viewId, 'readModel', { name: using });
    if (triggerId) addToSlice(viewId, 'event', { elementId: triggerId });
    if (checked('olAddTodo')) setTodo(rmId, true);
  } else if (known) {
    linkReads(procId, known.id);
    if (checked('olAddTodo') && !known.todo) setTodo(known.id, true);
  }
  addToSlice(sliceId, 'command', as('command', fieldValue('olAddCmd')));
  if (fieldValue('olAddResult')) addToSlice(sliceId, 'event', as('event', fieldValue('olAddResult')));
  if (triggerId) setTrigger(triggerId, procId, true);
  return sliceId;
}

function openEditSheet(sliceId) {
  const form = outlineEditForm(projectState(), sliceId);
  if (form) openBoardSheet(outlineEditSheet(form));
}

// Save the edit as one action (Undo takes it all back)
function saveEdit() {
  const form = document.querySelector('.ol-edit');
  if (!form) return;
  const sliceId = form.dataset.slice;
  const inputs = [...form.querySelectorAll('input[data-type]')];
  const missing = inputs.find(i => i.dataset.required && !i.value.trim());
  if (missing) { missing.focus(); showToast('That one needs a name'); return; }
  const was = form.dataset.title;
  reoutlineSlice(sliceId, {
    fields: inputs.map(i => ({ type: i.dataset.type, elementId: i.dataset.el || null, value: i.value })),
    props: { before: form.dataset.propsBefore, after: document.getElementById('olEdProps').value },
    description: document.getElementById('olEdDesc').value
  });
  hideAllSheets();
  render();
  toastWithUndo(`Updated ${rowNow(sliceId)?.title ?? was}`);
}

export function renderOutline() {
  const container = document.getElementById('outlineView');
  if (!container) return;
  // One replay of the book per draw: the layout and each part's own view read from it
  const state = projectState();
  const built = isBuildBook(getEventStream());
  const layout = outlineLayout(state, { query, folded: isChapterFolded });
  // A literature book's outline is its paragraphs and sentences: no scenarios, stickies or add steps
  if (layout.literature) { screenNow = { layout, rows: {} }; renderLiteratureOutline(container); return; }
  const rows = {};
  layout.chapters.forEach(ch => ch.rows.forEach(r => { rows[r.slice.id] = outlineSliceRow(state, r.slice, r); }));
  screenNow = { layout, rows };

  const rowUi = row => ({
    selecting, selected: selected.has(row.sliceId), query,
    open: gwtOpen(row.sliceId), nice: allScenarios.has(row.sliceId), showFields,
    fields: openFields.has(row.sliceId), values: openValues.has(row.sliceId),
    canAdd: !isReadOnly() || canAddScenariosHere(), verifying: !!layout.verify
  });
  const sections = layout.chapters.map(chapter => {
    const heading = outlineChapterHeading(state, chapter, { built, searching: layout.searching });
    const head = chapter.loose
      ? (layout.hasChapters ? outlineChapterHead(heading) : '')
      : outlineChapterHead(heading, { searching: layout.searching, bookmarked: isChapterBookmarked(chapter.id) });
    const body = chapter.folded ? ''
      : chapter.rows.length
        ? chapter.rows.map(r => outlineRow(rows[r.slice.id], rowUi(rows[r.slice.id]))).join('')
        : `<div class="ol-empty">No slices yet — add the first step below, or move some here</div>`;
    const add = chapter.folded || selecting || layout.filtering ? '' : outlineAddButtons(outlineAddKinds(state, { chapterId: chapter.id || '' }));
    return `<section class="ol-section">${head}${body}${add}</section>`;
  }).join('');

  const moveBar = selecting ? outlineMoveBar({ ...outlineMoveTargets(state), selected: selected.size }) : '';

  // The search box is made once and kept, so typing never loses focus; the rest redraws
  if (!container.querySelector('#olSearch')) container.innerHTML = `${outlineSearchBox(outlineSearchField(state, { query }))}<div id="olBody"></div>`;
  container.querySelector('.ol-search-clear').hidden = !query;
  container.querySelector('#olBody').innerHTML = `
    ${outlineToolbar({ ...outlineToolbarOptions(state, layout), showFields, selecting })}
    ${verifyLine(layout.verify)}
    ${roundsLine(layout.rounds)}
    ${sections || (layout.searching ? `<div class="ol-empty">Nothing matches "${escapeHtml(query)}"</div>` : staged() ? `<div class="ol-empty">${emptyText()}</div>` : '')}
    ${outlineNewChapterButton(outlineCanAddChapter(state, layout))}
    ${moveBar}
    ${bottomBar(state, layout)}`;
  pinOutline();
}

// Not checked out here: expanding, folding, fields and scenarios still open; a slice's row
// opens its page, a scenario its slice's scenarios to read; anything that would change it does nothing
const readOnlyReads = new Set(['chapter-menu', 'jump', 'open-slice', 'gwt', 'expand', 'collapse-all', 'comment', 'next-comment', 'testers', 'progress-history', 'verdict', 'verdict-save', 'nice', 'values-one', 'fields-one', 'fields', 'fold', 'search-clear', 'share-slice', 'add-scenario']);
function readOnlyTap(a, t) {
  if (readOnlyReads.has(a)) return false;
  if (a === 'edit') { hideAllSheets(); openSliceMenu(t.dataset.slice); }   // read-only: only sharing
  else if (a === 'edit-scenario') {
    if (t.dataset.slice) openScenariosSheet(t.dataset.slice, { readOnly: !canAddScenariosHere() });
  }
  return true;
}

function handleClick(e) {
  const t = e.target.closest('[data-outline-action]');
  if (!t || t.disabled) return;
  const a = t.dataset.outlineAction;
  const id = t.dataset.slice;
  if (isReadOnly() && readOnlyTap(a, t)) return;
  if (a === 'up' || a === 'down') { stepSlice(id, a === 'up' ? -1 : 1); render(); }
  else if (a === 'jump') { hideAllSheets(); window.EventPad.showSliceOnBoard(id); }
  else if (a === 'progress-history') openProgressHistory(id);
  else if (a === 'open-slice') { hideAllSheets(); showSlicePage(id); }
  else if (a === 'add-scenario') openScenariosSheet(id, { readOnly: isReadOnly() && !canAddScenariosHere() });
  else if (a === 'select') { selecting = !selecting; selected.clear(); renderOutline(); }
  else if (a === 'toggle') { selected.has(id) ? selected.delete(id) : selected.add(id); renderOutline(); }
  else if (a === 'move-to') { moveSelected(t.dataset.chapter || null); render(); }
  else if (a === 'move-to-new') {
    const name = prompt('New chapter name');
    if (!name?.trim()) return;
    moveSelected(createChapter(name.trim()));
    render();
  }
  else if (a === 'gwt' || a === 'expand') {
    // Closing it goes back to just the must haves next time
    if (gwtOpen(id)) allScenarios.delete(id);
    toggled.has(id) ? toggled.delete(id) : toggled.add(id);
    renderOutline();
  }
  else if (a === 'collapse-all') {
    // Collapse all: every chapter folded and every slice's scenarios shut; Expand all: the reverse
    collapsedAll = t.dataset.fold === 'close';
    toggled.clear();
    setAllChaptersFolded(screenNow.layout.chapterIds, collapsedAll);
    try { localStorage.setItem(COLLAPSED_KEY, collapsedAll ? '1' : '0'); } catch (e) { /* just this time */ }
    renderOutline();
  }
  else if (a === 'comment') openThread(id, t.dataset.scenario || null);
  else if (a === 'testers') {
    const scn = Object.values(screenNow.rows).flatMap(r => r.scenarios).find(x => x.id === t.dataset.scenario);
    if (scn?.testers) openBoardSheet(scenarioTestersSheet(scn.testers));
  }
  else if (a === 'verdict') {
    if (t.dataset.verdict === 'fails') askWhatHappened(id, t.dataset.scenario);
    else if (saveVerdict(id, t.dataset.scenario, 'works')) render();
  }
  else if (a === 'verdict-save') {
    if (saveVerdict(id, t.dataset.scenario, 'fails', document.getElementById('vdNote')?.value)) { hideAllSheets(); render(); }
  }
  else if (a === 'next-comment') openCommentsList(revealComment);
  else if (a === 'refined') {
    const row = rowNow(id);
    if (!row) return;
    const tap = refinedPillTap({ sliceId: id, refined: row.refined });
    if (tap.command === 'clearSliceRefined') { clearSliceRefined(...tap.args); render(); showToast(`${row.title}: no longer refined`); return; }
    const refused = markSliceRefined(...tap.args);
    if (refused) { showToast(refused); return; }
    render();
    toastWithUndo(`${row.title} is refined`);
  }
  else if (a === 'edit-scenario') window.EventPad.editScenario(t.dataset.scenario);
  else if (a === 'must') {
    const row = Object.values(screenNow.rows).find(r => r.scenarios.some(x => x.id === t.dataset.scenario));
    const scn = row?.scenarios.find(x => x.id === t.dataset.scenario);
    // Still marking: keep every scenario of the slice in view (so the next one can be starred too)
    if (scn) { setMustHave(scn.id, !scn.mustHave); allScenarios.add(row.sliceId); renderOutline(); }
  }
  else if (a === 'nice') { allScenarios.has(id) ? allScenarios.delete(id) : allScenarios.add(id); renderOutline(); }
  else if (a === 'values-one') { openValues.has(id) ? openValues.delete(id) : openValues.add(id); renderOutline(); }
  else if (a === 'fields-one') { openFields.has(id) ? openFields.delete(id) : openFields.add(id); renderOutline(); }
  else if (a === 'fields') {
    showFields = !showFields;
    try { localStorage.setItem(FIELDS_KEY, showFields ? '1' : '0'); } catch (e) { /* just this time */ }
    renderOutline();
  }
  else if (a === 'fold') { toggleChapterFolded(t.dataset.chapter); renderOutline(); }
  else if (a === 'chapter-menu') openChapterMenu(t.dataset.chapter);
  else if (a === 'chapter-up' || a === 'chapter-down') { moveChapter(t.dataset.chapter, Number(t.dataset.to)); render(); }
  else if (a === 'new-chapter') openChapterPicker(null);
  else if (a === 'search-clear') { query = ''; const box = document.getElementById('olSearch'); if (box) box.value = ''; renderOutline(); }
  else if (a === 'add-open') { adding = t.dataset.chapter; addKind = t.dataset.kind || addKind; openAddSheet(); }
  else if (a === 'add-kind') { addKind = t.dataset.kind; openAddSheet(); }
  else if (a === 'add-save') saveStep();
  else if (a === 'edit') openEditSheet(id);
  else if (a === 'edit-save') saveEdit();
  else if (a === 'share-slice') { hideAllSheets(); setTimeout(() => openShareSheet(null, { sliceId: id }), 150); }
}

// Along the bottom, as on the board: Collapse all (every chapter and every slice's scenarios)
// or Expand all, then the counts
function bottomBar(state, layout) {
  const title = outlineBookName(state);
  if (!layout.sliceCount) return `<div class="bd-stats ol-stats">${outlineBookTitle(title)}</div>`;
  const stat = (n, one, many) => `<span class="bd-stat">${n} ${n === 1 ? one : many}</span>`;
  const { slices, chapters, scenarios } = layout.totals;
  return `<div class="bd-stats ol-stats">
    ${outlineBookTitle(title)}
    ${outlineFoldAll(outlineFoldAllState(state, { collapsedAll, folded: isChapterFolded }))}
    ${usageButton(getEventStream())}
    ${outlineBarComments(outlineOpenCommentsCount(state))}
    ${statusChips(layout.stageSlices)}
    ${stat(slices, 'slice', 'slices')}${chapters ? stat(chapters, 'chapter', 'chapters') : ''}${stat(scenarios, 'scenario', 'scenarios')}
  </div>`;
}

// Two rounds (structure, then text): where the book is, once it's in them
function roundsLine(text) {
  return text ? `<div class="ol-verify ol-rounds">${escapeHtml(text)}</div>` : '';
}

// While verifying: how far it's got
function verifyLine(v) {
  return v ? `<div class="ol-verify">Verifying edition ${v.edition}: <b>✓ ${v.works}</b> · <b>✗ ${v.fails}</b> · ${v.untested} to try</div>` : '';
}

// ✗ asks what happened (that note becomes a comment on the scenario)
function askWhatHappened(sliceId, scenarioId) {
  openBoardSheet(outlineVerdictSheet(outlineVerdictForm(projectState(), sliceId, scenarioId)), 'vdNote');
}

function saveVerdict(sliceId, scenarioId, verdict, note) {
  const why = recordVerdict({ sliceId, scenarioId, verdict, note }, screenNow?.layout.verify?.edition ?? null);
  if (why === 'Pick a nickname first') { openThread(sliceId, scenarioId); showToast('Pick a nickname first, then try again'); return false; }
  if (why) { showToast(why); return false; }
  return true;
}

// A comment picked in the drawer: unfold its chapter, open its slice, scroll to it and flash it
function revealComment(c) {
  const chapterId = screenNow.layout.chapters.find(ch => ch.slices.some(sl => sl.id === c.sliceId))?.id;
  if (chapterId && isChapterFolded(chapterId)) toggleChapterFolded(chapterId);
  if (!gwtOpen(c.sliceId)) { toggled.has(c.sliceId) ? toggled.delete(c.sliceId) : toggled.add(c.sliceId); }
  renderOutline();
  const el = document.querySelector(`[data-cm-anchor="${c.commentId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1400);
}

// Enter steps from the command to the event, and adds the step from the last field
// (in the description it's a new line)
function handleKey(e) {
  // A row (a div, so ⋮ can sit inside it after the name) opens with Enter or Space
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList?.contains('ol-main')) { e.preventDefault(); e.target.click(); return; }
  if (e.key !== 'Enter' || !e.target.closest('.ol-add') || e.target.tagName === 'TEXTAREA') return;
  e.preventDefault();
  if (e.target.closest('.ol-edit')) { saveEdit(); return; }
  const fields = addForm?.fields || [];
  const i = fields.findIndex(f => f.id === e.target.id);
  if (i >= 0 && i < fields.length - 1) document.getElementById(fields[i + 1].id)?.focus();
  else saveStep();
}

// Scrolled down: a translucent line under the app header says where you are, "Chapter › slice"
// (the slice whose row is at the top). Outside the page's flow, so scrolling can't shift anything
function pinOutline() {
  const view = document.getElementById('outlineView');
  let ov = document.getElementById('outlineOverlay');
  if (!ov) { ov = document.createElement('div'); ov.id = 'outlineOverlay'; ov.setAttribute('aria-hidden', 'true'); document.body.appendChild(ov); }
  const shown = view && view.offsetParent !== null;
  const top = document.querySelector('.header')?.getBoundingClientRect().bottom || 0;
  const above = sel => [...view.querySelectorAll(sel)].filter(el => el.getBoundingClientRect().top < top + 8).pop();
  const row = shown ? above('.ol-row') : null;
  ov.classList.toggle('on', !!row);
  if (!row) return;
  const chapter = above('.ol-chapter');
  const r = view.getBoundingClientRect();
  ov.style.cssText = `top:${top}px;left:${r.left}px;width:${r.width}px`;
  const name = (chapter?.querySelector('.ol-chapter-name')?.textContent || '').replace(/⋮\s*$/, '').trim();
  ov.innerHTML = `<span class="oo-line">${name ? `<i class="bo-chapter">${escapeHtml(name)} ›</i> ` : ''}${escapeHtml(row.querySelector('.ol-name-text')?.textContent?.trim() || '')}</span>`;
}
let outlinePinning = false;
const onOutlineScroll = () => {
  if (outlinePinning) return;
  outlinePinning = true;
  requestAnimationFrame(() => { outlinePinning = false; pinOutline(); });
};

export function initOutline() {
  const view = document.getElementById('outlineView');
  window.addEventListener('scroll', onOutlineScroll, { passive: true });
  view?.addEventListener('click', handleClick);
  view?.addEventListener('keydown', handleKey);
  view?.addEventListener('input', e => {
    if (e.target.id !== 'olSearch') return;
    query = e.target.value;
    renderOutline();
  });
  // The add and edit forms live in the board sheet
  const sheet = document.getElementById('boardSheetContent');
  sheet?.addEventListener('click', handleClick);
  sheet?.addEventListener('keydown', handleKey);
  // An automation's hint follows what's typed and ticked
  const hint = e => {
    if (addForm?.kind !== 'AU' || !e.target.closest('.ol-add')) return;
    const el = document.getElementById('olAddHint');
    if (el) el.textContent = outlineAddHint(addForm, { when: fieldValue('olAddFirst'), using: fieldValue('olAddUsing'), external: checked('olAddExternal') });
  };
  sheet?.addEventListener('input', hint);
  sheet?.addEventListener('change', hint);
}
