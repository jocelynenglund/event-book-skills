// ===========================================
// BOARD SHEETS - Parts of the sheets, drawn from their view's objects alone
// Each takes one row of a sheet's view (see read.js) and reads nothing else. A root carries
// data-component and data-key, so the screen pass counts its controls as owned.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One scenario in a slice's menu: tap to edit it
export function sliceMenuScenario(sc) {
  return `
        <div class="sheet-option" data-component="Slice menu scenario" data-key="${sc.id}" data-board-action="edit-scenario" data-scenario="${sc.id}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">✓</div>
          <div class="sheet-option-text"><div class="sheet-option-title">${escapeHtml(sc.name)}</div></div>
        </div>`;
}

// One chapter a slice can go to (chapterId null: no chapter), the current one ticked
export function chapterOption(opt, sliceId) {
  return `
        <div class="sheet-option ${opt.current ? 'selected' : ''}" data-component="Chapter option" data-key="${opt.chapterId || 'none'}" data-board-action="set-chapter" data-slice="${sliceId}" data-chapter="${opt.chapterId || ''}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">${opt.current ? '✓' : ''}</div>
          <div class="sheet-option-text"><div class="sheet-option-title">${escapeHtml(opt.name)}</div></div>
        </div>`;
}

// One flow a slice can be on (flowId null: the chapter's main line), the current one ticked
export function flowOption(opt, sliceId) {
  return `
        <div class="sheet-option ${opt.current ? 'selected' : ''}" data-component="Flow option" data-key="${opt.flowId || 'main'}" data-board-action="set-flow" data-slice="${sliceId}" data-flow="${opt.flowId || ''}">
          <div class="sheet-option-icon" style="background: var(--surface-hover);">${opt.current ? '✓' : opt.flowId ? '↳' : '—'}</div>
          <div class="sheet-option-text">
            <div class="sheet-option-title">${escapeHtml(opt.name)}</div>
            <div class="sheet-option-desc">${opt.flowId ? 'Only when this flow is shown' : 'In every flow of the chapter'}</div>
          </div>
        </div>`;
}

// "Share as picture…" in a chapter's menu (editing): shares that chapter
export function chapterShareOption(v) {
  return `
      <div class="sheet-option" data-component="Chapter share option" data-key="${escapeHtml(v.chapterId)}" data-board-action="share-picture" data-chapter="${escapeHtml(v.chapterId)}">
        <div class="sheet-option-icon" style="background: var(--surface-hover);">↗</div>
        <div class="sheet-option-text">
          <div class="sheet-option-title">Share as picture…</div>
          <div class="sheet-option-desc">A picture of ${escapeHtml(v.name)}, with its slices</div>
        </div>
      </div>`;
}

// One slice in the reorder list, with its up and down
export function reorderRow(row) {
  return `
        <div class="bd-reorder-row" data-component="Reorder row" data-key="${row.sliceId}">
          <span class="bd-reorder-dot" data-slice-type="${row.type}"></span>
          <span class="bd-reorder-name">${escapeHtml(row.title)}</span>
          <button aria-label="Move up" data-board-action="reorder-move" data-slice="${row.sliceId}" data-to="${row.up || ''}" ${row.up ? '' : 'disabled'}>↑</button>
          <button aria-label="Move down" data-board-action="reorder-move" data-slice="${row.sliceId}" data-to="${row.down || ''}" ${row.down ? '' : 'disabled'}>↓</button>
        </div>`;
}

// One chapter chip of the new-slice sheet
export function newSliceChapterChip(chip) {
  return `
    <button class="bd-chapter-chip ${chip.active ? 'active' : ''}" data-component="New slice chapter chip" data-key="${chip.chapterId || 'none'}" data-board-action="pick-new-chapter" data-chapter="${chip.chapterId || ''}">${escapeHtml(chip.label)}</button>`;
}

// One sticky as a chip to pick: an event or read model (its key is what the search matches)
// pick: the kind of pick it is, when a sheet has two lists of them
export function pickChip(chip, action, pick = null) {
  return `
        <button class="bd-chip ${chip.linked ? 'linked' : ''}" data-component="Pick chip" data-type="${chip.type}"${chip.attrs} data-board-action="${action}"${pick ? ` data-pick="${pick}"` : ''} data-el="${chip.id}" data-key="${escapeHtml(chip.key)}" data-name="${escapeHtml(chip.name)}">${chip.linked ? '✓ ' : ''}${chip.todo ? '☑ ' : ''}${escapeHtml(chip.name)}</button>`;
}
