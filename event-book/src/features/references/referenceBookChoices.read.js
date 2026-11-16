// ===========================================
// REFERENCES - Reference Book Choices: the books you can change on this device (not build books) that a
// reference can be added to, A to Z.
// ===========================================

import { projectState } from '../../core/projections.js';
import { listModels, readModelEvents } from '../../core/eventStore.js';
import { canEdit } from '../sync/client.js';
import { isBuildBook } from '../buildVersions/rules.js';
import { byName } from '../../ui/byName.js';

// refId: the reference. -> [{ refId, id, name }]
export function referenceBookChoices(refId) {
  return listModels().filter(m => canEdit(m.id) && !isBuildBook(readModelEvents(m.id)))
    .map(m => ({ refId, id: m.id, name: projectState(readModelEvents(m.id)).modelName || 'Untitled model' }))
    .sort(byName);
}
