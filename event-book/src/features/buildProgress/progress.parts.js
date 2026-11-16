// ===========================================
// BUILD PROGRESS - Parts that show a builder's reports, each drawn from one view alone.
// A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The chip on a slice (the board's header, the outline's pills) from Slice Progress: its latest step and when.
// Tapping it lists the history (both screens' handlers listen for their own attribute).
export function sliceProgressChip(view) {
  if (!view) return '';
  return `<button class="bp-chip bp-${view.step}" data-component="Slice progress chip" data-key="${escapeHtml(view.sliceId)}" data-action="progress-history" data-outline-action="progress-history" data-slice="${escapeHtml(view.sliceId)}"
    aria-label="Build progress: ${escapeHtml(view.label)}${view.ago ? `, ${escapeHtml(view.ago)}` : ''}. Tap for the steps"><span aria-hidden="true">${view.icon}</span> ${escapeHtml(view.label)}${view.ago ? ` <span class="bp-ago">· ${escapeHtml(view.ago)}</span>` : ''}</button>`;
}

// The sheet a chip opens, from Slice Progress History: who reported which step, when, with the note and the PR
export function sliceProgressHistorySheet(view) {
  if (!view) return '';
  const rows = view.entries.map(e => `
      <li class="bp-step bp-${e.step}">
        <span class="bp-step-head"><span aria-hidden="true">${e.icon}</span> <b>${escapeHtml(e.label)}</b> <span class="bp-ago">${escapeHtml(e.by || 'a builder')} · ${escapeHtml(e.ago)}</span></span>
        ${e.note ? `<span class="bp-note">${escapeHtml(e.note)}</span>` : ''}
        ${e.pr?.url ? `<a class="bp-pr" href="${escapeHtml(e.pr.url)}" target="_blank" rel="noopener">PR${e.pr.number ? ` #${escapeHtml(e.pr.number)}` : ''} ↗</a>` : ''}
      </li>`).join('');
  return `<div data-component="Slice progress history" data-key="${escapeHtml(view.sliceId)}">
    <div class="sheet-title">${escapeHtml(view.title)}: build steps</div>
    <ol class="bp-steps">${rows}</ol>
  </div>`;
}

// On a plan's spine on the bookshelves, from Plan Build Progress: "4 of 7 green · PR #290"
export function planBuildProgressLine(view) {
  if (!view) return '';
  return `<span class="ed-progress" data-component="Plan build progress" data-key="${escapeHtml(view.bookId)}" title="${escapeHtml(view.text)}" aria-label="Build progress: ${escapeHtml(view.text)}"><span class="ed-progress-short" aria-hidden="true">🔨 ${view.green}/${view.total}</span><span class="ed-progress-full">${escapeHtml(view.text)}</span></span>`;
}
