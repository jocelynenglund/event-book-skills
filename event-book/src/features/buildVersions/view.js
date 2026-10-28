// ===========================================
// BUILD VERSIONS - Views
// SV: Build Editions — a build book's details sheet lists its editions, newest first, each to
// open (as it was built, look only) or compare with another.
// SV: Build At Edition — Open: the book, scrubbed to that edition (the latest opens as it is).
// SV: Build Changes — two editions side by side as the Compare view lays it out: − only in the
// earlier build (muted red), + only in the later (muted green).
// ===========================================

import { openModel, readModelEvents } from '../../core/eventStore.js';
import { buildEditions, buildChanges, unchanged, isBuildBook } from './rules.js';
import { escapeHtml } from '../board/view.js';
import { projectState } from '../../core/projections.js';
import { commitUrl } from '../../core/source.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { showBoard } from '../../ui/feed.js';
import { openReplay } from '../replay/replay.js';
import { showToast } from '../../ui/toast.js';

const date = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString([], { day: 'numeric', month: 'short' }); };
const when = e => [e.build != null ? `build ${e.build}` : '', e.commit, date(e.createdAt), e.scenarios != null ? `${e.scenarios} scenarios` : ''].filter(Boolean).join(' · ');
// The same, with the commit linked to the code (when the book knows its repo)
const whenHtml = (e, state) => [e.build != null ? `build ${escapeHtml(e.build)}` : '',
  e.commit ? (url => url ? `<a class="bv-commit" href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(e.commit)}</a>` : escapeHtml(e.commit))(commitUrl(state, e.commit)) : '',
  escapeHtml(date(e.createdAt)), e.scenarios != null ? `${e.scenarios} scenarios` : ''].filter(Boolean).join(' · ');

// The details sheet's list of editions ('' for a book that isn't a build book)
export function editionsSection(events, id) {
  if (!isBuildBook(events)) return '';
  const rows = buildEditions(events);
  const state = projectState(events);
  return `
    <div class="bv-editions" data-build-book="${escapeHtml(id)}">
      <div class="ed-sheet-kicker">Editions</div>
      ${rows.map((e, i) => `
        <div class="bv-edition" data-edition="${e.edition}">
          <div class="bv-edition-text"><b>Edition ${e.edition}</b><span>${whenHtml(e, state)}${i ? '' : ' · latest'}</span></div>
          ${i ? `<button class="bv-btn" data-bv-action="open" data-model="${escapeHtml(id)}" data-edition="${e.edition}">Open</button>` : ''}
          ${rows.length > 1 ? `<button class="bv-btn" data-bv-action="compare" data-model="${escapeHtml(id)}" data-edition="${e.edition}">Compare…</button>` : ''}
        </div>`).join('')}
    </div>`;
}

// Open an edition: the book, looking at the model as that build left it. The latest is the book as it is.
function openEdition(id, edition) {
  const events = readModelEvents(id);
  const rows = buildEditions(events);
  const row = rows.find(e => e.edition === edition);
  if (!row) return;
  hideAllSheets();
  openModel(id);
  showBoard();
  if (row.edition === rows[0].edition) return;
  setTimeout(() => openReplay(row.at), 150);
}

function pickOther(id, edition) {
  const rows = buildEditions(readModelEvents(id)).filter(e => e.edition !== edition);
  openBoardSheet(`
    <div class="sheet-title">Edition ${edition} against…</div>
    <div class="bv-picks">${rows.map(e => `
      <button class="bv-pick" data-bv-action="changes" data-model="${escapeHtml(id)}" data-edition="${edition}" data-other="${e.edition}">
        <b>Edition ${e.edition}</b><span>${escapeHtml(when(e))}</span>
      </button>`).join('')}</div>`);
}

const line = (t, text) => `<div class="cp-line ${t === '−' ? 'minus' : 'plus'}"><i>${t}</i><span>${escapeHtml(text)}</span></div>`;
function changesHtml(c) {
  if (unchanged(c)) return '<p class="ed-why" style="color: var(--text-muted)">Nothing changed between these builds.</p>';
  const group = (title, removed, added) => (removed.length || added.length)
    ? `<div class="bv-group"><div class="ed-sheet-kicker">${title}</div><div class="cp-scns">${removed.map(x => line('−', x)).join('')}${added.map(x => line('+', x)).join('')}</div></div>` : '';
  return group('Slices', c.slicesRemoved, c.slicesAdded) + group('Scenarios', c.scenariosRemoved, c.scenariosAdded) + group('Fields', c.fieldsRemoved, c.fieldsAdded) + group('Code', c.codeRemoved, c.codeAdded);
}

function showChanges(id, a, b) {
  const [from, to] = a < b ? [a, b] : [b, a];
  const c = buildChanges(readModelEvents(id), from, to);
  if (!c) { showToast('That edition is not there'); return; }
  openBoardSheet(`
    <div class="bv-changes">
      <div class="sheet-title">Edition ${from} → edition ${to}</div>
      <p class="bv-legend"><span class="cp-line minus"><i>−</i>only in edition ${from}</span> <span class="cp-line plus"><i>+</i>only in edition ${to}</span></p>
      ${changesHtml(c)}
    </div>`);
}

function handleClick(e) {
  const t = e.target.closest('[data-bv-action]');
  if (!t) return;
  const id = t.dataset.model, edition = Number(t.dataset.edition);
  const a = t.dataset.bvAction;
  if (a === 'open') openEdition(id, edition);
  else if (a === 'compare') pickOther(id, edition);
  else if (a === 'changes') showChanges(id, edition, Number(t.dataset.other));
}

export function initBuildVersions() {
  document.getElementById('boardSheetContent')?.addEventListener('click', handleClick);
}
