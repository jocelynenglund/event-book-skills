// PROPERTIES - Property Edit Form (SV): the property being edited, as its form fills in (null: none, or gone)
export function propertyEditForm(book, elementId, propertyId) {
  const p = book.elements[elementId]?.properties.find(x => x.id === propertyId);
  if (!p) return null;
  const type = p.type || 'string';
  return { id: p.id, name: p.name, type, items: p.items || [], itemsText: (p.items || []).join(', '), isArray: type === 'array', generated: !!p.generated };
}
