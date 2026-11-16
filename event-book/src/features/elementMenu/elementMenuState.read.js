// ELEMENT MENU - Element Menu State (SV): what a sticky is, as its ⋮ menu needs it: its name and kind and the marks it
// carries (external, legacy table, integration event, list, to-do); null when the sticky is gone
export function elementMenuState(book, elementId) {
  const el = book.elements[elementId];
  if (!el) return null;
  return { elementId, type: el.type, name: el.name, external: !!el.external, table: !!el.table, published: !!el.published, list: !!el.list, todo: !!el.todo };
}
