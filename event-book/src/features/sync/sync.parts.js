// ===========================================
// SYNC - Parts of the bookshelves' library line, drawn from Library Sign In alone.
// A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The line under "Bookshelves": the account (and a note when only the server's books show), or the sign-in
export function libraryAccountBar(v) {
  return `<div class="sy-bar" id="syBar" data-component="Library account bar" data-key="${v.action}"><button class="sy-account" data-sync-action="${v.action}">${escapeHtml(v.label)}</button>${v.signedIn ? '<span class="sy-note" id="syServerOnly"></span>' : ''}</div>`;
}
