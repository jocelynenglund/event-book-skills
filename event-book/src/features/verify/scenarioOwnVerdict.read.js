// ===========================================
// SCENARIO OWN VERDICT (SV) - what this device's nickname said about a scenario (its newest, counting a
// carried one): the round ✓ ✗ buttons light only that. Drawn by the verdict buttons.
// ===========================================

import { testersOf } from './verdictRules.js';

export function scenarioOwnVerdict(state, edition, sliceId, scenarioId, nickname) {
  const mine = nickname ? testersOf(state, edition, scenarioId).find(t => t.nickname === nickname) : null;
  return { sliceId, scenarioId, own: mine?.verdict || null };
}
