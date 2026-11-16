// ===========================================
// SPECS - Built As Planned List: in Compare, the generated slices this build has, each built as planned or
// what drifted.
// ===========================================

import { builtAsPlanned } from './generate.js';

// -> null when the build has none of the plan's generated slices, else { open, summary, rows: [{ slice, result, ok }] }
export function builtAsPlannedList(plan, built) {
  const rows = builtAsPlanned(plan, built);
  if (!rows.length) return null;
  const ok = rows.filter(r => r.result === 'built as planned').length;
  return {
    open: ok < rows.length,
    summary: `🧪 ${ok} of ${rows.length} generated ${rows.length === 1 ? 'slice' : 'slices'} built as planned`,
    rows: rows.map(r => ({ slice: r.slice, result: r.result, ok: r.result === 'built as planned' }))
  };
}
