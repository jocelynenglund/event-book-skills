// ===========================================
// READ-ONLY - Read Only Footer: what the footer of a read sheet says and offers. A build is read only, a plan
// starts from it; a published edition has nothing to check out, start the next draft; a book kept on the server
// is checked out (or taken over, or taken back from an agent editing it); a book that can be changed here offers Edit.
// ===========================================

import { isFrozenCurrent, getEventStream } from '../../core/eventStore.js';
import { isBuildBook } from '../buildVersions/rules.js';

// readOnly: the book can't be changed here. modelId: the open book. elementId, sliceId: the sticky shown.
// checkoutAction: what the header chip does (checkout / takeover). agent: who is editing it, when an agent is.
// -> { note, button, attr + value: the button's action (data-<attr>="<value>"), data: its other data attributes }
export function readOnlyFooter({ readOnly, modelId = '', elementId = '', sliceId = null, checkoutAction = null, agent = null }) {
  const model = { model: modelId || '' };
  if (!readOnly) return { note: '', button: 'Edit', attr: 'data-board-action', value: 'read-edit', data: { el: elementId, slice: sliceId || '' } };
  // A build: never checked out, a plan starts from it
  if (isBuildBook(getEventStream())) return { note: 'A build: read only', button: 'Start a plan from this build', attr: 'data-title-action', value: 'plan', data: model };
  // A published edition: nothing to check out, start the next draft instead
  if (isFrozenCurrent()) return { note: 'Published: read only', button: 'Start next draft', attr: 'data-library-action', value: 'next-draft', data: model };
  const action = checkoutAction || 'checkout';
  return {
    note: agent ? `${agent} is editing, read only here` : 'Read-only here',
    button: agent ? 'Take back' : action === 'takeover' ? '🔒 Take over to edit' : '☁ Check out to edit',
    attr: 'data-sync-action', value: action, data: model
  };
}
