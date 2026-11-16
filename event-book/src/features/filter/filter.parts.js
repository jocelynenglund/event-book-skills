// ===========================================
// STAGE FILTER - components, each drawn from its view alone (Stage Filter Counts).
// ===========================================

// Stage chips: show only the slices at one stage; tapping the one that's on goes back to All
export function stageChips(view) {
  if (!view?.chips?.length) return '';
  return `<span class="st-filter" data-component="Stage chips" data-key="stages" role="group" aria-label="Show slices">${view.chips.map(c => `
    <button class="st-chip ${c.on ? 'on' : ''}" data-status-filter="${c.key}" aria-pressed="${c.on}">${c.label}${c.count == null ? '' : ` <span class="st-n">${c.count}</span>`}</button>`).join('')}</span>`;
}
