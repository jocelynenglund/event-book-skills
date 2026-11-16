// ===========================================
// SHARE IMAGE - Share File Name: what the downloaded picture is called, and the title the share sheet offers.
// The model's name, then the slice or chapters shared, as a file name.
// ===========================================

import { sliceTitle } from '../../core/projections.js';
import { scopeOf } from './scope.js';

// -> { title, base: 'sandwich-shop-ordering' }   (the caller adds -<n>.png for a slide)
export function shareFileName(state, scope = null) {
  const wanted = scopeOf(scope);
  const slice = wanted.slices && state.slices[wanted.slices[0]];
  const chapterNames = (wanted.chapters || []).map(id => state.chapters[id]?.name).filter(Boolean);
  const name = [state.modelName || 'event-model', slice ? sliceTitle(slice, state) : chapterNames.join(' ')].filter(Boolean).join(' ');
  return { title: state.modelName || 'Event model', base: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') };
}
