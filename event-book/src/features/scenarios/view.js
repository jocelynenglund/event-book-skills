// ===========================================
// SCENARIOS - View (SV: View Scenario)
// A scenario's lines come from Scenario Lines (scenarioLines.read.js) and are drawn by its part
// (scenarios.parts.js); this is what the Board, the Outline and the drawers call.
// ===========================================

import { scenarioLines, filled } from './scenarioLines.read.js';
import { scenarioLinesBlock } from './scenarios.parts.js';

// A generated spec still marked pending in the build: not passing yet, or passing (its mark can go)
export const pendingMark = scn => scn?.pending === 'not passing yet'
  ? ' <span class="scn-pending" title="A generated spec: written, not passing yet">⏳ not passing yet</span>'
  : scn?.pending === 'passing' ? ' <span class="scn-pending passing" title="Passing: the builder can take its pending mark off">✓ passing, still marked pending</span>' : '';

export { filled };
export const hasValues = scn => [...(scn.given || []).map(g => g.values), scn.when?.values, scn.then?.values, ...(scn.then?.rows || [])]
  .some(v => v && Object.values(v).some(filled));

// One scenario as Given / And / When / Then lines, with the values it sets (values: false, names only)
export const renderGwt = (scn, book, opts) => scenarioLinesBlock(scenarioLines(book, scn, opts));
