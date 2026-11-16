// ===========================================
// LIBRARY - The card catalog's parts: Catalog hits, drawn from the Books found view alone.
// Nothing here reads the books or the sync. A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LABELS = { open: 'Open', 'download-open': 'Download &amp; open', checkout: 'Check out' };

// v: a Books found view. The hint, or each hit with the buttons it can take.
export function catalogHits(v) {
  const act = (h, a) => {
    const kind = a === 'download-open' ? 'open' : a;
    return `<button class="cat-act ${kind}" data-cat-action="${kind}" data-model="${escapeHtml(h.id)}"${h.remote ? ' data-remote="1"' : ''}>${LABELS[a]}</button>`;
  };
  return `<div data-component="Catalog hits" data-key="hits">${v.hint ? `<p class="cat-hint">${escapeHtml(v.hint)}</p>`
    : v.hits.map(h => `<div class="cat-hit" data-model="${escapeHtml(h.id)}">
        <span class="cat-name">${escapeHtml(h.name)}</span>
        <span class="cat-where">${escapeHtml(h.where)}</span>
        <span class="cat-acts">${h.actions.map(a => act(h, a)).join('')}</span>
      </div>`).join('')}</div>`;
}

// v: a Catalog prompt view. The green screen's header and the box the name is typed in.
export const catalogPromptBox = v => `<div data-component="Catalog prompt" data-key="prompt">
      <div class="cat-head">${escapeHtml(v.title)}</div>
      <label class="cat-prompt"><span aria-hidden="true">&gt;</span><input id="catalogQuery" type="search" autocomplete="off" spellcheck="false" aria-label="${escapeHtml(v.inputLabel)}"></label>
    </div>`;
