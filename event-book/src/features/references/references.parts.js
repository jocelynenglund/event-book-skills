// ===========================================
// REFERENCES - Parts of the reference sheets, each drawn from its piece of Reference Shelf, Reference Book or
// Reference Menu alone. A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A saved chapter to add to the open model (a row of Reference Shelf): tap to add it
export function referenceChoice(r) {
  return `
        <div class="sheet-option" data-component="Reference choice" data-key="${escapeHtml(r.id)}" data-ref-action="insert" data-ref="${escapeHtml(r.id)}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">📗</div>
          <div class="sheet-option-text">
            <div class="sheet-option-title">${escapeHtml(r.name)}</div>
            <div class="sheet-option-desc">${escapeHtml(r.summary)}</div>
          </div>
        </div>`;
}

// Add a reference to the open book, or to one picked (add: Reference Add Target with the reference's id)
export function referenceAddButton(add) {
  return `<button class="sheet-btn" data-component="Reference add button" data-key="${escapeHtml(add.id)}" data-ref-action="${add.action}" data-ref="${escapeHtml(add.id)}">${escapeHtml(add.label)}</button>`;
}

// The same, as an option in the reference's menu
export function referenceAddOption(add) {
  return `<div class="sheet-option" data-component="Reference add option" data-key="${escapeHtml(add.id)}" data-ref-action="${add.action}" data-ref="${escapeHtml(add.id)}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">＋</div>
        <div class="sheet-option-text"><div class="sheet-option-title">${escapeHtml(add.label)}</div></div>
      </div>`;
}

// A slice of a reference book: its stickies with their fields, and its scenarios folded to their names
export function referenceSlice(slice) {
  const stickies = slice.stickies.map(el => `
      <div class="rb-sticky" data-type="${el.type}"${el.attrs}>
        <span class="rb-kind">${escapeHtml(el.kind)}</span> <b>${escapeHtml(el.name)}</b>
        ${el.fields.length ? `<span class="rb-fields">${el.fields.map(escapeHtml).join(' · ')}</span>` : ''}
      </div>`).join('');
  const scenarios = slice.scenarios.map(scn => `
      <details class="bd-scn"><summary>${scn.mustHave ? '<span class="must-star">★</span> ' : ''}${escapeHtml(scn.name)}</summary>
        <div class="bd-scn-body">${scn.gwt}</div></details>`).join('');
  return `
      <section class="rb-slice" data-component="Reference slice" data-key="${escapeHtml(slice.title)}">
        <div class="rb-slice-type" data-slice-type="${slice.type}">${escapeHtml(slice.typeLabel)}</div>
        <div class="rb-slice-name">${escapeHtml(slice.title)}</div>
        ${slice.description ? `<p class="rb-desc">${escapeHtml(slice.description)}</p>` : ''}
        <div class="rb-stickies">${stickies}</div>
        ${scenarios ? `<div class="bd-scns">${scenarios}</div>` : ''}
      </section>`;
}

// Opens the reference's menu to rename or delete it
export const referenceMenuButton = id => `<button class="sheet-btn secondary" data-component="Reference menu button" data-key="${escapeHtml(id)}" data-ref-action="menu" data-ref="${escapeHtml(id)}">Rename or delete…</button>`;

// A book the reference can be added to (a choice of Reference Book Choices)
export function referenceBookChoice(b) {
  return `
      <div class="sheet-option" data-component="Reference book choice" data-key="${escapeHtml(b.id)}" data-ref-action="insert-into" data-ref="${escapeHtml(b.refId)}" data-model="${escapeHtml(b.id)}">
        <div class="sheet-option-text"><div class="sheet-option-title">${escapeHtml(b.name)}</div></div>
      </div>`;
}

// Rename the reference
export function referenceRenameForm(menu) {
  return `
    <div class="bd-inline-form" data-component="Reference rename form" data-key="${escapeHtml(menu.id)}">
      <input type="text" class="sheet-input" id="refName" value="${escapeHtml(menu.name)}" aria-label="Name">
      <button class="sheet-btn" data-ref-action="rename">Save</button>
    </div>`;
}

// Delete the reference (tap twice)
export function referenceDeleteOption() {
  return `<div class="sheet-option" data-component="Reference delete option" data-key="delete" data-ref-action="delete" style="border-top: 1px solid var(--border); margin-top: 8px; padding-top: 8px;">
        <div class="sheet-option-icon" style="background: #c0392b;">🗑️</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title" style="color: #e74c3c;">Delete reference</div>
          <div class="sheet-option-desc">Models it was added to keep their copy</div>
        </div>
      </div>`;
}
