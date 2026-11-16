// ===========================================
// DETAILS - Parts of the Details screen, each drawn from its piece of Details Page (or Move Scenario Choices)
// alone. A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// A filter above the list (a chip of Details Page): tap to show only that kind, tap again for All
export function detailsFilter(chip) {
  return `<button class="dt-filter ${chip.active ? 'active' : ''}" data-component="Details filter" data-key="${chip.type}" data-details-action="filter" data-filter="${chip.type}">${escapeHtml(chip.title)} <span>${chip.count}</span></button>`;
}

function links(list) {
  return list.length ? `<div class="dt-links">${list.map(l =>
    `<span class="dt-link"><span class="dt-link-rel">${escapeHtml(l.label)}</span> <button class="dt-link-el" data-details-action="show-el" data-el="${l.id}" data-type="${l.type}"${l.attrs}>${escapeHtml(l.name)}</button></span>`).join('')}</div>` : '';
}

// One element: its name, the slices it's in, its properties (tap to edit), Add properties and what it links to
export function detailsCard(card) {
  const props = card.props.length
    ? `<div class="dt-props">
        ${card.props.map(p => `
          <button class="dt-prop" data-details-action="edit-prop" data-el="${card.id}" data-prop="${p.id}">
            <span class="dt-prop-name">${escapeHtml(p.label)}</span>
            <span class="dt-prop-type">${escapeHtml(p.type)}</span>
          </button>`).join('')}
      </div>`
    : `<div class="dt-empty">No properties yet</div>`;
  return `
    <article class="dt-card" data-component="Details card" data-key="${card.id}" data-type="${card.type}"${card.attrs}>
      <button class="dt-card-head" data-details-action="element" data-el="${card.id}">
        <span class="dt-kind">${escapeHtml(card.label)}</span>
        <span class="dt-name">${escapeHtml(card.name)}</span>
      </button>
      ${card.slices.length ? `<div class="dt-slices">${card.slices.map(t => `<span class="dt-slice">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      ${props}
      <button class="dt-add" data-details-action="add-props" data-el="${card.id}">+ Add properties</button>
      ${links(card.links)}
    </article>`;
}

// A scenario whose slice was deleted, with Move to slice…
export function detailsOrphan(scn) {
  return `
          <div class="dt-card dt-scenario" data-component="Details orphan scenario" data-key="${scn.id}">
            <span class="dt-name">${escapeHtml(scn.name)}</span>
            ${scn.gwt}
            <button class="dt-move" data-details-action="move-scenario" data-scenario="${scn.id}">Move to slice…</button>
          </div>`;
}

// A scenario under its slice: tap to edit it
export function detailsScenario(scn) {
  return `
            <button class="dt-card dt-scenario" data-component="Details scenario" data-key="${scn.id}" data-details-action="scenario" data-scenario="${scn.id}">
              <span class="dt-name">${escapeHtml(scn.name)}</span>
              ${scn.gwt}
            </button>`;
}

// A slice a scenario can be moved to (a row of Move Scenario Choices)
export function detailsMoveOption(row) {
  return `
    <button class="share-scope-option dt-move-option" data-component="Details move option" data-key="${row.sliceId}" data-details-action="move-to" data-scenario="${row.scenarioId}" data-slice="${row.sliceId}"
      data-search="${escapeHtml(row.search)}">
      <b>${escapeHtml(row.title)}</b>
      <span class="dt-move-meta">${escapeHtml(row.kind)}${row.chapter ? ` · ${escapeHtml(row.chapter)}` : ''}</span>
    </button>`;
}
