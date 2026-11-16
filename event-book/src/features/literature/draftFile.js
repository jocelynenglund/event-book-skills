// ===========================================
// LITERATURE - Taking a draft in and out of the app
// ☰ → Import… a .md file (or paste one into an empty literature book) → Import Draft.
// ☰ → Export → Markdown → the post in reading order (SV: Draft Markdown).
// ===========================================

import { createModel, deleteModel, openModel, getCurrentModelId } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { nickname } from '../comments/command.js';
import { showToast } from '../../ui/toast.js';
import { showBoard } from '../../ui/feed.js';
import { hideAllSheets } from '../../ui/sheets.js';
import { openBoardSheet } from '../board/sheets/shared.js';
import { escapeHtml } from '../board/view.js';
import { importDraft } from './command.js';
import { draftMarkdown } from './rules.js';

const slug = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const nameOf = file => file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
const imported = () => { const n = Object.keys(projectState().slices).length; showToast(`Imported: ${n} ${n === 1 ? 'paragraph' : 'paragraphs'}`); };

// A .md file becomes a book of its own; refused (and nothing left behind) when it has no text
export async function importDraftFile(file) {
  const markdown = await file.text();
  const before = getCurrentModelId();
  const id = createModel();
  const why = importDraft({ markdown, fallbackTitle: nameOf(file), author: nickname() });
  if (why) { deleteModel(id); openModel(before); showToast(why); return; }
  showBoard();
  imported();
}

// An empty literature book takes a pasted draft
export function openPasteDraft() {
  openBoardSheet(`
    <div class="sheet-title">Paste a draft</div>
    <div class="bd-sheet-label">Title</div>
    <input type="text" class="sheet-input" id="ltTitle" value="${escapeHtml(projectState().modelName || '')}" placeholder="What the piece is called">
    <div class="bd-sheet-label">Text</div>
    <textarea class="sheet-input cm-box" id="ltText" rows="10" placeholder="Paste your Markdown here. A blank line divides paragraphs."></textarea>
    <button class="sheet-btn" data-lit-paste="go">Import</button>`, 'ltText');
}

export function pasteDraft() {
  const why = importDraft({ markdown: document.getElementById('ltText')?.value, title: document.getElementById('ltTitle')?.value, author: nickname() });
  if (why) { showToast(why); return; }
  hideAllSheets();
  showBoard();
  imported();
}

export function exportDraft() {
  const { title, markdown } = draftMarkdown(projectState());
  if (!markdown) { showToast('Nothing to export yet'); return; }
  const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug(title) || 'draft'}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Draft exported');
}

export function initDraftFile() {
  document.addEventListener('click', e => {
    if (e.target.closest('[data-lit-paste]')) pasteDraft();
    else if (e.target.closest('[data-lit-action="paste"]')) openPasteDraft();
  });
}
