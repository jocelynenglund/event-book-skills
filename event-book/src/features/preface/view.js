// ===========================================
// PREFACE - The page: title, why the book is being written, its tags, Start reading
// ===========================================

import { projectState } from '../../core/projections.js';
import { getCurrentModelId } from '../../core/eventStore.js';
import { escapeHtml } from '../board/view.js';
import { prefaceOf, prefaceSeen, markPrefaceSeen } from './rules.js';

export function renderPreface() {
  const root = document.getElementById('prefaceView');
  if (!root) return;
  const id = getCurrentModelId();
  const p = prefaceOf(projectState(), prefaceSeen(id));
  // Shown once is seen: from now on the book opens straight to the board
  markPrefaceSeen(id);
  root.innerHTML = `
    <article class="pf-page">
      <div class="pf-kicker">Preface</div>
      <h2 class="pf-title">${escapeHtml(p.title)}</h2>
      <div class="pf-rule" aria-hidden="true"></div>
      <p class="pf-text">${escapeHtml(p.preface)}</p>
      ${p.tags.length ? `<div class="pf-tags">${p.tags.map(t => `<span class="pf-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <button class="pf-start" data-preface-action="start">Start reading</button>
    </article>`;
}

export function initPreface({ startReading }) {
  document.getElementById('prefaceView')?.addEventListener('click', e => {
    if (e.target.closest('[data-preface-action=start]')) startReading();
  });
}
