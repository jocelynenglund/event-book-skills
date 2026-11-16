// ===========================================
// BOARD SHEETS - Parts of a slice's events drawer, drawn from Slice Events Drawer alone
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// One event: tap to go to its command (or read it), ✎ to edit it
export function eventDrawerRow(row) {
  return `
      <div class="bd-event-row" data-component="Event drawer row" data-key="${row.id}">
        <button class="bd-card" data-type="event"${row.attrs} data-board-action="${row.go.action}" data-el="${row.go.el}" data-slice="${row.go.slice}">
          <span class="bd-card-kind">${escapeHtml(row.kind)}</span>
          <span class="bd-card-name">${escapeHtml(row.name)}</span>
          ${row.props.length ? `<div class="bd-props">${row.props.map(p => `<span>${escapeHtml(p)}</span>`).join('')}</div>` : ''}
        </button>
        ${row.editable ? `<button class="bd-event-edit" data-board-action="event-edit" data-el="${row.id}" data-slice="${row.sliceId}" aria-label="Edit ${escapeHtml(row.name)}">✎</button>` : ''}
      </div>`;
}

// + Event (or + An event it reads)
export function addEventButton(drawer) {
  return `<button class="sheet-btn secondary" data-component="Add event button" data-key="${drawer.sliceId}" data-board-action="event-add" data-slice="${drawer.sliceId}">+ ${escapeHtml(drawer.addLabel)}</button>`;
}

// The whole sheet
export function eventsDrawerBody(drawer) {
  return `
    <div class="sheet-title">${drawer.heading} <span class="bd-sheet-sub">${escapeHtml(drawer.sub)}</span></div>
    <div class="bd-events">${drawer.groups.map(g => (g.title ? `<div class="bd-sheet-label">${g.title}</div>` : '') + g.rows.map(eventDrawerRow).join('')).join('')}
    </div>
    ${drawer.readOnly ? '' : addEventButton(drawer)}`;
}
