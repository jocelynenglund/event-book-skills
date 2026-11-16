// ===========================================
// SHARE IMAGE - A scenario as lines (Given / When / Then)
// Keyword, the element it names (coloured swatch) or a note; with values, each line's example values.
// ===========================================

// A scenario's values, as a short line: { orderId: o1, size: footlong } (empty ones left out)
const filledIn = v => v !== '' && v !== null && v !== undefined;
export const valuesText = values => {
  const parts = Object.entries(values || {}).filter(([, v]) => filledIn(v)).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
  return parts.length ? `{ ${parts.join(', ')} }` : '';
};

export function gwtLines(scn, state, showValues = false) {
  const ref = (kw, id, values) => {
    const el = state.elements[id];
    const v = showValues ? valuesText(values) : '';
    return el ? { kw, text: `${el.name}${v ? ` ${v}` : ''}`, type: el.type, external: !!el.external } : { kw, text: '(removed)' };
  };
  const lines = (scn.given || []).map((g, i) => ref(i ? 'And' : 'Given', g.elementId, g.values));
  if (!lines.length) lines.push({ kw: 'Given', text: 'nothing happened yet' });
  if (scn.when?.commandId) lines.push(ref('When', scn.when.commandId, scn.when.values));
  const then = scn.then;
  if (then?.type === 'event') lines.push(ref('Then', then.eventId, then.values));
  else if (then?.type === 'readModel') {
    const line = ref('Then', then.readModelId, then.rows?.length ? null : then.values);
    if (then.rows?.length) line.text += showValues ? ` ${then.rows.map(valuesText).filter(Boolean).join(' ')}` : ` · ${then.rows.length} ${then.rows.length === 1 ? 'row' : 'rows'}`;
    lines.push(line);
  }
  else if (then?.type === 'rejection') lines.push({ kw: 'Then', text: `✕ ${then.reason || 'rejected'}`, reject: true });
  else lines.push({ kw: 'Then', text: 'not set' });
  return lines;
}
