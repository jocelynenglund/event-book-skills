// ===========================================
// LIBRARY - View (SV: View Library)
// Every model on this device as a shelf of books: the model's chapters are
// the books on its shelf (thicker for more slices), a model without chapters
// is one book. Tap a shelf to open it.
// ===========================================

import { openShareSheet } from '../shareImage/sheet.js';
import { shelfBooks, bookSpec, fitSpine } from './books.js';
import { listReferences, referenceState } from '../references/store.js';
import { openReferenceBook } from '../references/sheet.js';
import { renderShelfImage } from './shelfImage.js';
import { renderBookcaseImage } from './bookcaseImage.js';
import { createShareLink, linkError } from '../shareLink/link.js';
import { copyText } from '../../ui/clipboard.js';
import { formatBytes } from '../../ui/bytes.js';
import { listModels, readModelEvents, modelSize, historyOf, getCurrentModelId, openModel, createModel, duplicateModel, deleteModel, setModelStartIn, openedAt } from '../../core/eventStore.js';
import { getStartIn } from '../../ui/feed.js';
import { projectState, getBoardGroups } from '../../core/projections.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml, noteTilt } from '../board/view.js';
import { openModelNameSheet } from '../board/sheets.js';
import { nameModel } from '../board/command.js';
import { rememberPair, openComparePicker } from '../compare/view.js';
import { sourceSummary, repoUrl, repoName } from '../../core/source.js';
import { accountBar, footMark, footIcon, locationText, shelfMenuOption, afterLibraryRender } from '../sync/view.js';
import { account, kept, canEdit, isKept, readyToChange, forgetHere, isReviewerAccount } from '../sync/client.js';
import { sharedOf, refreshShared } from '../shared/client.js';
import { verificationResults } from '../verify/command.js';
import { detailsOf, editionShelves } from '../editions/shelves.js';
import { publishRefusal, ordinal } from '../editions/rules.js';
import { publishEdition, startNextDraft } from '../editions/command.js';
import { bookshelfSections } from './sections.js';
import { sectionHead, sectionBody, jumpChips, toggleSection, jumpTo } from './folds.js';
import { showCompare } from '../../ui/feed.js';
import { editionsSection } from '../buildVersions/view.js';
import { usageSection } from '../usage/view.js';
import { isBuildBook, buildAt } from '../buildVersions/rules.js';

function ago(iso) {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

function renderBook(b) {
  const bands = b.blocks.map(t => `<span class="bd-spine-band" data-slice-type="${t}"></span>`).join('');
  return `
    <span class="lb-book" style="width: ${b.width}px; height: ${b.height}px; --cloth-dark: ${b.dark}; --cloth-light: ${b.light}; --tilt: ${noteTilt(b.key) * 0.6}deg">
      <span class="lb-book-title" style="font-size: ${b.titleSize}px" title="${escapeHtml(b.title)}">${b.titleLines.map(escapeHtml).join('<br>')}</span>
      <span class="lb-book-bands">${bands}</span>
    </span>`;
}

const count = n => n.toLocaleString('en-US');

// What a book's details sheet says about its size and history
function bookMeta(model, state, events) {
  const history = historyOf(events);
  const sliceCount = Object.keys(state.slices).length;
  return [
    `${sliceCount} ${sliceCount === 1 ? 'slice' : 'slices'}`,
    state.chapterOrder.length ? `${state.chapterOrder.length} ${state.chapterOrder.length === 1 ? 'chapter' : 'chapters'}` : '',
    `edited ${ago(model?.updatedAt)}`,
    `<span class="lb-size">${formatBytes(modelSize(model.id))}</span>`,
    sourceSummary(state),
    history.snapshot
      ? `📸 snapshot${history.changes ? ` + ${count(history.changes)} ${history.changes === 1 ? 'change' : 'changes'}` : ''}`
      : `🕘 history · ${count(history.changes)} ${history.changes === 1 ? 'event' : 'events'}`,
    model.startIn === 'outline' ? '📋 plotted' : model.startIn === 'board' ? '🌀 pantsed' : ''
  ].filter(Boolean).join(' · ');
}

// How a book's edition reads: "1st edition", "draft 3 of the 2nd edition", "draft 3"
export function editionText(e) {
  return e.published ? `${ordinal(e.edition)} edition` : e.edition ? `draft ${e.draft} of the ${ordinal(e.edition)} edition` : `draft ${e.draft}`;
}

// Cloth for the published editions: deep colours with gold rules
const CLOTHS = ['#2f5d8a', '#7a2f3a', '#2f6a4f', '#5a3f7a', '#8a5a2a'];

// The small print up a spine: slices · scenarios · (build) · edited date
const SHORT_DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
function spineMeta(model, state, events) {
  const edited = model.updatedAt && !isNaN(new Date(model.updatedAt)) ? SHORT_DATE.format(new Date(model.updatedAt)) : '';
  const build = isBuildBook(events) ? buildAt(events)?.build : null;
  return [Object.keys(state.slices).length, Object.keys(state.scenarios).length, ...(build != null ? [`b${build}`] : []), ...(edited ? [edited] : [])].join(' · ');
}

// What a spine is made of: its cloth, height, title fit, small print and loose sheets (shared with the bookcase picture)
function spineSpec(model) {
  const events = readModelEvents(model.id);
  const state = projectState(events);
  const d = detailsOf(state);
  const e = state.edition;
  const name = state.modelName || 'Untitled model';
  const cloth = CLOTHS[([...model.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0) >>> 0) % CLOTHS.length];
  // Taller for more slices, and for a long title (up to a point); the title is set to fit,
  // smaller or on two lines, rather than cut short
  const longestWord = Math.max(...name.split(/\s+/).map(w => w.length));
  const height = Math.min(246, Math.max(166, 146 + d.total * 6, 86 + name.length * 7, 80 + longestWord * 10));
  return { id: model.id, name, state, events, d, e, cloth, height, published: e.published, ready: Math.min(d.ready, 3), meta: spineMeta(model, state, events) };
}

// One book on a wooden shelf: ONE spine with a vertical title and its small print beside it.
// Published: cloth with a sheen and double gold rules. Drafts: stitched kraft paper with brown-ink
// rules, and a loose sheet sticking out of the top for each slice that is refined but not built
// yet (up to 3). Page edges show at the top. The foot mark says when it isn't yours to edit.
function renderSpine(model, loan = '') {
  const { name, e, d, cloth, height, events, state } = spineSpec(model);
  const fit = fitSpine(name, 36, height - 84, 17);
  const sheets = e.published ? '' : `<span class="ed-sheets" aria-hidden="true">${Array.from({ length: Math.min(d.ready, 3) }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>`;
  return `
    <span class="ed-book">
    <button class="ed-spine ${e.published ? 'cloth' : 'kraft'}"${loan ? ` data-loan="${loan}"` : ''} data-library-action="open" data-model="${model.id}" title="${escapeHtml(name)} · ${escapeHtml(editionText(e))}"
      style="--h:${height}px; --w:${fit.width + 13}px; --cloth:${cloth}" aria-label="${escapeHtml(name)}, ${escapeHtml(editionText(e))}">
      <span class="ed-pg" aria-hidden="true"></span>
      ${sheets}
      <span class="ed-title" style="font-size:${fit.size}px">${escapeHtml(name)}</span>
      <span class="ed-m" aria-hidden="true">${spineMeta(model, state, events)}</span>
      <span class="ed-foot" data-sync-shelf="${model.id}">${footMark(model.id)}</span>
    </button>
    <button class="ed-spine-more" aria-label="${escapeHtml(name)}: details and actions" data-library-action="details" data-model="${model.id}">⋯</button>
    </span>`;
}

// A book lying flat (one of the last few opened): its title across, ⋯ at its end
const RECENT_FLAT = 3;
function renderFlat(model, loan, i) {
  const state = projectState(readModelEvents(model.id));
  const e = state.edition;
  const name = state.modelName || 'Untitled model';
  const cloth = CLOTHS[([...model.id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0) >>> 0) % CLOTHS.length];
  const ready = e.published ? 0 : Math.min(detailsOf(state).ready, 3);
  const sheets = ready ? `<span class="ed-sheets" aria-hidden="true">${Array.from({ length: ready }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</span>` : '';
  return `
    <span class="ed-book flat" style="--shift:${[0, 10, 4][i % 3]}px">
    <button class="ed-spine flat ${e.published ? 'cloth' : 'kraft'}"${loan ? ` data-loan="${loan}"` : ''} data-library-action="open" data-model="${model.id}" title="${escapeHtml(name)} · ${escapeHtml(editionText(e))}"
      style="--cloth:${cloth}" aria-label="${escapeHtml(name)}, ${escapeHtml(editionText(e))}, opened recently">
      ${sheets}
      <span class="ed-title">${escapeHtml(name)}</span>
      <span class="ed-foot" data-sync-shelf="${model.id}">${footMark(model.id)}</span>
    </button>
    <button class="ed-spine-more" aria-label="${escapeHtml(name)}: details and actions" data-library-action="details" data-model="${model.id}">⋯</button>
    </span>`;
}

// Books that wrap onto a second row stand on a ledge of their own: the last book of every row grows
// to the shelf's edge so the ledge runs across, and the bottom row stands on the plank instead
export function markShelfRows(root = document) {
  root.querySelectorAll('.ed-shelf').forEach(shelf => {
    const books = [...shelf.children];
    books.forEach(b => b.classList.remove('row-end', 'last-row'));
    const bottoms = books.map(b => Math.round(b.offsetTop + b.offsetHeight));
    const last = Math.max(...bottoms, 0);
    books.forEach((b, i) => {
      if (bottoms[i + 1] === undefined || bottoms[i + 1] !== bottoms[i]) b.classList.add('row-end');
      if (bottoms[i] === last) b.classList.add('last-row');
    });
  });
}

// Spine titles are measured in the display font: once it has loaded, set them again
let fontsSettled = false;

export function renderLibrary() {
  const container = document.getElementById('libraryView');
  if (!container) return;
  if (!fontsSettled && document.fonts?.ready) {
    fontsSettled = true;
    document.fonts.ready.then(() => { if (document.body.classList.contains('library-mode')) renderLibrary(); });
  }
  const models = listModels();
  // Where each book lives: published or drafts (its own history), and who has it (the foot mark)
  const sections = editionShelves(models.map(m => ({ id: m.id, events: readModelEvents(m.id) })));
  // Books shared with this account have a shelf of their own
  const shared = sections.filter(x => sharedOf(x.id)).map(x => x.id);
  const published = sections.filter(x => x.section === 'published' && !sharedOf(x.id)).map(x => x.id);
  const drafts = sections.filter(x => x.section === 'drafts' && !sharedOf(x.id)).map(x => x.id);
  const byId = Object.fromEntries(models.map(m => [m.id, m]));
  const loans = Object.fromEntries(bookshelfSections(models, account() ? kept() : {}).library.map(b => [b.id, b.status === 'on-loan-agent' ? 'agent' : '']));
  // A shelf: the few books opened most recently lie flat in a stack on top of the bookcase; the
  // rest stand in it in alphabetical order
  const opened = openedAt();
  const titleOf = id => projectState(readModelEvents(id)).modelName || 'Untitled model';
  const shelf = (kind, ids, plaque) => {
    const recent = ids.filter(id => opened[id]).sort((a, b) => opened[b].localeCompare(opened[a])).slice(0, RECENT_FLAT);
    const upright = ids.filter(id => !recent.includes(id)).sort((a, b) => titleOf(a).localeCompare(titleOf(b), undefined, { numeric: true, sensitivity: 'base' }));
    const stack = recent.length ? `<span class="ed-stack" aria-label="Opened recently">${recent.map((id, i) => renderFlat(byId[id], loans[id] || '', i)).join('')}</span>` : '';
    return `<div class="ed-case ed-${kind}">${stack ? `<div class="ed-top">${stack}</div>` : ''}<div class="ed-shelf">${upright.map(id => renderSpine(byId[id], loans[id] || '')).join('')}</div><div class="ed-plank"><span class="ed-plate" aria-hidden="true"><b>${plaque}</b><i>${ids.length}</i></span></div></div>`;
  };
  container.innerHTML = `
    <div class="lb-head">
      <span class="lb-title">Bookshelves</span>
      <span class="lb-head-actions">
        ${account() ? '<button class="lb-sharebtn lb-syncbtn" data-sync-action="sync" aria-label="Sync with your library" title="Sync with your library">⟳</button>' : ''}
        <button class="lb-sharebtn" data-library-action="share-bookcase" aria-label="Share the bookshelves" title="Share the bookshelves"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        ${isReviewerAccount() ? '' : '<button class="lb-compare lb-newbtn" data-library-action="new">＋ New</button>'}
      </span>
    </div>
    ${jumpChips([
      { section: 'published', label: 'Published', count: published.length },
      { section: 'drafts', label: 'Drafts', count: drafts.length },
      ...(shared.length ? [{ section: 'shared', label: 'Shared with me', count: shared.length }] : []),
      ...(account() ? [{ section: 'missing', label: 'Not here', count: 0 }] : []),
      { section: 'reference', label: 'Reference', count: listReferences().length }])}
    ${sectionHead('published', 'Published', String(published.length), published.length)}
    ${published.length ? sectionBody('published', published.length, shelf('published', published, 'Published'))
      : '<p class="lb-section-note">An edition is a book whose every slice is done: open a draft, compare a build, then Publish.</p>'}
    ${sectionHead('drafts', 'Drafts', String(drafts.length), drafts.length)}
    ${sectionBody('drafts', drafts.length, shelf('drafts', drafts, 'Drafts'))}
    ${shared.length ? `${sectionHead('shared', 'Shared with me', String(shared.length), shared.length)}
    ${sectionBody('shared', shared.length, shelf('shared', shared, 'Shared with me'))}` : ''}
    <p class="ed-legend">Kraft = draft · cloth = published edition · loose sheets = refined, not built yet. Foot mark (library books): ✏️ green = checked out here, yours to edit · ☁ = checked in, read only · 🔒 amber or the itsyBIT mark = checked out on another device or to Claude. None = only on this device.</p>
    ${accountBar()}
    <div id="syMissing"></div>
    ${renderReferenceShelf()}`;
  afterLibraryRender();
  markShelfRows(container);
  // Books shared with this account: fetched onto this device (removed ones taken off), then the shelves again
  refreshShared().then(changed => { if (changed && document.body.classList.contains('library-mode')) renderLibrary(); });
}

// Chapters saved for reuse: one book each, on a shelf of their own
function renderReferenceShelf() {
  const refs = listReferences();
  const books = refs.map(r => {
    const { state, chapterId } = referenceState(r);
    const slices = state.sliceOrder.map(id => state.slices[id]).filter(s => s?.chapterId === chapterId);
    const b = bookSpec(r.name, slices, r.id, state);
    return renderBook(b).replace('<span class="lb-book"', `<span class="lb-book" data-library-action="reference" data-ref="${r.id}" role="button" aria-label="${escapeHtml(r.name)}"`);
  }).join('');
  return `
    ${sectionHead('reference', 'Reference shelf', `${refs.length} saved`, refs.length)}
    ${refs.length ? '' : '<p class="lb-section-note">Save a chapter here from its menu, then add it to any model.</p>'}
    ${sectionBody('reference', refs.length, `<div class="lb-case lb-ref-case">
      <section class="lb-shelf${refs.length ? '' : ' empty'}">
        <div class="lb-rail"><span class="lb-label"><span>Reference shelf</span></span></div>
        <div class="lb-bay">
          <div class="lb-books lb-ref-books">${books || '<span class="lb-empty">Save a chapter here from its menu, then add it to any model</span>'}</div>
        </div>
        <div class="lb-plank"></div>
      </section>
    </div>`)}`;
}

let menuModelId = null;

// A published book's next draft already on this device (a copy that says it came from it)
const nextDraftOf = id => listModels().find(m => readModelEvents(m.id).some(e => e.type === 'NextDraftStarted' && e.data?.fromModel === id)) || null;

// Tap a book: what it is, where it lives, how far along, and what you can do with it
function openBookSheet(id) {
  menuModelId = id;
  const shared = sharedOf(id);
  if (shared) {
    const st = projectState(readModelEvents(id));
    document.getElementById('boardSheetContent').innerHTML = `
      <div class="ed-sheet-card" data-book="${id}">
        <div class="ed-sheet-kicker">Shared with you</div>
        <div class="ed-sheet-title">${escapeHtml(st.modelName || 'Untitled model')}</div>
        <div class="ed-sheet-where">by ${escapeHtml(shared.owner || 'its owner')} · ${shared.role === 'editor' ? 'you can edit names and scenarios, and tick Refined' : shared.canAddScenarios ? 'you can comment and add scenarios' : 'you can comment'}</div>
        ${st.modelDescription ? `<p class="lb-info-text">${escapeHtml(st.modelDescription)}</p>` : ''}
        <div class="ed-actions"><button class="ed-btn primary" data-library-action="open" data-model="${id}">Open</button></div>
      </div>`;
    showSheet('boardSheet');
    return;
  }
  const events = readModelEvents(id);
  const state = projectState(events);
  const d = detailsOf(state);
  const e = state.edition;
  const name = state.modelName || 'Untitled model';
  const why = publishRefusal(events, state);
  const mine = canEdit(id);
  const next = e.published ? nextDraftOf(id) : null;
  const build = isBuildBook(events);
  const kept = isKept(id) && account();
  const publish = e.published ? '' : `
      <button class="ed-btn" data-library-action="publish" data-model="${id}" ${why || !mine ? 'disabled' : ''}>Publish ${ordinal(e.edition || 1)} edition</button>`;
  const whyText = e.published ? '' : why ? (why === 'Not every slice is done' ? `${d.total - d.done} of ${d.total} slices aren’t done yet: confirm them in Compare` : why === 'No build compared yet' ? 'Compare a build first, then confirm the slices done' : why) : !mine ? 'Check it out to publish it' : '';
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="ed-sheet-card" data-book="${id}">
      <div class="ed-sheet-kicker">${e.published ? 'Published' : 'Draft'}</div>
      <div class="ed-sheet-title">${escapeHtml(name)}</div>
      <div class="ed-sheet-where">${escapeHtml(locationText(id))}</div>
      ${state.modelDescription ? `<p class="lb-info-text">${escapeHtml(state.modelDescription)}</p>` : ''}
      <dl class="ed-facts">
        <dt>Slices</dt><dd class="ed-counts">${d.done} of ${d.total} done · ${d.ready} ready · ${d.sketched} sketched</dd>
        ${build && repoUrl(state) ? `<dt>Code</dt><dd class="ed-code"><a href="${escapeHtml(repoUrl(state))}" target="_blank" rel="noopener">${escapeHtml(repoName(state))} ↗</a></dd>` : ''}
        <dt>Last build</dt><dd class="ed-build">${d.lastBuild ? escapeHtml(String(d.lastBuild).slice(0, 7)) : 'not compared yet'}</dd>
        <dt>Edition</dt><dd class="ed-edition">${escapeHtml(editionText(e))}</dd>
        ${e.published && e.edition && Object.keys(state.verdicts?.[e.edition] || {}).length ? (r => `<dt>Verified</dt><dd class="ed-verified">✓ ${r.works} · ✗ ${r.fails} · ${r.untested} to try</dd>`)(verificationResults(state, e.edition)) : ''}
      </dl>
      <p class="lb-meta ed-meta">${bookMeta(listModels().find(m => m.id === id) || { id }, state, events)}</p>
      ${whyText ? `<p class="ed-why">${escapeHtml(whyText)}</p>` : ''}
      ${usageSection(events)}
      ${editionsSection(events, id)}
      <div class="ed-actions">
        <button class="ed-btn primary" data-library-action="open" data-model="${id}">Open</button>
        <button class="ed-btn" data-library-action="compare-book" data-model="${id}">Compare…</button>
        ${!kept && !build ? `<button class="ed-btn" data-sync-action="keep" data-model="${id}">Keep on server (private)</button>` : ''}
        ${kept && !build ? `<button class="ed-btn" data-review-action="open" data-model="${id}">Review &amp; verify…</button>` : ''}
        ${kept && !build && !isReviewerAccount() ? `<button class="ed-btn" data-people-action="open" data-model="${id}">People…</button>` : ''}
        ${build ? '' : publish}
        ${e.published && !build ? `<button class="ed-btn" data-library-action="next-draft" data-model="${id}" ${next ? 'disabled' : ''}>Start next draft</button>` : ''}
        <button class="ed-btn quiet" data-library-action="menu" data-model="${id}">More…</button>
      </div>
      ${next ? `<p class="ed-why">The ${ordinal(e.edition + 1)} edition is already a draft on your shelves.</p>` : ''}
    </div>`;
  showSheet('boardSheet');
}

// Run a command on another book: it opens, the command runs, and the model you had open is open again
function onBook(id, fn) {
  const open = getCurrentModelId();
  if (open !== id) openModel(id);
  const result = fn();
  if (open !== id && listModels().some(m => m.id === open)) openModel(open);
  return result;
}


function openShelfMenu(id) {
  menuModelId = id;
  const state = projectState(readModelEvents(id));
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="sheet-title">${escapeHtml(state.modelName || 'Untitled model')}</div>
    <div class="sheet-options">
      <div class="sheet-option" data-library-action="rename">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">✏️</div>
        <div class="sheet-option-text"><div class="sheet-option-title">Name &amp; description</div></div>
      </div>
      <div class="sheet-option" data-library-action="share">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↗</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Share…</div>
          <div class="sheet-option-desc">As a picture, slides or a link, without opening it</div>
        </div>
      </div>
      ${shelfMenuOption(id)}
      <div class="sheet-option" data-library-action="compare-book" data-model="${id}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↔</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Compare with…</div>
          <div class="sheet-option-desc">This book beside another you pick</div>
        </div>
      </div>
      <div class="sheet-option" data-library-action="duplicate">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">⧉</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Duplicate</div>
          <div class="sheet-option-desc">A copy on a new shelf, to try ideas</div>
        </div>
      </div>
      ${isKept(id) && account() ? `
      <div class="sheet-option" data-library-action="return" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↩</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Return to library</div>
          <div class="sheet-option-desc">Checks it in and takes it off this device; it stays in your library to borrow again</div>
        </div>
      </div>` : `
      <div class="sheet-option" data-library-action="delete" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
        <div class="sheet-option-icon" style="background: #c0392b;">🗑️</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title" style="color: #e74c3c;">Delete model</div>
          <div class="sheet-option-desc">Removes it from this device (export it first to keep a copy)</div>
        </div>
      </div>`}
    </div>`;
  showSheet('boardSheet');
}

// A model's description, from the ⓘ on its shelf label
function openShelfInfo(id) {
  menuModelId = id;
  const state = projectState(readModelEvents(id));
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="sheet-title">${escapeHtml(state.modelName || 'Untitled model')}</div>
    <p class="lb-info-text">${escapeHtml(state.modelDescription || '')}</p>
    <div class="bd-move-row">
      <button class="sheet-btn secondary" data-library-action="open" data-model="${id}">Open</button>
      <button class="sheet-btn" data-library-action="close">Close</button>
    </div>`;
  showSheet('boardSheet');
}

// ---------- Sharing a shelf: its picture and a link to the model ----------

let shelfShare = null; // { id, name, blob, url }

async function openShelfShare(id) {
  const state = projectState(readModelEvents(id));
  const name = state.modelName || 'Untitled model';
  shelfShare = { id, name, blob: null, url: null };
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="sheet-title">Share shelf <span class="bd-sheet-sub">${escapeHtml(name)}</span></div>
    <div class="share-preview-wrap"><img id="shelfSharePreview" alt="The shelf of ${escapeHtml(name)}"></div>
    <button class="sheet-btn" data-library-action="shelf-share-go">Share picture + link</button>
    <div class="share-secondary">
      <button class="share-small" data-library-action="shelf-copy-link">🔗 Copy link</button>
      <button class="share-small" data-library-action="shelf-download">⬇ Download</button>
    </div>
    <div class="lb-share-link" id="shelfLinkBox" hidden></div>
    <button class="lb-share-more" data-library-action="share-more">More options: the board as a picture, slides, one chapter…</button>`;
  showSheet('boardSheet');
  const canvas = await renderShelfImage(id);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (!shelfShare || shelfShare.id !== id) return;
  shelfShare.blob = blob;
  document.getElementById('shelfSharePreview').src = URL.createObjectURL(blob);
}

const shelfFileName = () => (shelfShare.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model') + '-shelf.png';

// The link is made once per sheet (each one uploads a copy of the model)
async function shelfLink() {
  if (!shelfShare.url) {
    shelfShare.url = await createShareLink(readModelEvents(shelfShare.id), shelfShare.id);
    const box = document.getElementById('shelfLinkBox');
    if (box) { box.textContent = shelfShare.url; box.hidden = false; }
  }
  return shelfShare.url;
}

async function shareShelf() {
  if (!shelfShare?.blob) return;
  let url;
  try { url = await shelfLink(); } catch (e) { showToast(linkError(e)); return; }
  const file = new File([shelfShare.blob], shelfFileName(), { type: 'image/png' });
  const text = `${shelfShare.name}: an event model made with Event Book ${url}`;
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: shelfShare.name, text }); } catch (e) { /* dismissed */ }
  } else if (navigator.share) {
    try { await navigator.share({ title: shelfShare.name, text, url }); } catch (e) { /* dismissed */ }
  } else {
    downloadShelf();
    showToast(await copyText(url) ? 'Picture downloaded, link copied' : 'Picture downloaded');
  }
}

async function copyShelfLink() {
  try {
    const url = await shelfLink();
    showToast(await copyText(url) ? 'Link copied' : 'Link ready below');
  } catch (e) { showToast(linkError(e)); }
}

function downloadShelf() {
  if (!shelfShare?.blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(shelfShare.blob);
  a.download = shelfFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ---------- Sharing the bookshelves: a picture of the whole bookcase ----------

const BOOKCASE_CHOICES = [['all', 'All shelves'], ['published', 'Published'], ['drafts', 'Drafts']];
let bookcaseShare = null; // { pick, blob, count }

// The shelves to draw: the published editions and the drafts (books shared with you aren't yours to show),
// each in alphabetical order, as plain specs for the picture
function bookcaseSections(pick) {
  const models = listModels();
  const placed = editionShelves(models.map(m => ({ id: m.id, events: readModelEvents(m.id) }))).filter(x => !sharedOf(x.id));
  const byId = Object.fromEntries(models.map(m => [m.id, m]));
  return [['published', 'Published'], ['drafts', 'Drafts']].filter(([kind]) => pick === 'all' || pick === kind).map(([kind, plaque]) => ({
    kind, plaque,
    books: placed.filter(x => x.section === kind).map(x => ({ ...spineSpec(byId[x.id]), mark: footIcon(x.id) }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
  }));
}

async function openBookcaseShare() {
  bookcaseShare = { pick: 'all', blob: null, count: 0 };
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="sheet-title">Share the bookshelves</div>
    <div class="share-format bc-choices" role="group" aria-label="What to include">
      ${BOOKCASE_CHOICES.map(([k, l]) => `<button data-library-action="bookcase-pick" data-pick="${k}" class="${k === 'all' ? 'active' : ''}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}
    </div>
    <div class="share-preview-wrap"><img id="bookcasePreview" alt="The bookshelves"></div>
    <button class="sheet-btn" data-library-action="bookcase-share-go">Share picture</button>
    <div class="share-secondary">
      <button class="share-small" data-library-action="bookcase-download">⬇ Download</button>
    </div>`;
  showSheet('boardSheet');
  await drawBookcase();
}

function pickBookcase(pick) {
  if (!bookcaseShare || bookcaseShare.pick === pick) return;
  bookcaseShare.pick = pick;
  document.querySelectorAll('[data-library-action=bookcase-pick]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.pick === pick)); b.classList.toggle('active', b.dataset.pick === pick); });
  drawBookcase();
}

async function drawBookcase() {
  const share = bookcaseShare, pick = share.pick;
  share.blob = null;
  const canvas = await renderBookcaseImage({ sections: bookcaseSections(pick) });
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (bookcaseShare !== share || share.pick !== pick) return; // another choice (or sheet) took over
  share.blob = blob;
  const img = document.getElementById('bookcasePreview');
  if (img) img.src = URL.createObjectURL(blob);
}

const bookcaseFileName = () => `bookshelves-${new Date().toISOString().slice(0, 10)}.png`;

async function shareBookcase() {
  if (!bookcaseShare?.blob) return;
  const file = new File([bookcaseShare.blob], bookcaseFileName(), { type: 'image/png' });
  const text = 'My bookshelves, made with Event Book';
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Bookshelves', text }); } catch (e) { /* dismissed */ }
  } else {
    downloadBookcase();
    showToast('Picture downloaded');
  }
}

function downloadBookcase() {
  if (!bookcaseShare?.blob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(bookcaseShare.blob);
  a.download = bookcaseFileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Long-press a spine: the book lifts off the shelf and its card opens (full title, edition, what
// you can do), as if you picked it up to browse. A move cancels it (that's a scroll); the tap that
// ends a long press doesn't also open the book.
const LIFT_MS = 450;
let lift = null, lifted = false;
function startLift(e) {
  // A new press: whatever the last long press's own release did (its card may have taken it)
  lifted = false;
  const spine = e.target.closest('.ed-spine[data-model]');
  if (!spine || e.button > 0) return;
  cancelLift();
  lift = { spine, x: e.clientX, y: e.clientY, timer: setTimeout(() => {
    lifted = true;
    spine.classList.add('lifted');
    navigator.vibrate?.(12);
    setTimeout(() => { spine.classList.remove('lifted'); openBookSheet(spine.dataset.model); }, 180);
  }, LIFT_MS) };
}
function moveLift(e) { if (lift && Math.hypot(e.clientX - lift.x, e.clientY - lift.y) > 8) cancelLift(); }
function cancelLift() { if (lift) clearTimeout(lift.timer); lift = null; }

function handleClick(e) {
  if (lifted) { lifted = false; if (e.target.closest('.ed-spine')) { e.preventDefault(); return; } }
  const t = e.target.closest('[data-library-action]');
  if (!t) return;
  const a = t.dataset.libraryAction;
  const id = t.dataset.model || menuModelId;
  if (a === 'open') { hideAllSheets(); openModel(id); window.EventPad.showStart(); }
  else if (a === 'info') openShelfInfo(id);
  else if (a === 'details') openBookSheet(id);
  else if (a === 'compare-book') {
    hideAllSheets();
    // This book beside another you pick (no book is open on the shelves)
    setTimeout(() => openComparePicker(id, showCompare), 150);
  }
  else if (a === 'publish') {
    const why = onBook(id, () => publishEdition());
    if (why) { showToast(why); return; }
    hideAllSheets();
    showToast(`Published: ${ordinal(projectState(readModelEvents(id)).edition.edition)} edition`);
    window.EventPad.showLibrary();
  }
  else if (a === 'next-draft') {
    const inLibrary = document.body.classList.contains('library-mode');
    const open = getCurrentModelId();
    if (open !== id) openModel(id);
    const why = startNextDraft();
    if (why) { showToast(why); return; }
    hideAllSheets();
    if (inLibrary) { openModel(open); window.EventPad.showLibrary(); }
    else window.EventPad.showStart();
    showToast('Next draft started: a copy to change');
  }
  else if (a === 'reference') openReferenceBook(t.dataset.ref);
  else if (a === 'close') hideAllSheets();
  else if (a === 'new') { setModelStartIn(createModel(), getStartIn()); window.EventPad.showStart(); openModelNameSheet({ isNew: true }); }
  else if (a === 'menu') openShelfMenu(id);
  else if (a === 'share') { hideAllSheets(); setTimeout(() => openShelfShare(id), 150); }
  else if (a === 'share-bookcase') { hideAllSheets(); setTimeout(() => openBookcaseShare(), 150); }
  else if (a === 'bookcase-pick') pickBookcase(t.dataset.pick);
  else if (a === 'bookcase-share-go') shareBookcase();
  else if (a === 'bookcase-download') downloadBookcase();
  else if (a === 'shelf-share-go') shareShelf();
  else if (a === 'shelf-copy-link') copyShelfLink();
  else if (a === 'shelf-download') downloadShelf();
  else if (a === 'share-more') { hideAllSheets(); setTimeout(() => openShareSheet(shelfShare.id), 150); }
  else if (a === 'rename') {
    // Named from the library, staying in the library: the model you had open is open again after Save.
    // A library book checked in is checked out here first (a rename is a change); held elsewhere, it can't be.
    const open = getCurrentModelId();
    hideAllSheets();
    readyToChange(id).then(why => {
      if (why) { showToast(why); return; }
      openModel(id);
      setTimeout(() => openModelNameSheet({ returnTo: open }), 150);
    });
  }
  // Always against the open board: it's the left side
  else if (a === 'fold') { toggleSection(t.dataset.section); markShelfRows(); }
  else if (a === 'jump') jumpTo(t.dataset.section);
  else if (a === 'duplicate') {
    // The copy goes on a new shelf; the model you had open stays open
    const open = getCurrentModelId();
    hideAllSheets();
    const name = projectState(readModelEvents(id)).modelName;
    duplicateModel(id);
    nameModel(`${name || 'Untitled model'} (copy)`);
    openModel(open);
    window.EventPad.showLibrary();
    showToast('Duplicated');
  }
  else if (a === 'return') {
    // A library book goes back: checked in with its last changes, off this device, still in the library
    hideAllSheets();
    forgetHere(id).then(() => {
      deleteModel(id);
      window.EventPad.showLibrary();
      showToast('Returned to your library');
    }, e => showToast(`Not returned: couldn't reach your library to send its last changes (${e.message})`));
  }
  else if (a === 'delete') {
    const name = projectState(readModelEvents(id)).modelName || 'this model';
    if (!confirm(`Delete "${name}" from this device?`)) return;
    hideAllSheets();
    deleteModel(id);
    window.EventPad.showLibrary();
    showToast('Model deleted');
  }
}

export function initLibrary() {
  const shelves = document.getElementById('libraryView');
  shelves?.addEventListener('click', handleClick);
  shelves?.addEventListener('pointerdown', startLift);
  shelves?.addEventListener('pointermove', moveLift);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => shelves?.addEventListener(t, cancelLift));
  // Rows of books wrap with the width: each gets its ledge again
  let rowTimer;
  window.addEventListener('resize', () => { clearTimeout(rowTimer); rowTimer = setTimeout(() => markShelfRows(), 80); });
  // A long press would also bring up the phone's own menu over a spine
  shelves?.addEventListener('contextmenu', e => { if (e.target.closest('.ed-spine')) e.preventDefault(); });
  // The shelf menu lives in the shared board sheet
  document.getElementById('boardSheetContent')?.addEventListener('click', handleClick);
}
