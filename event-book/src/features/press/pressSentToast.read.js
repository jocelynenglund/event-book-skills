// ===========================================
// PRESS - Press Sent Toast: the words after the ⋮ menu's Send to press or Stop the press.
// ===========================================

import { projectState } from '../../core/projections.js';

export function pressSentToast(send) {
  if (!send) return 'Stopped the press';
  const slices = projectState().press.slices;
  return `Sent to press: ${slices.length} ${slices.length === 1 ? 'slice' : 'slices'} for a builder`;
}
