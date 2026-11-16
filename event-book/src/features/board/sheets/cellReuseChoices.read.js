// BOARD SHEETS - Cell Reuse Choices (SV): filling a cell of a slice: the stickies of that kind it doesn't have yet that can be
// reused (A to Z, each with how many slices use it), the words around the name box, and whether the top lane can switch
// between a screen and an automation. null when the slice is gone.
import { typeLabels, externalAttr, byName } from '../../../core/constants.js';
import { placeholders, searchKey } from './shared.js';

export const CHIP_LIMIT = 18;   // chips shown at once; the rest are found by typing

export function cellReuseChoices(book, sliceId, elementType) {
  const slice = book.slices[sliceId];
  if (!slice) return null;
  const reusable = Object.values(book.elements)
    .filter(el => el.type === elementType && !slice.elements.includes(el.id))
    .sort(byName);
  const usedIn = id => Object.values(book.slices).filter(s => s.elements.includes(id)).length;
  const label = typeLabels[elementType];
  const noun = reusable.length === 1 ? label.toLowerCase() : label.toLowerCase() + 's';
  return {
    sliceId, elementType, label, sliceName: slice.name || 'this slice',
    placeholder: reusable.length ? `Search or name a new ${label.toLowerCase()}` : (placeholders[elementType] || 'Name'),
    hint: reusable.length ? `${reusable.length} existing ${noun} · tap one to reuse it` : '',
    more: reusable.length > CHIP_LIMIT ? `+${reusable.length - CHIP_LIMIT} more — type to narrow` : '',
    hasChips: reusable.length > 0,
    chips: reusable.map((el, i) => ({ id: el.id, type: el.type, attrs: externalAttr(el), name: el.name, key: searchKey(el.name), usedIn: usedIn(el.id), hidden: i >= CHIP_LIMIT })),
    // The top lane of a view or change is driven by a person (screen) or the system (processor)
    actorSwitch: (elementType === 'screen' || elementType === 'processor') && slice.type !== 'AU'
  };
}
