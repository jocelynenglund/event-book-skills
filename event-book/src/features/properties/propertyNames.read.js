// PROPERTIES - Property Names (SV): the names a sticky has already (null: it is gone), so adding skips them
export function propertyNames(book, elementId) {
  const element = book.elements[elementId];
  return element ? element.properties.map(p => p.name) : null;
}
