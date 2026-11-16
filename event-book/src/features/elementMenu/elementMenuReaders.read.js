// ELEMENT MENU - Element Menu Readers (SV): for an event, the read models it updates, wherever they are, each with the slice
// it is in (null: not on the board). null for any other kind of sticky.
import { getOrderedSlices } from '../../core/projections.js';

export function elementMenuReaders(book, elementId) {
  const el = book.elements[elementId];
  if (el?.type !== 'event') return null;
  const slices = getOrderedSlices(book);
  const readers = [...new Set(book.connections.filter(c => c.from === elementId && c.relation === 'consumer').map(c => c.to))]
    .map(id => book.elements[id]).filter(rm => rm?.type === 'readModel');
  return {
    label: readers.length ? `Updates ${readers.length} read ${readers.length === 1 ? 'model' : 'models'}` : 'No read model uses this event yet',
    readers: readers.map(rm => ({ id: rm.id, name: rm.name, todo: !!rm.todo, where: slices.find(s => s.elements.includes(rm.id))?.name || null }))
  };
}
