// ===========================================
// READ-ONLY - Read Only Slice Menu: what the ⋮ on a slice offers in a book that can't be changed here.
// Only sharing: the slice as a picture.
// ===========================================

import { sliceTitle } from '../../core/projections.js';
import { sliceTypeLabels } from '../board/boardSliceHeaderFields.read.js';

// -> null when the slice is gone, else { sliceId, typeLabel, share: { title, desc } }
export function readOnlySliceMenu(book, sliceId) {
  const slice = book.slices[sliceId];
  if (!slice) return null;
  return { sliceId, typeLabel: sliceTypeLabels[slice.type] || 'Slice', share: { title: 'Share as picture…', desc: `A picture of ${sliceTitle(slice, book)}` } };
}
