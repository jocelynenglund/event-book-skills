// ===========================================
// BOARD - Slice header (SV: Board Slice Header Fields)
// What the head of a slice's column says: its type, scenario count, flow, title, number, build chip,
// usage, whether it was waived, and where it can move to.
// ===========================================

import { getScenariosForSlice, boardBuildChip, sliceTitle, sliceRef, sliceFlow } from '../../core/projections.js';
import { sliceActor } from './command.js';
import { usageBadge } from '../usage/view.js';
import { sliceProgress } from '../buildProgress/sliceProgress.read.js';

export const sliceTypeLabels = { SC: 'State change', SV: 'State view', AU: 'Automation' };

// col: the column from the layout ({ slice, prev, next })
export function boardSliceHeaderFields(state, col) {
  const slice = col.slice;
  const flow = sliceFlow(slice, state);
  return {
    sliceId: slice.id, ref: sliceRef(state, slice.id), title: sliceTitle(slice, state), type: slice.type,
    typeLabel: sliceTypeLabels[slice.type] || slice.type,
    actor: sliceActor(slice, state),
    scenarios: getScenariosForSlice(slice.id, state).length,
    flow: flow ? flow.name : null,
    usage: usageBadge(slice, state),
    chip: boardBuildChip(state, slice.id),
    progress: sliceProgress(state, slice.id),
    waived: slice.waived || null,
    movable: state.sliceOrder.includes(slice.id), prev: col.prev, next: col.next
  };
}
