// PROPERTIES - Property Downstream Targets (SV): where new fields usually belong too, ticked when the sheet opens:
// a command's and a read model's fields live on their events; an event's flow on to its read models; a screen's to its command.
// Stickies of that kind linked to this one by a connection in either direction (older models store some links reversed) or
// by sharing a slice; automation slices and trigger links are skipped (a processor's trigger event isn't what its command produces).
const propagationTypes = { command: 'event', readModel: 'event', event: 'readModel', screen: 'command' };

export function propertyDownstreamTargets(book, elementId) {
  const el = book.elements[elementId];
  const targetType = el && propagationTypes[el.type];
  if (!targetType) return [];
  const ids = new Set();
  book.connections
    .filter(c => (c.from === elementId || c.to === elementId) && c.relation !== 'trigger')
    .forEach(c => ids.add(c.from === elementId ? c.to : c.from));
  Object.values(book.slices)
    .filter(s => s.type !== 'AU' && s.elements.includes(elementId))
    .forEach(s => s.elements.forEach(id => ids.add(id)));
  return [...ids].filter(id => id !== elementId && book.elements[id]?.type === targetType);
}
