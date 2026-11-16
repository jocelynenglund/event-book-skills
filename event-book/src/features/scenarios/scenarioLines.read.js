// ===========================================
// SCENARIOS - Scenario Lines (SV): a scenario as its Given / And / When / Then lines
// Each line says what its body shows: a sticky (name, kind, the values it was given) or a plain phrase.
// Ids in values come as aliases (#1, #2: the same alias for the same value within a scenario) or not at
// all, as the reader chose (ids.js). The Board, the Outline and the drawers draw from it.
// ===========================================

import { externalAttr } from '../../core/constants.js';
import { idsHidden, aliaser, shownEntries } from './ids.js';

// Only values that were filled in: an empty one says nothing
export const filled = v => v !== '' && v !== null && v !== undefined
  && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

// values: false, names only
export function scenarioLines(book, scn, { values = true } = {}) {
  const alias = aliaser(), hide = idsHidden();
  // The values to show: [{ key, text, alias }] ("string" quoted, the rest as JSON, an id as its alias)
  const valuesOf = (vals, el = null) => shownEntries(Object.entries(vals || {}).filter(([, v]) => filled(v)), el, alias, hide)
    .map(([key, v, isAlias]) => ({ key, text: isAlias ? v : typeof v === 'string' ? `"${v}"` : JSON.stringify(v), alias: isAlias }));
  // A sticky (null: it was removed) with the values it carries
  const ref = (id, vals) => {
    const el = book.elements[id];
    return el ? { name: el.name, type: el.type, attrs: externalAttr(el), values: values ? valuesOf(vals, el) : [] } : null;
  };

  const lines = [];
  (scn.given || []).forEach((g, i) => lines.push({ kw: i === 0 ? 'Given' : 'And', body: { ref: ref(g.elementId, g.values) } }));
  if (!scn.given?.length) lines.push({ kw: 'Given', body: { none: 'nothing happened yet' } });
  if (scn.when?.commandId) lines.push({ kw: 'When', body: { ref: ref(scn.when.commandId, scn.when.values) } });

  const then = scn.then;
  let body = { none: 'not set' };
  if (then?.type === 'event') body = { ref: ref(then.eventId, then.values) };
  else if (then?.type === 'readModel' && then.rows?.length && !values) body = { ref: ref(then.readModelId), rowCount: then.rows.length };
  else if (then?.type === 'readModel' && then.rows?.length) {
    const rm = ref(then.readModelId);
    body = { ref: rm, rows: then.rows.map(r => valuesOf(r, book.elements[then.readModelId])) };
  }
  else if (then?.type === 'readModel') body = { ref: ref(then.readModelId, then.values) };
  else if (then?.type === 'rejection') body = { rejected: then.reason || '' };
  lines.push({ kw: 'Then', body });
  return { id: scn.id || '', lines };
}
