// ELEMENT MENU - Element Menu Consumers (SV): for an integration event, who it is published to, as the comma-separated
// text the menu's field shows. null for anything else (not an event, not published, or an external event).
export function elementMenuConsumers(book, elementId) {
  const el = book.elements[elementId];
  if (el?.type !== 'event' || !el.published || el.external) return null;
  return { elementId, to: (el.to || []).join(', ') };
}
