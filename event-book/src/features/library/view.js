// ===========================================
// LIBRARY - View (SV: View Library)
// Every model on this device as a shelf of books: the model's chapters are
// the books on its shelf (thicker for more slices), a model without chapters
// is one book. Tap a shelf to open it.
// ===========================================

import { openShareSheet } from '../shareImage/sheet.js';
import { listReferences } from '../references/store.js';
import { openReferenceBook } from '../references/sheet.js';
import { renderShelfImage } from './shelfImage.js';
import { renderBookcaseImage } from './bookcaseImage.js';
import { createShareLink, linkError } from '../shareLink/link.js';
import { copyText } from '../../ui/clipboard.js';
import { formatBytes } from '../../ui/bytes.js';
import { listModels, readModelEvents, modelSize, historyOf, getCurrentModelId, openModel, createModel, duplicateModel, deleteModel, setModelStartIn, openedAt } from '../../core/eventStore.js';
import { getStartIn } from '../../ui/feed.js';
import { bookState } from '../../core/projections.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../board/view.js';
import { openModelNameSheet } from '../board/sheets.js';
import { nameModel } from '../board/command.js';
import { rememberPair, openComparePicker } from '../compare/view.js';
import { sourceSummary, repoUrl, repoName } from '../../core/source.js';
import { accountBar, footMark, footIcon, locationText, shelfMenuOption, afterLibraryRender } from '../sync/view.js';
import { account, kept, canEdit, isKept, readyToChange, forgetHere, isReviewerAccount } from '../sync/client.js';
import { sharedOf, refreshShared } from '../shared/client.js';
import { verificationResults } from '../verify/command.js';
import { detailsOf } from '../editions/shelves.js';
import { publishRefusal, ordinal } from '../editions/rules.js';
import { publishEdition, startNextDraft } from '../editions/command.js';
import { bookshelfSections } from './sections.js';
import { openCatalog } from './catalogView.js';
import { toggleSection, jumpTo } from './folds.js';
import { showCompare, showBoard } from '../../ui/feed.js';
import { openReplay } from '../replay/replay.js';
import { chooseBookKind } from '../literature/command.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { editionsSection } from '../buildVersions/view.js';
import { readyToRetire } from '../retire/readyToRetire.read.js';
import { retireBox, retiredShelfBox } from '../retire/retire.parts.js';
import { retirePlan } from '../retire/command.js';
import { usageSection } from '../usage/view.js';
import { pressSection } from '../press/view.js';
import { fillProductInsight } from '../productUsage/view.js';
import { isBuildBook, buildBookApp } from '../buildVersions/rules.js';
import { shelfTag, setShelfTag } from './tags.js';
import { velocitySummaries, velocityOpen, toggleVelocity } from '../velocity/view.js';
import { proppedUp, shelfEvents, propUpBook, putBookBack, isProppedUp } from './propUp.js';
import { libraryScreen, bookFacts, editionText, spineMeta } from './screen.js';
import { libraryHeader, libraryVelocity, libraryChips, libraryTags, librarySection, libraryReferenceShelf } from './rowView.js';

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

const count = n => n.toLocaleString('en-US');

// What a book's details sheet says about its size and history
function bookMeta(model, state, events) {
  const history = historyOf(events);
  const f = bookFacts(state);
  return [
    f.literature ? `${f.slices} ${f.slices === 1 ? 'paragraph' : 'paragraphs'}` : `${f.slices} ${f.slices === 1 ? 'slice' : 'slices'}`,
    f.chapters ? `${f.chapters} ${f.chapters === 1 ? 'chapter' : 'chapters'}` : '',
    `edited ${ago(model?.updatedAt)}`,
    `<span class="lb-size">${formatBytes(modelSize(model.id))}</span>`,
    sourceSummary(state),
    history.snapshot
      ? `📸 snapshot${history.changes ? ` + ${count(history.changes)} ${history.changes === 1 ? 'change' : 'changes'}` : ''}`
      : `🕘 history · ${count(history.changes)} ${history.changes === 1 ? 'event' : 'events'}`,
    model.startIn === 'outline' ? '📋 plotted' : model.startIn === 'board' ? '🌀 pantsed' : ''
  ].filter(Boolean).join(' · ');
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

// Every book on this device, as the screen takes them (a state per book, kept until its events change)
const booksOnDevice = () => listModels().map(m => ({ id: m.id, updatedAt: m.updatedAt, events: readModelEvents(m.id), state: bookState(m.id) }));

// The Library screen for what is on this device now. tag: the shelves' tag chip (the device's, unless said);
// velocity: the books' summaries (null: not wanted, as in a picture)
function shelves({ tag = shelfTag(), velocity = velocitySummaries() } = {}) {
  return libraryScreen(booksOnDevice(), {
    kept: account() ? kept() : {}, signedIn: !!account(),
    shared: listModels().filter(m => sharedOf(m.id)).map(m => m.id),
    opened: openedAt(), propped: proppedUp(shelfEvents()), tag, references: listReferences(),
    velocity, velocityOpen: velocityOpen()
  });
}

// What the shelves last drew, for the catalog's "which shelf"
let shelfOf = {};

export function renderLibrary() {
  const container = document.getElementById('libraryView');
  if (!container) return;
  if (!fontsSettled && document.fonts?.ready) {
    fontsSettled = true;
    document.fonts.ready.then(() => { if (document.body.classList.contains('library-mode')) renderLibrary(); });
  }
  const screen = shelves();
  shelfOf = screen.shelfOf;
  // The foot mark (who has the book) is the sync's; the rest is drawn from the screen
  const ui = { foot: id => footMark(id) };
  container.innerHTML = `
    ${libraryHeader(screen, { reviewer: isReviewerAccount() })}
    ${libraryVelocity(screen.velocity)}
    ${libraryChips(screen.chips)}
    ${libraryTags(screen.tags)}
    ${screen.sections.map(section => librarySection(section, ui)).join('\n    ')}
    ${retiredShelfBox(screen.retired, ui)}
    <p class="ed-legend">Kraft = draft · cloth = published edition · loose sheets = refined, not built yet. Foot mark (library books): ✏️ green = checked out here, yours to edit · ☁ = checked in, read only · 🔒 amber or the itsyBIT mark = checked out on another device or to Claude. None = only on this device.</p>
    ${accountBar()}
    <div id="syMissing"></div>
    ${libraryReferenceShelf(screen.reference, ui)}`;
  afterLibraryRender();
  // The chips pin just under the pinned shelves header: how tall that is here
  const head = container.querySelector('.lb-head');
  if (head) document.documentElement.style.setProperty('--lb-head-h', `${head.offsetHeight}px`);
  markShelfRows(container);
  // Books shared with this account: fetched onto this device (removed ones taken off), then the shelves again
  refreshShared().then(changed => { if (changed && document.body.classList.contains('library-mode')) renderLibrary(); });
}

let menuModelId = null;

// A published book's next draft already on this device (a copy that says it came from it)
const nextDraftOf = id => listModels().find(m => readModelEvents(m.id).some(e => e.type === 'NextDraftStarted' && e.data?.fromModel === id)) || null;

// A book's tags on its card
const tagsRow = tags => tags?.length ? `<div class="lb-tag-row">${tags.map(t => `<span class="lb-tag">${escapeHtml(t)}</span>`).join('')}</div>` : '';

// Tap a book: what it is, where it lives, how far along, and what you can do with it
function openBookSheet(id) {
  menuModelId = id;
  const shared = sharedOf(id);
  if (shared) {
    const book = bookFacts(bookState(id));
    document.getElementById('boardSheetContent').innerHTML = `
      <div class="ed-sheet-card" data-book="${id}">
        <div class="ed-sheet-kicker">Shared with you</div>
        <div class="ed-sheet-title">${escapeHtml(book.name)}</div>
        <div class="ed-sheet-where">by ${escapeHtml(shared.owner || 'its owner')} · ${shared.role === 'editor' ? 'you can edit names and scenarios, and tick Refined' : shared.canAddScenarios ? 'you can comment and add scenarios' : 'you can comment'}</div>
        ${book.description ? `<p class="lb-info-text">${escapeHtml(book.description)}</p>` : ''}
        ${tagsRow(book.tags)}
        <div class="ed-actions"><button class="ed-btn primary" data-library-action="open" data-model="${id}">Open</button></div>
      </div>`;
    showSheet('boardSheet');
    return;
  }
  const events = readModelEvents(id);
  const state = bookState(id);
  const f = bookFacts(state);
  const d = detailsOf(state);
  const e = f.edition;
  const name = f.name;
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
      ${f.description ? `<p class="lb-info-text">${escapeHtml(f.description)}</p>` : ''}
      ${tagsRow(f.tags)}
      <dl class="ed-facts">
        <dt>Slices</dt><dd class="ed-counts">${d.done} of ${d.total} done · ${d.ready} ready · ${d.sketched} sketched</dd>
        ${build && repoUrl(state) ? `<dt>Code</dt><dd class="ed-code"><a href="${escapeHtml(repoUrl(state))}" target="_blank" rel="noopener">${escapeHtml(repoName(state))} ↗</a></dd>` : ''}
        <dt>Last build</dt><dd class="ed-build">${d.lastBuild ? escapeHtml(String(d.lastBuild).slice(0, 7)) : 'not compared yet'}</dd>
        <dt>Edition</dt><dd class="ed-edition">${escapeHtml(editionText(e))}</dd>
        ${f.judged ? (r => `<dt>Verified</dt><dd class="ed-verified">✓ ${r.works} · ✗ ${r.fails} · ${r.untested} to try</dd>`)(verificationResults(state, e.edition)) : ''}
      </dl>
      <p class="lb-meta ed-meta">${bookMeta(listModels().find(m => m.id === id) || { id }, state, events)}</p>
      ${whyText ? `<p class="ed-why">${escapeHtml(whyText)}</p>` : ''}
      ${build ? '' : retireBox(readyToRetire(events, id))}
      ${usageSection(events)}
      ${build ? '' : pressSection(state, id)}
      ${build ? '' : replaceHistory(events, id)}
      ${build && buildBookApp(name) === 'eventpad' && account()?.admin ? '<div class="us-insight pu-insight" id="puInsight"></div>' : ''}
      ${editionsSection(events, id, booksOnDevice())}
      <div class="ed-actions">
        <button class="ed-btn primary" data-library-action="open" data-model="${id}">Open</button>
        <button class="ed-btn" data-library-action="compare-book" data-model="${id}">Compare…</button>
        ${!kept && !build ? `<button class="ed-btn" data-sync-action="keep" data-model="${id}">Keep on server (private)</button>` : ''}
        ${kept && !build ? `<button class="ed-btn" data-review-action="open" data-model="${id}">Review &amp; verify…</button>` : ''}
        ${kept && !build && !isReviewerAccount() ? `<button class="ed-btn" data-people-action="open" data-model="${id}">People…</button>` : ''}
        ${build ? '' : publish}
        ${e.published && !build ? `<button class="ed-btn" data-library-action="next-draft" data-model="${id}" ${next ? 'disabled' : ''}>Start next draft</button>` : ''}
        <button class="ed-btn" data-library-action="${isProppedUp(id) ? 'put-back' : 'prop-up'}" data-model="${id}">${isProppedUp(id) ? 'Put back' : 'Prop up'}</button>
        <button class="ed-btn quiet" data-library-action="menu" data-model="${id}">More…</button>
      </div>
      ${next ? `<p class="ed-why">The ${ordinal(e.edition + 1)} edition is already a draft on your shelves.</p>` : ''}
    </div>`;
  showSheet('boardSheet');
  fillProductInsight(document.getElementById('puInsight'));
}

// Run a command on another book: it opens, the command runs, and the model you had open is open again
function onBook(id, fn) {
  const open = getCurrentModelId();
  if (open !== id) openModel(id);
  const result = fn();
  if (open !== id && listModels().some(m => m.id === open)) openModel(open);
  return result;
}


// ＋ New: a fact book (the model: board, stickies, scenarios) or literature (a story: paragraphs and sentences)
function openNewBookSheet() {
  const option = (action, icon, title, desc) => `
    <div class="sheet-option" data-library-action="${action}">
      <div class="sheet-option-icon" style="background: var(--surface-hover);">${icon}</div>
      <div class="sheet-option-text"><div class="sheet-option-title">${title}</div><div class="sheet-option-desc">${desc}</div></div>
    </div>`;
  openBoardSheet(`
    <div class="sheet-title">A new book</div>
    <div class="sheet-options">
      ${option('new-fact', '🟧', 'Fact book', 'An event model: board, stickies, scenarios and specs')}
      ${option('new-literature', '📖', 'Literature', 'A story: paragraphs and their sentences, read in order. No board, no scenarios')}
    </div>`);
}

function openShelfMenu(id) {
  menuModelId = id;
  const facts = bookFacts(bookState(id));
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="sheet-title">${escapeHtml(facts.name)}</div>
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
      ${facts.literature ? '' : `<div class="sheet-option" data-library-action="compare-book" data-model="${id}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↔</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Compare with…</div>
          <div class="sheet-option-desc">This book beside another you pick</div>
        </div>
      </div>`}
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
  const facts = bookFacts(bookState(id));
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="sheet-title">${escapeHtml(facts.name)}</div>
    <p class="lb-info-text">${escapeHtml(facts.description)}</p>
    <div class="bd-move-row">
      <button class="sheet-btn secondary" data-library-action="open" data-model="${id}">Open</button>
      <button class="sheet-btn" data-library-action="close">Close</button>
    </div>`;
  showSheet('boardSheet');
}

// ---------- Sharing a shelf: its picture and a link to the model ----------

let shelfShare = null; // { id, name, blob, url }

async function openShelfShare(id) {
  const name = bookFacts(bookState(id)).name;
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
// The picture's shelves, as the bookshelves screen has them: a book checked out elsewhere is on
// the On loan shelf (there only when there are some), not among Published or Drafts
const loanedIds = models => new Set(bookshelfSections(models, account() ? kept() : {}).library
  .filter(b => b.status === 'on-loan' || b.status === 'on-loan-agent').map(b => b.id));

export function bookcaseSections(pick) {
  const placed = Object.fromEntries(shelves({ tag: null, velocity: null }).sections.map(sec => [sec.key, [...sec.propped, ...sec.recent, ...sec.standing]]));
  return [['published', 'Published'], ['drafts', 'Drafts'], ...(placed.onloan ? [['onloan', 'On loan']] : [])]
    .filter(([kind]) => pick === 'all' || pick === kind).map(([kind, plaque]) => ({
      kind, plaque,
      books: placed[kind].map(b => ({ ...b, name: b.title, meta: spineMeta(b), mark: footIcon(b.id) }))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    }));
}

async function openBookcaseShare() {
  bookcaseShare = { pick: 'all', format: 'tall', blob: null, count: 0 };
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="sheet-title">Share the bookshelves</div>
    <div class="share-format bc-choices" role="group" aria-label="What to include">
      ${[...BOOKCASE_CHOICES, ...(loanedIds(listModels()).size ? [['onloan', 'On loan']] : [])].map(([k, l]) => `<button data-library-action="bookcase-pick" data-pick="${k}" class="${k === 'all' ? 'active' : ''}" aria-pressed="${k === 'all'}">${l}</button>`).join('')}
    </div>
    <div class="share-format bc-formats" role="group" aria-label="Shape">
      ${[['tall', 'Tall'], ['square', 'Square 1:1']].map(([k, l]) => `<button data-library-action="bookcase-format" data-format="${k}" class="${k === 'tall' ? 'active' : ''}" aria-pressed="${k === 'tall'}">${l}</button>`).join('')}
    </div>
    <div class="share-preview-wrap"><img id="bookcasePreview" alt="The bookshelves"></div>
    <button class="sheet-btn" data-library-action="bookcase-share-go">Share picture</button>
    <div class="share-secondary">
      <button class="share-small" data-library-action="bookcase-download">⬇ Download</button>
    </div>`;
  showSheet('boardSheet');
  await drawBookcase();
}

function formatBookcase(format) {
  if (!bookcaseShare || bookcaseShare.format === format) return;
  bookcaseShare.format = format;
  document.querySelectorAll('[data-library-action=bookcase-format]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.format === format)); b.classList.toggle('active', b.dataset.format === format); });
  drawBookcase();
}

function pickBookcase(pick) {
  if (!bookcaseShare || bookcaseShare.pick === pick) return;
  bookcaseShare.pick = pick;
  document.querySelectorAll('[data-library-action=bookcase-pick]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.pick === pick)); b.classList.toggle('active', b.dataset.pick === pick); });
  drawBookcase();
}

async function drawBookcase() {
  const share = bookcaseShare, pick = share.pick, format = share.format;
  share.blob = null;
  const canvas = await renderBookcaseImage({ sections: bookcaseSections(pick), square: share.format === 'square' });
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  if (bookcaseShare !== share || share.pick !== pick || share.format !== format) return; // another choice (or sheet) took over
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

// History: each time an import replaced this book, with a way back to how it was before
// (Replay, at the moment before the replace; ✕ comes back to now)
function replaceHistory(events, id) {
  const rows = events.map((e, i) => ({ e, i })).filter(x => x.e.type === 'BookReplacedFromImport').reverse();
  if (!rows.length) return '';
  return `<div class="ed-history">
    <div class="ed-sheet-kicker">History</div>
    ${rows.map(({ e, i }) => {
      // Before the replace: the events before its snapshot (written in the same breath, just before it)
      const at = events[i - 1]?.type === 'ModelSnapshot' ? i - 1 : i;
      const when = new Date(e.timestamp);
      return `<p class="ed-history-row">Replaced from ${escapeHtml(e.data?.fileName || 'an import')}${isNaN(when) ? '' : ` · ${escapeHtml(when.toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}`}
        <button class="ed-btn" data-library-action="before-replace" data-model="${id}" data-at="${at}">See it as it was before</button></p>`;
    }).join('')}
  </div>`;
}

// The catalog's books
function catalogBooks() {
  return shelves({ velocity: null }).books.map(b => ({ id: b.id, name: b.title, description: b.description, tags: b.tags,
    chapters: b.chapters, shelf: shelfOf[b.id] || 'Drafts', slices: b.slices, updatedAt: b.updatedAt }));
}

function handleClick(e) {
  if (lifted) { lifted = false; if (e.target.closest('.ed-spine')) { e.preventDefault(); return; } }
  const t = e.target.closest('[data-library-action]');
  if (!t) return;
  const a = t.dataset.libraryAction;
  const id = t.dataset.model || menuModelId;
  if (a === 'open') { hideAllSheets(); openModel(id); window.EventPad.showStart(); }
  else if (a === 'catalog') openCatalog(catalogBooks());
  else if (a === 'velocity') { toggleVelocity(); renderLibrary(); }
  else if (a === 'prop-up' || a === 'put-back') {
    const why = a === 'prop-up' ? propUpBook(id) : putBookBack(id);
    hideAllSheets();
    if (why) { showToast(why); return; }
    renderLibrary();
    showToast(a === 'prop-up' ? 'Propped up at the front of its shelf' : 'Put back in line');
  }
  else if (a === 'tag') { setShelfTag(shelfTag() === t.dataset.tag ? null : t.dataset.tag); renderLibrary(); }
  else if (a === 'before-replace') {
    hideAllSheets();
    openModel(id);
    showBoard();
    setTimeout(() => openReplay(Number(t.dataset.at)), 150);
  }
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
    showToast(`Published: ${ordinal(bookFacts(bookState(id)).edition.edition)} edition`);
    window.EventPad.showLibrary();
  }
  else if (a === 'retire') {
    // Retiring is a change to the plan: a library book is checked out here first; held elsewhere, it can't be
    readyToChange(id).then(why => {
      if (why) { showToast(why); return; }
      const refused = onBook(id, () => retirePlan());
      if (refused) { showToast(refused); return; }
      hideAllSheets();
      showToast('Retired: it moved to the Retired shelf');
      renderLibrary();
    });
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
  else if (a === 'new') openNewBookSheet();
  else if (a === 'new-fact' || a === 'new-literature') {
    hideAllSheets();
    setModelStartIn(createModel(), getStartIn());
    chooseBookKind({ kind: a === 'new-fact' ? 'fact' : 'literature' });
    window.EventPad.showStart();
    openModelNameSheet({ isNew: true });
  }
  else if (a === 'menu') openShelfMenu(id);
  else if (a === 'share') { hideAllSheets(); setTimeout(() => openShelfShare(id), 150); }
  else if (a === 'share-bookcase') { hideAllSheets(); setTimeout(() => openBookcaseShare(), 150); }
  else if (a === 'bookcase-pick') pickBookcase(t.dataset.pick);
  else if (a === 'bookcase-format') formatBookcase(t.dataset.format);
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
    const name = bookState(id).modelName;
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
    const name = bookState(id).modelName || 'this model';
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
  // On the shelves, / looks a book up (not while typing somewhere)
  document.addEventListener('keydown', e => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || !document.body.classList.contains('library-mode')) return;
    if (e.target.closest?.('input, textarea, [contenteditable="true"]')) return;
    e.preventDefault();
    openCatalog(catalogBooks());
  });
}
