// ===========================================
// DETAILS - Move Scenario Choices: where a scenario can be moved to. Every slice, searchable, with its kind
// and chapter beside it. Null for a scenario that is gone.
// ===========================================

import { projectState, getOrderedSlices, sliceTitle } from '../../core/projections.js';

const KIND = { SC: 'Change', SV: 'View', AU: 'Automation' };

// -> { scenarioId, name, rows: [{ scenarioId, sliceId, title, search, kind, chapter }] } | null
export function moveScenarioChoices(scenarioId) {
  const state = projectState();
  const scn = state.scenarios[scenarioId];
  if (!scn) return null;
  return {
    scenarioId, name: scn.name,
    rows: getOrderedSlices(state).map(s => {
      const chapter = s.chapterId && state.chapters[s.chapterId] ? state.chapters[s.chapterId].name : null;
      return { scenarioId, sliceId: s.id, title: sliceTitle(s, state), search: `${sliceTitle(s, state)} ${state.chapters[s.chapterId]?.name || ''}`.toLowerCase(), kind: KIND[s.type] || s.type, chapter };
    })
  };
}
