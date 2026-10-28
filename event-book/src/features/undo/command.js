// ===========================================
// UNDO - Command
// ===========================================

import { popBatch, clearEvents, getCurrentModelId, canEditCurrent } from '../../core/eventStore.js';
import { undoBatch } from '../sync/client.js';
import { showToast } from '../../ui/toast.js';
import { render } from '../../ui/feed.js';

export function undo() {
  if (!canEditCurrent()) { showToast('Read-only here: check it out to edit'); return; }
  const popped = popBatch();
  if (popped.length) {
    undoBatch(getCurrentModelId(), popped[0].batch, popped.map(e => e.id));
    render();
    showToast('Undone');
  }
}

// A destructive action happens straight away, with a way back
export function toastWithUndo(message) {
  showToast(message, { action: 'Undo', onAction: undo });
}

export function clearAll() {
  if (!canEditCurrent()) { showToast('Read-only here: check it out to edit'); return; }
  if (!confirm('Clear all events?')) return;
  
  const count = clearEvents();
  render();
  showToast(`Cleared ${count} events`);
}
