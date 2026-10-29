// ===========================================
// OUTLINE - View (SV: View Outline)
// The model as a table of contents: chapters with their slices. Reorder with
// ↑ ↓ (stepping across chapter edges), or select several and move them to a
// chapter in one go. Tap a slice to jump to it on the board. ＋ Add step under a
// chapter sketches the journey from here: a change (command → event), a view
// (read model) or an automation, named after its command or read model.
// ===========================================

import { statusChips, shows, filtering as staged, emptyText, filterFor } from '../filter/status.js';
import { projectState, getBoardGroups, getScenariosForSlice, sliceTitle, refinedLabel } from '../../core/projections.js';
import { renderGwt, hasValues, pendingMark } from '../scenarios/view.js';
import { typeLabels, byName, propLabel } from '../../core/constants.js';
import { setMustHave } from '../scenarios/command.js';
import { render, showSlicePage } from '../../ui/feed.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml, isChapterFolded, toggleChapterFolded, setAllChaptersFolded, isChapterBookmarked, bookTitle } from '../board/view.js';
import { moveSlice, placeSlices, setSliceChapter, moveChapter, createChapter, sliceActor, createSlice, addToSlice, describeSlice,
  createAutomation, setTrigger, linkReads, setTodo, newId, markSliceRefined, clearSliceRefined } from '../board/command.js';
import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { addOutlineProperties, reoutlineSlice, outlinePropertiesText } from './command.js';
import { toastWithUndo } from '../undo/command.js';
import { openChapterMenu, openChapterPicker } from '../board/sheets.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { openShareSheet } from '../shareImage/sheet.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { isReadOnly } from '../readOnly/sheet.js';
import { openScenariosSheet } from '../board/sheets/scenarios.js';
import { openThread, openCommentsList } from '../comments/sheet.js';
import { canAddScenariosHere, reviewOf } from '../review/client.js';
import { verifyingEdition } from '../verify/command.js';
import { recordVerdict, verificationResults, verdictOf } from '../verify/command.js';
import { getCurrentModelId, getEventStream } from '../../core/eventStore.js';
import { isBuildBook } from '../buildVersions/rules.js';
import { commentsOn, openComments } from '../comments/read.js';
import { usageBadge, usageButton } from '../usage/view.js';

// Short enough to leave the slice name room on a phone; the colour bar says the rest
const shortKind = { SC: 'Change', SV: 'View', AU: 'Automation' };

let selecting = false;
let query = '';            // the search box: filters slices (and opens folded chapters while it does)
let selected = new Set();
// Scenarios show under every slice unless the outline is collapsed (Collapse outline, kept
// per device); a slice tapped open or shut goes the other way from that
const COLLAPSED_KEY = 'eventpad_outline_collapsed';
let collapsedAll = (() => { try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch (e) { return false; } })();
const toggled = new Set();
const gwtOpen = id => collapsedAll ? toggled.has(id) : !toggled.has(id);
let adding = null;         // chapter id ('' for no chapter) the add sheet adds to
let addKind = 'SC';        // Do (state change), See (state view) or Auto (automation)

// Read order of a slice: the way its story flows through the lanes
const laneFlow = { SC: [0, 1, 2], SV: [2, 1, 0], AU: [2, 0, 1] };
const laneOf = { screen: 0, processor: 0, command: 1, readModel: 1, event: 2 };

// Fields (stickies' properties, scenario values) only when asked for: per device
const FIELDS_KEY = 'eventpad_outline_fields';
let showFields = false;
try { showFields = localStorage.getItem(FIELDS_KEY) === '1'; } catch (e) { /* storage blocked */ }
const allScenarios = new Set(); // slices showing their nice to haves too
const openFields = new Set();   // slices showing their fields
const openValues = new Set();   // slices showing their scenarios' values

function summary(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const names = (laneFlow[slice.type] || [0, 1, 2])
    .flatMap(l => els.filter(e => laneOf[e.type] === l))
    .map(e => escapeHtml(e.name));
  return names.length ? names.join(' → ') : '<i>empty</i>';
}

// A slice's fields, each name once. One that only some of its stickies carry (a command's
// input the event doesn't keep, a value the view works out) wears the emoji of those stickies.
const fieldMark = { command: '🟦', event: '🟧', readModel: '🟩', processor: '🟪', screen: '⬜' };
const markName = { command: 'command', event: 'event', readModel: 'view', processor: 'automation', screen: 'screen' };
function sliceFields(slice, state) {
  const carriers = slice.elements.map(id => state.elements[id]).filter(e => e?.properties?.length);
  const byName = new Map();
  carriers.forEach(el => el.properties.forEach(p => {
    const key = p.name.toLowerCase();
    if (!byName.has(key)) byName.set(key, { prop: p, on: [] });
    byName.get(key).on.push(el);
  }));
  // The ones every sticky shares first, then the marked ones
  return [...byName.values()].map(({ prop, on }) => ({
    prop,
    marks: carriers.length > 1 && on.length < carriers.length ? [...new Set(on.map(el => el.type))] : []
  })).sort((a, b) => !!a.marks.length - !!b.marks.length);
}

function renderFields(slice, state) {
  const fields = sliceFields(slice, state);
  if (!fields.length) return '';
  const used = [...new Set(fields.flatMap(f => f.marks))];
  return `
    <div class="ol-fieldlist">
      ${fields.map(({ prop, marks }) => `<span class="ol-field">${marks.map(t => fieldMark[t]).join('')}${marks.length ? ' ' : ''}${escapeHtml(propLabel(prop))}${prop.type && prop.type !== 'string' ? ` <i>${escapeHtml(prop.type)}</i>` : ''}</span>`).join('')}
      ${used.length ? `<span class="ol-field-key">Squares: which stickies carry it (${used.map(t => `${fieldMark[t]} ${markName[t] === 'event' || markName[t] === 'automation' ? 'an' : 'the'} ${markName[t]}`).join(' · ')}); no square: all of them</span>` : ''}
    </div>`;
}

const refinedOf = slices => slices.filter(s => s.refined).length;

// Groups the outline can move slices between (synthetic automations excluded)
function movableGroups(state) {
  return getBoardGroups(state).map(g => ({ ...g, slices: g.slices.filter(s => state.sliceOrder.includes(s.id)) }));
}

// The slice plus its automation partner, in board order
function withPartner(sliceId, state) {
  const partner = state.slices[sliceId]?.pairWith;
  const ids = [sliceId, partner].filter(id => id && state.slices[id]);
  return ids.sort((a, b) => state.sliceOrder.indexOf(a) - state.sliceOrder.indexOf(b));
}

// ↑ / ↓ within a chapter; at a chapter's edge, step into the neighbouring one
function stepSlice(sliceId, dir) {
  const state = projectState();
  const groups = movableGroups(state);
  const gi = groups.findIndex(g => g.slices.some(s => s.id === sliceId));
  if (gi < 0) return;
  const list = groups[gi].slices;
  const i = list.findIndex(s => s.id === sliceId);
  const neighbour = list[i + dir];
  if (neighbour) { moveSlice(sliceId, neighbour.id); return; }

  const target = groups[gi + dir];
  // Above the first chapter is "no chapter", even when that group isn't showing
  const targetChapter = target ? (target.chapter?.id || null) : (dir < 0 && groups[gi].chapter ? null : undefined);
  if (targetChapter === undefined) return;
  const ids = withPartner(sliceId, state);
  setSliceChapter(sliceId, targetChapter);
  if (target?.slices.length) {
    placeSlices(ids, dir < 0 ? { after: target.slices[target.slices.length - 1].id } : { before: target.slices[0].id });
  }
}

// Move every selected slice to the end of a chapter, keeping their order
function moveSelected(chapterId) {
  const state = projectState();
  const order = movableGroups(state).flatMap(g => g.slices.map(s => s.id));
  const ids = [...new Set([...selected].flatMap(id => withPartner(id, state)))]
    .sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const target = movableGroups(state).find(g => (g.chapter?.id || null) === chapterId);
  const last = target?.slices.filter(s => !ids.includes(s.id)).pop();
  ids.forEach(id => setSliceChapter(id, chapterId));
  if (last) placeSlices(ids, { after: last.id });
  const name = chapterId ? state.chapters[chapterId].name : 'no chapter';
  showToast(`${selected.size} moved to ${name}`);
  selected.clear();
  selecting = false;
}

// Must haves are the acceptance criteria: once a slice has some, they're what the outline
// shows; the rest (nice to haves: whatever else was built) wait behind "+ N nice to haves"
function renderScenarios(slice, state) {
  const scenarios = getScenariosForSlice(slice.id, state);
  if (selecting) return { toggle: '', list: '' };
  // ＋ Scenario opens the slice's scenarios to add one: yours to change, or a review that lets you add them
  const canAdd = !isReadOnly() || canAddScenariosHere();
  const add = cls => canAdd ? `<button class="${cls} ol-add-scenario" data-outline-action="add-scenario" data-slice="${slice.id}">＋ Scenario</button>` : '';
  if (!scenarios.length) return { toggle: add('ol-gwt-toggle'), list: '' };
  const open = gwtOpen(slice.id);
  const must = scenarios.filter(s => s.mustHave);
  const extra = scenarios.length - must.length;
  const label = must.length
    ? `★ ${must.length} must ${must.length === 1 ? 'have' : 'haves'}${extra ? ` · ${extra} nice to ${extra === 1 ? 'have' : 'haves'}` : ''}`
    : `✓ ${scenarios.length} ${scenarios.length === 1 ? 'scenario' : 'scenarios'}`;
  const everything = !must.length || allScenarios.has(slice.id);
  const verifyEd = verifyingEdition(state);
  const shown = everything ? [...scenarios].sort((a, b) => !!b.mustHave - !!a.mustHave) : must;
  return {
    toggle: `<button class="ol-gwt-toggle" data-outline-action="gwt" data-slice="${slice.id}">${label} ${open ? '▴' : '▾'}</button>`,
    list: open ? shown.map(scn => `
      <div class="ol-scenario-row">
        <button class="ol-must ${scn.mustHave ? 'on' : ''}" data-outline-action="must" data-scenario="${scn.id}" aria-pressed="${!!scn.mustHave}"
          aria-label="${scn.mustHave ? 'Must have: tap to make it a nice to have' : 'Nice to have: tap to make it a must have'}">${scn.mustHave ? '★' : '☆'}</button>
        <button class="ol-scenario" data-outline-action="edit-scenario" data-scenario="${scn.id}">
          <span class="ol-scenario-name">${escapeHtml(scn.name)}${pendingMark(scn)}</span>
          ${scn.source?.file ? `<span class="ol-src">📄 ${escapeHtml(scn.source.file.split('/').pop())}${scn.source.line ? `:${scn.source.line}` : ''}</span>` : ''}
          ${renderGwt(scn, state, { values: showFields || openValues.has(slice.id) })}
        </button>
        ${verifyEd != null ? verdictButtons(slice.id, scn.id, state, verifyEd) : ''}
        ${commentButton(slice.id, scn.id, state)}
      </div>${inlineComments(slice.id, scn.id, state)}`).join('') + (must.length && extra
        ? `<button class="ol-more" data-outline-action="nice" data-slice="${slice.id}">${everything ? 'Only the must haves' : `+ ${extra} nice to ${extra === 1 ? 'have' : 'haves'}`}</button>` : '') + add('ol-more') : ''
  };
}

// 💬 beside a scenario (or a slice): its open comments' count; tap for the thread
function commentButton(sliceId, scenarioId, state) {
  const open = commentsOn(state, sliceId, scenarioId).filter(c => !c.resolved).length;
  return `<button class="ol-cm ${open ? 'has' : ''}" data-outline-action="comment" data-slice="${sliceId}"${scenarioId ? ` data-scenario="${scenarioId}"` : ''}
    aria-label="${open ? `${open} open ${open === 1 ? 'comment' : 'comments'}` : 'Comment'}">💬${open ? ` ${open}` : ''}</button>`;
}

// Verifying a shipped edition here: the published book's edition, or a verification link's;
// null when there's nothing to verify (a draft, or a review of the plan)

// ✓ works / ✗ doesn't beside a scenario, the latest verdict lit
function verdictButtons(sliceId, scenarioId, state, edition) {
  const v = verdictOf(state, edition, scenarioId)?.verdict;
  return `<span class="ol-vd" role="group" aria-label="Verified in the shipped app">
    <button class="ol-vd-btn works ${v === 'works' ? 'on' : ''}" data-outline-action="verdict" data-verdict="works" data-slice="${sliceId}" data-scenario="${scenarioId}" aria-pressed="${v === 'works'}" aria-label="Works">✓</button>
    <button class="ol-vd-btn fails ${v === 'fails' ? 'on' : ''}" data-outline-action="verdict" data-verdict="fails" data-slice="${sliceId}" data-scenario="${scenarioId}" aria-pressed="${v === 'fails'}" aria-label="Doesn't work">✗</button>
  </span>`;
}

// A scenario's (or slice's) open comments, right under it
const partLabel = { given: 'Given', when: 'When', then: 'Then' };
function inlineComments(sliceId, scenarioId, state) {
  const open = commentsOn(state, sliceId, scenarioId).filter(c => !c.resolved);
  if (!open.length) return '';
  return `<div class="ol-cm-list">${open.map(c => `
    <button class="ol-cm-line" data-outline-action="comment" data-slice="${sliceId}"${scenarioId ? ` data-scenario="${scenarioId}"` : ''} data-cm-anchor="${c.commentId}">
      <b>${escapeHtml(c.nickname)}</b>${c.part ? ` <span class="cm-part">${partLabel[c.part]}</span>` : ''} ${escapeHtml(c.text)}
    </button>`).join('')}</div>`;
}

// What the outline can add, and how each kind is asked for. An automation reads
// as a sentence — When … using … ⚙ … does … → … — and its shape follows from
// what's filled in: a reactor, a translator (from another system), or a to-do
// list it works through (a new read model gets its own view beside it).
const addKinds = {
  SC: { label: 'Do', hint: () => 'A state change: what someone does, and what happened', propsNote: 'on the command and its event', fields: [
    { id: 'olAddFirst', type: 'command', label: 'Command', placeholder: 'e.g. Place order', required: true },
    { id: 'olAddEvent', type: 'event', label: 'Event', placeholder: 'e.g. Order placed (optional)' }] },
  SV: { label: 'See', hint: () => 'A state view: what someone sees', propsNote: 'on the read model', fields: [
    { id: 'olAddFirst', type: 'readModel', label: 'Read model', placeholder: 'e.g. Order summary', required: true }] },
  AU: { label: 'Auto', hint: autoHint, propsNote: 'on the command and its result', fields: [
    { id: 'olAddFirst', type: 'event', label: 'When', placeholder: 'e.g. Agreement signed',
      check: { id: 'olAddExternal', label: 'from another system' } },
    { id: 'olAddUsing', type: 'readModel', label: 'Using', placeholder: 'e.g. Payments to capture (optional)',
      check: { id: 'olAddTodo', label: "it's a to-do list" } },
    { id: 'olAddProc', type: 'processor', label: '⚙ Processor', placeholder: 'e.g. Payment processor', required: true },
    { id: 'olAddCmd', type: 'command', label: 'Does', placeholder: 'e.g. Capture payment', required: true },
    { id: 'olAddResult', type: 'event', label: '→ Result', placeholder: 'e.g. Payment captured (optional)' }] }
};

// Names already in the model, so a step can reuse an event or read model
function namesOf(type, state) {
  return [...new Set(Object.values(state.elements).filter(e => e.type === type).map(e => e.name))]
    .map(name => ({ name })).sort(byName).map(n => n.name);
}

// An element of this type with this name (any case), if the model has one
function existing(type, name, state) {
  const key = name.trim().toLowerCase();
  return key ? Object.values(state.elements).find(e => e.type === type && e.name.trim().toLowerCase() === key) : null;
}

const fieldValue = id => document.getElementById(id)?.value.trim() || '';
const checked = id => !!document.getElementById(id)?.checked;

// What an automation will add, from what's filled in so far
function autoHint() {
  const state = projectState();
  const when = fieldValue('olAddFirst'), using = fieldValue('olAddUsing');
  if (using && !existing('readModel', using, state)) return `Adds 2 slices: the view of ${using}, then what it does`;
  if (when && checked('olAddExternal')) return `Adds 1 slice: it translates ${when} into a command of your own`;
  if (when) return `Adds 1 slice: it reacts to ${when} and sends the command`;
  return 'An automation: the system reacts and sends a command';
}

// ＋ Do · ＋ See · ＋ Auto under each chapter. The forms open in a sheet (a drawer):
// the page's stuck tabs can't cover them, and sheets sit above the keyboard.
function renderAddButtons(key) {
  return `<div class="ol-add-steps">${Object.entries(addKinds).map(([k, v]) =>
    `<button class="ol-add-step" data-outline-action="add-open" data-chapter="${key}" data-kind="${k}">＋ ${v.label}</button>`).join('')}</div>`;
}

function openAddSheet() {
  openBoardSheet(renderAddForm(projectState()), 'olAddFirst');
}

function renderAddForm(state) {
  const kind = addKinds[addKind];
  const last = kind.fields[kind.fields.length - 1];
  const chapter = adding && state.chapters[adding];
  return `
    <div class="ol-add">
      <div class="sheet-title">Add a step ${chapter ? `<span class="bd-sheet-sub">${escapeHtml(chapter.name)}</span>` : ''}</div>
      <div class="ol-add-kinds">
        ${Object.entries(addKinds).map(([k, v]) => `<button class="bd-chapter-chip ${k === addKind ? 'active' : ''}" data-outline-action="add-kind" data-kind="${k}">${v.label}</button>`).join('')}
      </div>
      <div class="ol-add-hint" id="olAddHint">${escapeHtml(kind.hint())}</div>
      ${kind.fields.map(f => `
        <label class="ol-add-label" for="${f.id}">${f.label}</label>
        <input class="sheet-input" id="${f.id}" list="${f.id}List" placeholder="${f.placeholder}" autocomplete="off" enterkeyhint="${f === last ? 'done' : 'next'}">
        <datalist id="${f.id}List">${namesOf(f.type, state).map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>
        ${f.check ? `<label class="ol-add-check"><input type="checkbox" id="${f.check.id}"> ${f.check.label}</label>` : ''}`).join('')}
      <label class="ol-add-label" for="olAddProps">Properties <span class="ol-add-note">${kind.propsNote}</span></label>
      <input class="sheet-input" id="olAddProps" placeholder="Optional: orderId, amount, lines[]" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <label class="ol-add-label" for="olAddDesc">Description</label>
      <textarea class="sheet-input ol-add-desc" id="olAddDesc" rows="4" placeholder="Optional: what this step is about, rules, open questions"></textarea>
      <button class="sheet-btn" data-outline-action="add-save">✓ Add</button>
    </div>`;
}

// Make the step: an existing element with the same name is reused, not copied
function saveStep() {
  const state = projectState();
  const kind = addKinds[addKind];
  const missing = kind.fields.find(f => f.required && !fieldValue(f.id));
  if (missing) {
    document.getElementById(missing.id)?.focus();
    showToast(`Name the ${missing.label.replace(/^\W+/, '').toLowerCase()} first`);
    return;
  }
  const as = (type, name) => {
    const same = existing(type, name, state);
    return same ? { elementId: same.id } : { name };
  };
  let sliceId;
  if (addKind === 'AU') sliceId = saveAutomation(state, as);
  else {
    sliceId = createSlice(addKind, null, { chapterId: adding || null });
    kind.fields.forEach(f => { if (fieldValue(f.id)) addToSlice(sliceId, f.type, as(f.type, fieldValue(f.id))); });
  }
  // Properties go on the step's command and event (an automation's trigger keeps its own)
  addOutlineProperties(sliceId, fieldValue('olAddProps'));
  const description = fieldValue('olAddDesc');
  if (description) describeSlice(sliceId, description);
  const title = fieldValue(kind.fields.find(f => f.required).id);
  render();
  openAddSheet();
  showToast(`Added ${title}`);
}

// When [event] using [read model] ⚙ [processor] does [command] → [result]
function saveAutomation(state, as) {
  const chapterId = adding || null;
  const when = fieldValue('olAddFirst'), using = fieldValue('olAddUsing');
  const known = using ? existing('readModel', using, state) : null;

  // The trigger: an event already in the model, or a new one
  let triggerId = when ? existing('event', when, state)?.id : null;
  if (when && !triggerId) {
    triggerId = newId('el');
    appendEvent(EventTypes.ElementCreated, { elementId: triggerId, elementType: 'event', name: when });
  }
  if (triggerId && checked('olAddExternal')) appendEvent(EventTypes.ElementExternalSet, { elementId: triggerId, external: true });

  // A new read model gets its own view (the trigger feeding it), beside what it does
  let sliceId, viewId = null;
  if (using && !known) {
    viewId = createAutomation(null, chapterId);
    sliceId = projectState().slices[viewId].pairWith;
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

// What a slice's edit form asks for: its main stickies, by kind
function editFields(slice, state) {
  const els = slice.elements.map(id => state.elements[id]).filter(Boolean);
  const first = type => els.find(e => e.type === type) || null;
  const field = (type, label, required = false) => ({ type, label, required, el: first(type) });
  if (slice.type === 'SV') return [field('readModel', 'Read model', true)];
  if (sliceActor(slice, state) === 'processor' || slice.type === 'AU') {
    return [field('processor', '⚙ Processor', true), field('command', 'Does', true), field('event', '→ Result')];
  }
  return [field('command', 'Command', true), field('event', 'Event')];
}

function openEditSheet(sliceId) {
  const state = projectState();
  const slice = state.slices[sliceId];
  if (slice) openBoardSheet(renderEdit(slice, state));
}

function renderEdit(slice, state) {
  const fields = editFields(slice, state);
  const shown = new Set(fields.map(f => f.el?.id));
  const more = slice.elements.filter(id => state.elements[id] && !shown.has(id) && state.elements[id].type !== 'screen').length;
  return `
    <div class="ol-add ol-edit" data-slice="${slice.id}">
      <div class="sheet-title">${escapeHtml(sliceTitle(slice, state))}</div>
      ${fields.map((f, i) => `
        <label class="ol-add-label" for="olEd${i}">${f.label}</label>
        <input class="sheet-input" id="olEd${i}" list="olEd${i}List" value="${escapeHtml(f.el?.name || '')}" placeholder="${f.required ? '' : 'optional'}"
          data-type="${f.type}" data-el="${f.el?.id || ''}" ${f.required ? 'data-required="1"' : ''} autocomplete="off" enterkeyhint="done">
        <datalist id="olEd${i}List">${namesOf(f.type, state).map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>`).join('')}
      ${more ? `<div class="ol-add-hint">＋ ${more} more on the board (and its screens)</div>` : ''}
      <label class="ol-add-label" for="olEdProps">Properties <span class="ol-add-note">on its ${slice.type === 'SV' ? 'read model' : 'command and event'}</span></label>
      <input class="sheet-input" id="olEdProps" value="${escapeHtml(outlinePropertiesText(slice.id, state))}" placeholder="orderId, amount, lines[]" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <label class="ol-add-label" for="olEdDesc">Description</label>
      <textarea class="sheet-input ol-add-desc" id="olEdDesc" rows="4" placeholder="What this step is about, rules, open questions">${escapeHtml(slice.description || '')}</textarea>
      <div class="ol-edit-actions">
        <button class="sheet-btn secondary" data-outline-action="open-slice" data-slice="${slice.id}">Open</button>
        <button class="sheet-btn secondary" data-outline-action="jump" data-slice="${slice.id}">↗ Board</button>
        <button class="sheet-btn secondary" data-outline-action="share-slice" data-slice="${slice.id}">Share…</button>
        <button class="sheet-btn" data-outline-action="edit-save">✓ Save</button>
      </div>
    </div>`;
}

// Save the edit as one action (Undo takes it all back)
function saveEdit() {
  const form = document.querySelector('.ol-edit');
  if (!form) return;
  const sliceId = form.dataset.slice;
  const inputs = [...form.querySelectorAll('input[data-type]')];
  const missing = inputs.find(i => i.dataset.required && !i.value.trim());
  if (missing) { missing.focus(); showToast('That one needs a name'); return; }
  const before = outlinePropertiesText(sliceId);
  reoutlineSlice(sliceId, {
    fields: inputs.map(i => ({ type: i.dataset.type, elementId: i.dataset.el || null, value: i.value })),
    props: { before, after: document.getElementById('olEdProps').value },
    description: document.getElementById('olEdDesc').value
  });
  hideAllSheets();
  render();
  toastWithUndo(`Updated ${sliceTitle(projectState().slices[sliceId], projectState())}`);
}

// Every word typed must appear in the slice: its name, its stickies, its description
// (or in its chapter's name, which brings the whole chapter)
const norm = t => String(t || '').toLowerCase();
function queryWords() { return norm(query).split(/\s+/).filter(Boolean); }
function sliceText(slice, state) {
  return norm([sliceTitle(slice, state), slice.description,
    ...slice.elements.map(id => state.elements[id]?.name)].join(' '));
}
const matches = (text, words) => words.every(w => text.includes(w));

function renderRow(slice, state, first, last) {
  const actor = sliceActor(slice, state);
  const isSel = selected.has(slice.id);
  return `
    <div class="ol-item">
    <div class="ol-row ${isSel ? 'selected' : ''}">
      ${selecting ? `<button class="ol-check" data-outline-action="toggle" data-slice="${slice.id}" aria-label="Select">${isSel ? '✓' : ''}</button>` : ''}
      <span class="ol-dot" data-slice-type="${slice.type}" data-actor="${actor}"></span>
      <div class="ol-main" role="button" tabindex="0" data-outline-action="${selecting ? 'toggle' : 'expand'}" data-slice="${slice.id}"${selecting ? '' : ` aria-expanded="${gwtOpen(slice.id)}"`}>
        <span class="ol-name">${selecting ? '' : `<button class="ol-kebab" aria-label="Edit ${escapeHtml(sliceTitle(slice, state))}" data-outline-action="edit" data-slice="${slice.id}">⋮</button>`}<span class="ol-name-text">${slice.refined ? '<span class="ol-refined-badge" aria-label="Refined"></span> ' : ''}${escapeHtml(sliceTitle(slice, state))}</span></span>
        <span class="ol-kind">${actor === 'processor' && slice.type !== 'AU' ? '⚙ ' : ''}${shortKind[slice.type] || slice.type}</span>
        ${usageBadge(slice, state)}
        <span class="ol-summary">${summary(slice, state)}</span>
        ${slice.description ? `<span class="ol-desc">${escapeHtml(slice.description)}</span>` : ''}
      </div>
      ${selecting ? '' : `
      <div class="ol-step">
        <button aria-label="Show on the board" data-outline-action="jump" data-slice="${slice.id}">↗</button>
        ${query ? '' : `
        <button aria-label="Move up" data-outline-action="up" data-slice="${slice.id}" ${first ? 'disabled' : ''}>↑</button>
        <button aria-label="Move down" data-outline-action="down" data-slice="${slice.id}" ${last ? 'disabled' : ''}>↓</button>`}
      </div>`}
    </div>
    ${renderDetails(slice, state)}
    </div>`;
}

// Under a row: its fields and scenarios pills, then whichever is open
function renderDetails(slice, state) {
  if (selecting) return '';
  const fields = sliceFields(slice, state).length;
  const fieldsOpen = showFields || openFields.has(slice.id);
  const { toggle, list } = renderScenarios(slice, state);
  // Refined (planned out): marked by hand once it has scenarios; any edit to the slice takes it back
  const refined = `<button class="ol-gwt-toggle ol-refined-pill ${slice.refined ? 'on' : ''}" data-outline-action="refined" data-slice="${slice.id}" aria-pressed="${!!slice.refined}"
    aria-label="${slice.refined ? 'Refined: tap to take it back' : 'Mark refined'}"><span class="ol-tick" aria-hidden="true"></span>Refined</button>`;
  const pill = fields ? `<button class="ol-gwt-toggle ol-fields-pill" data-outline-action="fields-one" data-slice="${slice.id}">${fields} ${fields === 1 ? 'field' : 'fields'} ${fieldsOpen ? '▴' : '▾'}</button>` : '';
  // Values in the open scenarios: only offered when some were filled in
  const valuesOn = showFields || openValues.has(slice.id);
  const values = list && !showFields && getScenariosForSlice(slice.id, state).some(hasValues)
    ? `<button class="ol-gwt-toggle ol-values-pill ${valuesOn ? 'on' : ''}" data-outline-action="values-one" data-slice="${slice.id}" aria-pressed="${valuesOn}">${valuesOn ? '✓ values' : 'values'}</button>` : '';
  return `<div class="ol-pills">${pill}${toggle}${values}${refined}${commentButton(slice.id, null, state)}</div>${inlineComments(slice.id, null, state)}${fieldsOpen ? renderFields(slice, state) : ''}${list}`;
}

export function renderOutline() {
  const container = document.getElementById('outlineView');
  if (!container) return;
  const state = projectState();
  const groups = movableGroups(state);
  const all = groups.flatMap(g => g.slices);
  const firstId = all[0]?.id;
  const lastId = all[all.length - 1]?.id;
  // The first slice can still step up out of a chapter into "no chapter"
  const canLeaveFirst = groups[0]?.chapter;

  const words = queryWords();
  filterFor(state);
  // Searching or showing one stage: chapters open, the ones with nothing to show are left out
  const filtering = words.length || staged();
  const openCount = openComments(state).length;
  let shown = 0;
  // A build book's slices are all built: its chapters count slices and scenarios, not Refined
  const built = isBuildBook(getEventStream());
  const sections = groups.map(({ chapter, slices: inChapter }, gi) => {
    // Searching: a matching chapter shows all its slices, otherwise just the matching ones
    const found = !words.length || (chapter && matches(norm(chapter.name), words))
      ? inChapter : inChapter.filter(sl => matches(sliceText(sl, state), words));
    const slices = found.filter(shows);
    if (filtering && !slices.length) return '';
    shown += slices.length;
    const ci = chapter ? state.chapterOrder.indexOf(chapter.id) : -1;
    // Folding here and on the board is the same thing; a search opens chapters (without unfolding them for good)
    const folded = chapter && !filtering && isChapterFolded(chapter.id);
    const bands = folded ? `<span class="ol-bands">${slices.map(s =>
      `<span class="bd-spine-band" data-slice-type="${sliceActor(s, state) === 'processor' ? 'AU' : s.type}"></span>`).join('')}</span>` : '';
    const head = chapter ? `
      <div class="ol-chapter ${folded ? 'folded' : ''}">
        <button class="ol-fold" aria-label="${folded ? 'Open' : 'Fold'} ${escapeHtml(chapter.name)}" data-outline-action="fold" data-chapter="${chapter.id}">${folded ? '›' : '⌄'}</button>
        <div class="ol-ch-text">
          <button class="ol-chapter-name" data-outline-action="chapter-menu" data-chapter="${chapter.id}">${isChapterBookmarked(chapter.id) ? '<span class="ch-mark" aria-label="Bookmarked">🔖</span> ' : ''}${escapeHtml(chapter.name)}</button>
          <span class="ol-count">${inChapter.length && !words.length ? chapterMeta(inChapter, state, built) : slices.length}${bands}</span>
        </div>
        <div class="ol-step" ${words.length ? 'hidden' : ''}>
          <button aria-label="Chapter earlier" data-outline-action="chapter-up" data-chapter="${chapter.id}" data-to="${ci - 1}" ${ci === 0 ? 'disabled' : ''}>↑</button>
          <button aria-label="Chapter later" data-outline-action="chapter-down" data-chapter="${chapter.id}" data-to="${ci + 1}" ${ci === state.chapterOrder.length - 1 ? 'disabled' : ''}>↓</button>
        </div>
      </div>` : (state.chapterOrder.length ? `<div class="ol-chapter ol-loose"><span class="ol-chapter-name">Not in a chapter</span><span class="ol-count">${slices.length}</span></div>` : '');
    const rows = folded ? ''
      : slices.length
        ? slices.map(s => renderRow(s, state, s.id === firstId && !canLeaveFirst, s.id === lastId)).join('')
        : `<div class="ol-empty">No slices yet — add the first step below, or move some here</div>`;
    const add = folded || selecting || filtering ? '' : renderAddButtons(chapter?.id || '');
    return `<section class="ol-section">${head}${rows}${add}</section>`;
  }).join('');

  const moveBar = selecting ? `
    <div class="ol-movebar">
      <span>${selected.size} selected · move to</span>
      <div class="ol-move-targets">
        ${state.chapterOrder.map(id => `<button class="bd-chapter-chip" data-outline-action="move-to" data-chapter="${id}" ${selected.size ? '' : 'disabled'}>${escapeHtml(state.chapters[id].name)}</button>`).join('')}
        <button class="bd-chapter-chip" data-outline-action="move-to-new" ${selected.size ? '' : 'disabled'}>＋ New chapter</button>
        ${state.chapterOrder.length ? `<button class="bd-chapter-chip" data-outline-action="move-to" data-chapter="" ${selected.size ? '' : 'disabled'}>No chapter</button>` : ''}
      </div>
    </div>` : '';

  // The search box is made once and kept, so typing never loses focus; the rest redraws
  if (!container.querySelector('#olSearch')) {
    container.innerHTML = `
      <div class="ol-search-row">
        <input type="search" class="sheet-input ol-search" id="olSearch" placeholder="Search slices, events, commands…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
        <button class="ol-search-clear" data-outline-action="search-clear" aria-label="Clear the search" hidden>✕</button>
      </div>
      <div id="olBody"></div>`;
  }
  container.querySelector('.ol-search-clear').hidden = !query;
  container.querySelector('#olBody').innerHTML = `
    <div class="ol-toolbar">
      <span class="ol-total">${filtering ? `${shown} of ${all.length} slices` : ""}</span>
      ${all.length ? `<button class="ol-select ol-fields-toggle ${showFields ? 'on' : ''}" data-outline-action="fields" aria-pressed="${showFields}">${showFields ? '✓ Fields' : 'Fields'}</button>` : ''}
      ${all.length && !filtering ? `<button class="ol-select" data-outline-action="select">${selecting ? 'Done' : 'Select'}</button>` : ''}
      ${openCount ? `<button class="ol-select ol-cm-next" data-outline-action="next-comment">💬 ${openCount} open</button>` : ''}
    </div>
    ${verifyLine(state)}
    ${sections || (words.length ? `<div class="ol-empty">Nothing matches "${escapeHtml(query)}"</div>` : staged() ? `<div class="ol-empty">${emptyText()}</div>` : '')}
    ${filtering ? '' : `<button class="ol-add-chapter" data-outline-action="new-chapter">＋ Chapter</button>`}
    ${moveBar}
    ${bottomBar(state, all.length)}`;
  pinOutline();
}

// Not checked out here: expanding, folding, fields and scenarios still open; a slice's row
// opens its page, a scenario its slice's scenarios to read; anything that would change it does nothing
const readOnlyReads = new Set(['jump', 'open-slice', 'gwt', 'expand', 'collapse-all', 'comment', 'next-comment', 'verdict', 'verdict-save', 'nice', 'values-one', 'fields-one', 'fields', 'fold', 'search-clear', 'share-slice', 'add-scenario']);
function readOnlyTap(a, t) {
  if (readOnlyReads.has(a)) return false;
  if (a === 'edit') { hideAllSheets(); showSlicePage(t.dataset.slice); }
  else if (a === 'edit-scenario') {
    const scn = projectState().scenarios[t.dataset.scenario];
    if (scn) openScenariosSheet(scn.sliceId, { readOnly: !canAddScenariosHere() });
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
    setAllChaptersFolded(projectState().chapterOrder, collapsedAll);
    try { localStorage.setItem(COLLAPSED_KEY, collapsedAll ? '1' : '0'); } catch (e) { /* just this time */ }
    renderOutline();
  }
  else if (a === 'comment') openThread(id, t.dataset.scenario || null);
  else if (a === 'verdict') {
    if (t.dataset.verdict === 'fails') askWhatHappened(id, t.dataset.scenario);
    else if (saveVerdict(id, t.dataset.scenario, 'works')) render();
  }
  else if (a === 'verdict-save') {
    if (saveVerdict(id, t.dataset.scenario, 'fails', document.getElementById('vdNote')?.value)) { hideAllSheets(); render(); }
  }
  else if (a === 'next-comment') openCommentsList(revealComment);
  else if (a === 'refined') {
    const slice = projectState().slices[id];
    if (!slice) return;
    if (slice.refined) { clearSliceRefined(id); render(); showToast(`${sliceTitle(slice, projectState())}: no longer refined`); return; }
    const refused = markSliceRefined(id);
    if (refused) { showToast(refused); return; }
    render();
    toastWithUndo(`${sliceTitle(slice, projectState())} is refined`);
  }
  else if (a === 'edit-scenario') window.EventPad.editScenario(t.dataset.scenario);
  else if (a === 'must') {
    const scn = projectState().scenarios[t.dataset.scenario];
    // Still marking: keep every scenario of the slice in view (so the next one can be starred too)
    if (scn) { setMustHave(scn.id, !scn.mustHave); allScenarios.add(scn.sliceId); renderOutline(); }
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

// Under a chapter's name: how far its slices are (a plan), or what it holds (a build book)
function chapterMeta(inChapter, state, built) {
  if (built) {
    const scns = inChapter.reduce((n, s) => n + getScenariosForSlice(s.id, state).length, 0);
    return `<span class="ol-refined-count built">${inChapter.length} ${inChapter.length === 1 ? 'slice' : 'slices'} · ${scns} ${scns === 1 ? 'scenario' : 'scenarios'}</span>`;
  }
  return `<span class="ol-refined-count ${refinedOf(inChapter) === inChapter.length ? 'all' : ''}">${refinedLabel(refinedOf(inChapter), inChapter.length)}</span>`;
}

// Along the bottom, as on the board: Collapse all (every chapter and every slice's scenarios)
// or Expand all, then the counts
function bottomBar(state, slices) {
  if (!slices) return `<div class="bd-stats ol-stats">${bookTitle(state)}</div>`;
  const chapters = state.chapterOrder.filter(id => state.chapters[id]);
  const anyOpen = !collapsedAll || chapters.some(id => !isChapterFolded(id));
  const stat = (n, one, many) => `<span class="bd-stat">${n} ${n === 1 ? one : many}</span>`;
  return `<div class="bd-stats ol-stats">
    ${bookTitle(state)}
    <button class="bd-fold-all" data-outline-action="collapse-all" data-fold="${anyOpen ? 'close' : 'open'}">${anyOpen ? '▾ Collapse all' : '▸ Expand all'}</button>
    ${usageButton(getEventStream())}
    ${openComments(state).length ? `<button class="bd-fold-all bd-cm-open" data-outline-action="next-comment" aria-label="${openComments(state).length} open comments">💬 ${openComments(state).length} open</button>` : ''}
    ${statusChips(movableGroups(state).flatMap(g => g.slices))}
    ${stat(slices, 'slice', 'slices')}${chapters.length ? stat(chapters.length, 'chapter', 'chapters') : ''}${stat(Object.keys(state.scenarios).length, 'scenario', 'scenarios')}
  </div>`;
}

// While verifying: how far it's got
function verifyLine(state) {
  const ed = verifyingEdition(state);
  if (ed == null) return '';
  const r = verificationResults(state, ed);
  return `<div class="ol-verify">Verifying edition ${ed}: <b>✓ ${r.works}</b> · <b>✗ ${r.fails}</b> · ${r.untested} to try</div>`;
}

// ✗ asks what happened (that note becomes a comment on the scenario)
function askWhatHappened(sliceId, scenarioId) {
  const scn = projectState().scenarios[scenarioId];
  openBoardSheet(`
    <div class="sheet-title">✗ Doesn't work <span class="bd-sheet-sub">${escapeHtml(scn?.name || '')}</span></div>
    <label class="bd-sheet-label" for="vdNote">What happened?</label>
    <textarea class="sheet-input cm-box" id="vdNote" rows="3" placeholder="What you did, and what you saw instead"></textarea>
    <button class="sheet-btn" data-outline-action="verdict-save" data-slice="${sliceId}" data-scenario="${scenarioId}">Save</button>`, 'vdNote');
}

function saveVerdict(sliceId, scenarioId, verdict, note) {
  const state = projectState();
  const why = recordVerdict({ sliceId, scenarioId, verdict, note }, verifyingEdition(state));
  if (why === 'Pick a nickname first') { openThread(sliceId, scenarioId); showToast('Pick a nickname first, then try again'); return false; }
  if (why) { showToast(why); return false; }
  return true;
}

// A comment picked in the drawer: unfold its chapter, open its slice, scroll to it and flash it
function revealComment(c) {
  const chapterId = projectState().slices[c.sliceId]?.chapterId;
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
  const fields = addKinds[addKind].fields;
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
  const name = chapter?.querySelector('.ol-chapter-name')?.textContent || '';
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
    if (addKind !== 'AU' || !e.target.closest('.ol-add')) return;
    const el = document.getElementById('olAddHint');
    if (el) el.textContent = addKinds.AU.hint();
  };
  sheet?.addEventListener('input', hint);
  sheet?.addEventListener('change', hint);
}
