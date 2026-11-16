// ===========================================
// REFERENCES - Reference Book: a reference book open to read: each slice with its stickies and fields, its
// scenarios folded to their names. Nothing here changes it. Null for a reference that is gone.
// ===========================================

import { getOrderedSlices, getScenariosForSlice, sliceTitle } from '../../core/projections.js';
import { elementLabel, externalAttr, propLabel } from '../../core/constants.js';
import { renderGwt } from '../scenarios/view.js';
import { sliceTypeLabels } from '../board/view.js';
import { listReferences, referenceState } from './store.js';
import { referenceSummary } from './referenceShelf.read.js';

// -> { id, name, summary, slices: [{ type, typeLabel, title, description, stickies: [{ type, attrs, kind, name, fields }],
//      scenarios: [{ name, mustHave, gwt }] }] } | null
export function referenceBook(id) {
  const ref = listReferences().find(r => r.id === id);
  if (!ref) return null;
  const { state } = referenceState(ref);
  return {
    id, name: ref.name, summary: referenceSummary(ref),
    slices: getOrderedSlices(state).map(slice => ({
      type: slice.type, typeLabel: sliceTypeLabels[slice.type] || slice.type, title: sliceTitle(slice, state), description: slice.description || '',
      stickies: slice.elements.map(e => state.elements[e]).filter(Boolean).map(el => ({
        type: el.type, attrs: externalAttr(el), kind: elementLabel(el), name: el.name, fields: (el.properties || []).map(propLabel)
      })),
      scenarios: getScenariosForSlice(slice.id, state).map(scn => ({ name: scn.name || 'Scenario', mustHave: !!scn.mustHave, gwt: renderGwt(scn, state) }))
    }))
  };
}
