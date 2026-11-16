// ===========================================
// LIBRARY - The card catalog terminal: an old computer in the bookshelves header. Tap it
// in the bookshelves header (or press / on the shelves) and a green-screen catalog asks what you're looking for; books
// come up as you type, each with what it can do: Open (a book here), Download & open (one
// only in the library), and Check out for a library book, which does all of that first.
// ===========================================

import { booksFound } from './booksFound.read.js';
import { catalogPrompt } from './catalogPrompt.read.js';
import { catalogHits, catalogPromptBox } from './catalog.parts.js';
import { account, serverLibrary, serverIds, isKept, holderOf, download, checkOut } from '../sync/client.js';
import { openModel } from '../../core/eventStore.js';
import { showSheet, hideAllSheets } from '../../ui/sheets.js';
import { showToast } from '../../ui/toast.js';

let books = [];

function render(query) {
  const box = document.getElementById('catalogHits');
  if (!box) return;
  const library = Object.fromEntries(books.map(b => [b.id, { kept: isKept(b.id), mine: !!holderOf(b.id)?.you }]));
  box.innerHTML = catalogHits(booksFound(books, query, library, new Date()));
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
      ${catalogPromptBox(catalogPrompt())}
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
        .map(m => ({ id: m.modelId, name: m.name || 'Untitled model', description: '', chapters: [], shelf: 'Not here', remote: true, updatedAt: m.updatedAt || null }));
      if (books === local) { books = [...local, ...far]; render(input.value); }
    } catch (e) { /* offline: this device's books only */ }
  }
}
