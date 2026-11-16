// PROPERTIES - Property List Rows (SV): a sticky's properties as the sheet lists them; null when the sticky is gone
import { propLabel } from '../../core/constants.js';

export function propertyListRows(book, elementId, editingId = null) {
  const element = book.elements[elementId];
  if (!element) return null;
  const n = element.properties.length;
  return {
    elementId, name: element.name,
    heading: n ? `${n} ${n === 1 ? 'property' : 'properties'} · tap one to edit it` : null,
    rows: element.properties.map(p => ({ id: p.id, label: propLabel(p), type: p.type || 'string', generated: !!p.generated, active: p.id === editingId }))
  };
}
