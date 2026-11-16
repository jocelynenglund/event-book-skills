// ===========================================
// SCENARIOS - Parts: a scenario's lines, drawn from Scenario Lines alone
// ===========================================

const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// { k: v, … } after a sticky's name (nothing when no value was filled in)
const valuesHtml = entries => entries.length
  ? ` <span class="gwt-values">{ ${entries.map(e => `${escapeHtml(e.key)}: ${e.alias ? `<span class="gwt-id">${escapeHtml(e.text)}</span>` : escapeHtml(e.text)}`).join(', ')} }</span>`
  : '';

const refHtml = r => r
  ? `<span class="gwt-ref" data-type="${r.type}"${r.attrs}>${escapeHtml(r.name)}</span>${valuesHtml(r.values)}`
  : '<span class="gwt-missing">(removed)</span>';

function bodyHtml(b) {
  if (b.none) return `<span class="gwt-none">${b.none}</span>`;
  if (b.rejected !== undefined) return `<span class="gwt-reject">Rejected: ${escapeHtml(b.rejected)}</span>`;
  if (b.rows) return `${refHtml(b.ref)}<span class="gwt-rows">${b.rows.map(r => `<span class="gwt-row">${valuesHtml(r)}</span>`).join('')}</span>`;
  if (b.rowCount) return `${refHtml(b.ref)} <span class="gwt-values">(${b.rowCount} ${b.rowCount === 1 ? 'row' : 'rows'})</span>`;
  return refHtml(b.ref);
}

// One scenario as Given / And / When / Then lines
export function scenarioLinesBlock(view) {
  return `<div class="gwt" data-component="Scenario lines" data-key="${escapeHtml(view.id)}">${view.lines.map(l =>
    `<div class="gwt-line"><span class="gwt-kw">${l.kw}</span><span class="gwt-body">${bodyHtml(l.body)}</span></div>`).join('')}</div>`;
}
