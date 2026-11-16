// ===========================================
// SPECS - Spec Trail: where a refined slice stands on its way from plan to built (planned → specs written →
// passing → built). "Passing" needs the app's build book on this device ("<app> · built").
// ===========================================

import { listModels, readModelEvents } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { buildBookName } from '../buildVersions/rules.js';
import { appOfPlan } from '../buildVersions/follow.js';
import { specStatus } from './generate.js';

const STEPS = ['planned', 'specs written', 'passing', 'built'];

// The plan's app's build book, when it's on this device
export function localBuildBook(state) {
  const name = buildBookName(state.follow?.app || appOfPlan(state));
  const found = listModels().map(m => projectState(readModelEvents(m.id))).find(st => st.modelName === name);
  return found || null;
}

// The trail on a refined slice's page: its steps with where it stands (null for a slice that isn't refined)
export function specTrailOf(slice, state) {
  if (!slice?.refined) return null;
  const row = specStatus(state, localBuildBook(state)).find(r => r.sliceId === slice.id);
  if (!row) return null;
  const at = STEPS.indexOf(row.status);
  return { status: row.status, steps: STEPS.map((name, i) => ({ name, at: i < at ? 'past' : i === at ? 'now' : '' })) };
}
