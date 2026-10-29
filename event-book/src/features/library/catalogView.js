// ===========================================
// LIBRARY - The card catalog terminal: an old computer in the bookshelves header. Tap it
// in the bookshelves header (or press / on the shelves) and a green-screen catalog asks what you're looking for; books
// come up as you type, each with what it can do: Open (a book here), Download & open (one
// only in the library), and Check out for a library book, which does all of that first.
// ===========================================

import { searchBooks } from './catalog.js';
import { account, serverLibrary, serverIds, isKept, holderOf, download, checkOut } from '../sync/client.js';
import { openModel } from '../../core/eventStore.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../board/view.js';

let books = [];

// The little computer (in the header, so folding a shelf never hides it): beige case, a green
// screen with a blinking cursor, a keyboard in front
export const terminalButton = () => `<button class="lb-terminal" data-library-action="catalog" aria-label="Look up a book (card catalog)" title="Look up a book (/)">
  <svg viewBox="0 0 64 60" width="40" height="38" aria-hidden="true">
    <rect x="6" y="2" width="52" height="40" rx="5" fill="#e3d6b8" stroke="#8a7550" stroke-width="1.5"/>
    <rect x="12" y="7" width="40" height="27" rx="3" fill="#13261a" stroke="#5b4a2c" stroke-width="1"/>
    <text x="16" y="19" font-family="monospace" font-size="7" font-weight="700" fill="#5cff8a">CATALOG</text>
    <text x="16" y="29" font-family="monospace" font-size="8" font-weight="700" fill="#5cff8a">&gt;<tspan class="lb-term-cursor">_</tspan></text>
    <rect x="22" y="42" width="20" height="5" fill="#cdbf9e" stroke="#8a7550" stroke-width="1"/>
    <rect x="4" y="47" width="56" height="11" rx="2.5" fill="#e3d6b8" stroke="#8a7550" stroke-width="1.5"/>
    <path d="M9 51h46M9 54.5h46" stroke="#a8946c" stroke-width="1" stroke-dasharray="3 1.5"/>
  </svg>
</button>`;

function render(query) {
  const box = document.getElementById('catalogHits');
  if (!box) return;
  const hits = searchBooks(books, query);
  box.innerHTML = !query.trim() ? '<p class="cat-hint">TYPE A NAME, A CHAPTER OR A WORD FROM THE DESCRIPTION</p>'
    : !hits.length ? '<p class="cat-hint">NO BOOK FOUND</p>'
    : hits.map(b => {
      const library = b.remote || isKept(b.id), mine = !b.remote && holderOf(b.id)?.you;
      const act = (kind, label) => `<button class="cat-act ${kind}" data-cat-action="${kind}" data-model="${escapeHtml(b.id)}"${b.remote ? ' data-remote="1"' : ''}>${label}</button>`;
      return `<div class="cat-hit" data-model="${escapeHtml(b.id)}">
        <span class="cat-name">${escapeHtml(b.name)}</span>
        <span class="cat-where">${escapeHtml(b.shelf)}${mine ? ' · checked out here' : ''}${b.slices != null ? ` · ${b.slices} ${b.slices === 1 ? 'slice' : 'slices'}` : ''}${b.why ? ` · chapter: ${escapeHtml(b.why)}` : ''}</span>
        <span class="cat-acts">${act('open', b.remote ? 'Download &amp; open' : 'Open')}${library && !mine ? act('checkout', 'Check out') : ''}</span>
      </div>`;
    }).join('');
}

// Open (downloading it first if it's not here); Check out does that and checks it out to this device
async function act(kind, id, remote) {
  try {
    if (remote) await download(id);
    if (kind === 'checkout') {
      try { await checkOut(id); showToast('Checked out here: edit away'); }
      catch (e) { showToast(e.status === 409 ? `Checked out on ${e.body?.holder?.deviceName || 'another device'}: opened to read` : 'Couldn’t check it out: opened to read'); }
    } else if (remote) showToast('Downloaded to this device');
  } catch (e) { showToast('Couldn’t download it: try again'); return; }
  hideAllSheets();
  openModel(id);
  window.EventPad.showStart();
}

// local: this device's books [{ id, name, description, chapters, shelf, slices }]
export async function openCatalog(local) {
  books = local;
  document.getElementById('boardSheetContent').innerHTML = `
    <div class="cat-screen">
      <div class="cat-head">EVENT BOOK · CARD CATALOG</div>
      <label class="cat-prompt"><span aria-hidden="true">&gt;</span><input id="catalogQuery" type="search" autocomplete="off" spellcheck="false" aria-label="Look up a book"></label>
      <div class="cat-hits" id="catalogHits"></div>
    </div>`;
  showSheet('boardSheet');
  const input = document.getElementById('catalogQuery');
  input.addEventListener('input', () => render(input.value));
  document.getElementById('catalogHits').addEventListener('click', e => {
    const t = e.target.closest('[data-cat-action]');
    if (!t || t.disabled) return;
    t.disabled = true;
    act(t.dataset.catAction, t.dataset.model, !!t.dataset.remote).finally(() => { t.disabled = false; });
  });
  render('');
  setTimeout(() => input.focus(), 60);
  // The library's books not on this device: found too, downloaded when picked
  if (account()) {
    try {
      const here = new Set(serverIds());
      const far = (await serverLibrary()).filter(m => !here.has(m.modelId))
        .map(m => ({ id: m.modelId, name: m.name || 'Untitled model', description: '', chapters: [], shelf: 'Not here', remote: true }));
      if (books === local) { books = [...local, ...far]; render(input.value); }
    } catch (e) { /* offline: this device's books only */ }
  }
}
