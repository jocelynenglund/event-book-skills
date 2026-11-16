// ===========================================
// SLICE VERDICT (SV) - a slice's verdict in the edition being verified: ✗ Fails when any scenario fails, ✓ Works
// when every scenario tried works, To try otherwise; with the count of ✗ notes. Drawn in the slice's row header.
// ===========================================

import { getScenariosForSlice } from '../../core/projections.js';
import { testersOf, overallOf } from './verdictRules.js';

export function sliceVerdict(state, edition, sliceId) {
  const per = getScenariosForSlice(sliceId, state).map(s => testersOf(state, edition, s.id));
  const overalls = per.map(overallOf);
  const overall = overalls.includes('fails') ? 'fails' : !overalls.length || overalls.some(v => !v) ? 'untried' : 'works';
  const notes = per.reduce((n, ts) => n + ts.filter(t => t.verdict === 'fails' && t.note).length, 0);
  const text = overall === 'fails' ? `✗ Fails${notes ? ` · ${notes} ${notes === 1 ? 'note' : 'notes'}` : ''}` : overall === 'works' ? '✓ Works' : 'To try';
  return { sliceId, overall, notes, text };
}
