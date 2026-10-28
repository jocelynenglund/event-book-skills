// ===========================================
// DELETE ELEMENT - Command
// ===========================================

import { appendEvent, EventTypes } from '../../core/eventStore.js';
import { projectState } from '../../core/projections.js';
import { render } from '../../ui/feed.js';
import { toastWithUndo } from '../undo/command.js';

export function deleteElement(elementId) {
  const state = projectState();
  const element = state.elements[elementId];
  
  if (!element) return;
  
  
  // Remove from every slice that holds it
  Object.values(state.slices)
    .filter(s => s.elements.includes(elementId) && !s.id.startsWith('au_inferred_'))
    .forEach(slice => {
      appendEvent(EventTypes.SliceElementRemoved, {
        sliceId: slice.id,
        elementId
      });

      // Inferred slices with < 2 elements left are gone; board-created slices stay
      const remainingElements = slice.elements.filter(id => id !== elementId);
      if (!slice.created && remainingElements.length < 2) {
        appendEvent(EventTypes.SliceDeleted, {
          sliceId: slice.id
        });
      }
    });

  // Delete the element
  appendEvent(EventTypes.ElementDeleted, {
    elementId
  });
  
  toastWithUndo(`${element.name} deleted`);
  render();
}
