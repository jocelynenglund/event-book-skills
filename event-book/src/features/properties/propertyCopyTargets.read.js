// PROPERTIES - Property Copy Targets (SV): the stickies linked to this one (by a connection either way, or a shared slice)
// that its properties can be copied to, ticked as the sheet has them; null when there is nothing to copy or nowhere to
import { byName, externalAttr, propLabel } from '../../core/constants.js';

export function propertyCopyTargets(book, elementId, ticked = new Set()) {
  const element = book.elements[elementId];
  const copyable = element ? element.properties.filter(p => !p.generated) : [];
  if (!element || !element.properties.length || !copyable.length) return null;
  const ids = new Set();
  book.connections
    .filter(c => c.from === elementId || c.to === elementId)
    .forEach(c => ids.add(c.from === elementId ? c.to : c.from));
  Object.values(book.slices)
    .filter(s => s.elements.includes(elementId))
    .forEach(s => s.elements.forEach(id => ids.add(id)));
  ids.delete(elementId);
  const targets = [...ids].map(id => book.elements[id]).filter(Boolean).sort(byName);
  if (!targets.length) return null;
  return {
    count: copyable.length, what: copyable.map(propLabel).join(', '), canCopy: ticked.size > 0,
    targets: targets.map(t => ({ id: t.id, type: t.type, attrs: externalAttr(t), name: t.name, ticked: ticked.has(t.id) }))
  };
}
