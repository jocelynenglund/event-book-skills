// ===========================================
// SCENARIO VERDICT (SV) - what a scenario's verdict row says on the left: the overall verdict, the tester it
// leads with (the first ✗, else the newest ✓) and how many others, the ✗ notes, and the edition it was
// carried over from. Drawn by the verdict summary.
// ===========================================

import { testersOf, overallOf } from './verdictRules.js';

export function scenarioVerdict(state, edition, scenarioId) {
  const testers = testersOf(state, edition, scenarioId);
  const lead = testers[0] || null;
  return {
    scenarioId, sliceId: state.scenarios?.[scenarioId]?.sliceId || null,
    overall: overallOf(testers) || 'untried',
    lead: lead?.nickname || null,
    more: Math.max(0, testers.length - 1),
    notes: testers.filter(t => t.verdict === 'fails' && t.note).map(t => ({ by: t.nickname, note: t.note })),
    fromEdition: lead?.fromEdition ?? null
  };
}
