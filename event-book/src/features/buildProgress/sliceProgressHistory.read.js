// ===========================================
// BUILD PROGRESS - Slice Progress History (SV): every report on a slice, newest first, for the sheet a chip opens.
// ===========================================

import { sliceTitle } from '../../core/projections.js';
import { ago, stepLabel, stepIcon } from './sliceProgress.read.js';

// -> null (no such slice, or nothing reported), or { sliceId, title, entries: [{ step, icon, label, by, ago, at, note, pr }] }
export function sliceProgressHistory(state, sliceId, now = Date.now()) {
  const slice = state.slices[sliceId];
  const p = state.progress?.[sliceId];
  if (!slice || !p) return null;
  return {
    sliceId, title: sliceTitle(slice, state),
    entries: [...p.history].reverse().map(r => ({
      step: r.step, icon: stepIcon(r.step), label: stepLabel(r), by: r.by, ago: ago(r.at, now), at: r.at, note: r.note, pr: r.pr
    }))
  };
}
