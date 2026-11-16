// ===========================================
// BOARD - Parts of the Board, each drawn from its own view alone
// Each takes the one view that feeds it (a header's fields, a lane's stickies, a chapter's heading…) and ui, the device's
// local state (the grid place it sits in, what is open); every part has a default, so each draws
// on its own. Nothing here reads the book. A root carries data-component and data-key.
// ===========================================

import { waivedMark } from '../scenarioWaiver/view.js';
import { renderGwt } from '../scenarios/view.js';
import { buildChip } from './buildChip.js';
import { sliceProgressChip } from '../buildProgress/progress.parts.js';
import { isNeat } from '../../ui/settings.js';

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Where a part sits in the board's grid (ui.col; row, and how many columns it spans)
const at = (col, row, span = 1) => col ? `style="grid-column: ${col} / span ${span}; grid-row: ${row}"` : '';

// Sticky notes sit slightly askew; derived from ids so a note keeps its angle (straight when Neat)
const tilts = [-1.2, 0.8, -0.5, 1.1, -0.9];
export function noteTilt(key) {
  if (isNeat()) return 0;
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) | 0;
  return tilts[Math.abs(h) % tilts.length];
}

// Every event, one a line while the list is short; flowing inline (smaller) once it's long
const LONG_STACK = 6;
const stackNames = names => names.length > LONG_STACK
  ? `<span class="bd-names-inline">${names.map(escapeHtml).join(' · ')}</span>`
  : names.map(n => `<span>${escapeHtml(n)}</span>`).join('');

const partLabel = { given: 'Given', when: 'When', then: 'Then' };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// One sticky
export function boardCard(card, ui = {}) {
  const mark = `data-component="Board card" data-key="${card.elementId}"`;
  if (card.ref) {
    return `
    <button class="bd-card bd-card-ref" ${mark} data-type="${card.type}" data-todo="true" data-action="element" data-el="${card.elementId}" data-slice="${card.sliceId}">
      <span class="bd-card-name">☑ ${escapeHtml(card.name)} <span class="bd-ref-mark" title="Same to-do list as before">↺</span></span>
    </button>`;
  }
  const props = card.foldedProps
    ? `<div class="bd-props bd-props-folded">${card.foldedProps}</div>`
    : card.props.length
    ? `<div class="bd-props">${card.props.map(p => `<span data-prop="${p.id}"${p.generated ? ' class="bd-prop-generated" title="Generated"' : ''}>${p.generated ? '⚙' : ''}${escapeHtml(p.label)}</span>`).join('')}</div>`
    : '';
  // A to-do list's updates (tap a tag to flip + ⇄ ✓); a processor's inputs from elsewhere
  const updates = card.tags.length ? `<div class="bd-todo-tags">${card.tags.map(tag =>
    `<span class="bd-todo-tag" data-role="${tag.kind}"${tag.flip ? ` data-flip="${tag.flip}"` : ''}>${escapeHtml(tag.text)}</span>`).join('')}</div>${card.todo ? '<div class="bd-todo-hint">＋ adds · ✓ ticks off · tap a tag to switch</div>' : ''}` : '';
  return `
    <button class="bd-card" ${mark} style="--tilt: ${noteTilt(card.tiltKey)}deg" data-type="${card.type}"${card.attrs}${card.otherFlow ? ' data-other-flow="true"' : ''}${card.trigger ? ' data-trigger="true"' : ''}${card.todo ? ' data-todo="true"' : ''}${card.list ? ' data-list="true"' : ''} data-action="element-read" data-el="${card.elementId}" data-slice="${card.sliceId}">
      <span class="bd-card-kind">${card.trigger ? '⚡ Trigger · ' : ''}${card.todo ? '☑ To-do list' : card.label}${card.outcome ? ` · ↳ ${escapeHtml(card.outcome)}` : ''}</span>
      <span class="bd-card-title"><span class="bd-card-more" role="button" aria-label="Edit ${escapeHtml(card.name)}" data-action="element" data-el="${card.elementId}" data-slice="${card.sliceId}">⋮</span><span class="bd-card-name">${escapeHtml(card.name)}</span></span>
      ${card.to ? `<span class="bd-card-to">→ ${escapeHtml(card.to)}</span>` : ''}
      ${props}
      ${updates}
    </button>`;
}

// A slice's header: its type, scenario count, flow, title, number, chip, usage; the moves and ＋
export function boardSliceHeader(col, ui = {}) {
  const tip = `${col.ref ? `${col.ref} · ` : ''}${escapeHtml(col.title)}`;
  return `
    <div class="bd-head" data-component="Board slice header" data-key="${col.sliceId}" ${at(ui.col, 2)} data-slice-type="${col.type}" data-actor="${col.actor}">
      ${col.movable && col.prev ? `<button class="bd-insert" aria-label="Add a slice here" data-action="insert" data-before="${col.sliceId}">+</button>` : ''}
      <div class="bd-head-main">
        <div class="bd-head-namebox">
          <button class="bd-head-name" data-action="slice-page" data-slice="${col.sliceId}" title="${tip}">
            <span class="bd-head-type">${col.typeLabel}${col.scenarios ? ` · ${col.scenarios} ✓` : ''}</span>
            ${col.flow ? `<span class="bd-head-flow">↳ ${escapeHtml(col.flow)}</span>` : ''}
            <span class="bd-head-title"><span class="bd-head-text">${escapeHtml(col.title)}</span>${col.ref ? `<span class="bd-head-ref" data-ref="${col.ref}" aria-label="${col.ref}"></span>` : ''}${buildChip(col.chip)}</span>
          </button>
          <button class="bd-more" aria-label="Edit this slice" data-action="slice-menu" data-slice="${col.sliceId}">⋮</button>
        </div>
        ${col.progress ? `<div class="bd-head-progress">${sliceProgressChip(col.progress)}</div>` : ''}
        ${col.usage || col.waived ? `<button class="bd-head-chips" tabindex="-1" data-action="slice-page" data-slice="${col.sliceId}">${col.usage ? `<span class="bd-head-usage">${col.usage}</span>` : ''}${waivedMark({ waived: col.waived })}</button>` : ''}
      </div>
      <div class="bd-head-tools">
        ${col.movable ? `
        <div class="bd-move">
          <button aria-label="Move left" data-action="move" data-slice="${col.sliceId}" data-to="${col.prev || ''}" ${col.prev ? '' : 'disabled'}>◀</button>
          <button aria-label="Move right" data-action="move" data-slice="${col.sliceId}" data-to="${col.next || ''}" ${col.next ? '' : 'disabled'}>▶</button>
        </div>` : ''}
      </div>
    </div>`;
}

// One lane of a column: its stickies (or, for a view, one pile of the events it reads) and the ＋
export function boardLane(lane, ui = {}) {
  const mark = `data-component="Board lane" data-key="${lane.sliceId}:${lane.lane}"`;
  const flow = lane.flow ? `data-flow="${lane.flow}"` : '';
  if (lane.pile) {
    const p = lane.pile;
    const kind = `${plural(p.count, 'event', 'events')}${p.note}`;
    return `<div class="bd-cell lane-2" ${mark} ${at(ui.col, 5)} ${flow}>
    <button class="bd-card bd-pile" data-type="event" data-layers="${Math.min(p.count, 3)}" style="--tilt: ${noteTilt(lane.tiltKey)}deg" data-action="events" data-slice="${lane.sliceId}" aria-label="${kind}: open the events">
      <span class="bd-card-kind">${kind} ▸</span>
      <span class="bd-pile-names">${stackNames(p.names)}</span>
    </button></div>`;
  }
  const add = lane.add
    ? `<button class="bd-add ${lane.add.more ? 'more' : ''}" data-type="${lane.add.type}" data-action="add" data-slice="${lane.sliceId}" data-lane-type="${lane.add.type}">
         + ${lane.add.more ? '' : lane.add.label}
       </button>`
    : '';
  return `<div class="bd-cell lane-${lane.lane}" ${mark} ${at(ui.col, lane.lane + 3)} ${flow}>${lane.cards.map(c => boardCard(c)).join('')}${add}</div>`;
}

// The scenarios cell under the lanes. ui.open: each scenario in full; closed, a count and the Given stack.
export function boardScenarios(gwt, ui = {}) {
  const mark = `data-component="Board scenarios" data-key="${gwt.sliceId}"`;
  if (!ui.open) {
    // A slice's scenarios open in a drawer (sheets/scenarios.js); the lane's label opens them all
    const count = gwt.count
      ? `<button class="bd-gwt-count" data-action="gwt-drawer" data-slice="${gwt.sliceId}">✓ ${plural(gwt.count, 'scenario', 'scenarios')}</button>`
      : gwt.inferred ? '' : `<button class="bd-gwt-count add" data-action="gwt-drawer" data-slice="${gwt.sliceId}">＋ Scenario</button>`;
    // Below the count: the events their Givens start from, as a small stack (tap: the drawer)
    const n = gwt.givens.length;
    const stack = n
      ? `<button class="bd-card bd-pile bd-givens" data-type="event" data-layers="${Math.min(n, 3)}" data-action="givens" data-slice="${gwt.sliceId}" aria-label="${plural(n, 'event', 'events')} the scenarios start from">
           <span class="bd-card-kind">Given · ${plural(n, 'event', 'events')} ▸</span>
           <span class="bd-givens-names">${stackNames(gwt.givens)}</span>
         </button>` : '';
    return `<div class="bd-cell lane-3 closed" ${mark} ${at(ui.col, 6)}>${count}${stack}</div>`;
  }
  const cards = gwt.scenarios.map(s => `
    <button class="bd-gwt" data-action="scenario" data-scenario="${s.id}">
      <span class="bd-gwt-name">${s.mustHave ? '<span class="must-star" title="Must have">★</span> ' : ''}${escapeHtml(s.name)}</span>
      ${renderGwt(s.scn, { elements: gwt.elements })}
    </button>`).join('');
  const add = gwt.inferred ? ''
    : `<button class="bd-add ${gwt.scenarios.length ? 'more' : ''}" data-action="add-scenario" data-slice="${gwt.sliceId}">+ ${gwt.scenarios.length ? '' : 'Scenario'}</button>`;
  return `<div class="bd-cell lane-3" ${mark} ${at(ui.col, 6)}>${cards}${add}</div>`;
}

// The comment lane under the scenarios: a slice's open threads, with the line they're about
export function boardComments(col, ui = {}) {
  const threads = col.comments.map(t => `
    <button class="bd-cm" data-action="comment" data-slice="${col.sliceId}"${t.scenarioId ? ` data-scenario="${t.scenarioId}"` : ''} data-cm-anchor="${t.commentId}">
      <span class="bd-cm-meta"><b>${escapeHtml(t.nickname)}</b>${t.scenarioName ? ` · ${escapeHtml(t.scenarioName)}` : ''}${t.part ? ` <span class="cm-part">${partLabel[t.part]}</span>` : ''}</span>
      <span class="bd-cm-text">${escapeHtml(t.text)}</span>
    </button>`).join('');
  return `<div class="bd-cell lane-cm" data-component="Board comments" data-key="${col.sliceId}" ${at(ui.col, 7)}>${threads}</div>`;
}

// A chapter's header over its columns. ui: col, bookmarked
export function boardChapterHead(chapter, ui = {}) {
  const chips = chapter.flows.length ? `
      <div class="bd-flows">
        <button class="bd-flow ${chapter.shownFlow ? '' : 'active'}" data-action="show-flow" data-chapter="${chapter.id}" data-flow="">Main</button>
        ${chapter.flows.map(f => `<button class="bd-flow ${chapter.shownFlow === f.id ? 'active' : ''}" data-action="show-flow" data-chapter="${chapter.id}" data-flow="${f.id}">↳ ${escapeHtml(f.name)}</button>`).join('')}
      </div>` : '';
  return `
    <div class="bd-chapter ${chapter.flows.length ? 'has-flows' : ''}${chapter.slices <= 1 ? ' bd-chapter-narrow' : ''}" data-component="Board chapter header" data-key="${chapter.id}" ${at(ui.col, 1, Math.max(chapter.slices, 1))}>
      <button class="bd-chapter-fold" aria-label="Fold ${escapeHtml(chapter.name)}" data-action="fold" data-chapter="${chapter.id}">‹</button>
      <button class="bd-chapter-label" data-action="chapter-menu" data-chapter="${chapter.id}" title="${escapeHtml(chapter.name)}">
        <span class="ch-more" aria-hidden="true">⋮</span>
        <span class="bd-chapter-name">${ui.bookmarked ? '<span class="ch-mark" aria-label="Bookmarked">🔖</span> ' : ''}${escapeHtml(chapter.name)}</span>
        <span class="bd-chapter-count">${plural(chapter.slices, 'slice', 'slices')}</span>
      </button>
      <button class="bd-chapter-add" aria-label="Add a slice to ${escapeHtml(chapter.name)}" data-action="new-slice" data-chapter="${chapter.id}">＋</button>${chips}
    </div>`;
}

// A chapter with no slices keeps a quiet column so there's somewhere to add its first
export function boardEmptyChapter(chapter, ui = {}) {
  return `
    <div class="bd-head bd-new-head" ${at(ui.col, 2)}></div>
    <button class="bd-chapter-empty" data-component="Board empty chapter" data-key="${chapter.id}" style="grid-column: ${ui.col}; grid-row: 3 / span 3" data-action="new-slice" data-chapter="${chapter.id}">＋ Slice</button>`;
}

// Long names get smaller lettering so the whole title fits down the spine
// (about 16 characters at full size); very long ones also wrap onto a second line
const spineFontSize = name => Math.round(Math.max(13, Math.min(20, 20 * 16 / Math.max(name.length, 1))));

// A folded chapter: a book spine with its name down the side and a coloured band per slice
export function boardSpine(chapter, ui = {}) {
  const bands = chapter.bands.map(kind => `<span class="bd-spine-band" data-slice-type="${kind}"></span>`).join('');
  return `
    <button class="bd-spine" data-component="Board spine" data-key="${chapter.id}" style="grid-column: ${ui.col}; grid-row: 1 / span 6" data-action="fold" data-chapter="${chapter.id}" aria-label="Open ${escapeHtml(chapter.name)}">
      <span class="bd-spine-name" style="font-size: ${spineFontSize(chapter.name)}px">${escapeHtml(chapter.name)}</span>
      ${chapter.meter}
      <span class="bd-spine-bands">${bands}</span>
      <span class="bd-spine-count">${chapter.slices}</span>
      <span class="bd-spine-wrap" aria-hidden="true"></span>
      <span class="bd-spine-ribbon" aria-hidden="true">${escapeHtml(chapter.name)}<i>${plural(chapter.slices, 'slice', 'slices')}</i></span>
    </button>`;
}

// The labels down the left that only name a lane (the scenarios and comment lanes have toggles of their own)
export const boardLaneLabels = () => `<div class="bd-label-head" ${at(1, 2)}></div>
    ${['UI', 'Commands · Views', 'Events'].map((l, i) => `<div class="bd-label lane-${i}" ${at(1, i + 3)}><span>${l}</span></div>`).join('')}`;

// The scenarios lane's label: a toggle that opens and closes every slice's scenarios
export function boardScenariosToggle(view, ui = {}) {
  return `<button class="bd-label lane-3 bd-gwt-toggle" data-component="Board scenarios toggle" data-key="gwt" ${at(1, 6)} data-action="toggle-gwt" aria-expanded="${!!ui.gwtOpen}" aria-label="${ui.gwtOpen ? 'Hide' : 'Show'} scenarios"><span>${view.label} ${ui.gwtOpen ? '▾' : '▸'}</span></button>`;
}

// The comment lane's label: the open count, and a tap goes to the next one (nothing until the book has comments)
export function boardCommentsToggle(view) {
  return view ? `<button class="bd-label lane-cm" data-component="Board comments toggle" data-key="cm" ${at(1, 7)} data-action="next-comment" aria-label="${view.open} open comments: go to the next"><span>💬 ${view.open}</span></button>` : '';
}

// The bar above the board: title, find, close all, replay, chat, usage, stage chips and the counts.
// ui: title (the book's title button), chips, usage, replay (offered), snapshot (the book started from one)
export function boardStats(screen, ui = {}) {
  const s = screen.stats;
  const title = ui.title ?? `<button class="bd-book-title" data-book-title>${escapeHtml(screen.title)}</button>`;
  const root = 'data-component="Board stats" data-key="stats" style="display: contents"';
  if (s.empty) return `<div ${root}>${title}</div>`;
  const stat = (count, one, many, type) => `<span class="bd-stat"${type ? ` data-type="${type}"` : ''}>${plural(count, one, many)}</span>`;
  const books = s.chapterIds.length > 1
    ? `<button class="bd-fold-all" data-fold-all="${s.anyOpen ? 'close' : 'open'}">${s.anyOpen ? '▾ Close all chapters' : '▸ Open all chapters'}</button>` : '';
  const replay = ui.replay ? '<button class="bd-fold-all bd-replay" data-replay>⏱ Replay</button>' : '';
  const comments = `<button class="bd-fold-all bd-cm-open bd-chat" data-comments-open aria-label="Board chat${s.chat ? `, ${s.chat} open` : ''}">💬 Chat${s.chat ? ` · ${s.chat} open` : ''}</button>`;
  const find = '<button data-component="Board find button" class="bd-fold-all bd-find" data-find-open aria-label="Find a slice">🔍 Find</button>';
  const snapshot = ui.snapshot ? `<span class="bd-stat" title="Imported or shared without history: there is no history before the snapshot">📸 snapshot${s.source
    ? ` @ ${escapeHtml(s.source.commit.slice(0, 7))}${s.source.build ? ` · build ${escapeHtml(s.source.build)}` : ''}` : ''}</span>` : '';
  return `<div ${root}>${title}${find}${books}${replay}${comments}${ui.usage || ''}${ui.chips || ''}${[
    stat(s.slices, 'slice', 'slices'),
    s.chapters ? stat(s.chapters, 'chapter', 'chapters') : '',
    stat(s.events, 'event', 'events', 'event'),
    stat(s.commands, 'command', 'commands', 'command'),
    stat(s.readModels, 'read model', 'read models', 'readModel'),
    s.automations ? stat(s.automations, 'automation', 'automations', 'processor') : '',
    s.screens ? stat(s.screens, 'screen', 'screens', 'screen') : '',
    stat(s.scenarios, 'scenario', 'scenarios'),
    snapshot
  ].filter(Boolean).join('')}</div>`;
}
