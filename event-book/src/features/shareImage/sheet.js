// ===========================================
// SHARE IMAGE - Sheet (preview, options, share)
// ===========================================

import { projectState, sliceTitle } from '../../core/projections.js';
import { readModelEvents } from '../../core/eventStore.js';
import { showSheet } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { renderModelImage, renderSlides, ensureFonts } from './render.js';
import { renderOutlineImage } from './outlineImage.js';
import { isChapterFolded } from '../board/view.js';

const OPTS_KEY = 'eventpad_share_opts';
let opts = { theme: 'light', showProps: true, foldChapters: true, showDescription: true, showScenarios: false, showSliceNotes: false, slides: false, outline: false };
// Picture (the board), Slides 4:5, or the Outline (a table of contents)
const formatOf = () => opts.outline ? 'outline' : opts.slides ? 'slides' : 'board';
try { opts = { ...opts, ...JSON.parse(localStorage.getItem(OPTS_KEY) || '{}') }; } catch (e) { /* storage blocked */ }

// What's shared: the whole model (null) or one chapter. Picked fresh each time.
let scope = null;
// Or one slice ('slice:<id>' in the What menu), from the slice's own menu
let sliceScope = null;
// Which model: the open one (null), or a shelf's from the library (its id)
let sourceId = null;
const sourceEvents = () => (sourceId ? readModelEvents(sourceId) : null);
const sourceState = () => (sourceId ? projectState(readModelEvents(sourceId)) : projectState());

// For the share link: the events of the model being shared (null = the open one)
export function shareSourceEvents() { return sourceEvents(); }
export function shareSourceId() { return sourceId; }
let blobs = [];        // one picture, or one per slide
let previewUrl = null;

const escapeHtml = text => String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function fileName(index = null) {
  const state = sourceState();
  const slice = scope?.startsWith('slice:') && state.slices[scope.slice(6)];
  const chapterNames = (scope && !scope.startsWith('slice:') ? scope.split(',') : []).map(id => state.chapters[id]?.name).filter(Boolean);
  const name = [state.modelName || 'event-model', slice ? sliceTitle(slice, state) : chapterNames.join(' ')].filter(Boolean).join(' ');
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base + (index === null ? '' : `-${index + 1}`) + '.png';
}

const toBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

// Whole model or one chapter, offered only when there are chapters with slices
// What to share: this slice (from its menu), the whole model, or a chapter. A picker with a
// search, since a big model's chapters run past what a phone's own list scrolls through well.
let scopeOptions = [];
function renderScope(state) {
  const chapters = state.chapterOrder.map(id => state.chapters[id])
    .filter(c => c && Object.values(state.slices).some(s => s.chapterId === c.id));
  const slice = sliceScope && state.slices[sliceScope];
  scopeOptions = [...(slice ? [{ id: 'slice:' + slice.id, name: 'This slice: ' + sliceTitle(slice, state) }] : []), { id: '', name: 'Whole model' }, ...chapters];
  document.getElementById('shareScope').innerHTML = scopeOptions.map(c =>
    `<option value="${c.id}" ${(scope || '') === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
  const btn = document.getElementById('shareScopeBtn');
  btn.hidden = scopeOptions.length < 2;
  const picked = chosenChapters().map(id => scopeOptions.find(o => o.id === id)?.name).filter(Boolean);
  document.getElementById('shareScopeLabel').textContent = picked.length
    ? picked[0] + (picked.length > 1 ? ` + ${picked.length - 1} more` : '')
    : (scopeOptions.find(o => o.id === (scope || '')) || scopeOptions[0])?.name || '';
  renderScopeList();
}

function renderScopeList() {
  const query = (document.getElementById('shareScopeSearch')?.value || '').trim().toLowerCase();
  const words = query.split(/\s+/).filter(Boolean);
  // The slice and the whole model always stay; chapters filter by every word typed
  const shown = scopeOptions.filter(o => !o.id || o.id.startsWith('slice:') || words.every(w => o.name.toLowerCase().includes(w)));
  const chapters = chosenChapters();
  // Chapters tick on and off (share several); the whole model and the slice are one choice each
  const isChapter = o => o.id && !o.id.startsWith('slice:');
  document.getElementById('shareScopeList').innerHTML = shown.map(o => {
    const on = isChapter(o) ? chapters.includes(o.id) : (scope || '') === o.id;
    return `<button type="button" class="share-scope-option ${on ? 'active' : ''}" role="option" aria-selected="${on}" data-scope="${escapeHtml(o.id)}">${isChapter(o) ? `<span class="share-scope-tick">${on ? '✓' : ''}</span>` : ''}${escapeHtml(o.name)}</button>`;
  }).join('')
    + (words.length && shown.every(o => !o.id || o.id.startsWith('slice:')) ? `<div class="share-scope-none">No chapter matches</div>` : '');
}

function openScopePanel(open) {
  const panel = document.getElementById('shareScopePanel');
  panel.hidden = !open;
  document.getElementById('shareScopeBtn').setAttribute('aria-expanded', String(open));
  if (open) {
    const search = document.getElementById('shareScopeSearch');
    search.value = '';
    renderScopeList();
    // Only a long list needs the search box
    search.hidden = scopeOptions.length <= 8;
    if (!search.hidden) search.focus();
    // On a short phone the list opens below the fold of the scrolling sheet: bring it up
    panel.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }
}

function pickScope(id) {
  if (id && !id.startsWith('slice:')) {
    // A chapter: on or off, keeping the others; the panel stays open for more
    const ids = chosenChapters();
    const next = ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id];
    scope = next.join(',') || null;
    document.getElementById('shareScope').value = next[0] || '';
    refreshPreview();
    return;
  }
  scope = id || null;
  document.getElementById('shareScope').value = id;
  openScopePanel(false);
  refreshPreview();
}

let refreshRun = 0;
const chosenChapters = () => (scope && !scope.startsWith('slice:') ? scope.split(',') : []);

async function refreshPreview() {
  const run = ++refreshRun;
  // data-busy until the picture for these settings is on screen (tests wait on it)
  const preview = document.getElementById('sharePreview');
  preview.dataset.busy = '1';
  await ensureFonts();
  const state = sourceState();
  if (scope && !scope.startsWith('slice:')) scope = chosenChapters().filter(id => state.chapters[id]).join(',') || null;
  if (scope?.startsWith('slice:') && !state.slices[scope.slice(6)]) scope = null;
  const only = scope?.startsWith('slice:') ? [scope.slice(6)] : null;
  const chapters = chosenChapters();
  const chapterId = only ? null : chapters.length > 1 ? chapters : chapters[0] || null;
  // Folded / All open only matters for the whole model (a picture or the outline), with a chapter folded
  document.getElementById('shareFoldOpt').style.display =
    !scope && !opts.slides && state.chapterOrder.some(id => isChapterFolded(id)) ? '' : 'none';
  // The outline lists slices; their stickies' fields are the board's
  document.getElementById('sharePropsOpt').style.display = opts.outline ? 'none' : '';
  document.getElementById('shareDescOpt').style.display = state.modelDescription ? '' : 'none';
  document.getElementById('shareNotesOpt').style.display = Object.values(state.slices).some(s => s.description) ? '' : 'none';
  document.getElementById('shareGwtOpt').style.display = Object.keys(state.scenarios).length ? '' : 'none';
  renderScope(state);
  document.querySelectorAll('#shareSheet [data-share-set]').forEach(btn => {
    btn.classList.toggle('active', formatOf() === btn.dataset.value);
  });
  document.querySelectorAll('#shareSheet [data-share-opt]').forEach(btn => {
    const { shareOpt, on } = btn.dataset;
    btn.classList.toggle('active', String(opts[shareOpt]) === on);
  });
  // "Options · 3 on": what's switched on, without opening it
  const on = [...document.querySelectorAll('#shareMore .share-chip.active')].filter(c => c.style.display !== 'none').length;
  document.getElementById('shareMoreSummary').textContent = `Options · ${on} on`;

  const canvases = opts.outline
    ? [renderOutlineImage({ ...opts, chapterId, onlySlices: only, events: sourceEvents() })]
    : opts.slides
      ? renderSlides({ ...opts, chapterId, onlySlices: only, events: sourceEvents() })
      : [renderModelImage({ ...opts, chapterId, onlySlices: only, events: sourceEvents() })];
  const made = await Promise.all(canvases.map(toBlob));
  // A newer refresh (another chip tapped meanwhile) wins
  if (run !== refreshRun) return;
  if (!made.length || made.some(b => !b)) {
    blobs = [];
    delete preview.dataset.busy;
    showToast("Couldn't draw the image. Try one chapter or slides");
    return;
  }
  blobs = made;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(blobs[0]);
  preview.onload = () => { if (run === refreshRun) delete preview.dataset.busy; };
  preview.src = previewUrl;
  document.getElementById('shareGo').textContent = blobs.length > 1 ? `Share ${blobs.length} slides` : 'Share image';
  const count = document.getElementById('shareSlideCount');
  count.hidden = blobs.length < 2;
  count.textContent = `Slide 1 of ${blobs.length}. All of them are shared together.`;
}

// modelId: share a shelf's model from the library without opening it.
// sliceId: start with just that slice (from the slice's menu).
export function openShareSheet(modelId = null, { sliceId = null } = {}) {
  sourceId = typeof modelId === 'string' ? modelId : null;
  const state = sourceState();
  if (!Object.keys(state.slices).length) {
    showToast('Add a slice first');
    return;
  }
  // A link made earlier may be for another model or an older version: start fresh
  const linkBox = document.getElementById('shareLinkResult');
  if (linkBox) { linkBox.hidden = true; linkBox.innerHTML = ''; }
  sliceScope = sliceId;
  scope = sliceId ? 'slice:' + sliceId : null;
  openScopePanel(false);
  showSheet('shareSheet');
  refreshPreview();
}

function download() {
  blobs.forEach((blob, i) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(blobs.length > 1 ? i : null);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  });
}

async function share() {
  if (!blobs.length) return;
  const files = blobs.map((blob, i) => new File([blob], fileName(blobs.length > 1 ? i : null), { type: 'image/png' }));
  if (navigator.canShare && navigator.canShare({ files })) {
    try {
      await navigator.share({ files, title: sourceState().modelName || 'Event model' });
    } catch (e) {
      if (e.name !== 'AbortError') download();
    }
  } else {
    download();
    showToast(files.length > 1 ? `${files.length} slides downloaded` : 'Image downloaded');
  }
}

export function initShareImage() {
  document.getElementById('shareBtn').addEventListener('click', openShareSheet);
  document.getElementById('shareScope').addEventListener('change', e => { scope = e.target.value || null; refreshPreview(); });
  document.getElementById('shareScopeBtn').addEventListener('click', () => openScopePanel(document.getElementById('shareScopePanel').hidden));
  document.getElementById('shareScopeSearch').addEventListener('input', renderScopeList);
  document.getElementById('shareScopeDone').addEventListener('click', () => openScopePanel(false));
  document.getElementById('shareScopeList').addEventListener('click', e => {
    const opt = e.target.closest('[data-scope]');
    if (opt) pickScope(opt.dataset.scope);
  });
  document.getElementById('shareSheet').addEventListener('click', e => {
    const opt = e.target.closest('[data-share-opt]');
    if (opt) {
      // Chips toggle between their on and off value
      const { shareOpt, on, off } = opt.dataset;
      const value = String(opts[shareOpt]) === on ? off : on;
      opts[shareOpt] = value === 'true' ? true : value === 'false' ? false : value;
      try { localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); } catch (err) { /* storage blocked */ }
      refreshPreview();
    }
    const set = e.target.closest('[data-share-set]');
    if (set) {
      opts.slides = set.dataset.value === 'slides';
      opts.outline = set.dataset.value === 'outline';
      try { localStorage.setItem(OPTS_KEY, JSON.stringify(opts)); } catch (err) { /* storage blocked */ }
      refreshPreview();
    }
    if (e.target.closest('#shareGo')) share();
    if (e.target.closest('#shareDownload')) download();
  });
}
