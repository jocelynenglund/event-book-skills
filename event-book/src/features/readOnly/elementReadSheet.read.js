// ===========================================
// READ-ONLY - Element Read Sheet: a sticky, to read: its kind, name and description, its fields (and whether the
// board folds them), its flags and the slices it's in. Null for a sticky that is gone. Replays the book once.
// ===========================================

import { projectState, getOrderedSlices, sliceTitle } from '../../core/projections.js';
import { elementLabel, externalAttr, propLabel, typeIcons } from '../../core/constants.js';
import { fieldsFolded } from '../board/foldedFields.js';

export function elementReadSheet(elementId) {
  const state = projectState();
  const el = state.elements[elementId];
  if (!el) return null;
  const props = el.properties || [];
  const slices = getOrderedSlices(state).filter(s => s.elements.includes(el.id));
  return {
    id: el.id, type: el.type, attrs: externalAttr(el), kind: `${typeIcons[el.type] || ''} ${elementLabel(el)}`, name: el.name, description: el.description || '',
    fields: props.map(p => ({ label: propLabel(p), type: p.type || 'string', generated: !!p.generated })),
    foldLabel: props.length ? (fieldsFolded(el.id) ? 'Show on the board' : 'Fold on the board') : null,
    flags: [
      el.type === 'event' && el.external ? 'From another system (external)' : '',
      el.type === 'readModel' && el.list ? 'A list' : '',
      el.todo ? 'A to-do list (a processor works through it)' : ''
    ].filter(Boolean),
    slicesHeading: `In ${slices.length === 1 ? 'slice' : 'slices'}`,
    slices: slices.map(s => sliceTitle(s, state))
  };
}
