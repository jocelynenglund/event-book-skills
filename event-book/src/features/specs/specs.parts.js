// ===========================================
// SPECS - Parts drawn from the spec views alone: the trail on a slice's page (Spec Trail) and, in Compare,
// the generated slices built as planned (Built As Planned List). A root carries data-component and data-key.
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// The steps of a refined slice's trail with where it stands ('' for none)
export function specTrailHtml(t) {
  if (!t) return '';
  return `<p class="sp-specs" data-component="Spec trail" data-key="${escapeHtml(t.status)}" aria-label="Spec status: ${escapeHtml(t.status)}">${t.steps.map(s =>
    `<span class="sp-spec-step${s.at ? ' ' + s.at : ''}">${escapeHtml(s.name)}</span>`).join('<span class="sp-spec-arrow" aria-hidden="true">→</span>')}</p>`;
}

// Compare: the generated slices this build has, built as planned or what drifted ('' for none)
export function builtAsPlannedSection(list) {
  if (!list) return '';
  return `<details class="cp-planned" data-component="Built as planned" data-key="planned"${list.open ? ' open' : ''}><summary>${escapeHtml(list.summary)}</summary>
    ${list.rows.map(r => `<p class="cp-planned-row ${r.ok ? 'ok' : 'drift'}"><b>${escapeHtml(r.slice)}</b> ${escapeHtml(r.result)}</p>`).join('')}</details>`;
}
