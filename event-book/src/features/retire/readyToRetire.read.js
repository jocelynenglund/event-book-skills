// ===========================================
// RETIRE - SV: Ready To Retire — where a plan stands on being built, from its history: how many slices are built
// (SliceMarkedBuilt, until a SliceBuiltCleared) into which app's edition. Ready when every slice is built and it
// isn't retired yet. { modelId, app, edition, built, total, ready, retired, text } — text is the plan's mark:
// "built into wishbook · edition 4", or "1 of 2 built" while it is part way; empty when nothing is built.
// ===========================================

import { projectState } from '../../core/projections.js';
import { appOfPlan } from '../buildVersions/rules.js';

export function readyToRetire(events, modelId = null) {
  const state = projectState(events);
  const slices = state.sliceOrder.map(id => state.slices[id]).filter(Boolean);
  const built = slices.filter(s => s.built);
  const retired = state.retired;
  const full = slices.length > 0 && built.length === slices.length;
  // The edition it is built into: the newest the built slices were marked at
  const editions = built.map(s => s.builtEdition).filter(e => e != null);
  const app = retired?.app || state.follow?.app || appOfPlan(state) || null;
  const edition = retired?.edition ?? (editions.length ? Math.max(...editions) : null);
  const text = full ? `built into ${app || 'its app'}${edition != null ? ` · edition ${edition}` : ''}` : built.length ? `${built.length} of ${slices.length} built` : '';
  return { modelId, app, edition, built: built.length, total: slices.length, ready: full && !retired, retired: !!retired, text };
}
