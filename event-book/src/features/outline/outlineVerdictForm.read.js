// ===========================================
// OUTLINE VERDICT FORM (SV) - what the "✗ Doesn't work" sheet asks about: the scenario it is for (its name is empty when
// the book has no such scenario any more)
// ===========================================

export function outlineVerdictForm(state, sliceId, scenarioId) {
  const scn = state.scenarios[scenarioId];
  return { sliceId, scenarioId, name: scn?.name || '' };
}
