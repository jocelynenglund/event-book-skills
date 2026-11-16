// ===========================================
// OUTLINE - Row and chapter header, and the controls around them, each drawn from its own view
// outlineRow(row, ui) takes an Outline Slice Row, outlineChapterHead(chapter, ui) an Outline Chapter
// Heading, and each control the view named by its function. ui is the device's local state (selecting, what is open); every part has a default,
// so a row draws on its own. Nothing here reads the book.
// ===========================================

import { waivedMark } from '../scenarioWaiver/view.js';
import { renderGwt, pendingMark } from '../scenarios/view.js';
import { refinedPill } from './refinedPill.js';
import { sliceProgressChip } from '../buildProgress/progress.parts.js';
import { propLabel } from '../../core/constants.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fieldMark = { command: '🟦', event: '🟧', readModel: '🟩', processor: '🟪', screen: '⬜' };
const markName = { command: 'command', event: 'event', readModel: 'view', processor: 'automation', screen: 'screen' };
const partLabel = { given: 'Given', when: 'When', then: 'Then' };

const chainText = row => row.chain.length ? row.chain.map(escapeHtml).join(' → ') : '<i>empty</i>';

function fieldList(row) {
  if (!row.fields.length) return '';
  const used = [...new Set(row.fields.flatMap(f => f.marks))];
  return `
    <div class="ol-fieldlist">
      ${row.fields.map(({ prop, marks }) => `<span class="ol-field">${marks.map(t => fieldMark[t]).join('')}${marks.length ? ' ' : ''}${escapeHtml(propLabel(prop))}${prop.type && prop.type !== 'string' ? ` <i>${escapeHtml(prop.type)}</i>` : ''}</span>`).join('')}
      ${used.length ? `<span class="ol-field-key">Squares: which stickies carry it (${used.map(t => `${fieldMark[t]} ${markName[t] === 'event' || markName[t] === 'automation' ? 'an' : 'the'} ${markName[t]}`).join(' · ')}); no square: all of them</span>` : ''}
    </div>`;
}

// 💬 beside a scenario (or a slice): its open comments' count; tap for the thread
function commentButton(row, scn) {
  const open = (scn ? scn.comments : row.comments).length;
  return `<button class="ol-cm ${open ? 'has' : ''}" data-outline-action="comment" data-slice="${row.sliceId}"${scn ? ` data-scenario="${scn.id}"` : ''}
    aria-label="${open ? `${open} open ${open === 1 ? 'comment' : 'comments'}` : 'Comment'}">💬${open ? ` ${open}` : ''}</button>`;
}

// A scenario's (or slice's) open comments, right under it
function inlineComments(row, scn) {
  const open = scn ? scn.comments : row.comments;
  if (!open.length) return '';
  return `<div class="ol-cm-list">${open.map(c => `
    <button class="ol-cm-line" data-outline-action="comment" data-slice="${row.sliceId}"${scn ? ` data-scenario="${scn.id}"` : ''} data-cm-anchor="${c.commentId}">
      <b>${escapeHtml(c.nickname)}</b>${c.part ? ` <span class="cm-part">${partLabel[c.part]}</span>` : ''} ${escapeHtml(c.text)}
    </button>`).join('')}</div>`;
}

// The verdict row of a scenario while verifying: the overall verdict on the left (tap: who tested it),
// two small round buttons on the right that light only this device's own verdict. Each part draws from its own view.

// ✗ Doesn't · Ana +1, a ✗ note on its own line under it, "from edition 3" when carried over; nothing when untried.
// view: Scenario Verdict
export function scenarioVerdictSummary(view) {
  const root = `data-component="Scenario verdict" data-key="${view.scenarioId}"`;
  if (view.overall === 'untried') return `<span class="ol-vd-sum" ${root}></span>`;
  const works = view.overall === 'works';
  return `<button class="ol-vd-sum ${view.overall}" ${root} data-outline-action="testers" data-slice="${view.sliceId}" data-scenario="${view.scenarioId}"
    aria-label="${works ? 'Works' : 'Does not work'}, tested by ${escapeHtml(view.lead)}${view.more ? ` and ${view.more} more` : ''}: see who tested it">
    <span class="ol-vd-head">${works ? '✓ Works' : '✗ Doesn\'t'} · ${escapeHtml(view.lead)}${view.more ? ` +${view.more}` : ''}</span>${view.fromEdition ? `<span class="ol-vd-from"> from edition ${view.fromEdition}</span>` : ''}
    ${view.notes.map(n => `<span class="ol-vd-note">✗ ${escapeHtml(n.note)}</span>`).join('')}
  </button>`;
}

// ✓ and ✗ as small round buttons, lit only for this device's own verdict. view: Scenario Own Verdict
export function scenarioVerdictButtons(view) {
  const v = view.own;
  const btn = (kind, mark, label) => `<button class="ol-vd-btn ${kind} ${v === kind ? 'on' : ''}" data-outline-action="verdict" data-verdict="${kind}" data-slice="${view.sliceId}" data-scenario="${view.scenarioId}" aria-pressed="${v === kind}" aria-label="${label}">${mark}</button>`;
  return `<span class="ol-vd-btns" role="group" aria-label="Your verdict in the shipped app" data-component="Scenario verdict buttons" data-key="${view.scenarioId}">
    ${btn('works', '✓', 'Works')}${btn('fails', '✗', 'Does not work')}
  </span>`;
}

// Who tested a scenario: each tester with verdict, time and note, ✗ first. view: Scenario Testers
export function scenarioTestersSheet(view) {
  return `
    <div data-component="Scenario testers sheet" data-key="${view.scenarioId}">
    <div class="sheet-title">Who tested <span class="bd-sheet-sub">${escapeHtml(view.name)}</span></div>
    <ul class="ol-testers">${view.testers.map(t => `
      <li class="ol-tester ${t.verdict}"><b>${escapeHtml(t.nickname)}</b> <span class="ol-tester-v">${t.verdict === 'works' ? '✓ Works' : '✗ Doesn\'t'}</span>
        <span class="ol-tester-at">${escapeHtml(t.label)}${t.fromEdition ? ` · from edition ${t.fromEdition}` : ''}</span> ${t.note ? `<div class="ol-tester-note">${escapeHtml(t.note)}</div>` : ''}</li>`).join('')}
    </ul>
    </div>`;
}

// A slice's verdict in its row header: ✗ Fails · 2 notes, ✓ Works, To try. view: Slice Verdict
export function sliceVerdictBadge(view) {
  return `<span class="ol-slice-vd ${view.overall}" data-component="Slice verdict badge" data-key="${view.sliceId}">${escapeHtml(view.text)}</span>`;
}

// One scenario's verdict row: the summary on the left, the round buttons on the right
function verdictRow(scn) {
  return `<div class="ol-vd">${scenarioVerdictSummary(scn.verdict)}${scenarioVerdictButtons(scn.own)}</div>`;
}

// Must haves are the acceptance criteria: once a slice has some, they're what the outline
// shows; the rest (nice to haves) wait behind "+ N nice to haves".
// ui: selecting, open (its scenarios are showing), nice (all of them), values (their values), canAdd, verifying
function scenarioParts(row, ui) {
  const scenarios = row.scenarios;
  if (ui.selecting) return { toggle: '', list: '' };
  const add = cls => ui.canAdd ? `<button class="${cls} ol-add-scenario" data-outline-action="add-scenario" data-slice="${row.sliceId}">＋ Scenario</button>` : '';
  if (!scenarios.length) return { toggle: add('ol-gwt-toggle'), list: '' };
  const open = !!ui.open;
  const must = scenarios.filter(s => s.mustHave);
  const extra = scenarios.length - must.length;
  const label = must.length
    ? `★ ${must.length} must ${must.length === 1 ? 'have' : 'haves'}${extra ? ` · ${extra} nice to ${extra === 1 ? 'have' : 'haves'}` : ''}`
    : `✓ ${scenarios.length} ${scenarios.length === 1 ? 'scenario' : 'scenarios'}`;
  const everything = !must.length || ui.nice;
  const shown = everything ? [...scenarios].sort((a, b) => !!b.mustHave - !!a.mustHave) : must;
  return {
    toggle: `<button class="ol-gwt-toggle" data-outline-action="gwt" data-slice="${row.sliceId}">${label} ${open ? '▴' : '▾'}</button>`,
    list: open ? shown.map(scn => `
      <div class="ol-scenario-row">
        <button class="ol-must ${scn.mustHave ? 'on' : ''}" data-outline-action="must" data-scenario="${scn.id}" aria-pressed="${!!scn.mustHave}"
          aria-label="${scn.mustHave ? 'Must have: tap to make it a nice to have' : 'Nice to have: tap to make it a must have'}">${scn.mustHave ? '★' : '☆'}</button>
        <button class="ol-scenario" data-outline-action="edit-scenario" data-slice="${row.sliceId}" data-scenario="${scn.id}">
          <span class="ol-scenario-name">${escapeHtml(scn.name)}${pendingMark(scn.scn)}</span>
          ${scn.scn.source?.file ? `<span class="ol-src">📄 ${escapeHtml(scn.scn.source.file.split('/').pop())}${scn.scn.source.line ? `:${scn.scn.source.line}` : ''}</span>` : ''}
          ${renderGwt(scn.scn, { elements: row.elements }, { values: !!(ui.showFields || ui.values) })}
        </button>
        ${ui.verifying && scn.verdict ? verdictRow(scn) : ''}
        ${commentButton(row, scn)}
      </div>${inlineComments(row, scn)}`).join('') + (must.length && extra
        ? `<button class="ol-more" data-outline-action="nice" data-slice="${row.sliceId}">${everything ? 'Only the must haves' : `+ ${extra} nice to ${extra === 1 ? 'have' : 'haves'}`}</button>` : '') + add('ol-more') : ''
  };
}

// Under a row: its fields and scenarios pills, then whichever is open
function details(row, ui) {
  if (ui.selecting) return '';
  const fields = row.fields.length;
  const fieldsOpen = !!(ui.showFields || ui.fields);
  const { toggle, list } = scenarioParts(row, ui);
  const refined = refinedPill({ sliceId: row.sliceId, refined: row.refined });
  const pill = fields ? `<button class="ol-gwt-toggle ol-fields-pill" data-outline-action="fields-one" data-slice="${row.sliceId}">${fields} ${fields === 1 ? 'field' : 'fields'} ${fieldsOpen ? '▴' : '▾'}</button>` : '';
  // Values in the open scenarios: only offered when some were filled in
  const valuesOn = !!(ui.showFields || ui.values);
  const values = list && !ui.showFields && row.scenarios.some(s => s.hasValues)
    ? `<button class="ol-gwt-toggle ol-values-pill ${valuesOn ? 'on' : ''}" data-outline-action="values-one" data-slice="${row.sliceId}" aria-pressed="${valuesOn}">${valuesOn ? '✓ values' : 'values'}</button>` : '';
  return `<div class="ol-pills">${pill}${toggle}${values}${refined}${sliceProgressChip(row.progress)}${waivedMark({ waived: row.waived })}${commentButton(row, null)}</div>${inlineComments(row, null)}${fieldsOpen ? fieldList(row) : ''}${list}`;
}

// One slice: its row, then its pills and open scenarios. ui: selecting, selected, open, query (searching),
// plus what scenarioParts and details read.
export function outlineRow(row, ui = {}) {
  const sel = !!ui.selected;
  return `
    <div class="ol-item" data-component="Outline row" data-key="${row.sliceId}">
    <div class="ol-row ${sel ? 'selected' : ''}">
      ${ui.selecting ? `<button class="ol-check" data-outline-action="toggle" data-slice="${row.sliceId}" aria-label="Select">${sel ? '✓' : ''}</button>` : ''}
      <span class="ol-dot" data-slice-type="${row.type}" data-actor="${row.actor}"></span>
      <div class="ol-main" role="button" tabindex="0" data-outline-action="${ui.selecting ? 'toggle' : 'expand'}" data-slice="${row.sliceId}"${ui.selecting ? '' : ` aria-expanded="${!!ui.open}"`}>
        <span class="ol-name">${ui.selecting ? '' : `<button class="ol-kebab" aria-label="Edit ${escapeHtml(row.title)}" data-outline-action="edit" data-slice="${row.sliceId}">⋮</button>`}<span class="ol-name-text">${row.refined ? '<span class="ol-refined-badge" aria-label="Refined"></span> ' : ''}${escapeHtml(row.title)}</span>${row.ref ? `<span class="ol-ref" title="Its number for an agent">${row.ref}</span>` : ''}</span>
        <span class="ol-kind">${row.kind}</span>
        ${ui.verifying && row.sliceVerdict ? sliceVerdictBadge(row.sliceVerdict) : ''}
        ${row.usage}
        <span class="ol-summary">${chainText(row)}</span>
        ${row.description ? `<span class="ol-desc">${escapeHtml(row.description)}</span>` : ''}
        ${row.paragraphs.map(text => `<span class="ol-para">${escapeHtml(text)}</span>`).join('')}
      </div>
      ${ui.selecting ? '' : `
      <div class="ol-step">
        <button aria-label="Show on the board" data-outline-action="jump" data-slice="${row.sliceId}">↗</button>
        ${ui.query ? '' : `
        <button aria-label="Move up" data-outline-action="up" data-slice="${row.sliceId}" ${row.canMoveUp ? '' : 'disabled'}>↑</button>
        <button aria-label="Move down" data-outline-action="down" data-slice="${row.sliceId}" ${row.canMoveDown ? '' : 'disabled'}>↓</button>`}
      </div>`}
    </div>
    ${details(row, ui)}
    </div>`;
}

// Under a chapter's name: how far its slices are (a plan), or what it holds (a build book)
function chapterMeta(count) {
  if (count.built) {
    return `<span class="ol-refined-count built">${count.slices} ${count.slices === 1 ? 'slice' : 'slices'} · ${count.scenarios} ${count.scenarios === 1 ? 'scenario' : 'scenarios'}</span>`;
  }
  return `<span class="ol-refined-count ${count.all ? 'all' : ''}">${count.label}</span>`;
}

// A chapter's header (or "Not in a chapter" when there are chapters). ui: searching, bookmarked.
export function outlineChapterHead(chapter, ui = {}) {
  const bands = chapter.folded ? `<span class="ol-bands">${chapter.bands.map(band =>
    `<span class="bd-spine-band" data-slice-type="${band}"></span>`).join('')}</span>` : '';
  // The whole chapter's count has a `built` flag; while searching it is just the matches
  const count = 'built' in chapter.count ? chapterMeta(chapter.count) : chapter.count.slices;
  if (chapter.loose) return `<div class="ol-chapter ol-loose" data-component="Outline chapter header" data-key="${chapter.id}"><span class="ol-chapter-name">${chapter.name}</span><span class="ol-count">${chapter.shown}</span></div>`;
  return `
      <div class="ol-chapter ${chapter.folded ? 'folded' : ''}" data-component="Outline chapter header" data-key="${chapter.id}">
        <button class="ol-fold" aria-label="${chapter.folded ? 'Open' : 'Fold'} ${escapeHtml(chapter.name)}" data-outline-action="fold" data-chapter="${chapter.id}">${chapter.folded ? '›' : '⌄'}</button>
        <div class="ol-ch-text">
          <button class="ol-chapter-name" data-outline-action="chapter-menu" data-chapter="${chapter.id}" aria-label="${escapeHtml(chapter.name)}: chapter menu (rename, move, delete)"><span class="ch-more" aria-hidden="true">⋮</span>${ui.bookmarked ? '<span class="ch-mark" aria-label="Bookmarked">🔖</span> ' : ''}${escapeHtml(chapter.name)}</button>
          <span class="ol-count">${count}${bands}</span>
        </div>
        <div class="ol-step" ${ui.searching ? 'hidden' : ''}>
          <button aria-label="Chapter earlier" data-outline-action="chapter-up" data-chapter="${chapter.id}" data-to="${chapter.index - 1}" ${chapter.first ? 'disabled' : ''}>↑</button>
          <button aria-label="Chapter later" data-outline-action="chapter-down" data-chapter="${chapter.id}" data-to="${chapter.index + 1}" ${chapter.last ? 'disabled' : ''}>↓</button>
        </div>
      </div>`;
}

// ---------- The controls around the rows: each drawn from its own view ----------

// The search box (made once and kept, so typing never loses focus; ✕ shows while there is a query)
// view: Outline Search Field
export function outlineSearchBox(view) {
  return `<div class="ol-search-row" data-component="Outline search box" data-key="search">
        <input type="search" class="sheet-input ol-search" id="olSearch" placeholder="Search slices, events, commands…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" value="${escapeHtml(view.query || '')}">
        <button class="ol-search-clear" data-outline-action="search-clear" aria-label="Clear the search" ${view.query ? '' : 'hidden'}>✕</button>
      </div>`;
}

// Above the chapters: how many slices match, Fields, Select / Done, and the open comments. view: Outline Toolbar Options, and whether Fields is on and the outline is selecting (a device's own)
export function outlineToolbar(view) {
  return `<div class="ol-toolbar" data-component="Outline toolbar" data-key="toolbar">
      <span class="ol-total">${view.total}</span>
      ${view.fields ? `<button class="ol-select ol-fields-toggle ${view.showFields ? 'on' : ''}" data-outline-action="fields" aria-pressed="${!!view.showFields}">${view.showFields ? '✓ Fields' : 'Fields'}</button>` : ''}
      ${view.select ? `<button class="ol-select" data-outline-action="select">${view.selecting ? 'Done' : 'Select'}</button>` : ''}
      ${view.openComments ? `<button class="ol-select ol-cm-next" data-outline-action="next-comment">💬 ${view.openComments} open</button>` : ''}
    </div>`;
}

// ＋ Do · ＋ See · ＋ Auto under a chapter. view: Outline Add Kinds
export function outlineAddButtons(view) {
  const key = view.chapterId || '';
  return `<div class="ol-add-steps" data-component="Outline add buttons" data-key="${escapeHtml(key)}">${view.kinds.map(k =>
    `<button class="ol-add-step" data-outline-action="add-open" data-chapter="${escapeHtml(key)}" data-kind="${k.kind}">＋ ${k.label}</button>`).join('')}</div>`;
}

// ＋ Chapter at the end (not while searching or showing one stage). view: Outline Can Add Chapter
export function outlineNewChapterButton(view) {
  return view?.canAddChapter ? `<button class="ol-add-chapter" data-component="Outline new chapter button" data-key="new-chapter" data-outline-action="new-chapter">＋ Chapter</button>` : '';
}

// The book's title along the bottom; tapping it goes to the book's front. view: Outline Book Name
export function outlineBookTitle(view) {
  return `<button class="bd-book-title" data-component="Outline book title" data-key="title" data-book-title>${escapeHtml(view.title)}</button>`;
}

// Collapse all (every chapter and every slice's scenarios) or Expand all. view: Outline Fold All State
export function outlineFoldAll(view) {
  if (!view?.sliceCount) return '';
  const close = view.anyOpen !== false;
  return `<button class="bd-fold-all" data-component="Outline fold all" data-key="fold-all" data-outline-action="collapse-all" data-fold="${close ? 'close' : 'open'}">${close ? '▾ Collapse all' : '▸ Expand all'}</button>`;
}

// 💬 N open along the bottom: tap for the list. view: Outline Open Comments Count
export function outlineBarComments(view) {
  return view?.openComments ? `<button class="bd-fold-all bd-cm-open" data-component="Outline open comments" data-key="open-comments" data-outline-action="next-comment" aria-label="${view.openComments} open comments">💬 ${view.openComments} open</button>` : '';
}

// Selecting: move the selected slices to a chapter. view: Outline Move Targets, and how many are selected (a device's own)
export function outlineMoveBar(view) {
  const off = view.selected ? '' : 'disabled';
  return `<div class="ol-movebar" data-component="Outline move bar" data-key="move-bar">
      <span>${view.selected || 0} selected · move to</span>
      <div class="ol-move-targets">
        ${view.chapters.map(c => `<button class="bd-chapter-chip" data-outline-action="move-to" data-chapter="${c.id}" ${off}>${escapeHtml(c.name)}</button>`).join('')}
        <button class="bd-chapter-chip" data-outline-action="move-to-new" ${off}>＋ New chapter</button>
        ${view.hasChapters ? `<button class="bd-chapter-chip" data-outline-action="move-to" data-chapter="" ${off}>No chapter</button>` : ''}
      </div>
    </div>`;
}

// The "Add a step" sheet. form: Outline Add Form (with its hint: Outline Add Hint)
export function outlineAddSheet(form) {
  return `
    <div class="ol-add" data-component="Outline add form" data-key="add-form">
      <div class="sheet-title">Add a step ${form.chapterName ? `<span class="bd-sheet-sub">${escapeHtml(form.chapterName)}</span>` : ''}</div>
      <div class="ol-add-kinds">
        ${form.kinds.map(k => `<button class="bd-chapter-chip ${k.active ? 'active' : ''}" data-outline-action="add-kind" data-kind="${k.kind}">${k.label}</button>`).join('')}
      </div>
      <div class="ol-add-hint" id="olAddHint">${escapeHtml(form.hint)}</div>
      ${form.fields.map(f => `
        <label class="ol-add-label" for="${f.id}">${f.label}</label>
        <input class="sheet-input" id="${f.id}" list="${f.id}List" placeholder="${f.placeholder}" autocomplete="off" enterkeyhint="${f.last ? 'done' : 'next'}">
        <datalist id="${f.id}List">${f.names.map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>
        ${f.check ? `<label class="ol-add-check"><input type="checkbox" id="${f.check.id}"> ${f.check.label}</label>` : ''}`).join('')}
      <label class="ol-add-label" for="olAddProps">Properties <span class="ol-add-note">${form.propsNote}</span></label>
      <input class="sheet-input" id="olAddProps" placeholder="Optional: orderId, amount, lines[]" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <label class="ol-add-label" for="olAddDesc">Description</label>
      <textarea class="sheet-input ol-add-desc" id="olAddDesc" rows="4" placeholder="Optional: what this step is about, rules, open questions"></textarea>
      <button class="sheet-btn" data-outline-action="add-save">✓ Add</button>
    </div>`;
}

// A slice's edit sheet. form: Outline Edit Form
export function outlineEditSheet(form) {
  return `
    <div class="ol-add ol-edit" data-component="Outline edit form" data-key="${form.sliceId}" data-slice="${form.sliceId}" data-title="${escapeHtml(form.title)}" data-props-before="${escapeHtml(form.props)}">
      <div class="sheet-title">${escapeHtml(form.title)}</div>
      ${form.fields.map((f, i) => `
        <label class="ol-add-label" for="olEd${i}">${f.label}</label>
        <input class="sheet-input" id="olEd${i}" list="olEd${i}List" value="${escapeHtml(f.name)}" placeholder="${f.required ? '' : 'optional'}"
          data-type="${f.type}" data-el="${f.elementId}" ${f.required ? 'data-required="1"' : ''} autocomplete="off" enterkeyhint="done">
        <datalist id="olEd${i}List">${f.names.map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist>`).join('')}
      ${form.more ? `<div class="ol-add-hint">＋ ${form.more} more on the board (and its screens)</div>` : ''}
      <label class="ol-add-label" for="olEdProps">Properties <span class="ol-add-note">on its ${form.propsNote}</span></label>
      <input class="sheet-input" id="olEdProps" value="${escapeHtml(form.props)}" placeholder="orderId, amount, lines[]" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done">
      <label class="ol-add-label" for="olEdDesc">Description</label>
      <textarea class="sheet-input ol-add-desc" id="olEdDesc" rows="4" placeholder="What this step is about, rules, open questions">${escapeHtml(form.description)}</textarea>
      <div class="ol-edit-actions">
        <button class="sheet-btn secondary" data-outline-action="open-slice" data-slice="${form.sliceId}">Open</button>
        <button class="sheet-btn secondary" data-outline-action="jump" data-slice="${form.sliceId}">↗ Board</button>
        <button class="sheet-btn secondary" data-outline-action="share-slice" data-slice="${form.sliceId}">Share…</button>
        <button class="sheet-btn" data-outline-action="edit-save">✓ Save</button>
      </div>
    </div>`;
}

// ✗ asks what happened (that note becomes a comment on the scenario). form: Outline Verdict Form
export function outlineVerdictSheet(form) {
  return `
    <div data-component="Outline verdict form" data-key="${form.scenarioId}">
    <div class="sheet-title">✗ Doesn't work <span class="bd-sheet-sub">${escapeHtml(form.name)}</span></div>
    <label class="bd-sheet-label" for="vdNote">What happened?</label>
    <textarea class="sheet-input cm-box" id="vdNote" rows="3" placeholder="What you did, and what you saw instead"></textarea>
    <button class="sheet-btn" data-outline-action="verdict-save" data-slice="${form.sliceId}" data-scenario="${form.scenarioId}">Save</button>
    </div>`;
}
