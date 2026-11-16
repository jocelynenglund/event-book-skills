// ===========================================
// STATUS FILTER - the stage chips on the board and the outline, and the tap that picks one.
// The choice and the book's stages are stage.js; what the chips answer is Stage Filter Counts
// (stageFilterCounts.read.js); the chips are the Stage chips component (filter.parts.js).
// ===========================================

import { stageFilterCounts } from './stageFilterCounts.read.js';
import { stageChips } from './filter.parts.js';
import { chooseStage } from './stage.js';

export { filterFor, stageOf, statusFilter, filtering, shows, emptyText } from './stage.js';

// The chips, with how many slices are at each stage
export const statusChips = slices => stageChips(stageFilterCounts(slices));

export function initStatusFilter(render) {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-status-filter]');
    if (!t) return;
    chooseStage(t.dataset.statusFilter);
    render();
  });
}
