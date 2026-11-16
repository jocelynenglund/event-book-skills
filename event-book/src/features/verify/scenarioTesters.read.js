// ===========================================
// SCENARIO TESTERS (SV) - the list a tap on a scenario's verdict opens: who tried it, with verdict, time
// and note, fails first. Drawn by the testers sheet.
// ===========================================

import { testersOf, overallOf } from './verdictRules.js';

export function scenarioTesters(state, edition, scenarioId) {
  const testers = testersOf(state, edition, scenarioId);
  return { scenarioId, sliceId: state.scenarios?.[scenarioId]?.sliceId || null, name: state.scenarios?.[scenarioId]?.name || '', overall: overallOf(testers) || 'untried', testers };
}
