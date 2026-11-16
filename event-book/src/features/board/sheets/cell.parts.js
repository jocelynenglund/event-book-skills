// ===========================================
// BOARD SHEETS - Parts of the fill-a-cell sheet, drawn from Cell Reuse Choices alone
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Screen or automation drives the top lane (the one the cell is for is on)
export function cellActorSwitch(choices) {
  return `
    <div class="segmented bd-actor-switch" data-component="Cell actor switch" data-key="${choices.elementType}">
      <button class="${choices.elementType === 'screen' ? 'active' : ''}" data-board-action="switch-actor" data-type="screen">Screen</button>
      <button class="${choices.elementType === 'processor' ? 'active' : ''}" data-board-action="switch-actor" data-type="processor">⚙️ Automation</button>
    </div>`;
}

// One box both searches the existing ones and names a new one
export function cellNameForm(choices) {
  return `
    <div class="bd-inline-form" data-component="Cell name form" data-key="${choices.elementType}">
      <input type="text" class="sheet-input" id="bdCellName" placeholder="${escapeHtml(choices.placeholder)}" autocomplete="off">
      <button class="sheet-btn" id="bdCellGo" data-board-action="create-in-cell">Add</button>
    </div>
    <div class="bd-cell-hint" id="bdCellHint">${escapeHtml(choices.hint)}</div>`;
}

// One existing sticky to reuse
export function cellReuseChip(chip) {
  return `<button class="bd-chip" data-component="Cell reuse chip" data-type="${chip.type}"${chip.attrs} data-board-action="reuse" data-el="${chip.id}" data-key="${escapeHtml(chip.key)}" data-name="${escapeHtml(chip.name)}" ${chip.hidden ? 'hidden' : ''}>
          ${escapeHtml(chip.name)}${chip.usedIn ? `<span class="bd-chip-used">in ${chip.usedIn} ${chip.usedIn === 1 ? 'slice' : 'slices'}</span>` : ''}
        </button>`;
}

// The whole sheet
export function cellSheetBody(choices) {
  return `
    <div class="sheet-title">${choices.label} <span class="bd-sheet-sub">in ${escapeHtml(choices.sliceName)}</span></div>
    ${choices.actorSwitch ? cellActorSwitch(choices) : ''}
    ${cellNameForm(choices)}
    ${choices.hasChips ? `
    <div class="bd-chips" id="bdCellChips">
      ${choices.chips.map(cellReuseChip).join('\n      ')}
    </div>
    <div class="bd-cell-more" id="bdCellMore">${choices.more}</div>` : ''}
  `;
}
