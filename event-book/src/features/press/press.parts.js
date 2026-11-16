// ===========================================
// PRESS - Parts of a book's details about its press, drawn from Press Status Section alone.
// A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Where the plan is at the press, and what came back with the build, with Compare ('' for a book never sent)
export function pressStatus(v) {
  if (!v) return '';
  const s = v.summary;
  return `<div class="ps-press" data-component="Press status" data-key="${escapeHtml(v.id)}" data-press-stage="${v.stage}">
    <p class="ps-status">🖨 ${escapeHtml(v.status)}</p>
    ${!s ? '' : `<dl class="ed-facts ps-summary">
      <dt>Build</dt><dd>${escapeHtml(s.build)}</dd>
      <dt>Done</dt><dd class="ps-done">${escapeHtml(s.done)}</dd>
      <dt>Still to build</dt><dd class="ps-todo">${escapeHtml(s.todo)}</dd>
      <dt>Not planned</dt><dd class="ps-extra">${escapeHtml(s.extra)}</dd>
      ${s.scenarios ? `<dt>Scenarios</dt><dd>${escapeHtml(s.scenarios)}</dd>` : ''}
    </dl>
    <button class="ed-btn" data-library-action="compare-book" data-model="${escapeHtml(v.id)}">Compare with the build…</button>`}
  </div>`;
}
