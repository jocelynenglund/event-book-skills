// ===========================================
// REFERENCES - Reference Add Target: where "Add" on a reference goes: the open book when you can change it here;
// otherwise (on the bookshelves, where no book is open, or a read-only or build book) you pick one.
// ===========================================

import { projectState } from '../../core/projections.js';
import { readModelEvents, canEditCurrent, getCurrentModelId } from '../../core/eventStore.js';
import { isBuildBook } from '../buildVersions/rules.js';

// id: the reference. -> { id, target: the open book's name | null, label: 'Add to <book>' | 'Add to a book…', action: 'insert' | 'pick-book' }
export function referenceAddTarget(id, inLibrary = document.body.classList.contains('library-mode')) {
  const target = inLibrary || !canEditCurrent() || isBuildBook(readModelEvents(getCurrentModelId())) ? null : (projectState().modelName || 'Untitled model');
  return { id, target, label: target ? `Add to ${target}` : 'Add to a book…', action: target ? 'insert' : 'pick-book' };
}
