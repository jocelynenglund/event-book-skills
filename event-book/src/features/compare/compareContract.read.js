// ===========================================
// COMPARE - Compare Contract (SV): the integration events (published to other systems) whose fields changed or that
// are gone going from the left book to the right one, one line each ("Order Placed: lost size"); null when none.
// ===========================================

import { projectState } from '../../core/projections.js';
import { contractChanges } from './diff.js';

export function compareContract({ planEvents, builtEvents }) {
  const lines = contractChanges(projectState(planEvents), projectState(builtEvents));
  return lines.length ? { title: '\u26a0 contract changed', lines } : null;
}
