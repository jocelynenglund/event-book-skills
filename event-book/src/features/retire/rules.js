// ===========================================
// RETIRE - SC: Retire Plan — a plan whose every slice is built is put away. PlanRetired { modelId, app, edition,
// retiredAt } goes onto the plan's own book, which is read only from then on (editions/rules.js isFrozen) and
// never deleted. Pure over the plan's history: { events } or { refused }.
// ===========================================

import { readyToRetire } from './readyToRetire.read.js';

export function retirePlan(history, { modelId = null, now = new Date().toISOString() } = {}) {
  const v = readyToRetire(history, modelId);
  if (v.retired) return { refused: 'Already retired' };
  if (!v.ready) return { refused: `${v.built} of ${v.total} slices built: retire it once every slice is built` };
  return { events: [{ type: 'PlanRetired', data: { modelId, app: v.app, edition: v.edition, retiredAt: now } }] };
}
