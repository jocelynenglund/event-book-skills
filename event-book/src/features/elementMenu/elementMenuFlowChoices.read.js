// ELEMENT MENU - Element Menu Flow Choices (SV): an outcome event can belong to a flow, so the main line reads as the happy
// case. The choices (every flow, the main line only, each flow) with the current one on; null unless this is an event in a
// chapter's slice on the main line (in a flow's own slices every outcome shows, so it isn't offered there).
import { chapterFlows, elementFlow, sliceFlow } from '../../core/projections.js';

export function elementMenuFlowChoices(book, elementId, sliceId) {
  const el = book.elements[elementId];
  const slice = sliceId && book.slices[sliceId];
  const flows = el?.type === 'event' && slice?.chapterId && !sliceFlow(slice, book) ? chapterFlows(slice.chapterId, book) : [];
  if (!flows.length) return null;
  const current = elementFlow(el, slice, book);
  return {
    choices: [
      { flowId: '', label: 'Every flow', on: !current },
      { flowId: 'main', label: 'Main line only', on: current?.id === 'main' },
      ...flows.map(f => ({ flowId: f.id, label: `↳ ${f.name}`, on: current?.id === f.id }))
    ]
  };
}
