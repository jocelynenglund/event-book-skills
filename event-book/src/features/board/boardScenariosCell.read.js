// ===========================================
// BOARD - Scenarios (SV: Board Scenarios Cell)
// The scenarios cell under a slice's lanes: how many there are and the events they start from
// (closed), or each one with the stickies its steps name.
// ===========================================

import { getScenariosForSlice, givenEventsOf } from '../../core/projections.js';

export function boardScenariosCell(state, col) {
  const slice = col.slice;
  const scenarios = getScenariosForSlice(slice.id, state);
  const elements = {};
  scenarios.forEach(scn => {
    [...(scn.given || []).map(g => g.elementId), scn.when?.commandId, scn.then?.eventId, scn.then?.readModelId]
      .filter(Boolean).forEach(id => { if (state.elements[id]) elements[id] = state.elements[id]; });
  });
  return {
    sliceId: slice.id, count: scenarios.length, inferred: slice.id.startsWith('au_inferred_'),
    givens: givenEventsOf(slice.id, state).map(g => g.element.name),
    scenarios: scenarios.map(scn => ({ id: scn.id, name: scn.name || 'Scenario', mustHave: !!scn.mustHave, scn })),
    elements
  };
}
