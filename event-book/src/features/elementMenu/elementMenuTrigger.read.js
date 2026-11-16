// ELEMENT MENU - Element Menu Trigger (SV): in an automation's slice, whether this event is what wakes the processor up
// (null: not an event, not in an automation's slice, or no processor there)
import { sliceProcessor, isTrigger } from '../board/command.js';

export function elementMenuTrigger(book, elementId, sliceId) {
  const el = book.elements[elementId];
  const slice = sliceId && book.slices[sliceId];
  const processor = slice && el?.type === 'event' ? sliceProcessor(slice, book) : null;
  return processor ? { processorId: processor.id, name: processor.name, triggering: !!isTrigger(elementId, processor.id, book) } : null;
}
