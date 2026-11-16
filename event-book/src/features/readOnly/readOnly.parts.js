// ===========================================
// READ-ONLY - Parts of the read sheet, each drawn from its piece of Element Read Sheet or Read Only Footer alone.
// A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A sticky, to read (inside the sheet's grid): its kind, name, description, fields (with Fold on the board), flags and slices
export function elementRead(v) {
  return `
    <div style="display: contents" data-component="Element read" data-key="${escapeHtml(v.id)}">
      <div class="ro-kind">${escapeHtml(v.kind)}</div>
      <div class="ro-name rb-sticky" data-type="${v.type}"${v.attrs}>${escapeHtml(v.name)}</div>
      ${v.description ? `<p class="ro-desc">${escapeHtml(v.description)}</p>` : ''}
      <div class="bd-sheet-label ro-fields-head">Fields${v.foldLabel ? `<button class="cm-btn quiet" data-fold-fields="${escapeHtml(v.id)}">${v.foldLabel}</button>` : ''}</div>
      ${v.fields.length ? `<ul class="ro-fields">${v.fields.map(p => `
        <li><span class="ro-field-name">${p.generated ? '<span title="Generated">⚙</span> ' : ''}${escapeHtml(p.label)}</span><span class="ro-field-type">${escapeHtml(p.type)}</span></li>`).join('')}
      </ul>` : '<p class="sy-p">No fields</p>'}
      ${v.flags.length ? `<div class="ro-flags">${v.flags.map(f => `<span>${escapeHtml(f)}</span>`).join('')}</div>` : ''}
      <div class="bd-sheet-label">${v.slicesHeading}</div>
      ${v.slices.length ? `<ul class="ro-slices">${v.slices.map(t => `<li>${escapeHtml(t)}</li>`).join('')}</ul>` : '<p class="sy-p">Not in a slice</p>'}
    </div>`;
}

// One "Share as picture…" entry (the only thing a read-only ⋮ offers): data-chapter or data-slice says what to share
const shareEntry = (share, what) => `
      <div class="sheet-option" data-board-action="share-picture" ${what}>
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↗</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">${escapeHtml(share.title)}</div>
          <div class="sheet-option-desc">${escapeHtml(share.desc)}</div>
        </div>
      </div>`;

// The menu of a chapter's ⋮ in a book that can't be changed here: only sharing
export function readOnlyChapterMenuBox(v) {
  return `
    <div data-component="Read only chapter menu" data-key="${escapeHtml(v.chapterId)}">
      <div class="sheet-title">Chapter</div>
      <div class="sheet-options">${shareEntry(v.share, `data-chapter="${escapeHtml(v.chapterId)}"`)}
      </div>
    </div>`;
}

// The menu of a slice's ⋮ in a book that can't be changed here: only sharing
export function readOnlySliceMenuBox(v) {
  return `
    <div data-component="Read only slice menu" data-key="${escapeHtml(v.sliceId)}">
      <div class="sheet-title">${escapeHtml(v.typeLabel)}</div>
      <div class="sheet-options">${shareEntry(v.share, `data-slice="${escapeHtml(v.sliceId)}"`)}
      </div>
    </div>`;
}

// The foot of the read sheet: what is the matter, and the button that fixes it (or Edit when it can be changed)
export function readOnlyFooterBar(f) {
  const data = Object.entries(f.data).map(([k, val]) => `data-${k}="${escapeHtml(val)}"`).join(' ');
  return `
    <div class="ro-foot" data-component="Read only footer" data-key="${escapeHtml(f.value)}">
      <span>${escapeHtml(f.note)}</span>
      <button class="ro-checkout" ${f.attr}="${escapeHtml(f.value)}" ${data}>${escapeHtml(f.button)}</button>
    </div>`;
}
